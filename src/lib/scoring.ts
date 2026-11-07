import { cycleGameweeks, cycleStatus } from "./cycles";
import type { FplEntryHistory } from "./fpl/types";
import type { Cycle, CycleRow, Gameweek, GwScore, Manager, OverallRow } from "./types";

/**
 * Net gameweek score = change in the running season total.
 * `total_points` already has hits deducted, so differencing it gives net
 * points without ever subtracting `event_transfers_cost` ourselves, which
 * rules out double-counting hits whatever `points` turns out to include.
 */
export function scoresFromHistory(history: FplEntryHistory): Record<number, GwScore> {
  const chips = new Map(history.chips.map((c) => [c.event, c.name]));
  const scores: Record<number, GwScore> = {};
  let previousTotal = 0;
  for (const h of [...history.current].sort((a, b) => a.event - b.event)) {
    scores[h.event] = {
      gw: h.event,
      net: h.total_points - previousTotal,
      gross: h.points,
      hits: h.event_transfers_cost,
      chip: chips.get(h.event),
    };
    previousTotal = h.total_points;
  }
  return scores;
}

/**
 * Standard competition ranking ("1, 1, 3"): tied scores share a rank.
 * Display order within a tie is alphabetical so it stays stable.
 */
export function rankBy<T extends { total: number; name: string }>(rows: T[]) {
  const sorted = [...rows].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const leader = sorted[0]?.total ?? 0;
  return sorted.map((row) => ({
    ...row,
    rank: 1 + sorted.filter((r) => r.total > row.total).length,
    gap: leader - row.total,
  }));
}

export function cycleStandings(managers: Manager[], cycle: Cycle, gameweeks: Map<number, Gameweek>): CycleRow[] {
  const gwIds = cycleGameweeks(cycle);
  const complete = cycleStatus(cycle, gameweeks) === "complete";
  const rows = managers.map((m) => {
    const gws = gwIds.map((id) => m.scores[id] ?? null);
    return {
      entry: m.entry,
      name: m.name,
      team: m.team,
      gws,
      total: gws.reduce((sum, s) => sum + (s?.net ?? 0), 0),
      hits: gws.reduce((sum, s) => sum + (s?.hits ?? 0), 0),
      missed: gwIds.filter((id, i) => gameweeks.get(id)?.started && !gws[i]).length,
    };
  });
  // Ties for first are joint winners, but only once every gameweek is final
  return rankBy(rows).map((r) => ({ ...r, winner: complete && r.rank === 1 }));
}

export function cycleWinners(managers: Manager[], cycles: Cycle[], gameweeks: Map<number, Gameweek>) {
  return cycles
    .filter((c) => cycleStatus(c, gameweeks) === "complete")
    .map((cycle) => {
      const winners = cycleStandings(managers, cycle, gameweeks).filter((r) => r.winner);
      return { cycle, score: winners[0]?.total ?? 0, winners };
    });
}

export function overallStandings(
  managers: Manager[],
  cycles: Cycle[],
  gameweeks: Map<number, Gameweek>,
  lastGw: number | null,
): OverallRow[] {
  const wins = new Map<number, number>();
  for (const { winners } of cycleWinners(managers, cycles, gameweeks)) {
    for (const w of winners) wins.set(w.entry, (wins.get(w.entry) ?? 0) + 1);
  }
  const rows = managers.map((m) => {
    const scores = Object.values(m.scores);
    const total = scores.reduce((s, g) => s + g.net, 0);
    return {
      entry: m.entry,
      name: m.name,
      team: m.team,
      total,
      lastGw: lastGw ? (m.scores[lastGw]?.net ?? null) : null,
      bestGw: scores.length ? Math.max(...scores.map((g) => g.net)) : null,
      average: scores.length ? total / scores.length : 0,
      hits: scores.reduce((s, g) => s + g.hits, 0),
      cycleWins: wins.get(m.entry) ?? 0,
    };
  });
  return rankBy(rows);
}

/** Highest net score in each started gameweek (joint if tied). */
export function gameweekTopScorers(managers: Manager[], gameweeks: Gameweek[]) {
  return gameweeks
    .filter((g) => g.started)
    .map((g) => {
      const scored = managers.filter((m) => m.scores[g.id]);
      const top = Math.max(...scored.map((m) => m.scores[g.id].net));
      return {
        gw: g.id,
        final: g.final,
        score: scored.length ? top : 0,
        managers: scored.filter((m) => m.scores[g.id].net === top),
      };
    })
    .filter((r) => r.managers.length > 0);
}
