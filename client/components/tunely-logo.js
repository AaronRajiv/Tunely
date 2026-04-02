import Link from "next/link";

export function TunelyLogo({ compact = false }) {
  return (
    <Link href="/" className="group inline-flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#121521] shadow-glow">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(255,255,255,0.16),transparent_28%)]" />
        <div className="absolute h-7 w-7 rounded-full border border-white/10 bg-gradient-to-br from-[#ff8b6b] via-[#ff4d7d] to-[#7367ff]" />
        <div className="absolute h-2.5 w-2.5 rounded-full bg-[#121521]" />
        <div className="absolute right-[13px] top-[12px] h-1.5 w-1.5 rounded-full bg-white/80" />
      </div>
      <div>
        <div className="text-3xl font-semibold tracking-[-0.06em] text-white">Tunely</div>
      </div>
      {compact ? null : <div className="ml-1 hidden h-8 w-px bg-white/10 md:block" />}
    </Link>
  );
}
