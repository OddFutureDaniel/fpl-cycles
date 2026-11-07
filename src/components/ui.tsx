import type { CycleStatus, GwScore } from "@/lib/types";

export const gwRange = (start: number, end: number) => `GW${start}–${end}`;

const STATUS_STYLE: Record<CycleStatus, string> = {
  complete: "bg-pitch-soft text-pitch",
  live: "bg-live-soft text-live",
  upcoming: "bg-line/60 text-muted",
};
const STATUS_LABEL: Record<CycleStatus, string> = { complete: "Final", live: "In progress", upcoming: "Upcoming" };

export function StatusBadge({ status }: { status: CycleStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {status === "live" && <span className="size-1.5 animate-pulse rounded-full bg-live" />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ManagerCell({ name, team }: { name: string; team: string }) {
  return (
    <td className="py-2.5 pr-3">
      <div className="font-semibold leading-tight">{name}</div>
      <div className="text-xs text-muted leading-tight">{team}</div>
    </td>
  );
}

export function RankCell({ rank, highlight }: { rank: number; highlight?: boolean }) {
  return (
    <td className="w-10 py-2.5 pl-3 pr-2 text-right">
      <span className={highlight ? "font-bold text-gold" : "text-muted"}>{rank}</span>
    </td>
  );
}

export function GapCell({ gap }: { gap: number }) {
  return <td className="py-2.5 pl-2 pr-3 text-right text-muted">{gap === 0 ? "–" : `−${gap}`}</td>;
}

const CHIP_LABEL: Record<string, string> = { "3xc": "TC", bboost: "BB", freehit: "FH", wildcard: "WC", manager: "AM" };

/** Net points, with hits and chips as small annotations. */
export function ScoreCell({ score, provisional }: { score: GwScore | null; provisional?: boolean }) {
  return (
    <td className="hidden py-2.5 px-2 text-right sm:table-cell">
      {score ? (
        <span className={provisional ? "text-live" : undefined}>
          {score.net}
          {score.hits > 0 && <sup className="ml-0.5 text-[10px] text-muted">−{score.hits}</sup>}
          {score.chip && (
            <span className="ml-1 rounded bg-ink px-1 text-[9px] font-bold text-paper align-middle">
              {CHIP_LABEL[score.chip] ?? score.chip}
            </span>
          )}
        </span>
      ) : (
        <span className="text-line">·</span>
      )}
    </td>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={`py-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted ${className}`}>{children}</th>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-card ${className}`}>{children}</section>;
}
