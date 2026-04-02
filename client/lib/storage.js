"use client";

const PLAYER_ID_KEY = "sgp_player_id";
const PLAYER_NAME_KEY = "sgp_player_name";
const PLAYLIST_HISTORY_KEY = "sgp_playlist_history";
const PLAYER_AVATAR_KEY = "sgp_player_avatar_seed";
const AUDIO_PREFS_KEY = "sgp_audio_prefs";

export function getPlayerId() {
  if (typeof window === "undefined") {
    return "";
  }

  let playerId = window.localStorage.getItem(PLAYER_ID_KEY);

  if (!playerId) {
    playerId = `player_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(PLAYER_ID_KEY, playerId);
  }

  return playerId;
}

export function getStoredName() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(PLAYER_NAME_KEY) || "";
}

export function setStoredName(name) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PLAYER_NAME_KEY, name);
}

export function getPlaylistHistory() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    return JSON.parse(window.localStorage.getItem(PLAYLIST_HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

export function savePlaylistHistory(entry) {
  if (typeof window === "undefined" || !entry?.name || !entry?.url) {
    return [];
  }

  const current = getPlaylistHistory().filter((item) => item.url !== entry.url);
  const next = [entry, ...current].slice(0, 8);
  window.localStorage.setItem(PLAYLIST_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function generateAvatarSeed() {
  return `avatar_${Math.random().toString(36).slice(2, 10)}`;
}

export function getAvatarSeed() {
  if (typeof window === "undefined") {
    return "";
  }

  let value = window.localStorage.getItem(PLAYER_AVATAR_KEY);

  if (!value) {
    value = generateAvatarSeed();
    window.localStorage.setItem(PLAYER_AVATAR_KEY, value);
  }

  return value;
}

export function setAvatarSeed(seed) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PLAYER_AVATAR_KEY, seed);
}

export function getAudioPrefs() {
  if (typeof window === "undefined") {
    return { volume: 0.8, isMuted: false };
  }

  try {
    return JSON.parse(window.localStorage.getItem(AUDIO_PREFS_KEY) || "{\"volume\":0.8,\"isMuted\":false}");
  } catch {
    return { volume: 0.8, isMuted: false };
  }
}

export function setAudioPrefs(prefs) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUDIO_PREFS_KEY, JSON.stringify(prefs));
}
