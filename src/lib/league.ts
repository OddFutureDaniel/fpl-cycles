import "server-only";
import { buildCycles } from "./cycles";
import { getAllPicks, getAllTransfers, getBootstrap, getFixtures, getHistories, getLeague, getLive } from "./fpl/client";
import * as fx from "./fpl/fixture";
import { buildLiveContext, buildTicker, computeManagerLive, estimateFreeTransfers, transfersInGw } from "./live";
import { rankBy, scoresFromHistory } from "./scoring";
import { cycleStatus } from "./cycles";
import type { FplBootstrap } from "./fpl/types";
import type { Gameweek, Manager } from "./types";

export const LEAGUE_ID = Number(process.env.FPL_LEAGUE_ID ?? 1447874);
export const useFixture = process.env.FPL_FIXTURE === "1";

const gameweekStates = (bootstrap: FplBootstrap, now = Date.now()): Gameweek[] =>
  bootstrap.events.map((e) => ({
    id: e.id,
    started: e.finished || new Date(e.deadline_time).getTime() <= now,
    final: e.finished && e.data_checked,
    isCurrent: e.is_current,
  }));

/** Cheap check (bootstrap only) used by the forfeit API: voting closes once a cycle is final. */
export async function cycleState(cycleNumber: number) {
  const cycle = buildCycles().find((c) => c.number === cycleNumber);
  if (!cycle) return null;
  const bootstrap = useFixture ? fx.fixtureBootstrap() : await getBootstrap();
  const gws = gameweekStates(bootstrap);
  return cycleStatus(cycle, new Map(gws.map((g) => [g.id, g])));
}

/** Season data shared by every view: league, gameweek states, histories. */
export async function loadLeague() {
  const [bootstrap, league] = useFixture
    ? [fx.fixtureBootstrap(), fx.fixtureLeague()]
    : await Promise.all([getBootstrap(), getLeague(LEAGUE_ID)]);

  const now = Date.now();
  const gameweeks = gameweekStates(bootstrap, now);

  const ids = league.managers.map((m) => m.entry);
  const histories = useFixture ? ids.map(fx.fixtureHistory) : await getHistories(ids);

  const managers: Manager[] = league.managers.map((m, i) => ({
    entry: m.entry,
    name: m.player_name,
    team: m.entry_name,
    scores: scoresFromHistory(histories[i]),
  }));

  const current = gameweeks.find((g) => g.isCurrent) ?? null;
  const lastStarted = [...gameweeks].reverse().find((g) => g.started) ?? null;

  return {
    name: league.name,
    bootstrap,
    histories,
    managers,
    gameweeks,
    gwMap: new Map(gameweeks.map((g) => [g.id, g])),
    cycles: buildCycles(),
    currentGw: current ?? lastStarted,
    lastGw: lastStarted?.id ?? null,
    updatedAt: new Date(now),
  };
}

export type LeagueData = Awaited<ReturnType<typeof loadLeague>>;

/**
 * Live gameweek: only fetched for the Live view, as it costs two extra
 * requests per manager (picks and transfers).
 */
export async function loadLive(data: LeagueData) {
  const gw = data.currentGw?.id;
  if (!gw) return null;
  const ids = data.managers.map((m) => m.entry);

  const [live, fixtures, picks, transfers] = useFixture
    ? [fx.fixtureLive(), fx.fixtureFixtures(), ids.map(fx.fixturePicks), ids.map(fx.fixtureTransfers)]
    : await Promise.all([getLive(gw), getFixtures(gw), getAllPicks(ids, gw), getAllTransfers(ids)]);

  const ctx = buildLiveContext(data.bootstrap, live, fixtures);

  const rows = data.managers.map((m, i) => {
    const prevTotal = Object.values(m.scores).filter((s) => s.gw < gw).reduce((sum, s) => sum + s.net, 0);
    const ml = computeManagerLive(picks[i], ctx);
    return {
      entry: m.entry,
      name: m.name,
      team: m.team,
      prevTotal,
      total: prevTotal + ml.net,
      overallRank: picks[i].entry_history.overall_rank,
      transfers: transfersInGw(transfers[i], gw, ctx),
      freeTransfers: estimateFreeTransfers(data.histories[i], gw),
      ...ml,
    };
  });

  // Movement compares live position with position before this gameweek
  const before = new Map(rankBy(rows.map((r) => ({ ...r, total: r.prevTotal }))).map((r) => [r.entry, r.rank]));
  const table = rankBy(rows).map((r) => ({ ...r, movement: (before.get(r.entry) ?? r.rank) - r.rank }));

  return {
    gw,
    final: !!data.currentGw?.final,
    anyLive: fixtures.some((f) => f.started && !(f.finished || f.finished_provisional)),
    ticker: buildTicker(fixtures, data.bootstrap, ctx),
    table,
  };
}

export type LiveData = NonNullable<Awaited<ReturnType<typeof loadLive>>>;
export type LiveRow = LiveData["table"][number];
