export interface Gameweek {
  id: number;
  /** Deadline has passed, so points exist (possibly provisional) */
  started: boolean;
  /** Finished and data checked by FPL: points are final */
  final: boolean;
  isCurrent: boolean;
}

export interface GwScore {
  gw: number;
  /** Net points after hits: what counts */
  net: number;
  gross: number;
  hits: number;
  chip?: string;
}

export interface Manager {
  entry: number;
  name: string;
  team: string;
  scores: Record<number, GwScore>;
}

export interface Cycle {
  number: number;
  start: number;
  end: number;
}

export type CycleStatus = "complete" | "live" | "upcoming";

export interface CycleRow {
  entry: number;
  name: string;
  team: string;
  total: number;
  /** One per gameweek in the cycle; null if not played (late entrant or not started) */
  gws: (GwScore | null)[];
  hits: number;
  /** Started gameweeks in the cycle the manager has no score for */
  missed: number;
  rank: number;
  gap: number;
  winner: boolean;
}

export interface OverallRow {
  entry: number;
  name: string;
  team: string;
  total: number;
  lastGw: number | null;
  bestGw: number | null;
  average: number;
  hits: number;
  cycleWins: number;
  rank: number;
  gap: number;
}
