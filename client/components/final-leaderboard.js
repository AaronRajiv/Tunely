import { AvatarBadge } from "./avatar-badge";

function getBadges(player, awards) {
  if (!player) {
    return [];
  }

  const badges = [];

  if (awards?.fastest === player.id) {
    badges.push("Fastest hands");
  }

  if (awards?.accuracy === player.id) {
    badges.push("Most accurate");
  }

  if (awards?.streak === player.id) {
    badges.push("Best streak");
  }

  return badges;
}

export function FinalLeaderboard({ leaderboard, awards }) {
  const first = leaderboard[0];
  const second = leaderboard[1];
  const third = leaderboard[2];
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      <div className="panel overflow-hidden p-6 md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_34%)]" />
        <p className="relative text-sm uppercase tracking-[0.24em] text-white/40">Final results</p>
        <h2 className="relative mt-3 text-4xl font-semibold tracking-[-0.03em]">Victory podium</h2>

        <div className="relative mt-10 grid items-end gap-4 md:grid-cols-3">
          {second ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 animate-[float_4.2s_ease-in-out_infinite]">
                <AvatarBadge seed={second.avatarSeed || second.id} name={second.name} size="lg" />
              </div>
              <div className="w-full rounded-[28px] border border-white/10 bg-gradient-to-b from-white/12 to-white/5 p-5 text-center shadow-glow">
                <p className="text-sm text-white/45">P2</p>
                <p className="mt-3 text-2xl font-semibold">{second.name}</p>
                <p className="mt-2 text-white/55">{second.score} pts</p>
                {getBadges(second, awards).length ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {getBadges(second, awards).map((badge) => (
                      <span key={`${second.id}-${badge}`} className="pill">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="h-28 w-full rounded-b-[28px] bg-gradient-to-b from-slate-300/30 to-slate-500/20" />
            </div>
          ) : (
            <div />
          )}

          {first ? (
            <div className="flex flex-col items-center">
              <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-40 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl" />
              <div className="relative mb-5 animate-[float_3.6s_ease-in-out_infinite]">
                <div className="absolute -left-10 -top-5 text-3xl animate-[pop_1.8s_ease-in-out_infinite]">+</div>
                <div className="absolute -right-9 top-0 text-2xl animate-[pop_2.1s_ease-in-out_infinite]">*</div>
                <div className="absolute -bottom-4 left-10 text-xl animate-[pop_1.6s_ease-in-out_infinite]">+</div>
                <AvatarBadge seed={first.avatarSeed || first.id} name={first.name} size="lg" />
              </div>
              <div className="w-full rounded-[30px] border border-gold/30 bg-gradient-to-b from-gold/25 via-white/10 to-white/5 p-6 text-center shadow-glow">
                <p className="text-sm font-medium tracking-[0.24em] text-gold">P1</p>
                <p className="mt-3 text-3xl font-semibold text-white">{first.name}</p>
                <p className="mt-2 text-white/60">{first.score} pts</p>
                {getBadges(first, awards).length ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {getBadges(first, awards).map((badge) => (
                      <span key={`${first.id}-${badge}`} className="pill">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="h-36 w-full rounded-b-[30px] bg-gradient-to-b from-gold/70 to-gold/30" />
            </div>
          ) : (
            <div />
          )}

          {third ? (
            <div className="flex flex-col items-center">
              <div className="mb-4 animate-[float_4.8s_ease-in-out_infinite]">
                <AvatarBadge seed={third.avatarSeed || third.id} name={third.name} size="lg" />
              </div>
              <div className="w-full rounded-[28px] border border-white/10 bg-gradient-to-b from-white/12 to-white/5 p-5 text-center shadow-glow">
                <p className="text-sm text-white/45">P3</p>
                <p className="mt-3 text-2xl font-semibold">{third.name}</p>
                <p className="mt-2 text-white/55">{third.score} pts</p>
                {getBadges(third, awards).length ? (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                    {getBadges(third, awards).map((badge) => (
                      <span key={`${third.id}-${badge}`} className="pill">
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="h-24 w-full rounded-b-[28px] bg-gradient-to-b from-amber-700/35 to-amber-900/20" />
            </div>
          ) : (
            <div />
          )}
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
                  <div>
                    <p className="font-medium text-white">
                      #{index + 4} {player.name}
                    </p>
                    {getBadges(player, awards).length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {getBadges(player, awards).map((badge) => (
                          <span key={`${player.id}-${badge}`} className="pill">
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
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
