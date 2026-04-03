const ROOM_CODE_LENGTH = 6;
const HOST_RECONNECT_GRACE_MS = 3 * 60 * 1000;
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;

const DEFAULT_SETTINGS = {
  gameMode: "spotify_playlist",
  roundDuration: 10,
  totalRounds: 8,
  roundMode: "audio",
  genre: "Top Hits",
  playlistUrl: "",
  playlistName: "",
  playlistCover: "",
  sourceTrackCount: 0,
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
    ready: isHost,
    connected: true,
    lastAnswerAt: null,
    stats: {
      answersSubmitted: 0,
      correctAnswers: 0,
      fastestAnswers: 0,
      totalResponseMs: 0,
      currentStreak: 0,
      bestStreak: 0
    }
  };
}

function serializeRoom(room) {
  const answeredIds = room.game.currentRoundData
    ? new Set(room.game.currentRoundData.answers.keys())
    : new Set();
  const connectedPlayers = room.players.filter((player) => player.connected);
  const host = room.players.find((player) => player.id === room.hostId);

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
        connected: player.connected,
        ready: player.ready,
        hasAnswered: answeredIds.has(player.id)
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    songPoolSize: room.songPool.length,
    spotifyConnected: spotifyHostTokens.has(room.hostId),
    currentRound: room.game.currentRound,
    totalRounds: room.game.totalRounds,
    hostConnected: Boolean(host?.connected),
    hostReconnectGraceRemainingMs:
      host && !host.connected && room.hostReconnectGraceUntil
        ? Math.max(0, room.hostReconnectGraceUntil - Date.now())
        : 0,
    answerProgress: {
      connectedCount: connectedPlayers.length,
      answeredCount: connectedPlayers.filter((player) => answeredIds.has(player.id)).length,
      readyCount: connectedPlayers.filter((player) => player.ready).length,
      waitingPlayerIds: connectedPlayers
        .filter((player) => !answeredIds.has(player.id))
        .map((player) => player.id),
      allReady: connectedPlayers.every((player) => player.ready)
    },
    leaderboard: room.players
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatarSeed: player.avatarSeed,
        score: player.score,
        isHost: player.isHost,
        connected: player.connected,
        ready: player.ready,
        hasAnswered: answeredIds.has(player.id),
        stats: { ...player.stats }
      }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)),
    awards: room.phase === "finished" ? buildPlayerAwards(room.players) : null
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

  const startAt = Date.now() + 5000;
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

function buildPlayerAwards(players) {
  if (!players.length) {
    return {};
  }

  const ranked = [...players];
  const byMetric = (metric, fallback = 0) =>
    ranked.reduce((best, player) => {
      const value = metric(player);

      if (!best || value > best.value) {
        return { id: player.id, value: value ?? fallback };
      }

      return best;
    }, null);

  const accuracyWinner = byMetric((player) =>
    player.stats.answersSubmitted
      ? player.stats.correctAnswers / player.stats.answersSubmitted
      : 0
  );
  const fastestWinner = byMetric((player) => player.stats.fastestAnswers);
  const streakWinner = byMetric((player) => player.stats.bestStreak);

  return {
    accuracy: accuracyWinner?.value ? accuracyWinner.id : "",
    fastest: fastestWinner?.value ? fastestWinner.id : "",
    streak: streakWinner?.value ? streakWinner.id : ""
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
    emptySince: null,
    hostReconnectGraceUntil: 0,
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
    if (player.isHost) {
      player.ready = true;
      room.hostReconnectGraceUntil = 0;
    }
  } else {
    player = createPlayer({ socketId, name, playerId, isHost: false });
    player.avatarSeed = avatarSeed || player.avatarSeed;
    room.players.push(player);
  }

  room.emptySince = null;

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

export function updateReady({ code, playerId, ready }) {
  const room = ensureRoom(code);
  const player = getPlayer(room, playerId);

  player.ready = player.isHost ? true : Boolean(ready);

  return room;
}

export function updateSettings({ code, playerId, settings }) {
  const room = ensureRoom(code);
  ensureHost(room, playerId);

  const mode =
    settings.gameMode !== undefined ? settings.gameMode : room.settings.gameMode;
  room.settings = {
    ...room.settings,
    ...settings,
    roundDuration: Number(settings.roundDuration ?? room.settings.roundDuration),
    totalRounds: Number(settings.totalRounds ?? room.settings.totalRounds),
    ...(mode === "default_mode"
      ? {
          playlistUrl: "",
          playlistName: "",
          playlistCover: "",
          sourceTrackCount: 0
        }
      : {})
  };
  room.game.totalRounds = room.settings.totalRounds;

  return room;
}

export function setPlaylistSongs({
  code,
  playerId,
  songs,
  playlistUrl,
  playlistName,
  playlistCover = "",
  sourceTrackCount = songs.length,
  gameMode = "spotify_playlist"
}) {
  const room = ensureRoom(code);
  ensureHost(room, playerId);

  room.songPool = shuffle(songs.map(sanitizeSong));
  room.settings = {
    ...room.settings,
    gameMode,
    playlistUrl,
    playlistName,
    playlistCover,
    sourceTrackCount,
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

  if (!room.players.filter((player) => player.connected).every((player) => player.ready)) {
    throw new Error("Everyone in the room needs to be ready before you start.");
  }

  if (room.songPool.length < 4) {
    throw new Error("Need at least 4 playable songs before starting the game.");
  }

  room.players.forEach((player) => {
    player.score = 0;
    player.lastAnswerAt = null;
    player.ready = false;
    player.stats = {
      answersSubmitted: 0,
      correctAnswers: 0,
      fastestAnswers: 0,
      totalResponseMs: 0,
      currentStreak: 0,
      bestStreak: 0
    };
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
    return {
      room,
      accepted: false,
      reason: "No round is active."
    };
  }

  if (Date.now() < round.startAt || Date.now() > round.endAt) {
    return {
      room,
      accepted: false,
      reason: "Wait for the round countdown to finish."
    };
  }

  if (round.answers.has(playerId)) {
    return {
      room,
      accepted: false,
      reason: "Answer already locked."
    };
  }

  if (!round.answers.has(playerId)) {
    round.answers.set(playerId, {
      optionId,
      submittedAt: Date.now()
    });
    player.lastAnswerAt = Date.now();
    player.stats.answersSubmitted += 1;
  }

  return {
    room,
    accepted: true,
    submittedAt: player.lastAnswerAt
  };
}

export function revealRound(code) {
  const room = ensureRoom(code);
  const round = room.game.currentRoundData;

  if (!round) {
    throw new Error("No round to reveal.");
  }

  room.phase = "reveal";
  const scoreChanges = {};
  const correctAnswers = room.players
    .map((player) => ({
      player,
      answer: round.answers.get(player.id)
    }))
    .filter((entry) => entry.answer && entry.answer.optionId === round.song.id)
    .sort((a, b) => a.answer.submittedAt - b.answer.submittedAt);
  const fastestCorrectPlayerId = correctAnswers[0]?.player.id || "";

  for (const player of room.players) {
    const answer = round.answers.get(player.id);

    if (!answer) {
      player.stats.currentStreak = 0;
      scoreChanges[player.id] = 0;
      continue;
    }

    player.stats.totalResponseMs += Math.max(0, answer.submittedAt - round.startAt);

    if (answer.optionId !== round.song.id) {
      player.stats.currentStreak = 0;
      scoreChanges[player.id] = 0;
      continue;
    }

    const remainingTime = Math.max(0, Math.floor((round.endAt - answer.submittedAt) / 1000));
    const points = 100 + remainingTime * 10;
    player.score += points;
    player.stats.correctAnswers += 1;
    player.stats.currentStreak += 1;
    player.stats.bestStreak = Math.max(player.stats.bestStreak, player.stats.currentStreak);
    if (player.id === fastestCorrectPlayerId) {
      player.stats.fastestAnswers += 1;
    }
    scoreChanges[player.id] = points;
  }

  const leaderboard = serializeRoom(room).leaderboard;
  const revealPayload = {
    roundNumber: room.game.currentRound,
    totalRounds: room.game.totalRounds,
    song: round.song,
    options: round.options,
    correctOptionId: round.song.id,
    leaderboard,
    scoreChanges,
    fastestCorrectPlayerId
  };

  room.game.currentRoundData = null;

  return {
    reveal: revealPayload,
    leaderboard,
    gameEnded: room.game.currentRound >= room.game.totalRounds
  };
}

export function haveAllConnectedPlayersAnswered(code) {
  const room = ensureRoom(code);
  const round = room.game.currentRoundData;

  if (!round) {
    return false;
  }

  const connectedPlayers = room.players.filter((player) => player.connected);

  if (!connectedPlayers.length) {
    return false;
  }

  return connectedPlayers.every((player) => round.answers.has(player.id));
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
    player.ready = false;
    affectedRoom = room;
    room.emptySince = room.players.every((entry) => !entry.connected) ? Date.now() : null;

    if (room.hostId === player.id) {
      room.hostReconnectGraceUntil = Date.now() + HOST_RECONNECT_GRACE_MS;
    }

    break;
  }

  return affectedRoom;
}

export function leaveRoom({ code, playerId, socketId }) {
  const room = ensureRoom(code);
  const player = room.players.find(
    (entry) => entry.id === playerId || (socketId && entry.socketId === socketId)
  );

  if (!player) {
    return room;
  }

  player.connected = false;
  player.socketId = "";
  player.ready = false;
  room.emptySince = room.players.every((entry) => !entry.connected) ? Date.now() : null;

  if (room.hostId === player.id) {
    room.hostReconnectGraceUntil = Date.now() + HOST_RECONNECT_GRACE_MS;
  }

  return room;
}

export function removeEmptyRooms() {
  for (const [code, room] of rooms.entries()) {
    if (room.emptySince && Date.now() - room.emptySince > EMPTY_ROOM_TTL_MS) {
      rooms.delete(code);
    }
  }

  return rooms;
}

export function getRoom(code) {
  return rooms.get(code);
}

export function getRoomSnapshot(code) {
  return serializeRoom(ensureRoom(code));
}
