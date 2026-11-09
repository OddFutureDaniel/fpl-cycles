import Link from "next/link";
import { CycleTable } from "@/components/CycleTable";
import { OverallTable } from "@/components/OverallTable";
import { Records } from "@/components/Records";
import { Charts } from "@/components/charts/Charts";
import { H2HView } from "@/components/h2h/H2HView";
import { LiveView } from "@/components/live/LiveView";
import { MeSelect } from "@/components/me";
import { RoundupButton } from "@/components/RoundupButton";
import { headers } from "next/headers";
import { cycleStatus } from "@/lib/cycles";
import { forfeitLeaders } from "@/lib/forfeits";
import { applyLiveScores, LEAGUE_ID, loadLeague, loadLive, type LeagueData } from "@/lib/league";
import { AutoRefresh } from "@/components/live/AutoRefresh";
import { buildRoundup } from "@/lib/roundup";

// Rendered per request; the FPL fetches underneath are cached for 5 minutes
export const dynamic = "force-dynamic";

type Search = Promise<{ view?: string; a?: string; b?: string }>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  const { view, a, b } = await searchParams;

  let data: LeagueData;
  try {
    data = await loadLeague();
  } catch (err) {
    console.error(err);
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="text-xl font-bold">Couldn’t reach Fantasy Premier League</h1>
        <p className="mt-2 text-muted">
          The FPL API may be updating between gameweeks or rate limiting requests. Try again in a few minutes.
        </p>
      </main>
    );
  }

  // Unconfirmed gameweek: every tab uses live scores and refreshes itself
  const gwOpen = !!data.currentGw && !data.currentGw.final;
  if (gwOpen) {
    const live = await loadLive(data).catch((err) => (console.error(err), null));
    if (live) applyLiveScores(data, live);
  }

  // Default to Live while a gameweek is being played, otherwise the latest cycle
  const latestCycle =
    data.cycles.find((c) => cycleStatus(c, data.gwMap) === "live") ??
    [...data.cycles].reverse().find((c) => cycleStatus(c, data.gwMap) === "complete");
  const active =
    view ?? (data.currentGw && !data.currentGw.final ? "live" : latestCycle ? `cycle-${latestCycle.number}` : "overall");
  const cycle = data.cycles.find((c) => `cycle-${c.number}` === active);

  const tabs = [
    { id: "live", label: "Live" },
    { id: "h2h", label: "H2H" },
    { id: "overall", label: "Overall" },
    ...data.cycles.map((c) => ({ id: `cycle-${c.number}`, label: `C${c.number}`, status: cycleStatus(c, data.gwMap) })),
    { id: "charts", label: "Charts" },
    { id: "records", label: "Records" },
  ];

  // WhatsApp round-up for the latest gameweek with points
  let roundup: string | null = null;
  if (data.lastGw) {
    const gwCycle = data.cycles.find((c) => data.lastGw! >= c.start && data.lastGw! <= c.end);
    const leaders = gwCycle ? await forfeitLeaders([gwCycle.number]).catch(() => new Map()) : new Map();
    const host = (await headers()).get("host");
    roundup = buildRoundup({
      league: data.name,
      managers: data.managers,
      cycles: data.cycles,
      gwMap: data.gwMap,
      gw: data.lastGw,
      forfeit: gwCycle ? (leaders.get(gwCycle.number) ?? null) : null,
      url: process.env.SITE_URL ?? (host ? `https://${host}` : undefined),
    });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <AutoRefresh active={gwOpen} />
      <header className="mb-6 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-pitch">Four-gameweek mini-league</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{data.name}</h1>
        </div>
        <div className="text-sm text-muted sm:text-right">
          {data.currentGw && (
            <div className="font-semibold text-ink">
              Gameweek {data.currentGw.id} {data.currentGw.final ? "· final" : "· live"}
            </div>
          )}
          <div>
            Updated {data.updatedAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" })}
          </div>
          <div className="mt-2 flex items-center gap-2 sm:justify-end">
            <MeSelect managers={data.managers.map(({ entry, name }) => ({ entry, name }))} />
            {roundup && <RoundupButton text={roundup} />}
          </div>
        </div>
      </header>

      <nav className="-mx-4 mb-6 overflow-x-auto px-4">
        <div className="flex w-max gap-1 rounded-xl border border-line bg-card p-1">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/?view=${t.id}`}
              className={`relative rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                t.id === active ? "bg-ink text-paper" : "text-muted hover:bg-paper hover:text-ink"
              } ${"status" in t && t.status === "upcoming" && t.id !== active ? "opacity-50" : ""}`}
            >
              {t.label}
              {"status" in t && t.status === "live" && (
                <span className="absolute top-1 right-1 size-1.5 rounded-full bg-live" />
              )}
            </Link>
          ))}
        </div>
      </nav>

      {active === "live" ? (
        <LiveView data={data} />
      ) : active === "h2h" ? (
        <H2HView data={data} a={Number(a) || undefined} b={Number(b) || undefined} />
      ) : active === "charts" ? (
        <Charts managers={data.managers} lastGw={data.lastGw ?? 0} />
      ) : active === "records" ? (
        <Records data={data} />
      ) : cycle ? (
        <CycleTable data={data} cycle={cycle} />
      ) : (
        <OverallTable data={data} />
      )}

      <footer className="mt-10 text-xs text-muted">
        Classic league {LEAGUE_ID} · Scores are net of transfer hits · Ties share the cycle win
      </footer>
    </main>
  );
}
