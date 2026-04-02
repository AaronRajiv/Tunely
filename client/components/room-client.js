"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getSocket } from "@/lib/socket";
import {
  generateAvatarSeed,
  getAudioPrefs,
  getAvatarSeed,
  getPlayerId,
  getStoredName,
  setAudioPrefs,
  setAvatarSeed,
  setStoredName
} from "@/lib/storage";
import { HostControls } from "./host-controls";
import { PlayerList } from "./player-list";
import { GameRoundCard } from "./game-round-card";
import { RevealCard } from "./reveal-card";
import { FinalLeaderboard } from "./final-leaderboard";
import { AvatarBadge } from "./avatar-badge";
import { TunelyLogo } from "./tunely-logo";

export function RoomClient({ code }) {
  const searchParams = useSearchParams();
  const [room, setRoom] = useState(null);
  const [currentPlayerId, setCurrentPlayerId] = useState("");
  const [avatarSeed, setAvatarSeedState] = useState("");
  const [name, setName] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [round, setRound] = useState(null);
  const [reveal, setReveal] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [error, setError] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [copyState, setCopyState] = useState("Copy code");
  const [audioPrefs, setAudioPrefsState] = useState({ volume: 0.8, isMuted: false });

  const socket = useMemo(() => getSocket(), []);
  const me = room?.players.find((player) => player.id === currentPlayerId);
  const isHost = room?.hostId === currentPlayerId;
  const playlistLabel = room?.settings?.playlistName || room?.settings?.genre || "Tunely session";

  useEffect(() => {
    if (!searchParams) {
      return;
    }

    const spotifyStatus = searchParams.get("spotify");
    const spotifyError = searchParams.get("spotify_error");

    if (spotifyStatus === "connected") {
      setError("");
    }

    if (spotifyError) {
      setError(spotifyError);
    }
  }, [searchParams]);

  useEffect(() => {
    const storedName = getStoredName() || `Guest ${Math.floor(Math.random() * 90 + 10)}`;
    const playerId = getPlayerId();
    const storedAvatarSeed = getAvatarSeed();

    setName(storedName);
    setCurrentPlayerId(playerId);
    setAvatarSeedState(storedAvatarSeed);
    setAudioPrefsState(getAudioPrefs());

    socket.emit("join_room", {
      roomCode: code,
      name: storedName,
      playerId,
      avatarSeed: storedAvatarSeed
    });

    const handleRoomPayload = ({ room: nextRoom, playerId: nextPlayerId }) => {
      setRoom(nextRoom);
      setLeaderboard(nextRoom.leaderboard || []);
      setCurrentPlayerId(nextPlayerId);
      setIsReady(true);
    };

    const handlePlayersUpdated = (nextRoom) => {
      setRoom(nextRoom);
      setLeaderboard(nextRoom.leaderboard || []);
    };

    const handleSettingsUpdated = (nextRoom) => {
      setRoom(nextRoom);
    };

    const handleGameStarted = (nextRoom) => {
      setRoom(nextRoom);
      setReveal(null);
      setSelectedOptionId("");
      setLeaderboard(nextRoom.leaderboard || []);
    };

    const handleNewRound = (nextRound) => {
      setRoom((currentRoom) => (currentRoom ? { ...currentRoom, phase: "playing" } : currentRoom));
      setRound(nextRound);
      setReveal(null);
      setSelectedOptionId("");
      setSecondsLeft(nextRound.duration);
    };

    const handleTimer = ({ secondsLeft: nextSeconds }) => {
      setSecondsLeft(nextSeconds);
    };

    const handleReveal = (payload) => {
      setRoom((currentRoom) => (currentRoom ? { ...currentRoom, phase: "reveal" } : currentRoom));
      setReveal(payload);
      setLeaderboard(payload.leaderboard || []);
      setRound(null);
      setSelectedOptionId("");
    };

    const handleLeaderboard = (nextLeaderboard) => {
      setLeaderboard(nextLeaderboard);
    };

    const handleEnded = (finalRoom) => {
      setRoom(finalRoom);
      setLeaderboard(finalRoom.leaderboard || []);
      setRound(null);
      setReveal(null);
    };

    const handleError = ({ message }) => {
      setError(message);
      setIsReady(true);
    };

    socket.on("room_created", handleRoomPayload);
    socket.on("room_joined", handleRoomPayload);
    socket.on("player_list_updated", handlePlayersUpdated);
    socket.on("settings_updated", handleSettingsUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("new_round", handleNewRound);
    socket.on("round_timer", handleTimer);
    socket.on("reveal_answer", handleReveal);
    socket.on("leaderboard_update", handleLeaderboard);
    socket.on("game_ended", handleEnded);
    socket.on("error_message", handleError);

    return () => {
      socket.off("room_created", handleRoomPayload);
      socket.off("room_joined", handleRoomPayload);
      socket.off("player_list_updated", handlePlayersUpdated);
      socket.off("settings_updated", handleSettingsUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("new_round", handleNewRound);
      socket.off("round_timer", handleTimer);
      socket.off("reveal_answer", handleReveal);
      socket.off("leaderboard_update", handleLeaderboard);
      socket.off("game_ended", handleEnded);
      socket.off("error_message", handleError);
    };
  }, [code, socket]);

  function updateDisplayName(nextName) {
    setName(nextName);
    setStoredName(nextName);
    socket.emit("update_name", {
      roomCode: code,
      playerId: currentPlayerId,
      name: nextName
    });
  }

  function regenerateAvatar() {
    const nextSeed = generateAvatarSeed();
    setAvatarSeed(nextSeed);
    setAvatarSeedState(nextSeed);
    socket.emit("update_avatar", {
      roomCode: code,
      playerId: currentPlayerId,
      avatarSeed: nextSeed
    });
  }

  function updateAudioPrefs(nextPrefs) {
    setAudioPrefsState(nextPrefs);
    setAudioPrefs(nextPrefs);
  }

  function submitAnswer(optionId) {
    if (selectedOptionId) {
      return;
    }

    setSelectedOptionId(optionId);
    socket.emit("submit_answer", {
      roomCode: code,
      playerId: currentPlayerId,
      optionId
    });
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopyState("Copied");
      window.setTimeout(() => setCopyState("Copy code"), 1400);
    } catch {
      setCopyState("Copy failed");
      window.setTimeout(() => setCopyState("Copy code"), 1400);
    }
  }

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-white">
        <div className="grain" />
        <div className="panel max-w-xl p-8 text-center">
          <p className="text-sm uppercase tracking-[0.24em] text-white/40">Connecting</p>
          <h1 className="mt-3 text-3xl font-semibold">Joining room {code}</h1>
        </div>
      </main>
    );
  }

  if (!room) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-white">
        <div className="panel max-w-xl p-8 text-center">
          <h1 className="text-3xl font-semibold">Room not found</h1>
          <Link className="ghost-button mt-6" href="/">
            Back home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-5 text-white md:px-10">
      <div className="grain" />
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="flex items-center justify-between pt-2">
          <TunelyLogo compact />
          <button className="ghost-button !rounded-xl !px-4 !py-2 text-sm" onClick={copyRoomCode}>
            {room.code} · {copyState}
          </button>
        </section>

        <section className="panel grid gap-5 p-5 md:grid-cols-[1.25fr_0.75fr] md:p-6">
          <div>
            <p className="text-sm uppercase tracking-[0.42em] text-white/35">Now playing</p>
            <h1 className="mt-3 text-5xl font-semibold tracking-[-0.06em] text-white">{playlistLabel}</h1>
            <p className="mt-3 text-white/55">
              {room.settings.totalRounds} rounds · {room.settings.roundDuration}s preview · {room.songPoolSize} matched songs ready
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-[32px] border border-white/10 bg-white/6 p-4">
            <AvatarBadge seed={me?.avatarSeed || avatarSeed || currentPlayerId} name={name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-white/45">{me?.isHost ? "Host profile" : "Player profile"}</p>
              <input
                className="mt-2 w-full bg-transparent text-2xl font-semibold text-white outline-none placeholder:text-white/30"
                value={name}
                onChange={(event) => updateDisplayName(event.target.value)}
                placeholder="Display name"
              />
            </div>
            <button className="ghost-button !rounded-xl !px-4 !py-2 text-sm" onClick={regenerateAvatar}>
              Remix avatar
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 px-5 py-4 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <PlayerList players={room.players} currentPlayerId={currentPlayerId} />

            <div className="panel overflow-hidden p-5">
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-lg font-semibold">Leaderboard</h3>
                <span className="text-sm text-white/45">Live scoring</span>
              </div>

              <div className="space-y-3">
                {leaderboard.map((player, index) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-[24px] border border-white/8 bg-gradient-to-r from-white/10 to-white/5 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <AvatarBadge seed={player.avatarSeed || player.id} name={player.name} />
                      <div>
                        <p className="font-medium text-white">
                          #{index + 1} {player.name}
                        </p>
                        <p className="text-sm text-white/40">
                          {index === 0 ? "Leading the room" : `${Math.max(0, leaderboard[0]?.score - player.score)} behind first`}
                        </p>
                      </div>
                    </div>
                    <p className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-white/80">{player.score}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {room.phase === "lobby" ? (
              isHost ? (
                <HostControls room={room} playerId={currentPlayerId} socket={socket} onImported={() => setError("")} />
              ) : (
                <div className="panel p-6">
                  <p className="text-sm uppercase tracking-[0.24em] text-white/40">Lobby</p>
                  <h2 className="mt-3 text-3xl font-semibold">Waiting for the host</h2>
                  <p className="mt-3 max-w-2xl text-white/60">
                    The host is choosing the playlist and tuning the rounds. Stay here and the game will begin automatically.
                  </p>
                </div>
              )
            ) : null}

            {room.phase === "playing" && round ? (
              <GameRoundCard
                round={round}
                secondsLeft={secondsLeft}
                selectedOptionId={selectedOptionId}
                onSelect={submitAnswer}
                volume={audioPrefs.volume}
                isMuted={audioPrefs.isMuted}
                onVolumeChange={(volume) => updateAudioPrefs({ volume, isMuted: volume === 0 ? true : false })}
                onToggleMute={() => updateAudioPrefs({ ...audioPrefs, isMuted: !audioPrefs.isMuted })}
                playlistName={playlistLabel}
              />
            ) : null}

            {room.phase === "reveal" ? <RevealCard reveal={reveal} /> : null}

            {room.phase === "finished" ? <FinalLeaderboard leaderboard={leaderboard} /> : null}

            <div className="panel p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.24em] text-white/40">Session details</p>
                  <h3 className="mt-2 text-xl font-semibold">{playlistLabel}</h3>
                </div>
                <div className="text-sm text-white/45">{room.phase === "lobby" ? "Waiting in lobby" : "Game in progress"}</div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-white/45">Rounds</p>
                  <p className="mt-2 text-lg font-semibold text-white">{room.settings.totalRounds}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-white/45">Preview length</p>
                  <p className="mt-2 text-lg font-semibold text-white">{room.settings.roundDuration}s</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="text-sm text-white/45">Playable tracks</p>
                  <p className="mt-2 text-lg font-semibold text-white">{room.songPoolSize}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
