import { describe, expect, it } from "vitest";
import { buildCycles } from "./cycles";
import { cycleStandings, cycleWinners, gameweekTopScorers, overallStandings, rankBy, scoresFromHistory } from "./scoring";
import type { Gameweek, Manager } from "./types";

const gws = (finalUpTo: number, startedUpTo = finalUpTo): Gameweek[] =>
  Array.from({ length: 38 }, (_, i) => ({ id: i + 1, final: i + 1 <= finalUpTo, started: i + 1 <= startedUpTo, isCurrent: false }));
const map = (list: Gameweek[]) => new Map(list.map((g) => [g.id, g]));

/** Build a manager from net scores keyed by gameweek. */
const manager = (entry: number, name: string, nets: Record<number, number>): Manager => ({
  entry,
  name,
  team: `${name} FC`,
  scores: Object.fromEntries(Object.entries(nets).map(([gw, net]) => [gw, { gw: +gw, net, gross: net, hits: 0 }])),
});

const [cycle1, cycle2] = buildCycles();

describe("scoresFromHistory", () => {
  it("deducts hits exactly once by differencing total_points", () => {
    const scores = scoresFromHistory({
      chips: [{ name: "wildcard", event: 6 }],
      current: [
        { event: 5, points: 64, total_points: 300, event_transfers: 1, event_transfers_cost: 0, points_on_bench: 0, overall_rank: null },
        { event: 6, points: 72, total_points: 368, event_transfers: 2, event_transfers_cost: 4, points_on_bench: 0, overall_rank: null },
      ],
    });
    // GW5 is a late entrant's first week: total_points is the whole net score
    expect(scores[5]).toMatchObject({ net: 300 });
    expect(scores[6]).toMatchObject({ net: 68, gross: 72, hits: 4, chip: "wildcard" });
  });

  it("matches the brief's GW5 to GW8 example of 275", () => {
    const m = manager(1, "A", { 5: 64, 6: 72, 7: 58, 8: 81 });
    expect(cycleStandings([m], cycle2, map(gws(8)))[0].total).toBe(275);
  });
});

describe("rankBy", () => {
  it("shares ranks on ties and skips the next rank", () => {
    const ranked = rankBy([
      { name: "C", total: 200 },
      { name: "A", total: 250 },
      { name: "B", total: 250 },
    ]);
    expect(ranked.map((r) => [r.name, r.rank, r.gap])).toEqual([
      ["A", 1, 0],
      ["B", 1, 0],
      ["C", 3, 50],
    ]);
  });
});

describe("cycleStandings", () => {
  const managers = [
    manager(1, "Ann", { 1: 60, 2: 70, 3: 50, 4: 40 }), // 220
    manager(2, "Ben", { 1: 50, 2: 60, 3: 70, 4: 40 }), // 220
    manager(3, "Cat", { 3: 90, 4: 80 }), // late entrant: 170
  ];

  it("names joint winners once the cycle is final", () => {
    const rows = cycleStandings(managers, cycle1, map(gws(4)));
    expect(rows.filter((r) => r.winner).map((r) => r.name)).toEqual(["Ann", "Ben"]);
    expect(rows[2]).toMatchObject({ name: "Cat", rank: 3, gap: 50, missed: 2 });
  });

  it("does not crown a winner while a gameweek is provisional", () => {
    const rows = cycleStandings(managers, cycle1, map(gws(3, 4)));
    expect(rows.some((r) => r.winner)).toBe(false);
  });

  it("feeds cycle wins into the overall table", () => {
    const list = gws(4);
    const overall = overallStandings(managers, buildCycles(), map(list), 4);
    expect(overall.find((r) => r.name === "Ann")?.cycleWins).toBe(1);
    expect(overall.find((r) => r.name === "Cat")?.cycleWins).toBe(0);
    expect(cycleWinners(managers, buildCycles(), map(list))).toHaveLength(1);
  });

  it("finds joint gameweek top scorers", () => {
    const top = gameweekTopScorers(managers, gws(4));
    expect(top.find((t) => t.gw === 4)?.managers.map((m) => m.name)).toEqual(["Cat"]);
    expect(top.find((t) => t.gw === 1)?.score).toBe(60);
  });
});
