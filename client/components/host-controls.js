"use client";

import { useEffect, useMemo, useState } from "react";
import { SERVER_URL } from "@/lib/config";
import { getPlaylistHistory, savePlaylistHistory } from "@/lib/storage";

const MODE_OPTIONS = ["spotify_playlist", "Pop", "Rock", "Top Hits"];
const ROUND_DURATIONS = [5, 10, 15];
const TOTAL_ROUNDS = [5, 8, 10, 12];

export function HostControls({ room, playerId, socket, onImported }) {
  const [playlistUrl, setPlaylistUrl] = useState(room.settings.playlistUrl || "");
  const [playlistHistory, setPlaylistHistory] = useState([]);
  const [importState, setImportState] = useState({
    loading: false,
    message: "",
    error: ""
  });

  const isPlaylistMode = room.settings.gameMode === "spotify_playlist";
  const spotifyConnected = room.spotifyConnected;

  const songPoolLabel = useMemo(() => {
    if (isPlaylistMode) {
      return room.settings.playlistName
        ? `${room.settings.playlistName} · ${room.songPoolSize} playable tracks`
        : `${room.songPoolSize} playable tracks ready`;
    }

    return `${room.settings.genre} · ${room.songPoolSize || "Spotify search"} tracks`;
  }, [isPlaylistMode, room.settings.genre, room.settings.playlistName, room.songPoolSize]);

  useEffect(() => {
    setPlaylistHistory(getPlaylistHistory());
  }, []);

  function emitSettings(nextSettings) {
    socket.emit("update_settings", {
      roomCode: room.code,
      playerId,
      settings: nextSettings
    });
  }

  async function importPlaylist() {
    setImportState({ loading: true, message: "", error: "" });

    try {
      const response = await fetch(`${SERVER_URL}/api/spotify/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          roomCode: room.code,
          playerId,
          playlistUrl
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to import playlist.");
      }

      setImportState({
        loading: false,
        message: `${data.playlistName} imported with ${data.songsImported} playable tracks.`,
        error: ""
      });
      setPlaylistHistory(
        savePlaylistHistory({
          name: data.playlistName,
          url: playlistUrl
        })
      );

      emitSettings({
        gameMode: "spotify_playlist",
        playlistUrl
      });
      onImported?.({
        playlistName: data.playlistName,
        playlistUrl
      });
    } catch (error) {
      setImportState({
        loading: false,
        message: "",
        error: error.message
      });
    }
  }

  return (
    <div className="panel p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-white/40">Host controls</p>
          <h3 className="mt-2 text-xl font-semibold">Shape the next party</h3>
        </div>
        <span className="pill">{songPoolLabel}</span>
      </div>

      <div className="grid gap-4">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <label className="mb-1 block text-sm text-white/55">Spotify connection</label>
              <p className="text-sm text-white/65">
                Only the host needs to connect Spotify. Everyone else can stay as a guest.
              </p>
            </div>
            <button
              className={spotifyConnected ? "ghost-button" : "primary-button"}
              onClick={() => {
                if (spotifyConnected) {
                  return;
                }

                window.location.href = `${SERVER_URL}/auth/spotify/start?roomCode=${encodeURIComponent(room.code)}&playerId=${encodeURIComponent(playerId)}`;
              }}
              type="button"
            >
              {spotifyConnected ? "Spotify connected" : "Connect Spotify"}
            </button>
          </div>
          <p className="mt-3 text-sm text-white/50">
            Status: {spotifyConnected ? "Connected for host imports" : "Not connected"}
          </p>
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/55">Game mode</label>
          <select
            className="field"
            value={room.settings.gameMode === "spotify_playlist" ? "spotify_playlist" : room.settings.genre}
            onChange={(event) => {
              const value = event.target.value;

              if (value === "spotify_playlist") {
                emitSettings({ gameMode: "spotify_playlist" });
                return;
              }

              emitSettings({
                gameMode: "default_mode",
                genre: value
              });
            }}
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option === "spotify_playlist" ? "Spotify Playlist" : option}
              </option>
            ))}
          </select>
        </div>

        {isPlaylistMode ? (
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
            <label className="mb-2 block text-sm text-white/55">Spotify playlist URL</label>
            <form
              className="grid gap-3 md:grid-cols-[1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                importPlaylist();
              }}
            >
              <input
                className="field"
                value={playlistUrl}
                onChange={(event) => setPlaylistUrl(event.target.value)}
                placeholder="https://open.spotify.com/playlist/..."
              />
              <button
                className="ghost-button"
                type="submit"
                disabled={!spotifyConnected || !playlistUrl.trim() || importState.loading}
              >
                {importState.loading ? "Importing..." : "Import"}
              </button>
            </form>
            {playlistHistory.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {playlistHistory.map((entry) => (
                  <button
                    key={entry.url}
                    className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-sm text-white/70 transition hover:bg-white/14"
                    onClick={() => setPlaylistUrl(entry.url)}
                    type="button"
                  >
                    {entry.name}
                  </button>
                ))}
              </div>
            ) : null}
            {!spotifyConnected ? (
              <p className="mt-3 text-sm text-amber-200">
                Connect Spotify first so this room can import your playlists.
              </p>
            ) : null}
            {importState.message ? <p className="mt-3 text-sm text-emerald-300">{importState.message}</p> : null}
            {importState.error ? <p className="mt-3 text-sm text-rose-300">{importState.error}</p> : null}
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm text-white/55">Round duration</label>
            <select
              className="field"
              value={room.settings.roundDuration}
              onChange={(event) => emitSettings({ roundDuration: Number(event.target.value) })}
            >
              {ROUND_DURATIONS.map((value) => (
                <option key={value} value={value}>
                  {value}s
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/55">Total rounds</label>
            <select
              className="field"
              value={room.settings.totalRounds}
              onChange={(event) => emitSettings({ totalRounds: Number(event.target.value) })}
            >
              {TOTAL_ROUNDS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <p className="text-sm text-white/45">Round mode</p>
            <p className="mt-2 text-lg font-semibold text-white">Audio</p>
          </div>
        </div>

        <button
          className="primary-button mt-2"
          onClick={() => socket.emit("start_game", { roomCode: room.code, playerId })}
          disabled={(isPlaylistMode && room.songPoolSize < 4) || (isPlaylistMode && !spotifyConnected)}
        >
          Start game
        </button>
      </div>
    </div>
  );
}
