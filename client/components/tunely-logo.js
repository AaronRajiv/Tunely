import Link from "next/link";

export function TunelyLogo({ compact = false }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 shadow-glow">
        <div className="absolute h-7 w-7 rounded-full border border-white/20 bg-gradient-to-br from-coral/90 via-accent/80 to-mint/80" />
        <div className="absolute h-3 w-3 rounded-full bg-[#0b0d14]" />
        <div className="absolute right-[11px] top-[11px] h-1.5 w-1.5 rounded-full bg-white/80" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.36em] text-white/35">Party playback</p>
        <div className="text-3xl font-semibold tracking-[-0.06em] text-white">Tunely</div>
      </div>
      {compact ? null : <div className="ml-1 hidden h-8 w-px bg-white/10 md:block" />}
    </Link>
  );
}
