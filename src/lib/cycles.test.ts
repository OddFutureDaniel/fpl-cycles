import { describe, expect, it } from "vitest";
import { buildCycles, cycleGameweeks, cycleStatus } from "./cycles";
import type { Gameweek } from "./types";

const gwMap = (finalUpTo: number, startedUpTo: number) =>
  new Map<number, Gameweek>(
    Array.from({ length: 38 }, (_, i) => {
      const id = i + 1;
      return [id, { id, final: id <= finalUpTo, started: id <= startedUpTo, isCurrent: id === startedUpTo }];
    }),
  );

describe("buildCycles", () => {
  const cycles = buildCycles();

  it("makes eight four-week cycles and a six-week finale", () => {
    expect(cycles).toHaveLength(9);
    expect(cycles[0]).toEqual({ number: 1, start: 1, end: 4 });
    expect(cycles[1]).toEqual({ number: 2, start: 5, end: 8 });
    expect(cycles[7]).toEqual({ number: 8, start: 29, end: 32 });
    expect(cycles[8]).toEqual({ number: 9, start: 33, end: 38 });
  });

  it("covers every gameweek exactly once", () => {
    expect(cycles.flatMap(cycleGameweeks)).toEqual(Array.from({ length: 38 }, (_, i) => i + 1));
  });

  it("rejects lengths that do not fit the season", () => {
    expect(() => buildCycles({ totalGameweeks: 38, cycleLength: 4, finalCycleLength: 5 })).toThrow();
  });
});

describe("cycleStatus", () => {
  const [c1, c2, c3] = buildCycles();

  it("is complete only when every gameweek is final", () => {
    expect(cycleStatus(c1, gwMap(4, 5))).toBe("complete");
    expect(cycleStatus(c2, gwMap(7, 8))).toBe("live"); // GW8 played but not data-checked
  });

  it("is upcoming before its first deadline", () => {
    expect(cycleStatus(c3, gwMap(7, 8))).toBe("upcoming");
  });
});
