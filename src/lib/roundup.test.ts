import { describe, expect, it } from "vitest";
import { buildCycles } from "./cycles";
import { buildRoundup } from "./roundup";
import type { Gameweek, Manager } from "./types";

const manager = (entry: number, name: string, nets: number[]): Manager => ({
  entry,
  name,
  team: "",
  scores: Object.fromEntries(nets.map((net, i) => [i + 1, { gw: i + 1, net, gross: net, hits: 0 }])),
});
const gwMap = (finalUpTo: number) =>
  new Map<number, Gameweek>(Array.from({ length: 38 }, (_, i) => [i + 1, { id: i + 1, final: i < finalUpTo, started: i < finalUpTo, isCurrent: false }]));

const managers = [manager(1, "Ann", [60, 70, 50, 40]), manager(2, "Ben", [50, 60, 70, 40]), manager(3, "Cat", [40, 50, 60, 30])];

describe("buildRoundup", () => {
  it("names the cycle winner and the loser's forfeit once the cycle is final", () => {
    const text = buildRoundup({
      league: "Lads",
      managers,
      cycles: buildCycles(),
      gwMap: gwMap(4),
      gw: 4,
      forfeit: { text: "Sing", votes: 9 },
    });
    expect(text).toContain("*Lads · GW4 round-up*\n");
    expect(text).toContain("Manager of the week: Ann & Ben (40)");
    expect(text).toContain("Wooden spoon: Cat (30)");
    expect(text).toContain("🏆 Joint winners: Ann & Ben (220)");
    expect(text).toContain("😬 Forfeit for Cat: Sing");
  });

  it("shows the leading forfeit mid-cycle and flags provisional scores", () => {
    const text = buildRoundup({ league: "Lads", managers, cycles: buildCycles(), gwMap: gwMap(1), gw: 2, forfeit: { text: "Sing", votes: 3 } });
    expect(text).toContain("(provisional)");
    expect(text).toContain("2 GW to go");
    expect(text).toContain("leading: Sing (3 votes)");
  });
});
