"use client";

import clsx from "clsx";

export function StreakFlame({ streak = 0 }) {
  const isActive = streak > 0;

  return (
    <span
      className={clsx(
        "relative inline-flex items-center gap-1 text-sm font-semibold transition-all duration-500",
        isActive
          ? "translate-y-0 text-orange-100 opacity-100"
          : "pointer-events-none translate-y-1 text-orange-100/0 opacity-0"
      )}
    >
      <span
        className={clsx(
          "relative inline-flex h-7 w-6 items-center justify-center transition-all duration-500",
          isActive ? "scale-100 opacity-100" : "scale-50 opacity-0"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="h-0 w-0"
        >
          <path />
        </svg>
        <span
          className={clsx(
            "relative origin-bottom text-lg drop-shadow-[0_0_14px_rgba(251,146,60,0.75)]",
            isActive ? "animate-[flame_1.25s_ease-in-out_infinite]" : "scale-50"
          )}
        >
          🔥
        </span>
      </span>
      <span
        className={clsx(
          "transition-all duration-500",
          isActive ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        )}
      >
        {streak}
      </span>
    </span>
  );
}
