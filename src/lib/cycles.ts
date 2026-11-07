import type { Cycle, CycleStatus, Gameweek } from "./types";

/** League rules: four-week cycles, with a longer final cycle to finish the season. */
export const CYCLE_RULES = { totalGameweeks: 38, cycleLength: 4, finalCycleLength: 6 };

export function buildCycles({ totalGameweeks, cycleLength, finalCycleLength } = CYCLE_RULES): Cycle[] {
  const regular = (totalGameweeks - finalCycleLength) / cycleLength;
  if (!Number.isInteger(regular) || regular < 0) {
    throw new Error("Cycle lengths do not divide the season evenly");
  }
  const cycles: Cycle[] = Array.from({ length: regular }, (_, i) => ({
    number: i + 1,
    start: i * cycleLength + 1,
    end: (i + 1) * cycleLength,
  }));
  if (finalCycleLength > 0) {
    cycles.push({ number: regular + 1, start: totalGameweeks - finalCycleLength + 1, end: totalGameweeks });
  }
  return cycles;
}

export const cycleGameweeks = (c: Cycle) => Array.from({ length: c.end - c.start + 1 }, (_, i) => c.start + i);

export function cycleStatus(cycle: Cycle, gameweeks: Map<number, Gameweek>): CycleStatus {
  const gws = cycleGameweeks(cycle).map((id) => gameweeks.get(id));
  if (gws.every((g) => g?.final)) return "complete";
  if (gws.some((g) => g?.started)) return "live";
  return "upcoming";
}
