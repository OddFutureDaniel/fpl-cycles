"use client";

import { useEffect, useState } from "react";
import type { FplPlayerGw } from "@/lib/fpl/types";
import { POS_LABEL, type SquadPlayer } from "@/lib/live";

type Row = FplPlayerGw & { opponent: string };
type Col = { label: string; get: (r: Row) => string | number };

const xg = (v?: string) => (v ? Number(v).toFixed(2) : "–");
const BASE: Col[] = [
  { label: "GW", get: (r) => r.round },
  { label: "Opp", get: (r) => r.opponent },
  { label: "Min", get: (r) => r.minutes },
];
// Columns that matter for each position
const BY_POS: Record<1 | 2 | 3 | 4, Col[]> = {
  1: [
    { label: "Saves", get: (r) => r.saves },
    { label: "CS", get: (r) => r.clean_sheets },
    { label: "GC", get: (r) => r.goals_conceded },
  ],
  2: [
    { label: "G", get: (r) => r.goals_scored },
    { label: "A", get: (r) => r.assists },
    { label: "CS", get: (r) => r.clean_sheets },
    { label: "GC", get: (r) => r.goals_conceded },
    { label: "DC", get: (r) => r.defensive_contribution ?? "–" },
  ],
  3: [
    { label: "G", get: (r) => r.goals_scored },
    { label: "A", get: (r) => r.assists },
    { label: "xGI", get: (r) => xg(String(Number(r.expected_goals ?? 0) + Number(r.expected_assists ?? 0))) },
    { label: "CS", get: (r) => r.clean_sheets },
    { label: "DC", get: (r) => r.defensive_contribution ?? "–" },
  ],
  4: [
    { label: "G", get: (r) => r.goals_scored },
    { label: "A", get: (r) => r.assists },
    { label: "xG", get: (r) => xg(r.expected_goals) },
    { label: "xA", get: (r) => xg(r.expected_assists) },
  ],
};
const TAIL: Col[] = [
  { label: "BPS", get: (r) => r.bps },
  { label: "Bon", get: (r) => r.bonus },
  { label: "Pts", get: (r) => r.total_points },
];

export function PlayerModal({ player, onClose }: { player: SquadPlayer; onClose: () => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/player/${player.id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setRows(d.history))
      .catch(() => setError(true));
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [player.id, onClose]);

  const cols = [...BASE, ...BY_POS[player.pos], ...TAIL];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-label={`${player.name} last five gameweeks`}
        className="w-full max-w-lg rounded-t-2xl bg-card p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="text-lg font-bold">{player.name}</div>
            <div className="text-sm text-muted">
              {player.team} · {POS_LABEL[player.pos]} · this GW {player.points} pts
              {player.bonusProvisional && " (incl. provisional bonus)"}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-muted hover:bg-paper" aria-label="Close">
            ✕
          </button>
        </div>
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Last 5 gameweeks</div>
        {error ? (
          <p className="py-6 text-center text-sm text-muted">Couldn’t load player history.</p>
        ) : !rows ? (
          <p className="py-6 text-center text-sm text-muted">Loading…</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  {cols.map((c) => (
                    <th key={c.label} className={`py-1.5 px-1.5 font-semibold ${c.label === "Opp" ? "text-left" : "text-right"}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.round + r.opponent}>
                    {cols.map((c) => (
                      <td
                        key={c.label}
                        className={`py-1.5 px-1.5 ${c.label === "Opp" ? "text-left text-muted" : "text-right"} ${c.label === "Pts" ? "font-bold" : ""}`}
                      >
                        {c.get(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
