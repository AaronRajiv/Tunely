function hashSeed(seed) {
  return [...seed].reduce((accumulator, char) => accumulator * 31 + char.charCodeAt(0), 7);
}

export function AvatarBadge({ seed = "guest", name = "Guest", size = "md" }) {
  const hash = Math.abs(hashSeed(seed));
  const hueA = hash % 360;
  const hueB = (hash * 1.31) % 360;
  const hueC = (hash * 2.07) % 360;
  const dimensions = size === "lg" ? "h-16 w-16 text-xl rounded-full" : "h-10 w-10 text-xs rounded-full";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "G";

  return (
    <div
      className={`relative flex ${dimensions} items-center justify-center overflow-hidden border border-white/10 font-semibold text-white shadow-glow`}
      style={{
        background: `radial-gradient(circle at 25% 20%, hsla(${hueA}, 96%, 72%, 0.95), transparent 36%), linear-gradient(135deg, hsla(${hueB}, 74%, 56%, 0.96), hsla(${hueC}, 72%, 34%, 0.92))`
      }}
    >
      <div className="absolute inset-[10%] rounded-full border border-white/10 opacity-70" />
      <div
        className="absolute -right-3 top-2 h-8 w-8 rounded-full blur-md"
        style={{ background: `hsla(${hueA}, 98%, 82%, 0.75)` }}
      />
      <div
        className="absolute -left-4 bottom-1 h-10 w-10 rounded-full blur-lg"
        style={{ background: `hsla(${hueC}, 88%, 66%, 0.5)` }}
      />
      <div
        className="absolute inset-y-2 right-2 w-[22%] rounded-full opacity-45"
        style={{ background: `linear-gradient(180deg, hsla(${hueA}, 96%, 94%, 0.8), transparent)` }}
      />
      <span className="relative z-10 tracking-[0.08em]">{initials}</span>
    </div>
  );
}
