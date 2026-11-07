import { describe, expect, it } from "vitest";
import type { FplBootstrap, FplFixture, FplLive, FplPicks } from "./fpl/types";
import { bonusFromBps, buildLiveContext, computeManagerLive, estimateFreeTransfers, headToHead } from "./live";

// A 15-man squad: ids 1–2 GK, 3–7 DEF, 8–12 MID, 13–15 FWD, all on team 1 unless moved
const TYPES: (1 | 2 | 3 | 4)[] = [1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4];

/** players: per-id overrides of minutes/points/team. Team 1 has finished, team 2 is yet to play. */
function setup(players: Record<number, { minutes?: number; points?: number; team?: number }> = {}) {
  const bootstrap: FplBootstrap = {
    events: [],
    teams: [1, 2, 3, 5, 6].map((id) => ({ id, short_name: `T${id}` })),
    elements: TYPES.map((t, i) => ({ id: i + 1, web_name: `P${i + 1}`, team: players[i + 1]?.team ?? 1, element_type: t })),
  };
  const fixtures: FplFixture[] = [
    { id: 1, event: 1, team_h: 1, team_a: 3, team_h_score: 1, team_a_score: 0, kickoff_time: null, started: true, finished: true, finished_provisional: true, minutes: 90, stats: [] },
    { id: 2, event: 1, team_h: 2, team_a: 4, team_h_score: null, team_a_score: null, kickoff_time: null, started: false, finished: false, finished_provisional: false, minutes: 0, stats: [] },
    { id: 3, event: 1, team_h: 5, team_a: 6, team_h_score: 0, team_a_score: 0, kickoff_time: null, started: true, finished: false, finished_provisional: false, minutes: 30, stats: [] },
  ];
  const live: FplLive = {
    elements: TYPES.map((_, i) => {
      const o = players[i + 1] ?? {};
      return { id: i + 1, explain: [], stats: { minutes: o.minutes ?? 90, total_points: o.points ?? 2, goals_scored: 0, assists: 0, bonus: 0, bps: 10 } };
    }),
  };
  return buildLiveContext(bootstrap, live, fixtures);
}

/** 4-4-2: GK 1, DEF 3–6, MID 8–11, FWD 13–14; bench 2 (GK), 7, 12, 15 */
function picks(over: Partial<FplPicks> = {}, captain = 13, vice = 14): FplPicks {
  const order = [1, 3, 4, 5, 6, 8, 9, 10, 11, 13, 14, 2, 7, 12, 15];
  return {
    active_chip: null,
    automatic_subs: [],
    entry_history: { event: 1, overall_rank: 1, event_transfers: 0, event_transfers_cost: 0 },
    picks: order.map((element, i) => ({
      element, position: i + 1, multiplier: i < 11 ? 1 : 0, is_captain: element === captain, is_vice_captain: element === vice,
    })),
    ...over,
  };
}

describe("bonusFromBps", () => {
  const b = (vals: number[]) => [...bonusFromBps(vals.map((value, element) => ({ element, value })))];

  it("awards 3/2/1", () => expect(b([30, 20, 10, 5])).toEqual([[0, 3], [1, 2], [2, 1]]));
  it("tie for first: both 3, next gets 1", () => expect(b([30, 30, 20, 10])).toEqual([[0, 3], [1, 3], [2, 1]]));
  it("tie for second: both 2, no third", () => expect(b([30, 20, 20, 10])).toEqual([[0, 3], [1, 2], [2, 2]]));
  it("tie for third: all get 1", () => expect(b([30, 20, 10, 10])).toEqual([[0, 3], [1, 2], [2, 1], [3, 1]]));
});

describe("provisional bonus", () => {
  const bootstrap: FplBootstrap = {
    events: [],
    teams: [{ id: 1, short_name: "AAA" }, { id: 2, short_name: "BBB" }],
    elements: [1, 2, 3].map((id) => ({ id, web_name: `P${id}`, team: id === 3 ? 2 : 1, element_type: 3 as const })),
  };
  const live = (bonus: number): FplLive => ({
    elements: [1, 2, 3].map((id) => ({
      id, explain: [], stats: { minutes: 90, total_points: 5 + (id === 1 ? bonus : 0), goals_scored: 0, assists: 0, bonus: id === 1 ? bonus : 0, bps: 0 },
    })),
  });
  const fixture = (bonusStat: { element: number; value: number }[]): FplFixture => ({
    id: 1, event: 1, team_h: 1, team_a: 2, team_h_score: 1, team_a_score: 0, kickoff_time: null,
    started: true, finished: false, finished_provisional: true, minutes: 90,
    stats: [
      { identifier: "bps", h: [{ element: 1, value: 40 }, { element: 2, value: 30 }], a: [{ element: 3, value: 20 }] },
      { identifier: "bonus", h: bonusStat, a: [] },
    ],
  });

  it("adds BPS bonus while FPL hasn't published any", () => {
    const ctx = buildLiveContext(bootstrap, live(0), [fixture([])]);
    expect(ctx.players.get(1)).toMatchObject({ points: 8, bonus: 3, bonusProvisional: true });
  });

  it("never stacks on bonus FPL has already added, even before `finished`", () => {
    const ctx = buildLiveContext(bootstrap, live(3), [fixture([{ element: 1, value: 3 }])]);
    expect(ctx.players.get(1)).toMatchObject({ points: 8, bonus: 3, bonusProvisional: false });
    expect(ctx.players.get(2)?.bonus).toBe(0); // FPL's list is final: no extra 2 for P2
  });
});

describe("computeManagerLive", () => {
  it("doubles the captain and deducts hits", () => {
    const ml = computeManagerLive(picks({ entry_history: { event: 1, overall_rank: 1, event_transfers: 2, event_transfers_cost: 4 } }), setup({ 13: { points: 10 } }));
    expect(ml.points).toBe(10 * 2 + 10 * 2); // captain 20 + ten others on 2
    expect(ml.net).toBe(36);
    expect(ml.viceActive).toBe(false);
  });

  it("promotes the vice when the captain didn't play", () => {
    const ml = computeManagerLive(picks(), setup({ 13: { minutes: 0, points: 0 }, 14: { points: 8 } }));
    expect(ml.viceActive).toBe(true);
    expect(ml.captain).toBe("P14");
    expect(ml.squad.find((p) => p.id === 14)?.multiplier).toBe(2);
  });

  it("doesn't promote the vice while the captain could still play", () => {
    const ml = computeManagerLive(picks(), setup({ 13: { minutes: 0, team: 2 } }));
    expect(ml.viceActive).toBe(false);
  });

  it("switches to the vice early when the captain is benched mid-match", () => {
    // Team 5 is 30 minutes in: captain 13 hasn't played, team-mate 8 has
    const ctx = setup({ 13: { team: 5, minutes: 0, points: 0 }, 8: { team: 5, minutes: 30 }, 14: { points: 6 } });
    const ml = computeManagerLive(picks(), ctx);
    expect(ml).toMatchObject({ viceActive: true, viceProvisional: true, captain: "P14" });
    expect(ml.autoSubs).toEqual([]); // no auto-sub until his match is over
  });

  it("keeps the captain if he comes on", () => {
    const ml = computeManagerLive(picks(), setup({ 13: { team: 5, minutes: 12 }, 8: { team: 5, minutes: 30 } }));
    expect(ml.viceActive).toBe(false);
  });

  it("doesn't call a captain benched before his team has any minutes", () => {
    const ml = computeManagerLive(picks(), setup({ 13: { team: 5, minutes: 0 } }));
    expect(ml.viceActive).toBe(false);
  });

  it("subs in the first bench player who keeps a valid formation", () => {
    // DEF 3 out: DEF 7 is first eligible outfielder on the bench and keeps 4 at the back
    const ml = computeManagerLive(picks(), setup({ 3: { minutes: 0, points: 0 }, 7: { points: 6 } }));
    expect(ml.autoSubs).toEqual([{ in: "P7", out: "P3" }]);
    expect(ml.points).toBe(9 * 2 + 2 * 2 + 6); // captain doubled
  });

  it("skips a bench player who would break the formation", () => {
    // 3-5-2 (DEF 3, 4, 5); bench order: GK 2, FWD 15, DEF 7, MID 6-as-spare
    const order = [1, 3, 4, 5, 8, 9, 10, 11, 12, 13, 14, 2, 15, 7, 6];
    const p = picks({
      picks: order.map((element, i) => ({ element, position: i + 1, multiplier: i < 11 ? 1 : 0, is_captain: element === 13, is_vice_captain: element === 14 })),
    });
    // FWD 15 would leave two at the back, so DEF 7 comes on instead
    expect(computeManagerLive(p, setup({ 3: { minutes: 0 } })).autoSubs).toEqual([{ in: "P7", out: "P3" }]);
  });

  it("waits when the next bench player hasn't played yet", () => {
    // DEF 7 (first outfield sub) is yet to play: don't jump ahead to MID 12
    const ml = computeManagerLive(picks(), setup({ 3: { minutes: 0 }, 7: { minutes: 0, team: 2 } }));
    expect(ml.autoSubs).toEqual([]);
  });

  it("only swaps keepers for keepers", () => {
    const ml = computeManagerLive(picks(), setup({ 1: { minutes: 0 } }));
    expect(ml.autoSubs).toEqual([{ in: "P2", out: "P1" }]);
  });

  it("counts the bench on bench boost and makes no subs", () => {
    const ml = computeManagerLive(picks({ active_chip: "bboost" }), setup({ 3: { minutes: 0, points: 0 } }));
    expect(ml.autoSubs).toEqual([]);
    expect(ml.squad.filter((p) => p.multiplier > 0)).toHaveLength(15);
  });

  it("triples the captain on triple captain", () => {
    const ml = computeManagerLive(picks({ active_chip: "3xc" }), setup({ 13: { points: 10 } }));
    expect(ml.points).toBe(30 + 20);
  });

  it("counts players yet to play", () => {
    const ml = computeManagerLive(picks(), setup({ 8: { team: 2, minutes: 0 }, 9: { team: 2, minutes: 0 } }));
    expect(ml.toPlay).toBe(2);
  });
});

describe("estimateFreeTransfers", () => {
  const row = (event: number, event_transfers: number) => ({
    event, event_transfers, points: 0, total_points: 0, overall_rank: null, event_transfers_cost: 0, points_on_bench: 0,
  });

  it("banks one a week up to five", () => {
    expect(estimateFreeTransfers({ chips: [], current: [1, 2, 3, 4, 5, 6, 7].map((g) => row(g, 0)) }, 7)).toBe(5);
  });

  it("spends and rolls", () => {
    // GW2 has 1 FT, uses 1 → 0 +1 = 1 for GW3; GW3 uses 0 → 2 for GW4
    expect(estimateFreeTransfers({ chips: [], current: [row(1, 0), row(2, 1), row(3, 0)] }, 3)).toBe(2);
  });

  it("keeps the bank through a wildcard", () => {
    const h = { chips: [{ name: "wildcard", event: 3 }], current: [row(1, 0), row(2, 0), row(3, 9)] };
    expect(estimateFreeTransfers(h, 3)).toBe(3);
  });
});

describe("headToHead", () => {
  it("cancels shared players and counts captaincy as a differential", () => {
    const ctx = setup({ 13: { points: 10 } });
    const a = computeManagerLive(picks({}, 13, 14), ctx); // captains 13
    const b = computeManagerLive(picks({}, 14, 13), ctx); // same XI, captains 14
    const { shared, diffs } = headToHead(a.squad, b.squad);
    expect(shared).toHaveLength(9);
    expect(diffs.map((d) => [d.player.id, d.swing])).toEqual([[13, 10], [14, -2]]);
    expect(diffs.reduce((s, d) => s + d.swing, 0)).toBe(a.points - b.points);
  });
});
