import type { LeagueData } from "@/lib/league";
import { overallStandings } from "@/lib/scoring";
import { Card, GapCell, ManagerCell, RankCell, Th } from "./ui";

export function OverallTable({ data }: { data: LeagueData }) {
  const rows = overallStandings(data.managers, data.cycles, data.gwMap, data.lastGw);
  const lastFinal = data.lastGw ? data.gwMap.get(data.lastGw)?.final : true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Overall</h2>
        <span className="text-muted">Season to date · net of hits</span>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <Th className="text-right">#</Th>
              <Th className="text-left">Manager</Th>
              {data.lastGw && <Th className="hidden text-right sm:table-cell">GW{data.lastGw}</Th>}
              <Th className="hidden text-right md:table-cell">Best</Th>
              <Th className="hidden text-right md:table-cell">Avg</Th>
              <Th className="hidden text-right md:table-cell">Hits</Th>
              <Th className="text-right">Wins</Th>
              <Th className="text-right">Pts</Th>
              <Th className="text-right">Gap</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.entry} data-entry={r.entry}>
                <RankCell rank={r.rank} highlight={r.rank === 1} />
                <ManagerCell name={r.name} team={r.team} />
                {data.lastGw && (
                  <td className={`hidden py-2.5 px-2 text-right sm:table-cell ${lastFinal ? "" : "text-live"}`}>
                    {r.lastGw ?? "·"}
                  </td>
                )}
                <td className="hidden py-2.5 px-2 text-right md:table-cell">{r.bestGw ?? "·"}</td>
                <td className="hidden py-2.5 px-2 text-right md:table-cell">{r.average.toFixed(1)}</td>
                <td className="hidden py-2.5 px-2 text-right text-muted md:table-cell">{r.hits ? `−${r.hits}` : "–"}</td>
                <td className="py-2.5 px-2 text-right">
                  {r.cycleWins > 0 ? <span className="font-semibold text-gold">{r.cycleWins}</span> : <span className="text-line">0</span>}
                </td>
                <td className="py-2.5 px-2 text-right text-base font-bold">{r.total}</td>
                <GapCell gap={r.gap} />
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
