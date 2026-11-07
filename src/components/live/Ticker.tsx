import type { TickerMatch } from "@/lib/live";

const kickoff = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })
    : "TBC";

function Side({ events }: { events: TickerMatch["events"] }) {
  const goals = events.filter((e) => e.kind !== "assist");
  const assists = events.filter((e) => e.kind === "assist");
  return (
    <div className="min-w-0 space-y-0.5">
      {goals.map((g) => (
        <div key={g.name + g.kind} className="truncate">
          {g.name}
          {g.kind === "og" ? " (OG)" : ""} <span aria-label={`${g.count} goals`}>{"⚽".repeat(g.count)}</span>
        </div>
      ))}
      {assists.map((a) => (
        <div key={a.name} className="truncate text-muted">
          {a.name} <span className="text-[10px] font-semibold">A{a.count > 1 ? `×${a.count}` : ""}</span>
        </div>
      ))}
    </div>
  );
}

export function Ticker({ matches }: { matches: TickerMatch[] }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1">
      <div className="flex w-max gap-2">
        {matches.map((m) => (
          <div
            key={m.id}
            className={`w-56 shrink-0 rounded-xl border bg-card px-3 py-2.5 text-xs ${m.state === "live" ? "border-live/40" : "border-line"}`}
          >
            <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide">
              {m.state === "live" ? (
                <span className="flex items-center gap-1.5 text-live">
                  <span className="size-1.5 animate-pulse rounded-full bg-live" />
                  {m.minutes}′
                </span>
              ) : (
                <span className="text-muted">{m.state === "ft" ? "Full time" : kickoff(m.kickoff)}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-base font-bold">
              <span>{m.home}</span>
              <span className="tabular-nums">
                {m.state === "upcoming" ? "v" : `${m.homeScore} – ${m.awayScore}`}
              </span>
              <span>{m.away}</span>
            </div>
            {m.events.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2">
                <Side events={m.events.filter((e) => e.side === "h")} />
                <div className="text-right">
                  <Side events={m.events.filter((e) => e.side === "a")} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
