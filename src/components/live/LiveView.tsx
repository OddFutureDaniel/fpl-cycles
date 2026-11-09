import { loadLive, type LeagueData } from "@/lib/league";
import { LiveTable } from "./LiveTable";
import { Ticker } from "./Ticker";

export async function LiveView({ data }: { data: LeagueData }) {
  let live;
  try {
    live = await loadLive(data);
  } catch (err) {
    console.error(err);
    return <p className="py-10 text-center text-muted">Live data is unavailable right now. FPL may be updating; try again shortly.</p>;
  }
  if (!live) return <p className="py-10 text-center text-muted">The season hasn’t started yet.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-bold tracking-tight">Gameweek {live.gw}</h2>
        {live.anyLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-live-soft px-2.5 py-0.5 text-xs font-semibold text-live">
            <span className="size-1.5 animate-pulse rounded-full bg-live" />
            Live · updates every minute
          </span>
        ) : (
          <span className="rounded-full bg-line/60 px-2.5 py-0.5 text-xs font-semibold text-muted">
            {live.final ? "Final" : "Between matches"}
          </span>
        )}
      </div>
      <Ticker matches={live.ticker} />
      <LiveTable rows={live.table} final={live.final} />
    </div>
  );
}
