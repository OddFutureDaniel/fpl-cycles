import { cycleGameweeks, cycleStatus } from "@/lib/cycles";
import type { LeagueData } from "@/lib/league";
import { cycleStandings } from "@/lib/scoring";
import type { Cycle } from "@/lib/types";
import { listForfeits, usingMemoryStore } from "@/lib/forfeits";
import { useFixture } from "@/lib/league";
import { readVoter } from "@/lib/voter";
import { ForfeitBoard } from "./forfeits/ForfeitBoard";
import { Card, GapCell, gwRange, RankCell, ScoreCell, StatusBadge, Th } from "./ui";

export async function CycleTable({ data, cycle }: { data: LeagueData; cycle: Cycle }) {
  const status = cycleStatus(cycle, data.gwMap);
  const rows = cycleStandings(data.managers, cycle, data.gwMap);
  const gwIds = cycleGameweeks(cycle);
  const winners = rows.filter((r) => r.winner);
  const remaining = gwIds.filter((id) => !data.gwMap.get(id)?.final).length;
  // Bottom of the cycle does the forfeit (joint if tied)
  const bottomRank = Math.max(...rows.map((r) => r.rank));
  const losers = status === "upcoming" ? [] : rows.filter((r) => r.rank === bottomRank && rows.length > 1);
  const forfeits = await listForfeits(cycle.number, await readVoter()).catch(() => []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Cycle {cycle.number}</h2>
        <span className="text-muted">{gwRange(cycle.start, cycle.end)}</span>
        <StatusBadge status={status} />
        {status === "live" && (
          <span className="text-sm text-muted">
            {remaining} gameweek{remaining === 1 ? "" : "s"} to go · orange scores are provisional
          </span>
        )}
      </div>

      {winners.length > 0 && (
        <div className="rounded-xl border border-gold/30 bg-gold-soft px-4 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gold">
            {winners.length > 1 ? "Joint winners" : "Winner"}
          </span>
          <div className="text-lg font-bold">
            {winners.map((w) => w.name).join(" & ")} <span className="font-normal text-muted">· {winners[0].total} pts</span>
          </div>
        </div>
      )}

      {status === "upcoming" ? (
        <Card className="px-4 py-10 text-center text-muted">
          This cycle starts at the GW{cycle.start} deadline.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line">
              <tr>
                <Th className="text-right">#</Th>
                <Th className="text-left">Manager</Th>
                {gwIds.map((id) => (
                  <Th key={id} className="hidden text-right sm:table-cell">
                    GW{id}
                  </Th>
                ))}
                <Th className="text-right">Pts</Th>
                <Th className="text-right">Gap</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.entry} data-entry={r.entry} className={r.winner ? "bg-gold-soft/50" : undefined}>
                  <RankCell rank={r.rank} highlight={r.winner} />
                  <td className="py-2.5 pr-3">
                    <div className="font-semibold leading-tight">{r.name}</div>
                    <div className="text-xs text-muted leading-tight">
                      {r.team}
                      {r.missed > 0 && <span className="ml-1.5 text-live">· joined late ({r.missed} GW missed)</span>}
                      {status === "complete" && losers.includes(r) && (
                        <span className="ml-1.5 rounded bg-live-soft px-1 text-[10px] font-bold text-live">FORFEIT</span>
                      )}
                    </div>
                  </td>
                  {r.gws.map((s, i) => (
                    <ScoreCell key={gwIds[i]} score={s} provisional={!data.gwMap.get(gwIds[i])?.final} />
                  ))}
                  <td className="py-2.5 px-2 text-right text-base font-bold">{r.total}</td>
                  <GapCell gap={r.gap} />
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {usingMemoryStore && !useFixture && process.env.NODE_ENV === "production" && (
        <p className="rounded-lg bg-live-soft px-3 py-2 text-sm text-live">
          Forfeit storage isn’t connected, so suggestions won’t be saved. Add the Upstash Redis integration in Vercel.
        </p>
      )}
      <ForfeitBoard
        key={cycle.number}
        cycle={cycle.number}
        endGw={cycle.end}
        open={status !== "complete"}
        initial={forfeits}
        loser={losers.length ? losers.map((l) => l.name).join(" & ") : null}
      />
    </div>
  );
}
