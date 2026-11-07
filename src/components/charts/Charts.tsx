"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMe } from "@/components/me";
import type { Manager } from "@/lib/types";

// Validated categorical order (see dataviz palette); slots stick to a manager while selected
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"];
const MAX_SELECTED = SERIES.length;

type Mode = "total" | "gap" | "weekly" | "position";
const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: "total", label: "Points race", blurb: "Season total after each gameweek" },
  { id: "gap", label: "Gap to leader", blurb: "Points behind whoever was top after each gameweek" },
  { id: "weekly", label: "Weekly scores", blurb: "Net points each gameweek; darker is higher" },
  { id: "position", label: "Position", blurb: "League position after each gameweek" },
];

export function Charts({ managers, lastGw }: { managers: Manager[]; lastGw: number }) {
  const gws = useMemo(() => Array.from({ length: lastGw }, (_, i) => i + 1), [lastGw]);

  // Per manager: weekly net, cumulative total, gap to leader, league position
  const series = useMemo(() => {
    const totals = managers.map((m) => {
      let run = 0;
      return gws.map((g) => (run += m.scores[g]?.net ?? 0));
    });
    const leaders = gws.map((_, i) => Math.max(...totals.map((t) => t[i])));
    return managers.map((m, mi) => ({
      entry: m.entry,
      name: m.name,
      weekly: gws.map((g) => m.scores[g]?.net ?? null),
      total: totals[mi],
      gap: totals[mi].map((t, i) => t - leaders[i]),
      position: totals[mi].map((t, i) => 1 + totals.filter((o) => o[i] > t).length),
    }));
  }, [managers, gws]);

  const byFinal = useMemo(() => [...series].sort((a, b) => b.total.at(-1)! - a.total.at(-1)!), [series]);

  const [mode, setMode] = useState<Mode>("total");
  // entry -> colour slot; the top three start selected
  const [slots, setSlots] = useState<Map<number, number>>(() => new Map(byFinal.slice(0, 3).map((s, i) => [s.entry, i])));

  // Once we know who "me" is, open on me vs the leader (or me vs second if I'm top)
  const me = useMe();
  useEffect(() => {
    if (!me || !byFinal.some((s) => s.entry === me)) return;
    const rival = byFinal.find((s) => s.entry !== me)!;
    setSlots(new Map([[me, 0], [rival.entry, 1]]));
  }, [me, byFinal]);

  const toggle = (entry: number) =>
    setSlots((prev) => {
      const next = new Map(prev);
      if (next.has(entry)) next.delete(entry);
      else if (next.size < MAX_SELECTED) {
        const used = new Set(next.values());
        next.set(entry, SERIES.findIndex((_, i) => !used.has(i)));
      }
      return next;
    });

  if (!lastGw) return <p className="py-10 text-center text-muted">Charts appear after the first gameweek.</p>;
  const current = MODES.find((m) => m.id === mode)!;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Charts</h2>
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-card p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={`rounded-lg px-3 py-1 text-sm font-semibold ${mode === m.id ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {mode !== "weekly" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Compare (up to {MAX_SELECTED}):</span>
          {byFinal.map((s) => {
            const slot = slots.get(s.entry);
            const on = slot !== undefined;
            return (
              <button
                key={s.entry}
                onClick={() => toggle(s.entry)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                  on ? "border-ink/30 bg-card text-ink" : "border-line text-muted hover:text-ink"
                }`}
              >
                <span className="size-2 rounded-full" style={{ background: on ? SERIES[slot] : "var(--color-line)" }} />
                {s.name}
              </button>
            );
          })}
        </div>
      )}

      <section className="rounded-xl border border-line bg-card p-4">
        <p className="mb-3 text-sm text-muted">{current.blurb}</p>
        {mode === "weekly" ? (
          <Heatmap rows={byFinal} gws={gws} />
        ) : (
          <LineChart
            gws={gws}
            series={series.map((s) => ({ entry: s.entry, name: s.name, values: s[mode] }))}
            slots={slots}
            invert={mode === "position"}
            integerTicks={mode === "position"}
            maxY={mode === "position" ? series.length : undefined}
            minY={mode === "position" ? 1 : undefined}
            unit={mode === "position" ? "" : " pts"}
          />
        )}
      </section>
    </div>
  );
}

function niceTicks(min: number, max: number, count = 5) {
  const span = max - min || 1;
  const step = 10 ** Math.floor(Math.log10(span / count));
  const nice = [1, 2, 5, 10].map((m) => m * step).find((s) => span / s <= count) ?? step * 10;
  const ticks = [];
  for (let v = Math.ceil(min / nice) * nice; v <= max; v += nice) ticks.push(Math.round(v));
  return ticks;
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(700);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function LineChart(props: {
  gws: number[];
  series: { entry: number; name: string; values: number[] }[];
  slots: Map<number, number>;
  invert?: boolean;
  integerTicks?: boolean;
  minY?: number;
  maxY?: number;
  unit: string;
}) {
  const { gws, series, slots, invert, unit } = props;
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const height = 320;
  const pad = { top: 12, right: 96, bottom: 28, left: 44 };
  const all = series.flatMap((s) => s.values);
  const minY = props.minY ?? Math.min(...all);
  const maxY = props.maxY ?? Math.max(...all);
  const ticks = props.integerTicks
    ? Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i).filter((v, _, a) => a.length <= 12 || v === 1 || v % 2 === 0)
    : niceTicks(minY, maxY);

  const iw = Math.max(width - pad.left - pad.right, 100);
  const ih = height - pad.top - pad.bottom;
  const x = (i: number) => pad.left + (gws.length === 1 ? iw / 2 : (i / (gws.length - 1)) * iw);
  const y = (v: number) => {
    const t = (v - minY) / (maxY - minY || 1);
    return pad.top + (invert ? t : 1 - t) * ih;
  };
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");

  const selected = series.filter((s) => slots.has(s.entry));
  const rest = series.filter((s) => !slots.has(s.entry));
  const last = gws.length - 1;

  // Direct labels at the line ends, nudged apart so they don't overlap
  const labels = selected
    .map((s) => ({ s, y: y(s.values[last]) }))
    .sort((a, b) => a.y - b.y)
    .reduce<{ s: (typeof selected)[number]; y: number }[]>((acc, l) => {
      const prev = acc.at(-1);
      acc.push({ ...l, y: prev && l.y - prev.y < 14 ? prev.y + 14 : l.y });
      return acc;
    }, []);

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const i = Math.round(((e.clientX - box.left) / box.width) * last);
    setHover(Math.max(0, Math.min(last, i)));
  };

  const tip =
    hover === null
      ? null
      : [...selected].sort((a, b) => (invert ? a.values[hover] - b.values[hover] : b.values[hover] - a.values[hover]));

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label="Line chart by gameweek">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={pad.left + iw} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--color-muted)">
              {t}
            </text>
          </g>
        ))}
        {gws.map((g, i) =>
          gws.length <= 20 || i % 2 === 0 || i === last ? (
            <text key={g} x={x(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--color-muted)">
              {g}
            </text>
          ) : null,
        )}
        {rest.map((s) => (
          <path key={s.entry} d={path(s.values)} fill="none" stroke="var(--color-line)" strokeWidth={1.5} />
        ))}
        {selected.map((s) => (
          <g key={s.entry}>
            <path d={path(s.values)} fill="none" stroke={SERIES[slots.get(s.entry)!]} strokeWidth={2} strokeLinejoin="round" />
            <circle cx={x(last)} cy={y(s.values[last])} r={4} fill={SERIES[slots.get(s.entry)!]} stroke="var(--color-card)" strokeWidth={2} />
          </g>
        ))}
        {labels.map(({ s, y: ly }) => (
          <text key={s.entry} x={x(last) + 10} y={ly} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--color-ink)">
            {s.name}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={pad.top + ih} stroke="var(--color-ink)" strokeOpacity={0.25} />
            {selected.map((s) => (
              <circle key={s.entry} cx={x(hover)} cy={y(s.values[hover])} r={4} fill={SERIES[slots.get(s.entry)!]} stroke="var(--color-card)" strokeWidth={2} />
            ))}
          </g>
        )}
        <rect
          x={pad.left}
          y={pad.top}
          width={iw}
          height={ih}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {tip && hover !== null && tip.length > 0 && (
        <div
          className="pointer-events-none absolute top-2 rounded-lg border border-line bg-card px-3 py-2 text-xs shadow-md"
          style={x(hover) > width / 2 ? { right: width - x(hover) + 12 } : { left: x(hover) + 12 }}
        >
          <div className="mb-1 font-semibold">GW{gws[hover]}</div>
          {tip.map((s) => (
            <div key={s.entry} className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ background: SERIES[slots.get(s.entry)!] }} />
              <span className="flex-1">{s.name}</span>
              <span className="font-semibold tabular-nums">
                {invert ? ordinal(s.values[hover]) : `${s.values[hover]}${unit}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ordinal(n: number) {
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
}

function Heatmap({ rows, gws }: { rows: { entry: number; name: string; weekly: (number | null)[] }[]; gws: number[] }) {
  const vals = rows.flatMap((r) => r.weekly).filter((v): v is number => v !== null);
  const [min, max] = [Math.min(...vals), Math.max(...vals)];
  // Best score each week gets a ring, so streaks and one-off hauls stand out
  const best = gws.map((_, i) => Math.max(...rows.map((r) => r.weekly[i] ?? -Infinity)));

  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th />
            {gws.map((g) => (
              <th key={g} className="w-10 pb-1 text-center font-semibold text-muted">
                {g}
              </th>
            ))}
            <th className="pb-1 pl-2 text-right font-semibold text-muted">Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const played = r.weekly.filter((v): v is number => v !== null);
            return (
              <tr key={r.entry}>
                <th className="whitespace-nowrap pr-3 text-left font-semibold">{r.name}</th>
                {r.weekly.map((v, i) => {
                  const t = v === null ? 0 : (v - min) / (max - min || 1);
                  return (
                    <td
                      key={i}
                      title={v === null ? `GW${gws[i]}: didn't play` : `${r.name}, GW${gws[i]}: ${v} pts`}
                      className={`h-8 w-10 rounded text-center tabular-nums ${v === best[i] ? "ring-2 ring-ink ring-inset" : ""}`}
                      style={{
                        background: v === null ? "transparent" : `color-mix(in oklab, #2a78d6 ${Math.round(8 + t * 80)}%, #fcfcfb)`,
                        color: t > 0.55 ? "#fff" : "var(--color-ink)",
                      }}
                    >
                      {v ?? "·"}
                    </td>
                  );
                })}
                <td className="pl-2 text-right font-semibold tabular-nums">
                  {played.length ? (played.reduce((a, b) => a + b, 0) / played.length).toFixed(1) : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Outlined: top score of the week.</p>
    </div>
  );
}
