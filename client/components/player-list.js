import { AvatarBadge } from "./avatar-badge";

export function PlayerList({ players, currentPlayerId }) {
  return (
    <div className="panel p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Players</h3>
        <span className="pill">{players.length} in room</span>
      </div>

      <div className="space-y-3">
        {players.map((player) => (
          <div
            key={player.id}
            className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <AvatarBadge seed={player.id} name={player.name} />
              <div>
                <p className="font-medium text-white">
                  {player.name} {player.id === currentPlayerId ? <span className="text-white/45">(You)</span> : null}
                </p>
                <p className="text-sm text-white/45">
                  {player.isHost ? "Host" : "Player"} · {player.connected ? "Online" : "Away"}
                </p>
              </div>
            </div>
            <p className="text-lg font-semibold text-white">{player.score}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
