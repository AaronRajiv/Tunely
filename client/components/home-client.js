"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";
import { getAvatarSeed, getPlayerId, getStoredName, setStoredName } from "@/lib/storage";
import { TunelyLogo } from "./tunely-logo";

export function HomeClient() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const patchNotes = [
    "Live streak tracking now glows right inside the room leaderboard.",
    "Players can ready up before the host starts, while the host stays auto-ready.",
    "Round flow now has better waiting states, score bursts, and smoother reveals.",
    "Playlist imports keep recent history and show matched track counts more clearly."
  ];

  useEffect(() => {
    setName(getStoredName() || `Guest ${Math.floor(Math.random() * 90 + 10)}`);
  }, []);

  useEffect(() => {
    const socket = getSocket();

    const handleCreated = ({ room, playerId }) => {
      window.localStorage.setItem("sgp_player_id", playerId);
      setIsBusy(false);
      router.push(`/room/${room.code}`);
    };

    const handleJoined = ({ room, playerId }) => {
      window.localStorage.setItem("sgp_player_id", playerId);
      setIsBusy(false);
      router.push(`/room/${room.code}`);
    };

    const handleError = ({ message }) => {
      setError(message);
      setIsBusy(false);
    };

    socket.on("room_created", handleCreated);
    socket.on("room_joined", handleJoined);
    socket.on("error_message", handleError);

    return () => {
      socket.off("room_created", handleCreated);
      socket.off("room_joined", handleJoined);
      socket.off("error_message", handleError);
    };
  }, [router]);

  function persistName() {
    const safeName = name.trim() || "Guest";
    setStoredName(safeName);
    setName(safeName);
    return safeName;
  }

  function handleCreateRoom() {
    setError("");
    setIsBusy(true);
    const socket = getSocket();
    const safeName = persistName();

    socket.emit("create_room", {
      name: safeName,
      playerId: getPlayerId(),
      avatarSeed: getAvatarSeed()
    });
  }

  function handleJoinRoom() {
    setError("");
    setIsBusy(true);

    const socket = getSocket();
    const safeName = persistName();

    socket.emit("join_room", {
      roomCode: roomCode.trim(),
      name: safeName,
      playerId: getPlayerId(),
      avatarSeed: getAvatarSeed()
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-5 py-8 text-white md:px-10">
      <div className="grain" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-between gap-10">
        <section className="flex flex-col gap-6 pt-6 md:pt-16">
          <TunelyLogo compact />
          <span className="pill w-fit">Multiplayer music trivia with Spotify playlist rooms</span>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-5xl font-semibold tracking-[-0.04em] text-white md:text-7xl">Tunely</h1>
            <p className="max-w-2xl text-lg leading-8 text-white/65 md:text-xl">
              Import a Spotify playlist, open a room, and race your friends to guess songs
              faster than anyone else.
            </p>
          </div>
        </section>

        <section className="grid gap-6 pb-8 md:grid-cols-[1.15fr_0.85fr]">
          <div className="panel p-6 md:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.24em] text-white/45">Quick start</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
                  Create or join in seconds
                </h2>
              </div>
              <div className="pill">6-digit room codes</div>
            </div>

            <div className="grid gap-4">
              <input
                className="field"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your display name"
              />

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  className="field uppercase tracking-[0.35em]"
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Room code"
                />
                <button className="ghost-button" onClick={handleJoinRoom} disabled={isBusy || roomCode.length !== 6}>
                  Join room
                </button>
              </div>

              <button className="primary-button mt-2" onClick={handleCreateRoom} disabled={isBusy}>
                Create a new room
              </button>

              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            </div>
          </div>

          <div className="panel flex flex-col justify-between p-6 md:p-8">
            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Core features</p>
              <div className="space-y-3 text-sm text-white/70">
                <p>Paste any Spotify playlist URL and keep only tracks with playable previews.</p>
                <p>Run fast real-time rounds with synced timers, answer reveals, and live scoring.</p>
                <p>Swap between playlist games and quick default mixes like Pop, Rock, and Top Hits.</p>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-white/70">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-2xl font-semibold text-white">10s</p>
                <p className="mt-1">Default round clip</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="text-2xl font-semibold text-white">Live</p>
                <p className="mt-1">Leaderboard updates</p>
              </div>
            </div>
          </div>
        </section>

        <section className="panel p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/45">Patch notes</p>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Latest updates in Tunely</h2>
            </div>
            <span className="pill">April 2026 build</span>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {patchNotes.map((note, index) => (
              <div
                key={note}
                className="rounded-[24px] border border-white/10 bg-black/20 px-5 py-4 text-white/75"
              >
                <p className="text-sm uppercase tracking-[0.24em] text-white/35">{`Update 0${index + 1}`}</p>
                <p className="mt-3 text-base leading-7">{note}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
