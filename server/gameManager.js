const ROOM_CODE_LENGTH = 6;

const DEFAULT_SETTINGS = {
  gameMode: "spotify_playlist",
  roundDuration: 10,
  totalRounds: 8,
  roundMode: "audio",
  genre: "Top Hits",
  playlistUrl: "",
  playlistName: "",
  importedCount: 0
};

const rooms = new Map();
const spotifyHostTokens = new Map();

function randomId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function generateRoomCode() {
  let code = "";

  while (!code || rooms.has(code)) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  }

  return code;
}

function shuffle(list) {
  const clone = [...list];

  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }

  return clone;
}

function sanitizeName(name) {
  return (name || "Guest").trim().slice(0, 24) || "Guest";
}

function sanitizeSong(song, index = 0) {
  return {
    id:
      song.id ||
      `${song.title}-${song.artist}-${index}`.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    title: song.title,
    artist: song.artist,
    preview_url: song.preview_url,
    cover: song.cover,
    apple_music_url: song.apple_music_url || "",
    lyricSnippet: song.lyricSnippet || ""
  };
}

function createPlayer({ socketId, name, playerId, isHost = false }) {
  return {
    id: playerId || randomId("player"),
    socketId,
    name: sanitizeName(name),
    avatarSeed: randomId("avatar"),
    isHost,
    score: 0,
    connected: true,
    lastAnswerAt: null
  };
}

function serializeRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    phase: room.phase,
    settings: { ...room.settings },
    players: room.players
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatarSeed: player.avatarSeed,
        score: player.score,
        isHost: player.isHost,
        connected: player.connected
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    songPoolSize: room.songPool.length,
    spotifyConnected: spotifyHostTokens.has(room.hostId),
    currentRound: room.game.currentRound,
    totalRounds: room.game.totalRounds,
    leaderboard: room.players
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatarSeed: player.avatarSeed,
        score: player.score,
        isHost: player.isHost
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  };
}

function ensureRoom(code) {
  const room = rooms.get(code);

  if (!room) {
    throw new Error("Room not found.");
  }

  return room;
}

function ensureHost(room, playerId) {
  if (room.hostId !== playerId) {
    throw new Error("Only the host can perform this action.");
  }
}

function getPlayer(room, playerId) {
  const player = room.players.find((entry) => entry.id === playerId);

  if (!player) {
    throw new Error("Player not found in this room.");
  }

  return player;
}

function pickWrongOptions(songPool, correctSong) {
  return shuffle(songPool.filter((song) => song.id !== correctSong.id)).slice(0, 3);
}

function createRoundPayload(room, roundSong) {
  const wrongOptions = pickWrongOptions(room.songPool, roundSong);

  if (wrongOptions.length < 3) {
    throw new Error("Need at least 4 playable songs to start a game.");
  }

  const options = shuffle([
    { id: roundSong.id, label: `${roundSong.title} — ${roundSong.artist}` },
    ...wrongOptions.map((song) => ({
      id: song.id,
      label: `${song.title} — ${song.artist}`
    }))
  ]);

  const startAt = Date.now() + 1200;
  const endAt = startAt + room.settings.roundDuration * 1000;

  room.phase = "playing";
  room.game.currentRound += 1;
  room.game.currentRoundData = {
    id: randomId("round"),
    song: roundSong,
    options,
    answers: new Map(),
    startAt,
    endAt
  };
  room.game.usedSongIds.add(roundSong.id);

  return {
    roundNumber: room.game.currentRound,
    totalRounds: room.game.totalRounds,
    roundId: room.game.currentRoundData.id,
    startAt,
    endAt,
    duration: room.settings.roundDuration,
    mode: room.settings.roundMode,
    preview_url: room.settings.roundMode === "audio" ? roundSong.preview_url : "",
    lyricSnippet:
      room.settings.roundMode === "lyric"
        ? roundSong.lyricSnippet || "Lyric mode placeholder. Add a lyric provider when you are ready."
        : "",
    options
  };
}

function selectRoundSong(room) {
  const availableSongs = room.songPool.filter((song) => !room.game.usedSongIds.has(song.id));
  const source = availableSongs.length ? availableSongs : room.songPool;
  return shuffle(source)[0];
}

export function createRoom({ socketId, name, playerId, avatarSeed }) {
  const code = generateRoomCode();
  const host = createPlayer({ socketId, name, playerId, isHost: true });
  host.avatarSeed = avatarSeed || host.avatarSeed;

  const room = {
    code,
    hostId: host.id,
    phase: "lobby",
    players: [host],
    settings: { ...DEFAULT_SETTINGS },
    songPool: [],
    game: {
      currentRound: 0,
      totalRounds: DEFAULT_SETTINGS.totalRounds,
      usedSongIds: new Set(),
      currentRoundData: null
    }
  };

  rooms.set(code, room);

  return { room, player: host };
}

export function joinRoom({ code, socketId, name, playerId, avatarSeed }) {
  const room = ensureRoom(code);
  let player = room.players.find((entry) => entry.id === playerId);

  if (player) {
    player.socketId = socketId;
    player.connected = true;
    player.name = sanitizeName(name || player.name);
    player.avatarSeed = avatarSeed || player.avatarSeed;
  } else {
    player = createPlayer({ socketId, name, playerId, isHost: false });
    player.avatarSeed = avatarSeed || player.avatarSeed;
    room.players.push(player);
  }

  return { room, player };
}

export function updateName({ code, playerId, name }) {
  const room = ensureRoom(code);
  const player = getPlayer(room, playerId);

  player.name = sanitizeName(name);

  return room;
}

export function updateAvatar({ code, playerId, avatarSeed }) {
  const room = ensureRoom(code);
  const player = getPlayer(room, playerId);

  player.avatarSeed = avatarSeed || player.avatarSeed;

  return room;
}

export function updateSettings({ code, playerId, settings }) {
  const room = ensureRoom(code);
  ensureHost(room, playerId);

  room.settings = {
    ...room.settings,
    ...settings,
    roundDuration: Number(settings.roundDuration ?? room.settings.roundDuration),
    totalRounds: Number(settings.totalRounds ?? room.settings.totalRounds)
  };
  room.game.totalRounds = room.settings.totalRounds;

  return room;
}

export function setPlaylistSongs({ code, playerId, songs, playlistUrl, playlistName }) {
  const room = ensureRoom(code);
  ensureHost(room, playerId);

  room.songPool = shuffle(songs.map(sanitizeSong));
  room.settings = {
    ...room.settings,
    gameMode: "spotify_playlist",
    playlistUrl,
    playlistName,
    importedCount: room.songPool.length
  };

  return room;
}

export function setSpotifyAuth({ playerId, tokens }) {
  spotifyHostTokens.set(playerId, tokens);
}

export function getSpotifyAuth(playerId) {
  return spotifyHostTokens.get(playerId) || null;
}

export function clearSpotifyAuth(playerId) {
  spotifyHostTokens.delete(playerId);
}

export function setModeSongs({ code, songs, mode }) {
  const room = ensureRoom(code);

  room.songPool = shuffle(songs.map(sanitizeSong));
  room.settings = {
    ...room.settings,
    genre: mode,
    importedCount: room.songPool.length
  };

  return room;
}

export function startGame({ code, playerId }) {
  const room = ensureRoom(code);
  ensureHost(room, playerId);

  if (room.songPool.length < 4) {
    throw new Error("Need at least 4 playable songs before starting the game.");
  }

  room.players.forEach((player) => {
    player.score = 0;
    player.lastAnswerAt = null;
  });

  room.phase = "playing";
  room.game = {
    currentRound: 0,
    totalRounds: room.settings.totalRounds,
    usedSongIds: new Set(),
    currentRoundData: null
  };

  return room;
}

export function nextRound(code) {
  const room = ensureRoom(code);

  if (room.game.currentRound >= room.game.totalRounds) {
    return null;
  }

  const roundSong = selectRoundSong(room);
  return createRoundPayload(room, roundSong);
}

export function submitAnswer({ code, playerId, optionId }) {
  const room = ensureRoom(code);
  const player = getPlayer(room, playerId);
  const round = room.game.currentRoundData;

  if (!round) {
    throw new Error("No round is active.");
  }

  if (Date.now() < round.startAt || Date.now() > round.endAt) {
    return room;
  }

  if (!round.answers.has(playerId)) {
    round.answers.set(playerId, {
      optionId,
      submittedAt: Date.now()
    });
    player.lastAnswerAt = Date.now();
  }

  return room;
}

export function revealRound(code) {
  const room = ensureRoom(code);
  const round = room.game.currentRoundData;

  if (!round) {
    throw new Error("No round to reveal.");
  }

  room.phase = "reveal";

  for (const player of room.players) {
    const answer = round.answers.get(player.id);

    if (!answer || answer.optionId !== round.song.id) {
      continue;
    }

    const remainingTime = Math.max(0, Math.floor((round.endAt - answer.submittedAt) / 1000));
    player.score += 100 + remainingTime * 10;
  }

  const leaderboard = serializeRoom(room).leaderboard;
  const revealPayload = {
    roundNumber: room.game.currentRound,
    totalRounds: room.game.totalRounds,
    song: round.song,
    correctOptionId: round.song.id,
    leaderboard
  };

  room.game.currentRoundData = null;

  return {
    reveal: revealPayload,
    leaderboard,
    gameEnded: room.game.currentRound >= room.game.totalRounds
  };
}

export function endGame(code) {
  const room = ensureRoom(code);
  room.phase = "finished";
  return serializeRoom(room);
}

export function handleDisconnect(socketId) {
  let affectedRoom = null;

  for (const room of rooms.values()) {
    const player = room.players.find((entry) => entry.socketId === socketId);

    if (!player) {
      continue;
    }

    player.connected = false;
    affectedRoom = room;

    if (room.hostId === player.id) {
      const nextHost = room.players.find((entry) => entry.id !== player.id && entry.connected);

      if (nextHost) {
        player.isHost = false;
        nextHost.isHost = true;
        room.hostId = nextHost.id;
      }
    }

    break;
  }

  return affectedRoom;
}

export function removeEmptyRooms() {
  return rooms;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function getRoomSnapshot(code) {
  return serializeRoom(ensureRoom(code));
}
