import Link from "next/link";
import { cycleStatus } from "@/lib/cycles";
import type { LeagueData } from "@/lib/league";
import { forfeitLeaders } from "@/lib/forfeits";
import { cycleStandings, cycleWinners, gameweekTopScorers } from "@/lib/scoring";
import { Card, gwRange, StatusBadge } from "./ui";

export async function Records({ data }: { data: LeagueData }) {
  const champions = new Map(cycleWinners(data.managers, data.cycles, data.gwMap).map((c) => [c.cycle.number, c]));
  const forfeits = await forfeitLeaders([...champions.keys()]).catch(() => new Map());
  // Bottom of each completed cycle, joint if tied
  const losers = new Map(
    [...champions.keys()].map((n) => {
      const rows = cycleStandings(data.managers, data.cycles[n - 1], data.gwMap);
      const bottom = Math.max(...rows.map((r) => r.rank));
      return [n, rows.filter((r) => r.rank === bottom).map((r) => r.name).join(" & ")];
    }),
  );
  const topScorers = gameweekTopScorers(data.managers, data.gameweeks).reverse();

  const winCounts = new Map<string, number>();
  for (const { winners } of champions.values()) {
    for (const w of winners) winCounts.set(w.name, (winCounts.get(w.name) ?? 0) + 1);
  }
  const leaderboard = [...winCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">Cycle champions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.cycles.map((cycle) => {
            const status = cycleStatus(cycle, data.gwMap);
            const champ = champions.get(cycle.number);
            const leader = status === "live" ? cycleStandings(data.managers, cycle, data.gwMap)[0] : null;
            return (
              <Link key={cycle.number} href={`/?view=cycle-${cycle.number}`} className="block">
                <Card className={`h-full px-4 py-3 transition hover:border-ink/30 ${champ ? "border-gold/30" : ""}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      Cycle {cycle.number} <span className="font-normal text-muted">{gwRange(cycle.start, cycle.end)}</span>
                    </span>
                    <StatusBadge status={status} />
                  </div>
                  <div className="mt-2 min-h-12">
                    {champ ? (
                      <>
                        <div className="font-bold">{champ.winners.map((w) => w.name).join(" & ")}</div>
                        <div className="text-sm text-muted">{champ.score} pts{champ.winners.length > 1 && " · joint"}</div>
                        <div className="mt-2 border-t border-line pt-2 text-xs">
                          <span className="font-semibold text-live">Forfeit: {losers.get(cycle.number)}</span>
                          <div className="text-muted">{forfeits.get(cycle.number)?.text ?? "No forfeit voted"}</div>
                        </div>
                      </>
                    ) : leader ? (
                      <>
                        <div className="text-sm text-muted">Currently leading</div>
                        <div className="font-semibold">{leader.name} · {leader.total}</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted">Not started</div>
                    )}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Most cycle wins</h2>
          <Card className="divide-y divide-line">
            {leaderboard.length === 0 && <p className="px-4 py-6 text-center text-muted">No completed cycles yet.</p>}
            {leaderboard.map(([name, wins]) => (
              <div key={name} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="font-semibold">{name}</span>
                <span className="font-bold text-gold">{"🏆".repeat(wins)}</span>
              </div>
            ))}
          </Card>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold tracking-tight">Manager of the gameweek</h2>
          <Card className="divide-y divide-line">
            {topScorers.map((t) => (
              <div key={t.gw} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="w-12 text-muted">GW{t.gw}</span>
                <span className="flex-1 font-semibold">{t.managers.map((m) => m.name).join(" & ")}</span>
                <span className={`font-bold ${t.final ? "" : "text-live"}`}>{t.score}</span>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}
