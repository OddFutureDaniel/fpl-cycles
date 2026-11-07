// Raw response shapes from the unofficial FPL API. Only the fields we use are typed.

export interface FplEvent {
  id: number;
  name: string;
  deadline_time: string;
  finished: boolean;
  data_checked: boolean;
  is_current: boolean;
  is_next: boolean;
}

/** element_type: 1 GK, 2 DEF, 3 MID, 4 FWD */
export interface FplElement {
  id: number;
  web_name: string;
  team: number;
  element_type: 1 | 2 | 3 | 4;
}

export interface FplTeam {
  id: number;
  short_name: string;
}

export interface FplBootstrap {
  events: FplEvent[];
  elements: FplElement[];
  teams: FplTeam[];
}

export interface FplStandingsResult {
  entry: number;
  entry_name: string;
  player_name: string;
  rank: number;
  total: number;
  event_total: number;
}

export interface FplLeagueStandings {
  league: { id: number; name: string };
  standings: {
    has_next: boolean;
    page: number;
    results: FplStandingsResult[];
  };
}

export interface FplHistoryEvent {
  event: number;
  /** Gross gameweek points, before transfer hits */
  points: number;
  /** Running season total, after hits */
  total_points: number;
  overall_rank: number | null;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
}

export interface FplEntryHistory {
  current: FplHistoryEvent[];
  chips: { name: string; event: number }[];
}

export interface FplLiveElement {
  id: number;
  stats: {
    minutes: number;
    goals_scored: number;
    assists: number;
    bonus: number;
    bps: number;
    total_points: number;
  };
  explain: { fixture: number; stats: { identifier: string; points: number; value: number }[] }[];
}

export interface FplLive {
  elements: FplLiveElement[];
}

export interface FplFixtureStat {
  identifier: string;
  a: { value: number; element: number }[];
  h: { value: number; element: number }[];
}

export interface FplFixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  kickoff_time: string | null;
  started: boolean | null;
  finished: boolean;
  finished_provisional: boolean;
  minutes: number;
  stats: FplFixtureStat[];
}

export interface FplPick {
  element: number;
  /** 1–11 starting XI, 12–15 bench in substitution order (12 is the reserve keeper) */
  position: number;
  multiplier: number;
  is_captain: boolean;
  is_vice_captain: boolean;
}

export interface FplPicks {
  active_chip: string | null;
  automatic_subs: { element_in: number; element_out: number }[];
  entry_history: { event: number; overall_rank: number | null; event_transfers: number; event_transfers_cost: number };
  picks: FplPick[];
}

export interface FplTransfer {
  element_in: number;
  element_out: number;
  event: number;
  time: string;
}

export interface FplPlayerGw {
  round: number;
  opponent_team: number;
  was_home: boolean;
  minutes: number;
  total_points: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  saves: number;
  bonus: number;
  bps: number;
  defensive_contribution?: number;
  expected_goals?: string;
  expected_assists?: string;
}

export interface FplElementSummary {
  history: FplPlayerGw[];
}
