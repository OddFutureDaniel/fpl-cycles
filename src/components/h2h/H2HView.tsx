import { Suspense } from "react";
import { loadLive, type LeagueData, type LiveRow } from "@/lib/league";
import { headToHead, type H2HRow } from "@/lib/live";
import { Card } from "../ui";
import { H2HPicker } from "./H2HPicker";

const CHIP: Record<string, string> = { bboost: "Bench Boost", "3xc": "Triple Captain", freehit: "Free Hit", wildcard: "Wildcard" };

export async function H2HView({ data, a, b }: { data: LeagueData; a?: number; b?: number }) {
  let live;
  try {
    live = await loadLive(data);
  } catch {
    live = null;
  }
  if (!live) return <p className="py-10 text-center text-muted">Live data is unavailable right now.</p>;

  // Default pair: top two in the live table
  const byEntry = new Map(live.table.map((r) => [r.entry, r]));
  const [first, second] = live.table;
  const A = byEntry.get(a ?? 0) ?? first;
  const B = byEntry.get(b ?? 0) && b !== A.entry ? byEntry.get(b!)! : A === first ? second : first;
  if (!A || !B) return <p className="py-10 text-center text-muted">Needs at least two managers.</p>;

  const { shared, diffs } = headToHead(A.squad, B.squad);
  const gwGap = A.net - B.net;
  const toPlay = (rows: H2HRow[], side: "a" | "b") =>
    rows.filter((r) => r[side] > r[side === "a" ? "b" : "a"] && (r.player.status === "to-play" || r.player.status === "playing")).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Head to head</h2>
        <span className="text-muted">Gameweek {live.gw}</span>
      </div>

      <Suspense>
        <H2HPicker managers={data.managers.map(({ entry, name }) => ({ entry, name }))} a={A.entry} b={B.entry} />
      </Suspense>

      <div className="grid grid-cols-2 gap-3">
        <Side row={A} edge={toPlay(diffs, "a")} />
        <Side row={B} edge={toPlay(diffs, "b")} />
      </div>

      <Card className="px-4 py-3 text-center">
        <div className="text-sm text-muted">This gameweek</div>
        <div className="text-lg font-bold">
          {gwGap === 0 ? "Level" : `${gwGap > 0 ? A.name : B.name} up by ${Math.abs(gwGap)}`}
        </div>
        <div className="text-sm text-muted">
          Season: {A.total === B.total ? "level" : `${A.total > B.total ? A.name : B.name} ahead by ${Math.abs(A.total - B.total)}`}
        </div>
      </Card>

      <section className="space-y-2">
        <h3 className="text-lg font-bold">Differentials</h3>
        <p className="text-sm text-muted">Players who count for one side more than the other, including captaincy. Swing is the points difference they make.</p>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pl-3 text-left font-semibold">Player</th>
                <th className="px-2 text-right font-semibold">Pts</th>
                <th className="px-2 text-center font-semibold">{A.name.split(" ")[0]}</th>
                <th className="px-2 text-center font-semibold">{B.name.split(" ")[0]}</th>
                <th className="py-2 pr-3 text-right font-semibold">Swing</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {diffs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-muted">Identical teams this week.</td>
                </tr>
              )}
              {diffs.map((r) => (
                <tr key={r.player.id}>
                  <td className="py-2 pl-3">
                    <div className="font-semibold">{r.player.name}</div>
                    <div className="text-xs text-muted">
                      {r.player.team} · {r.player.status === "to-play" ? "yet to play" : r.player.benched ? "not on" : `${r.player.minutes}′`}
                    </div>
                  </td>
                  <td className="px-2 text-right">{r.player.points}</td>
                  <td className="px-2 text-center">{mult(r.a)}</td>
                  <td className="px-2 text-center">{mult(r.b)}</td>
                  <td className={`py-2 pr-3 text-right font-bold ${r.swing > 0 ? "text-pitch" : r.swing < 0 ? "text-live" : "text-muted"}`}>
                    {r.swing > 0 ? `+${r.swing}` : r.swing}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="text-xs text-muted">Swing is from {A.name}’s side: green helps them, orange helps {B.name}. Hits aren’t included here.</p>
      </section>

      {shared.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-lg font-bold">Shared ({shared.length})</h3>
          <p className="text-sm text-muted">Cancel each other out.</p>
          <div className="flex flex-wrap gap-1.5">
            {shared.map((r) => (
              <span key={r.player.id} className="rounded-full border border-line bg-card px-2.5 py-1 text-xs">
                <span className="font-semibold">{r.player.name}</span> <span className="text-muted">{r.player.points * r.a}</span>
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const mult = (m: number) => (m === 0 ? <span className="text-line">–</span> : m === 1 ? "✓" : <span className="font-bold">C×{m}</span>);

function Side({ row, edge }: { row: LiveRow; edge: number }) {
  return (
    <Card className="px-3 py-3 sm:px-4" >
      <div data-entry={row.entry} className="truncate font-bold">{row.name}</div>
      <div className="truncate text-xs text-muted">{row.team}</div>
      <div className="mt-2 text-3xl font-black">{row.net}</div>
      <div className="text-xs text-muted">
        GW pts{row.hits > 0 && ` (after −${row.hits})`} · rank {row.rank}
      </div>
      <dl className="mt-2 space-y-0.5 text-xs">
        <div>
          <dt className="inline text-muted">Captain </dt>
          <dd className="inline font-semibold">
            {row.captain}
            {row.viceActive && (row.viceProvisional ? " (VC?)" : " (VC)")}
          </dd>
        </div>
        {row.chip && (
          <div>
            <dt className="inline text-muted">Chip </dt>
            <dd className="inline font-semibold">{CHIP[row.chip] ?? row.chip}</dd>
          </div>
        )}
        <div>
          <dt className="inline text-muted">Left to play </dt>
          <dd className="inline font-semibold">
            {row.toPlay + row.playing}
            {edge > 0 && <span className="font-normal text-muted"> ({edge} differential{edge > 1 ? "s" : ""})</span>}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
