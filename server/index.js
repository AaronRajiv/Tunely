import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import {
  clearSpotifyAuth,
  createRoom,
  endGame,
  getSpotifyAuth,
  getRoom,
  getRoomSnapshot,
  handleDisconnect,
  haveAllConnectedPlayersAnswered,
  joinRoom,
  leaveRoom,
  nextRound,
  removeEmptyRooms,
  revealRound,
  setModeSongs,
  setPlaylistSongs,
  setSpotifyAuth,
  startGame,
  submitAnswer,
  updateReady,
  updateAvatar,
  updateName,
  updateSettings
} from "./gameManager.js";
import {
  fetchDefaultModeTracks,
  importAppleCuratedPlaylist,
  createSpotifyAuthUrl,
  exchangeCodeForTokens,
  importSpotifyPlaylist,
  listAppleCuratedPlaylists
} from "./spotifyService.js";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = Number(process.env.PORT || 4000);
const REVEAL_DURATION_MS = 5500;
const roomTimers = new Map();
const spotifyAuthStates = new Map();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000"
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/apple/curated", (_req, res) => {
  res.json({
    success: true,
    playlists: listAppleCuratedPlaylists()
  });
});

app.get("/auth/spotify/start", (req, res) => {
  try {
    const { roomCode, playerId } = req.query;

    if (!roomCode || !playerId) {
      throw new Error("Missing room code or player id.");
    }

    const room = getRoom(roomCode);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.hostId !== playerId) {
      throw new Error("Only the host can connect Spotify.");
    }

    const state = Math.random().toString(36).slice(2, 12);
    spotifyAuthStates.set(state, {
      roomCode,
      playerId,
      createdAt: Date.now()
    });

    res.redirect(createSpotifyAuthUrl(state));
  } catch (error) {
    const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
    res.redirect(`${clientUrl}/room/${req.query.roomCode || ""}?spotify_error=${encodeURIComponent(error.message)}`);
  }
});

app.get("/auth/spotify/callback", async (req, res) => {
  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
  let redirectRoomCode = "";

  try {
    const { code, state, error } = req.query;

    if (error) {
      throw new Error(`Spotify authorization failed: ${error}`);
    }

    const authState = spotifyAuthStates.get(state);

    if (!authState) {
      throw new Error("Spotify auth session expired. Try again.");
    }

    spotifyAuthStates.delete(state);
    redirectRoomCode = authState.roomCode;

    const room = getRoom(authState.roomCode);

    if (!room || room.hostId !== authState.playerId) {
      throw new Error("Room or host session no longer valid.");
    }

    const tokens = await exchangeCodeForTokens(code);
    setSpotifyAuth({
      playerId: authState.playerId,
      tokens
    });

    io.to(authState.roomCode).emit("settings_updated", getRoomSnapshot(authState.roomCode));

    res.redirect(`${clientUrl}/room/${authState.roomCode}?spotify=connected`);
  } catch (callbackError) {
    res.redirect(
      `${clientUrl}/room/${redirectRoomCode}?spotify_error=${encodeURIComponent(callbackError.message)}`
    );
  }
});

app.post("/api/library/import", async (req, res) => {
  try {
    const { roomCode, playerId, playlistUrl, source } = req.body;
    const room = getRoom(roomCode);

    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.hostId !== playerId) {
      throw new Error("Only the host can import a playlist.");
    }

    let imported;

    if (source === "apple_curated") {
      imported = await importAppleCuratedPlaylist(playlistUrl);
    } else {
      const spotifyTokens = getSpotifyAuth(playerId);

      if (!spotifyTokens) {
        throw new Error("Connect Spotify as the host before importing a playlist.");
      }

      imported = await importSpotifyPlaylist(playlistUrl, spotifyTokens);
      setSpotifyAuth({
        playerId,
        tokens: imported.tokens
      });
    }

    const updatedRoom = setPlaylistSongs({
      code: roomCode,
      playerId,
      songs: imported.songs,
      playlistUrl,
      playlistName: imported.playlistName,
      playlistCover: imported.playlistCover || "",
      sourceTrackCount: imported.sourceTrackCount || imported.songs.length,
      gameMode: imported.source === "apple_curated" ? "apple_curated" : "spotify_playlist"
    });

    io.to(roomCode).emit("settings_updated", getRoomSnapshot(updatedRoom.code));

    res.json({
      success: true,
      playlistName: imported.playlistName,
      songsImported: updatedRoom.songPool.length,
      sourceTrackCount: imported.sourceTrackCount || imported.songs.length,
      playlistCover: imported.playlistCover || "",
      source: imported.source || source || "spotify"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to import playlist."
    });
  }
});

function clearRoomTimers(roomCode) {
  const timers = roomTimers.get(roomCode);

  if (!timers) {
    return;
  }

  clearTimeout(timers.roundTimeout);
  clearTimeout(timers.nextRoundTimeout);
  clearInterval(timers.timerInterval);
  roomTimers.delete(roomCode);
}

function emitRoomUpdate(roomCode) {
  io.to(roomCode).emit("player_list_updated", getRoomSnapshot(roomCode));
}

function concludeRound(roomCode, timers) {
  if (timers?.timerInterval) {
    clearInterval(timers.timerInterval);
  }
  if (timers?.roundTimeout) {
    clearTimeout(timers.roundTimeout);
  }

  const result = revealRound(roomCode);

  io.to(roomCode).emit("reveal_answer", result.reveal);
  io.to(roomCode).emit("leaderboard_update", result.leaderboard);

  if (result.gameEnded) {
    const finishedRoom = endGame(roomCode);
    io.to(roomCode).emit("game_ended", finishedRoom);
    clearRoomTimers(roomCode);
    return;
  }

  timers.nextRoundTimeout = setTimeout(() => {
    scheduleRound(roomCode);
  }, REVEAL_DURATION_MS);

  roomTimers.set(roomCode, timers);
}

function scheduleRound(roomCode) {
  clearRoomTimers(roomCode);

  try {
    const round = nextRound(roomCode);

    if (!round) {
      const finishedRoom = endGame(roomCode);
      io.to(roomCode).emit("game_ended", finishedRoom);
      return;
    }

    io.to(roomCode).emit("new_round", round);

    const timers = {};

    timers.timerInterval = setInterval(() => {
      const secondsLeft = Math.max(0, Math.ceil((round.endAt - Date.now()) / 1000));
      io.to(roomCode).emit("round_timer", {
        roundId: round.roundId,
        secondsLeft,
        endAt: round.endAt
      });
    }, 1000);

    timers.roundTimeout = setTimeout(() => {
      concludeRound(roomCode, timers);
    }, Math.max(0, round.endAt - Date.now()));

    roomTimers.set(roomCode, timers);
  } catch (error) {
    io.to(roomCode).emit("error_message", { message: error.message });
  }
}

io.on("connection", (socket) => {
  socket.on("create_room", ({ name, playerId, avatarSeed }) => {
    try {
      const { room, player } = createRoom({
        socketId: socket.id,
        name,
        playerId,
        avatarSeed
      });

      socket.join(room.code);
      socket.emit("room_created", {
        room: getRoomSnapshot(room.code),
        playerId: player.id
      });
      emitRoomUpdate(room.code);
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("join_room", ({ roomCode, name, playerId, avatarSeed }) => {
    try {
      const { room, player } = joinRoom({
        code: roomCode,
        socketId: socket.id,
        name,
        playerId,
        avatarSeed
      });

      socket.join(room.code);
      socket.emit("room_joined", {
        room: getRoomSnapshot(room.code),
        playerId: player.id
      });
      emitRoomUpdate(room.code);
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("update_name", ({ roomCode, playerId, name }) => {
    try {
      updateName({ code: roomCode, playerId, name });
      emitRoomUpdate(roomCode);
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("update_avatar", ({ roomCode, playerId, avatarSeed }) => {
    try {
      updateAvatar({ code: roomCode, playerId, avatarSeed });
      emitRoomUpdate(roomCode);
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("update_ready", ({ roomCode, playerId, ready }) => {
    try {
      updateReady({ code: roomCode, playerId, ready });
      emitRoomUpdate(roomCode);
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("update_settings", ({ roomCode, playerId, settings }) => {
    try {
      updateSettings({ code: roomCode, playerId, settings });
      io.to(roomCode).emit("settings_updated", getRoomSnapshot(roomCode));
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("leave_room", ({ roomCode, playerId }) => {
    try {
      socket.leave(roomCode);
      leaveRoom({ code: roomCode, playerId, socketId: socket.id });
      emitRoomUpdate(roomCode);
      removeEmptyRooms();
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("start_game", async ({ roomCode, playerId }) => {
    try {
      const room = getRoom(roomCode);

      if (!room) {
        throw new Error("Room not found.");
      }

      if (room.hostId !== playerId) {
        throw new Error("Only the host can start the game.");
      }

      if (room.settings.gameMode === "default_mode") {
        const songs = await fetchDefaultModeTracks(room.settings.genre);
        setModeSongs({
          code: roomCode,
          songs,
          mode: room.settings.genre
        });
      }

      startGame({ code: roomCode, playerId });

      io.to(roomCode).emit("game_started", getRoomSnapshot(roomCode));
      scheduleRound(roomCode);
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("submit_answer", ({ roomCode, playerId, optionId }) => {
    try {
      submitAnswer({ code: roomCode, playerId, optionId });
      emitRoomUpdate(roomCode);

      if (haveAllConnectedPlayersAnswered(roomCode)) {
        const timers = roomTimers.get(roomCode);

        if (timers) {
          concludeRound(roomCode, timers);
        }
      }
    } catch (error) {
      socket.emit("error_message", { message: error.message });
    }
  });

  socket.on("disconnect", () => {
    const room = handleDisconnect(socket.id);

    if (!room) {
      return;
    }

    emitRoomUpdate(room.code);

    if (room.players.every((player) => !player.connected)) {
      room.players.forEach((player) => clearSpotifyAuth(player.id));
      clearRoomTimers(room.code);
      removeEmptyRooms();
    }
  });
});

server.listen(PORT, () => {
  console.log(`Tunely server running on http://localhost:${PORT}`);
});
