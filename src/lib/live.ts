// Pure live-gameweek engine: no fetching here, so it's straightforward to test.
import type {
  FplBootstrap,
  FplEntryHistory,
  FplFixture,
  FplLive,
  FplPicks,
  FplTransfer,
} from "./fpl/types";

export type PlayStatus = "to-play" | "playing" | "done" | "blank";
export type Pos = 1 | 2 | 3 | 4;
export const POS_LABEL: Record<Pos, string> = { 1: "GK", 2: "DEF", 3: "MID", 4: "FWD" };

export interface PlayerLive {
  id: number;
  name: string;
  team: string;
  pos: Pos;
  /** Live points including any provisional bonus */
  points: number;
  minutes: number;
  bps: number;
  bonus: number;
  bonusProvisional: boolean;
  defcon: number;
  status: PlayStatus;
  /**
   * 0 minutes while every one of their matches has kicked off and team-mates
   * are on the pitch: dropped or on the bench. Could still come on as a sub.
   */
  benched: boolean;
}

export interface LiveContext {
  players: Map<number, PlayerLive>;
}

/**
 * FPL bonus from BPS: top three get 3/2/1, ties share. Competition ranking
 * gives the official tie rules for free: two tied first both get 3 and the
 * next player is ranked 3rd, so gets 1.
 */
export function bonusFromBps(entries: { element: number; value: number }[]) {
  const award: Record<number, number> = { 1: 3, 2: 2, 3: 1 };
  const out = new Map<number, number>();
  for (const e of entries) {
    const rank = 1 + entries.filter((o) => o.value > e.value).length;
    if (award[rank]) out.set(e.element, award[rank]);
  }
  return out;
}

export function buildLiveContext(bootstrap: FplBootstrap, live: FplLive, fixtures: FplFixture[]): LiveContext {
  const teamName = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
  const liveById = new Map(live.elements.map((e) => [e.id, e]));

  const fixturesByTeam = new Map<number, FplFixture[]>();
  for (const f of fixtures) {
    for (const t of [f.team_h, f.team_a]) fixturesByTeam.set(t, [...(fixturesByTeam.get(t) ?? []), f]);
  }

  // Provisional bonus from BPS, only where FPL hasn't published bonus for the fixture yet.
  // FPL can add bonus before it flags the fixture `finished`, so check the bonus stat too.
  const provisional = new Map<number, number>();
  for (const f of fixtures) {
    if (!f.started || f.finished) continue;
    const official = f.stats.find((s) => s.identifier === "bonus");
    if (official && official.h.length + official.a.length > 0) continue;
    const bps = f.stats.find((s) => s.identifier === "bps");
    if (!bps) continue;
    for (const [el, pts] of bonusFromBps([...bps.h, ...bps.a])) provisional.set(el, (provisional.get(el) ?? 0) + pts);
  }

  // Teams with someone on the pitch: guards against minutes lagging just after kick-off
  const teamOnPitch = new Set(
    bootstrap.elements.filter((e) => (liveById.get(e.id)?.stats.minutes ?? 0) > 0).map((e) => e.team),
  );

  const players = new Map<number, PlayerLive>();
  for (const el of bootstrap.elements) {
    const l = liveById.get(el.id);
    const fx = fixturesByTeam.get(el.team) ?? [];
    const status: PlayStatus =
      fx.length === 0
        ? "blank"
        : fx.every((f) => f.finished || f.finished_provisional)
          ? "done"
          : fx.some((f) => f.started)
            ? "playing"
            : "to-play";
    // Belt and braces: if the player already has bonus in his live stats, never add more on top
    const prov = (l?.stats.bonus ?? 0) > 0 ? 0 : (provisional.get(el.id) ?? 0);
    const minutes = l?.stats.minutes ?? 0;
    players.set(el.id, {
      id: el.id,
      name: el.web_name,
      team: teamName.get(el.team) ?? "",
      pos: el.element_type,
      points: (l?.stats.total_points ?? 0) + prov,
      minutes,
      bps: l?.stats.bps ?? 0,
      bonus: (l?.stats.bonus ?? 0) + prov,
      bonusProvisional: prov > 0,
      defcon: (l?.explain ?? [])
        .flatMap((x) => x.stats)
        .filter((s) => s.identifier === "defensive_contribution")
        .reduce((sum, s) => sum + s.points, 0),
      status,
      benched: status === "playing" && minutes === 0 && fx.every((f) => f.started) && teamOnPitch.has(el.team),
    });
  }
  return { players };
}

export interface SquadPlayer extends PlayerLive {
  position: number;
  multiplier: number;
  isCaptain: boolean;
  isVice: boolean;
  subIn: boolean;
  subOut: boolean;
}

export interface ManagerLive {
  points: number;
  hits: number;
  net: number;
  chip: string | null;
  captain: string;
  viceActive: boolean;
  /** Vice has the armband because the captain looks benched mid-match; reverts if he comes on */
  viceProvisional: boolean;
  autoSubs: { in: string; out: string }[];
  autoSubsConfirmed: boolean;
  bps: number;
  defcon: number;
  bonus: number;
  /** Bonus not yet confirmed by FPL, with multipliers: subtract to match FPL's own table */
  provisionalBonus: number;
  toPlay: number;
  playing: number;
  squad: SquadPlayer[];
}

/** Didn't play and can't any more: candidate for an auto-sub or vice-captaincy. */
const absent = (p: PlayerLive) => p.minutes === 0 && (p.status === "done" || p.status === "blank");

function validFormation(ids: number[], ctx: LiveContext) {
  const count = (pos: Pos) => ids.filter((id) => ctx.players.get(id)?.pos === pos).length;
  return count(1) === 1 && count(2) >= 3 && count(3) >= 2 && count(4) >= 1;
}

export function computeManagerLive(picks: FplPicks, ctx: LiveContext): ManagerLive {
  const get = (id: number) => ctx.players.get(id)!;
  const sorted = [...picks.picks].sort((a, b) => a.position - b.position);
  const chip = picks.active_chip;
  const confirmed = picks.automatic_subs.length > 0;
  const capMult = chip === "3xc" ? 3 : 2;
  const captain = sorted.find((p) => p.is_captain);
  const vice = sorted.find((p) => p.is_vice_captain);

  const mult = new Map<number, number>();
  const subs: { in: number; out: number }[] = [];
  let viceProvisional = false;

  if (confirmed) {
    // FPL has processed the gameweek: its multipliers are final
    for (const p of sorted) mult.set(p.element, p.multiplier);
    subs.push(...picks.automatic_subs.map((s) => ({ in: s.element_in, out: s.element_out })));
  } else {
    const lineup = sorted.filter((p) => p.position <= 11).map((p) => p.element);
    const bench = sorted.filter((p) => p.position > 11).map((p) => p.element);

    if (chip !== "bboost") {
      const used = new Set<number>();
      for (let i = 0; i < lineup.length; i++) {
        const out = get(lineup[i]);
        if (!absent(out)) continue;
        for (const b of bench) {
          if (used.has(b) || (get(b).pos === 1) !== (out.pos === 1)) continue;
          const sub = get(b);
          if (absent(sub)) continue;
          if (sub.minutes === 0) break; // yet to play: can't predict past this bench slot
          const next = lineup.with(i, b);
          if (!validFormation(next, ctx)) continue;
          lineup[i] = b;
          used.add(b);
          subs.push({ in: b, out: out.id });
          break;
        }
      }
    }

    const counted = chip === "bboost" ? [...lineup, ...bench] : lineup;
    for (const id of counted) mult.set(id, 1);

    // Captain out (or benched mid-match): the vice inherits the multiplier
    const state = (id?: number) => (!id ? "out" : absent(get(id)) ? "out" : get(id).benched ? "benched" : "in");
    const cap = state(captain?.element);
    const capId = cap === "in" ? captain!.element : state(vice?.element) === "in" ? vice!.element : null;
    if (capId && mult.has(capId)) mult.set(capId, capMult);
    viceProvisional = capId === vice?.element && cap === "benched";
  }

  const squad: SquadPlayer[] = sorted.map((p) => ({
    ...get(p.element),
    position: p.position,
    multiplier: mult.get(p.element) ?? 0,
    isCaptain: p.is_captain,
    isVice: p.is_vice_captain,
    subIn: subs.some((s) => s.in === p.element),
    subOut: subs.some((s) => s.out === p.element),
  }));
  const counted = squad.filter((p) => p.multiplier > 0);
  const points = counted.reduce((s, p) => s + p.points * p.multiplier, 0);
  const hits = picks.entry_history.event_transfers_cost;
  const viceActive = !!vice && (mult.get(vice.element) ?? 0) > 1;

  return {
    points,
    hits,
    net: points - hits,
    chip,
    captain: get((viceActive ? vice : captain)?.element ?? 0)?.name ?? "",
    viceActive,
    viceProvisional,
    autoSubs: subs.map((s) => ({ in: get(s.in).name, out: get(s.out).name })),
    autoSubsConfirmed: confirmed,
    bps: counted.reduce((s, p) => s + p.bps, 0),
    defcon: counted.reduce((s, p) => s + p.defcon * p.multiplier, 0),
    bonus: counted.reduce((s, p) => s + p.bonus * p.multiplier, 0),
    provisionalBonus: counted.reduce((s, p) => s + (p.bonusProvisional ? p.bonus * p.multiplier : 0), 0),
    toPlay: counted.filter((p) => p.status === "to-play").length,
    playing: counted.filter((p) => p.status === "playing").length,
    squad,
  };
}

/**
 * Free transfers for the next deadline, rebuilt from history using the
 * current rules: +1 a week up to 5, wildcard and free hit keep your bank.
 * Estimate only: FPL doesn't expose this publicly.
 */
export function estimateFreeTransfers(history: FplEntryHistory, upToGw: number) {
  const rows = [...history.current].filter((h) => h.event <= upToGw).sort((a, b) => a.event - b.event);
  if (!rows.length) return 1;
  const chipAt = new Map(history.chips.map((c) => [c.event, c.name]));
  let ft = 1; // available for the week after a manager's first gameweek
  for (const row of rows.slice(1)) {
    const chip = chipAt.get(row.event);
    if (chip !== "wildcard" && chip !== "freehit") ft = Math.max(0, ft - row.event_transfers);
    ft = Math.min(5, ft + 1);
  }
  return ft;
}

export const transfersInGw = (transfers: FplTransfer[], gw: number, ctx: LiveContext) =>
  transfers
    .filter((t) => t.event === gw)
    .map((t) => ({ in: ctx.players.get(t.element_in)?.name ?? "?", out: ctx.players.get(t.element_out)?.name ?? "?" }));

export interface TickerMatch {
  id: number;
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  state: "upcoming" | "live" | "ft";
  minutes: number;
  kickoff: string | null;
  events: { side: "h" | "a"; kind: "goal" | "assist" | "og"; name: string; count: number }[];
}

export function buildTicker(fixtures: FplFixture[], bootstrap: FplBootstrap, ctx: LiveContext): TickerMatch[] {
  const team = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
  const kinds: Record<string, TickerMatch["events"][number]["kind"]> = { goals_scored: "goal", own_goals: "og", assists: "assist" };
  return [...fixtures]
    .sort((a, b) => (a.kickoff_time ?? "").localeCompare(b.kickoff_time ?? "") || a.id - b.id)
    .map((f) => ({
      id: f.id,
      home: team.get(f.team_h) ?? "",
      away: team.get(f.team_a) ?? "",
      homeScore: f.team_h_score,
      awayScore: f.team_a_score,
      state: f.finished || f.finished_provisional ? "ft" : f.started ? "live" : "upcoming",
      minutes: f.minutes,
      kickoff: f.kickoff_time,
      events: f.stats
        .filter((s) => s.identifier in kinds)
        .flatMap((s) =>
          (["h", "a"] as const).flatMap((side) =>
            s[side].map((e) => ({
              // An own goal counts for the other side, so list it there
              side: kinds[s.identifier] === "og" ? (side === "h" ? "a" : "h") : side,
              kind: kinds[s.identifier],
              name: ctx.players.get(e.element)?.name ?? "?",
              count: e.value,
            })),
          ),
        ),
    }));
}

export interface H2HRow {
  player: SquadPlayer;
  /** Effective multipliers this gameweek (0 = benched or not owned) */
  a: number;
  b: number;
  /** Points this player is worth to A over B */
  swing: number;
}

/**
 * Compares two squads player by player. Anyone counted for both with the same
 * multiplier cancels out; everything else is a differential, including
 * captaincy (both own Haaland, one captains him: swing = his points).
 */
export function headToHead(a: SquadPlayer[], b: SquadPlayer[]) {
  const inA = new Map(a.map((p) => [p.id, p]));
  const inB = new Map(b.map((p) => [p.id, p]));
  const ids = new Set([...a, ...b].filter((p) => p.multiplier > 0).map((p) => p.id));
  const rows: H2HRow[] = [...ids].map((id) => {
    const player = (inA.get(id) ?? inB.get(id))!;
    const ma = inA.get(id)?.multiplier ?? 0;
    const mb = inB.get(id)?.multiplier ?? 0;
    return { player, a: ma, b: mb, swing: player.points * (ma - mb) };
  });
  return {
    shared: rows.filter((r) => r.a === r.b).sort((x, y) => y.player.points - x.player.points),
    diffs: rows.filter((r) => r.a !== r.b).sort((x, y) => Math.abs(y.swing) - Math.abs(x.swing) || x.player.pos - y.player.pos),
  };
}
