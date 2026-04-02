export function RevealCard({ reveal }) {
  if (!reveal) {
    return null;
  }

  return (
    <div className="panel overflow-hidden">
      <div className="grid gap-0 md:grid-cols-[260px_1fr]">
        <div className="relative min-h-[260px] bg-black/30">
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
              <a
                className="ghost-button"
                href={reveal.song.apple_music_url}
                target="_blank"
                rel="noreferrer"
              >
                Listen on Apple Music
              </a>
            ) : (
              <span className="pill">Apple Music link unavailable</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
