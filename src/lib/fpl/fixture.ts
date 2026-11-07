// Deterministic sample data in the raw API shape, for local UI work (FPL_FIXTURE=1).
// Player and team names are invented.
import type {
  FplBootstrap,
  FplElement,
  FplElementSummary,
  FplEntryHistory,
  FplFixture,
  FplLive,
  FplPicks,
  FplStandingsResult,
  FplTransfer,
} from "./types";

export const FIXTURE_GW = 11;
const WEEK = 7 * 24 * 3600 * 1000;

function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
}
const pick = <T,>(r: () => number, list: T[]) => list[Math.floor(r() * list.length)];

const PEOPLE = [
  ["Daniel F", "Third Line FC"], ["Marcus O", "Saka Potatoes"], ["Priya S", "Kane Train"],
  ["Tom B", "Murder on Zidane's Floor"], ["Aisha K", "Expected Toulouse"], ["Jack W", "Ctrl Alt De Bruyne"],
  ["Leah M", "Haaland Oates"], ["Sam R", "Ødegaard of Eden"],
];
const TEAMS = ["ANC", "BRK", "CDF", "DOV", "ELM", "FRN", "GRV", "HTH", "IRN", "JNC", "KNG", "LYN", "MRS", "NTH", "OAK", "PRT", "QAY", "RVR", "STN", "TWR"];
const SURNAMES = ["Adeyemi", "Barros", "Calloway", "Duarte", "Eklund", "Fofana", "Garnier", "Holm", "Ibe", "Jansen", "Kovac", "Lindqvist", "Mensah", "Novak", "Okafor", "Pereira", "Quinn", "Rossi", "Sandberg", "Tanaka", "Uche", "Varga", "Wilde", "Yildiz", "Zubiri"];
const SHAPE: [1 | 2 | 3 | 4, number][] = [[1, 2], [2, 5], [3, 5], [4, 3]];

const elements: FplElement[] = TEAMS.flatMap((_, t) => {
  let n = 0;
  return SHAPE.flatMap(([type, count]) =>
    Array.from({ length: count }, () => {
      const id = t * 15 + ++n;
      return { id, web_name: SURNAMES[(id * 7) % SURNAMES.length] + (id % 3 ? "" : "-" + TEAMS[t][0]), team: t + 1, element_type: type };
    }),
  );
});

export function fixtureBootstrap(): FplBootstrap {
  const now = Date.now();
  return {
    events: Array.from({ length: 38 }, (_, i) => {
      const id = i + 1;
      return {
        id,
        name: `Gameweek ${id}`,
        deadline_time: new Date(now + (id - FIXTURE_GW) * WEEK - 3600_000).toISOString(),
        finished: id < FIXTURE_GW,
        data_checked: id < FIXTURE_GW,
        is_current: id === FIXTURE_GW,
        is_next: id === FIXTURE_GW + 1,
      };
    }),
    elements,
    teams: TEAMS.map((short_name, i) => ({ id: i + 1, short_name })),
  };
}

export function fixtureLeague(): { name: string; managers: FplStandingsResult[] } {
  return {
    name: "Sample Mini-League",
    managers: PEOPLE.map(([player_name, entry_name], i) => ({
      entry: 1000 + i, player_name, entry_name, rank: i + 1, total: 0, event_total: 0,
    })),
  };
}

export function fixtureHistory(entry: number): FplEntryHistory {
  const rand = rng(entry);
  const firstGw = entry === 1007 ? 6 : 1; // one late entrant
  let total = 0;
  const current = [];
  for (let gw = firstGw; gw <= FIXTURE_GW; gw++) {
    const points = Math.round(35 + rand() * 50);
    const cost = rand() > 0.85 ? 4 : rand() > 0.97 ? 8 : 0;
    total += points - cost;
    current.push({
      event: gw, points, total_points: total, overall_rank: Math.round(200_000 + rand() * 3_000_000),
      event_transfers: cost / 4 + (rand() > 0.5 ? 1 : 0), event_transfers_cost: cost, points_on_bench: 4,
    });
  }
  return { current, chips: entry === 1002 ? [{ name: "3xc", event: 7 }] : entry === 1004 ? [{ name: "wildcard", event: 9 }] : [] };
}

// --- Live gameweek: 4 finished (2 bonus-confirmed), 3 in play, 3 to come ---
type Minutes = Map<number, number>;
let liveCache: { fixtures: FplFixture[]; live: FplLive } | null = null;

function buildLive() {
  const r = rng(99);
  const now = Date.now();
  const minutes: Minutes = new Map();
  const goals = new Map<number, number>();
  const assists = new Map<number, number>();
  const bps = new Map<number, number>();
  const defcon = new Set<number>();
  const byTeam = (t: number) => elements.filter((e) => e.team === t);

  const fixtures: FplFixture[] = Array.from({ length: 10 }, (_, i) => {
    const state = i < 2 ? "final" : i < 4 ? "provisional" : i < 7 ? "live" : "upcoming";
    const h = i + 1, a = i + 11;
    const played = state === "live" ? 50 + Math.round(r() * 35) : state === "upcoming" ? 0 : 90;
    const score = { h: 0, a: 0 };
    const stat = (id: string) => ({ identifier: id, h: [] as { value: number; element: number }[], a: [] as { value: number; element: number }[] });
    const s = { goals_scored: stat("goals_scored"), assists: stat("assists"), bps: stat("bps"), bonus: stat("bonus") };
    if (played) {
      for (const [side, team] of [["h", h], ["a", a]] as const) {
        const squad = byTeam(team);
        // Starting XI: 1 GK, 4 DEF, 4 MID, 2 FWD; one fringe player in each squad never plays
        const xi = [squad[0], ...squad.slice(2, 6), ...squad.slice(7, 11), ...squad.slice(12, 14)];
        for (const p of xi) {
          minutes.set(p.id, played);
          bps.set(p.id, Math.round(r() * 30));
          if (p.element_type === 2 && r() > 0.6) defcon.add(p.id);
        }
        const n = Math.floor(r() * 3.2);
        for (let g = 0; g < n; g++) {
          const scorer = pick(r, xi.filter((p) => p.element_type > 2));
          const assister = pick(r, xi.filter((p) => p !== scorer && p.element_type > 1));
          goals.set(scorer.id, (goals.get(scorer.id) ?? 0) + 1);
          assists.set(assister.id, (assists.get(assister.id) ?? 0) + 1);
          bps.set(scorer.id, bps.get(scorer.id)! + 24);
          bps.set(assister.id, bps.get(assister.id)! + 9);
          score[side]++;
        }
        for (const p of xi) {
          if (goals.get(p.id)) s.goals_scored[side].push({ element: p.id, value: goals.get(p.id)! });
          if (assists.get(p.id)) s.assists[side].push({ element: p.id, value: assists.get(p.id)! });
          s.bps[side].push({ element: p.id, value: bps.get(p.id)! });
        }
      }
    }
    return {
      id: 100 + i, event: FIXTURE_GW, team_h: h, team_a: a,
      team_h_score: played ? score.h : null, team_a_score: played ? score.a : null,
      kickoff_time: new Date(now + (i - 6) * 2 * 3600_000).toISOString(),
      started: played > 0, finished: state === "final", finished_provisional: state === "final" || state === "provisional",
      minutes: played, stats: Object.values(s),
    };
  });

  // Confirmed bonus only for `finished` fixtures; the app works out the rest from BPS
  const confirmedBonus = new Map<number, number>();
  for (const f of fixtures.filter((f) => f.finished)) {
    const list = f.stats.find((s) => s.identifier === "bps")!;
    const all = [...list.h, ...list.a].sort((x, y) => y.value - x.value).slice(0, 3);
    all.forEach((e, i) => confirmedBonus.set(e.element, 3 - i));
  }

  const live: FplLive = {
    elements: elements.map((e) => {
      const mins = minutes.get(e.id) ?? 0;
      const g = goals.get(e.id) ?? 0, as = assists.get(e.id) ?? 0, bonus = confirmedBonus.get(e.id) ?? 0;
      const dc = defcon.has(e.id) ? 2 : 0;
      const goalPts = { 1: 10, 2: 6, 3: 5, 4: 4 }[e.element_type];
      return {
        id: e.id,
        stats: { minutes: mins, goals_scored: g, assists: as, bonus, bps: bps.get(e.id) ?? 0,
          total_points: (mins ? (mins >= 60 ? 2 : 1) : 0) + g * goalPts + as * 3 + bonus + dc },
        explain: dc ? [{ fixture: 0, stats: [{ identifier: "defensive_contribution", points: 2, value: 11 }] }] : [],
      };
    }),
  };
  return { fixtures, live };
}

export const fixtureLive = () => (liveCache ??= buildLive()).live;
export const fixtureFixtures = () => (liveCache ??= buildLive()).fixtures;

export function fixturePicks(entry: number): FplPicks {
  const r = rng(entry * 31);
  const take = (type: number, n: number, from = elements) => {
    const pool = from.filter((e) => e.element_type === type);
    const out = new Set<FplElement>();
    while (out.size < n) out.add(pick(r, pool));
    return [...out];
  };
  // Starters skew towards teams already playing so the table has some life in it
  const playedTeams = elements.filter((e) => e.team <= 7 || (e.team >= 11 && e.team <= 17));
  const xi = entry === 1006 ? [...take(1, 1, playedTeams), ...take(2, 5), ...take(3, 4), ...take(4, 1)] : [...take(1, 1, playedTeams), ...take(2, 4), ...take(3, 4), ...take(4, 2)];
  const bench = [...take(1, 1), ...take(2, 1), ...take(3, 1), ...take(4, 1)].filter((b) => !xi.includes(b));
  const squad = [...xi, ...bench].slice(0, 15);
  const chip = entry === 1001 ? "bboost" : entry === 1005 ? "3xc" : null;
  // Entry 1003's captain is a fringe player who won't play, to show the vice taking over
  let capIdx = entry === 1003 ? -1 : 6 + (entry % 4);
  if (entry === 1003) squad[5] = elements.find((e) => e.id === 7)!; // DEF who sits out a finished game
  // Entry 1006 captains a defender left out of a match that's in play: early vice switch
  if (entry === 1006) {
    squad[1] = elements.find((e) => e.id === 67)!;
    capIdx = 1;
  }
  return {
    active_chip: chip,
    automatic_subs: [],
    entry_history: { event: FIXTURE_GW, overall_rank: 150_000 + (entry - 1000) * 97_310, event_transfers: entry % 3, event_transfers_cost: entry % 5 === 0 ? 4 : 0 },
    picks: squad.map((e, i) => ({
      element: e.id,
      position: i + 1,
      multiplier: i < 11 ? 1 : 0,
      is_captain: capIdx === -1 ? i === 5 : i === capIdx,
      is_vice_captain: i === (capIdx === -1 ? 9 : capIdx === 9 ? 8 : 9),
    })),
  };
}

export function fixtureTransfers(entry: number): FplTransfer[] {
  const r = rng(entry * 17);
  return Array.from({ length: entry % 3 }, () => ({
    element_in: pick(r, elements).id, element_out: pick(r, elements).id, event: FIXTURE_GW, time: new Date().toISOString(),
  }));
}

export function fixtureElementSummary(id: number): FplElementSummary {
  const r = rng(id);
  return {
    history: Array.from({ length: 10 }, (_, i) => {
      const minutes = r() > 0.15 ? 90 : 0;
      const g = minutes && r() > 0.75 ? 1 : 0;
      return {
        round: i + 1, opponent_team: 1 + Math.floor(r() * 20), was_home: r() > 0.5, minutes,
        total_points: minutes ? 2 + g * 5 + Math.round(r() * 4) : 0, goals_scored: g, assists: minutes && r() > 0.8 ? 1 : 0,
        clean_sheets: minutes && r() > 0.65 ? 1 : 0, goals_conceded: minutes ? Math.floor(r() * 3) : 0,
        saves: minutes ? Math.floor(r() * 5) : 0, bonus: minutes && r() > 0.8 ? 2 : 0, bps: minutes ? Math.round(r() * 35) : 0,
        defensive_contribution: minutes ? Math.round(r() * 14) : 0,
        expected_goals: (r() * 0.6).toFixed(2), expected_assists: (r() * 0.4).toFixed(2),
      };
    }),
  };
}
