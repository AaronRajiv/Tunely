import clsx from "clsx";

export function RevealCard({ reveal, selectedOptionId }) {
  if (!reveal) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="panel overflow-hidden">
        <div className="grid gap-0 md:grid-cols-[240px_1fr]">
          <div className="relative min-h-[240px] bg-black/30">
            {reveal.song.cover ? (
              <img src={reveal.song.cover} alt={reveal.song.title} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-white/30">No artwork</div>
            )}
          </div>

          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/40">Answer revealed</p>
              <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">{reveal.song.title}</h2>
              <p className="mt-2 text-lg text-white/65">{reveal.song.artist}</p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <span className="pill">Round {reveal.roundNumber}</span>
              {reveal.song.apple_music_url ? (
                <a className="ghost-button" href={reveal.song.apple_music_url} target="_blank" rel="noreferrer">
                  Listen on Apple Music
                </a>
              ) : (
                <span className="pill">Apple Music link unavailable</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {reveal.options?.map((option, index) => {
          const isCorrect = option.id === reveal.correctOptionId;
          const isWrongSelection = selectedOptionId === option.id && option.id !== reveal.correctOptionId;

          return (
            <div
              key={option.id}
              className={clsx(
                "min-h-[118px] rounded-[28px] border px-5 py-5 text-left transition",
                isCorrect
                  ? "border-emerald-400/45 bg-emerald-400/18 text-emerald-50 shadow-glow"
                  : isWrongSelection
                    ? "border-rose-400/40 bg-rose-400/18 text-rose-50"
                    : "border-white/10 bg-white/5 text-white/60"
              )}
            >
              <div className="text-sm opacity-70">{`0${index + 1}`.slice(-2)}</div>
              <div className="mt-4 text-xl font-semibold leading-8">{option.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
