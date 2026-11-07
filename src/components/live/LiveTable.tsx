"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import type { LiveRow } from "@/lib/league";
import { POS_LABEL, type SquadPlayer } from "@/lib/live";
import { PlayerModal } from "./PlayerModal";

const CHIP: Record<string, string> = { bboost: "BB", "3xc": "TC", freehit: "FH", wildcard: "WC", manager: "AM" };
const left = (r: LiveRow) => r.toPlay + r.playing;

type Key = "rank" | "movement" | "name" | "net" | "total" | "gap" | "captain" | "chip" | "autoSubs" | "bps" | "defcon" | "status" | "overallRank";

// Sort value per column; the first click sorts the "best" way round for each
const COLUMNS: { key: Key; label: string; title?: string; align?: "left"; value: (r: LiveRow) => number | string; desc?: boolean; hide?: string }[] = [
  { key: "rank", label: "#", value: (r) => r.rank },
  { key: "movement", label: "", title: "Places moved this gameweek", value: (r) => r.movement, desc: true },
  { key: "name", label: "Team", align: "left", value: (r) => r.name.toLowerCase() },
  { key: "net", label: "GW", title: "Live gameweek points, net of hits", value: (r) => r.net, desc: true },
  { key: "total", label: "Total", value: (r) => r.total, desc: true },
  { key: "gap", label: "Gap", value: (r) => r.gap },
  { key: "captain", label: "Cpt", align: "left", value: (r) => r.captain.toLowerCase(), hide: "hidden sm:table-cell" },
  { key: "chip", label: "Chip", value: (r) => r.chip ?? "", desc: true, hide: "hidden sm:table-cell" },
  { key: "autoSubs", label: "Auto-Sub", value: (r) => r.autoSubs.length, desc: true, hide: "hidden md:table-cell" },
  { key: "bps", label: "BPS", value: (r) => r.bps, desc: true, hide: "hidden md:table-cell" },
  { key: "defcon", label: "DEFCON", value: (r) => r.defcon, desc: true, hide: "hidden md:table-cell" },
  { key: "status", label: "Status", title: "Players still to play or playing", value: (r) => left(r), desc: true, hide: "hidden sm:table-cell" },
  { key: "overallRank", label: "OR", title: "Overall rank", value: (r) => r.overallRank ?? Infinity, hide: "hidden lg:table-cell" },
];

const fmtRank = (n: number | null) => (n == null ? "–" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}m` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

export function LiveTable({ rows: liveRows, final }: { rows: LiveRow[]; final: boolean }) {
  // "Confirmed only" strips unconfirmed bonus so the table matches FPL's own league page
  const [confirmedOnly, setConfirmedOnly] = useState(false);
  const rows = useMemo(() => (confirmedOnly ? withoutProvisionalBonus(liveRows) : liveRows), [liveRows, confirmedOnly]);
  const hasProvisional = liveRows.some((r) => r.provisionalBonus > 0);
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "rank", desc: false });
  const [open, setOpen] = useState<number | null>(null);
  const [player, setPlayer] = useState<SquadPlayer | null>(null);
  const closePlayer = useCallback(() => setPlayer(null), []);

  const sorted = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key)!;
    return [...rows].sort((a, b) => {
      const [x, y] = [col.value(a), col.value(b)];
      const cmp = typeof x === "string" ? x.localeCompare(String(y)) : x - (y as number);
      return (sort.desc ? -cmp : cmp) || a.rank - b.rank;
    });
  }, [rows, sort]);

  const toggleSort = (key: Key) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: !!COLUMNS.find((c) => c.key === key)?.desc }));

  return (
    <>
      {hasProvisional && (
        <div className="mb-2 flex items-center justify-end gap-2 text-xs">
          <span className="text-muted">Bonus</span>
          <div className="flex rounded-lg border border-line bg-card p-0.5">
            {[
              { on: false, label: "Live" },
              { on: true, label: "Confirmed only" },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => setConfirmedOnly(o.on)}
                aria-pressed={confirmedOnly === o.on}
                className={`rounded-md px-2 py-0.5 font-semibold ${confirmedOnly === o.on ? "bg-ink text-paper" : "text-muted"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-line bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  title={c.title}
                  aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : undefined}
                  className={`px-2 py-2 text-xs font-semibold uppercase tracking-wide text-muted ${c.align === "left" ? "text-left" : "text-right"} ${c.hide ?? ""}`}
                >
                  <button onClick={() => toggleSort(c.key)} className={`hover:text-ink ${sort.key === c.key ? "text-ink" : ""}`}>
                    {c.label}
                    {sort.key === c.key && (sort.desc ? " ↓" : " ↑")}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {sorted.map((r) => (
              <Fragment key={r.entry}>
                <tr
                  data-entry={r.entry}
                  onClick={() => setOpen(open === r.entry ? null : r.entry)}
                  className={`cursor-pointer hover:bg-paper/60 ${open === r.entry ? "bg-paper/60" : ""}`}
                  aria-expanded={open === r.entry}
                >
                  <td className="w-8 py-2.5 pl-3 pr-1 text-right text-muted">{r.rank}</td>
                  <td className="w-8 px-1 text-right text-xs font-semibold">
                    {r.movement > 0 ? (
                      <span className="text-pitch">▲{r.movement}</span>
                    ) : r.movement < 0 ? (
                      <span className="text-live">▼{-r.movement}</span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-2 pl-1">
                    <div className="font-semibold leading-tight">{r.name}</div>
                    <div className="text-xs leading-tight text-muted">{r.team}</div>
                  </td>
                  <td className={`px-2 text-right font-semibold ${final ? "" : "text-live"}`}>
                    {r.net}
                    {r.hits > 0 && <sup className="ml-0.5 text-[10px] font-normal text-muted">−{r.hits}</sup>}
                  </td>
                  <td className="px-2 text-right text-base font-bold">{r.total}</td>
                  <td className="px-2 text-right text-muted">{r.gap ? `−${r.gap}` : "–"}</td>
                  <td className="hidden px-2 sm:table-cell">
                    {r.captain}
                    {r.viceActive && (
                      <span
                        className="ml-1 rounded bg-gold-soft px-1 text-[10px] font-bold text-gold"
                        title={r.viceProvisional ? "Captain not on the pitch: vice has the armband unless he comes on" : "Vice-captain activated"}
                      >
                        VC{r.viceProvisional && "?"}
                      </span>
                    )}
                  </td>
                  <td className="hidden px-2 text-right sm:table-cell">
                    {r.chip && <span className="rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-paper">{CHIP[r.chip] ?? r.chip}</span>}
                  </td>
                  <td className="hidden px-2 text-right text-xs md:table-cell" title={r.autoSubs.map((s) => `${s.out} → ${s.in}`).join(", ")}>
                    {r.autoSubs.length ? `${r.autoSubs.length} ${r.autoSubsConfirmed ? "" : "(pred.)"}` : "–"}
                  </td>
                  <td className="hidden px-2 text-right md:table-cell">{r.bps}</td>
                  <td className="hidden px-2 text-right md:table-cell">{r.defcon || "–"}</td>
                  <td className="hidden px-2 text-right text-xs sm:table-cell">
                    {left(r) === 0 ? (
                      <span className="text-muted">Done</span>
                    ) : (
                      <span className="whitespace-nowrap">
                        {r.playing > 0 && <span className="text-live">{r.playing} live</span>}
                        {r.playing > 0 && r.toPlay > 0 && " · "}
                        {r.toPlay > 0 && <span>{r.toPlay} to play</span>}
                      </span>
                    )}
                  </td>
                  <td className="hidden py-2.5 pl-2 pr-3 text-right text-muted lg:table-cell">{fmtRank(r.overallRank)}</td>
                </tr>
                {open === r.entry && (
                  <tr>
                    <td colSpan={COLUMNS.length} className="bg-paper/60 px-1.5 pb-4 pt-1 sm:px-3">
                      <Breakdown row={r} onPlayer={setPlayer} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">
        Tap a row for the squad, then a player for their last five gameweeks. Bonus marked * and auto-subs marked (pred.) are predicted until FPL confirms them.
      </p>
      {player && <PlayerModal player={player} onClose={closePlayer} />}
    </>
  );
}

function PlayerChip({ p, onClick }: { p: SquadPlayer; onClick: () => void }) {
  const dot = { "to-play": "bg-line", playing: "bg-live animate-pulse", done: "bg-pitch", blank: "bg-ink/20" }[p.status];
  return (
    <button
      onClick={onClick}
      className={`flex min-w-0 max-w-[7.5rem] flex-1 basis-0 flex-col items-center rounded-lg border bg-card px-1 py-1.5 text-center hover:border-ink/40 sm:px-2 ${
        p.subOut ? "border-dashed border-line opacity-50" : p.subIn ? "border-pitch/50" : "border-line"
      }`}
    >
      <span className="flex w-full min-w-0 items-center justify-center gap-0.5 text-[11px] font-semibold sm:gap-1 sm:text-xs">
        <span className={`size-1.5 shrink-0 rounded-full ${dot}`} />
        <span className={`truncate ${p.benched && p.multiplier > 0 ? "line-through decoration-live" : ""}`}>{p.name}</span>
        {p.isCaptain && <span className="shrink-0 rounded bg-ink px-1 text-[9px] text-paper">C</span>}
        {p.isVice && <span className="shrink-0 rounded border border-ink/40 px-1 text-[9px]">V</span>}
      </span>
      <span className="w-full truncate text-[9px] text-muted sm:text-[10px]">
        {p.team} · {p.benched ? "not on" : `${p.minutes}′`}{p.bonus > 0 && ` · ${p.bonus}b${p.bonusProvisional ? "*" : ""}`}
        {p.defcon > 0 && " · DC"}
      </span>
      <span className="text-sm font-bold">
        {p.points * Math.max(p.multiplier, 1)}
        {p.multiplier > 1 && <span className="ml-0.5 text-[10px] font-normal text-muted">×{p.multiplier}</span>}
        {p.subIn && <span className="ml-1 text-[10px] font-semibold text-pitch">IN</span>}
        {p.subOut && <span className="ml-1 text-[10px] font-semibold text-muted">OUT</span>}
      </span>
    </button>
  );
}

function Breakdown({ row, onPlayer }: { row: LiveRow; onPlayer: (p: SquadPlayer) => void }) {
  const starters = row.squad.filter((p) => p.position <= 11);
  const bench = row.squad.filter((p) => p.position > 11);
  return (
    // contain:inline-size stops the squad from widening the table; it fits whatever width the row has
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 [contain:inline-size] lg:grid-cols-[minmax(0,1fr)_15rem]">
      <div className="min-w-0 space-y-2">
        {([1, 2, 3, 4] as const).map((pos) => (
          <div key={pos} className="flex justify-center gap-1 sm:gap-1.5" aria-label={POS_LABEL[pos]}>
            {starters.filter((p) => p.pos === pos).map((p) => (
              <PlayerChip key={p.id} p={p} onClick={() => onPlayer(p)} />
            ))}
          </div>
        ))}
        <div className="pt-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
          Bench{row.chip === "bboost" && " · Bench Boost active"}
        </div>
        <div className="flex justify-center gap-1 sm:gap-1.5">
          {bench.map((p) => (
            <PlayerChip key={p.id} p={p} onClick={() => onPlayer(p)} />
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 self-start rounded-xl border border-line bg-card p-3 text-sm lg:grid-cols-1">
        <Item label="Gameweek">
          {row.points} pts{row.hits > 0 && ` − ${row.hits} hit = ${row.net}`}
        </Item>
        <Item label="Captain">
          {row.captain}
          {row.viceActive && (row.viceProvisional ? " (vice, captain not on yet)" : " (vice activated)")}
        </Item>
        <Item label="Bonus">{row.bonus} pts</Item>
        <Item label="Auto-subs">
          {row.autoSubs.length
            ? row.autoSubs.map((s) => `${s.out} → ${s.in}`).join(", ") + (row.autoSubsConfirmed ? "" : " (predicted)")
            : "None"}
        </Item>
        <Item label="Transfers this GW">
          {row.transfers.length ? (
            <ul>
              {row.transfers.map((t, i) => (
                <li key={i}>
                  <span className="text-live">{t.out}</span> → <span className="text-pitch">{t.in}</span>
                </li>
              ))}
            </ul>
          ) : (
            "None"
          )}
        </Item>
        <Item label="Free transfers next GW">
          {row.freeTransfers} <span className="text-xs text-muted">(estimate)</span>
        </Item>
      </dl>
    </div>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Re-ranks the table with unconfirmed bonus taken off; movement keeps its pre-gameweek baseline. */
function withoutProvisionalBonus(rows: LiveRow[]): LiveRow[] {
  const adjusted = rows.map((r) => ({
    ...r,
    net: r.net - r.provisionalBonus,
    points: r.points - r.provisionalBonus,
    total: r.total - r.provisionalBonus,
    bonus: r.bonus - r.provisionalBonus,
    before: r.rank + r.movement,
  }));
  const leader = Math.max(...adjusted.map((r) => r.total));
  return adjusted.map(({ before, ...r }) => {
    const rank = 1 + adjusted.filter((o) => o.total > r.total).length;
    return { ...r, rank, gap: leader - r.total, movement: before - rank };
  });
}
