import { AvatarBadge } from "./avatar-badge";

const podiumOrder = [1, 0, 2];
const podiumHeights = ["h-[220px]", "h-[280px]", "h-[190px]"];
const podiumLabels = ["#2", "#1", "#3"];

export function FinalLeaderboard({ leaderboard }) {
  const podiumSource = leaderboard.slice(0, 3);
  const podium = podiumOrder.map((index) => podiumSource[index]).filter(Boolean);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <div className="panel overflow-hidden p-6 md:p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-white/40">Final results</p>
        <h2 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Top podium</h2>

        <div className="mt-10 grid items-end gap-4 md:grid-cols-3">
          {podium.map((player, index) => (
            <div
              key={player.id}
              className={`relative flex ${podiumHeights[index]} flex-col justify-between rounded-[30px] border border-white/10 bg-gradient-to-b from-white/14 via-white/6 to-transparent p-5 shadow-glow`}
            >
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-coral via-white to-mint opacity-70" />
              <div className="flex items-center justify-between">
                <span className="pill">{podiumLabels[index]}</span>
                <span className="text-sm text-white/45">{player.score} pts</span>
              </div>
              <div className="mt-8 flex flex-col items-center text-center">
                <AvatarBadge seed={player.avatarSeed || player.id} name={player.name} size="lg" />
                <p className="mt-5 text-2xl font-semibold text-white">{player.name}</p>
                <p className="mt-2 text-white/55">{index === 1 ? "Crowd favorite" : "On the podium"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="text-xl font-semibold">Full ranking</h3>
        <div className="mt-4 space-y-3">
          {rest.length ? (
            rest.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <AvatarBadge seed={player.avatarSeed || player.id} name={player.name} />
                  <p className="font-medium text-white">
                    #{index + 4} {player.name}
                  </p>
                </div>
                <p className="text-white/65">{player.score}</p>
              </div>
            ))
          ) : (
            <p className="text-white/55">No extra players beyond the podium.</p>
          )}
        </div>
      </div>
    </div>
  );
}
