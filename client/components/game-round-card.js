"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export function GameRoundCard({
  round,
  secondsLeft,
  selectedOptionId,
  onSelect,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  playlistName
}) {
  const audioRef = useRef(null);
  const stopRef = useRef(null);
  const fadeRef = useRef(null);
  const [playbackState, setPlaybackState] = useState("waiting");
  const [introCountdown, setIntroCountdown] = useState(0);

  const introLabel = useMemo(() => {
    if (introCountdown <= 0) {
      return "GO";
    }

    return introCountdown;
  }, [introCountdown]);

  useEffect(() => {
    if (!round?.preview_url) {
      return undefined;
    }

    const delay = Math.max(0, round.startAt - Date.now());
    setIntroCountdown(Math.max(0, Math.ceil(delay / 1000)));

    const countdownInterval = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((round.startAt - Date.now()) / 1000));
      setIntroCountdown(next);
    }, 150);

    const startTimer = setTimeout(() => {
      const audio = new Audio(round.preview_url);
      audio.volume = isMuted ? 0 : volume;
      audioRef.current = audio;
      audio.play().then(
        () => setPlaybackState("playing"),
        () => setPlaybackState("blocked")
      );

      stopRef.current = setTimeout(() => {
        const steps = 8;
        const initialVolume = audio.volume;
        let currentStep = 0;

        fadeRef.current = window.setInterval(() => {
          currentStep += 1;
          audio.volume = Math.max(0, initialVolume * (1 - currentStep / steps));

          if (currentStep >= steps) {
            clearInterval(fadeRef.current);
            audio.pause();
            audio.currentTime = 0;
            audio.volume = isMuted ? 0 : volume;
            setPlaybackState("stopped");
          }
        }, 70);
      }, Math.max(0, round.endAt - Date.now()));
    }, delay);

    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopRef.current);
      clearInterval(fadeRef.current);
      clearInterval(countdownInterval);
      if (audioRef.current) {
        const audio = audioRef.current;
        const initialVolume = audio.volume;
        let currentStep = 0;

        fadeRef.current = window.setInterval(() => {
          currentStep += 1;
          audio.volume = Math.max(0, initialVolume * (1 - currentStep / 5));

          if (currentStep >= 5) {
            clearInterval(fadeRef.current);
            audio.pause();
            audio.currentTime = 0;
          }
        }, 45);
      }
    };
  }, [round, isMuted, volume]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [isMuted, volume]);

  if (!round) {
    return null;
  }

  return (
    <div className="panel relative overflow-hidden p-5 md:p-7">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_26%)]" />
      {Date.now() < round.startAt ? (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#090b11]/78 backdrop-blur-md">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.42em] text-white/35">Up next</p>
            <h3 className="mt-4 text-5xl font-semibold tracking-[-0.06em] text-white">{playlistName || "Tunely mix"}</h3>
            <div className="mx-auto mt-6 flex h-24 w-24 items-center justify-center rounded-full border border-white/10 bg-white/8 text-4xl font-semibold text-white shadow-glow transition">
              {introLabel}
            </div>
          </div>
        </div>
      ) : null}

      <div className="relative z-10 mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-white/40">
            Round {round.roundNumber} / {round.totalRounds}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Guess the track</h2>
        </div>
        <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-3 text-center">
          <p className="text-xs uppercase tracking-[0.24em] text-white/40">Time left</p>
          <p className="mt-1 text-3xl font-semibold">{secondsLeft}s</p>
        </div>
      </div>

      <div className="relative z-10 mb-6 rounded-3xl border border-white/10 bg-gradient-to-r from-white/10 to-white/5 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-white/55">Playback</p>
            <p className="mt-2 text-xl font-medium text-white">
              {playbackState === "blocked"
                ? "Browser blocked autoplay. Tap an answer to keep going."
                : playbackState === "playing"
                  ? "Preview is playing now"
                  : playbackState === "stopped"
                    ? "Preview finished"
                    : "Syncing audio for everyone"}
            </p>
          </div>

          <div className="flex min-w-[250px] items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <button
              className="ghost-button !rounded-xl !px-4 !py-2 text-sm"
              onClick={onToggleMute}
              type="button"
            >
              {isMuted ? "Unmute" : "Mute"}
            </button>
            <input
              className="w-full accent-white"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="relative z-10 grid gap-3">
        {round.options.map((option, index) => (
          <button
            key={option.id}
            className={clsx(
              "rounded-3xl border px-5 py-4 text-left transition duration-200",
              selectedOptionId === option.id
                ? "border-white bg-white text-black shadow-glow"
                : "border-white/10 bg-white/5 text-white hover:translate-x-1 hover:bg-white/10"
            )}
            onClick={() => onSelect(option.id)}
            disabled={Boolean(selectedOptionId)}
          >
            <span className="mr-3 text-white/45">{index + 1}.</span>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
