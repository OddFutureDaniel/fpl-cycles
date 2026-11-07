import { cycleStatus } from "./cycles";
import { cycleStandings, overallStandings } from "./scoring";
import type { Cycle, Gameweek, Manager } from "./types";

interface RoundupInput {
  league: string;
  managers: Manager[];
  cycles: Cycle[];
  gwMap: Map<number, Gameweek>;
  gw: number;
  /** Top forfeit suggestion for the gameweek's cycle */
  forfeit: { text: string; votes: number } | null;
  url?: string;
}

const names = (list: { name: string }[]) => list.map((m) => m.name).join(" & ");

/** Plain text for WhatsApp: *bold* and emoji only, so it pastes cleanly anywhere. */
export function buildRoundup({ league, managers, cycles, gwMap, gw, forfeit, url }: RoundupInput): string {
  const final = !!gwMap.get(gw)?.final;
  const lines: string[] = [`*${league} · GW${gw} round-up*${final ? "" : " (provisional)"}`, ""];

  const scored = managers.filter((m) => m.scores[gw]).map((m) => ({ name: m.name, pts: m.scores[gw].net }));
  if (scored.length) {
    const top = Math.max(...scored.map((s) => s.pts));
    const bottom = Math.min(...scored.map((s) => s.pts));
    lines.push(`🔝 Manager of the week: ${names(scored.filter((s) => s.pts === top))} (${top})`);
    lines.push(`🥄 Wooden spoon: ${names(scored.filter((s) => s.pts === bottom))} (${bottom})`, "");
  }

  const cycle = cycles.find((c) => gw >= c.start && gw <= c.end);
  if (cycle) {
    const status = cycleStatus(cycle, gwMap);
    const rows = cycleStandings(managers, cycle, gwMap);
    const left = cycle.end - gw;
    lines.push(
      `*Cycle ${cycle.number} · GW${cycle.start}-${cycle.end}*${status === "complete" ? " · FINAL" : left ? ` · ${left} GW to go` : " · last GW"}`,
    );
    for (const r of rows) lines.push(`${r.rank}. ${r.name} ${r.total}${r.gap ? ` (-${r.gap})` : ""}`);
    lines.push("");

    const bottom = Math.max(...rows.map((r) => r.rank));
    const losers = rows.filter((r) => r.rank === bottom);
    if (status === "complete") {
      lines.push(`🏆 ${rows.filter((r) => r.winner).length > 1 ? "Joint winners" : "Winner"}: ${names(rows.filter((r) => r.winner))} (${rows[0].total})`);
      lines.push(`😬 Forfeit for ${names(losers)}: ${forfeit ? forfeit.text : "still to be decided"}`);
    } else if (forfeit) {
      lines.push(`😬 Forfeit currently leading: ${forfeit.text} (${forfeit.votes} votes)`);
    }
    lines.push("");
  }

  const season = overallStandings(managers, cycles, gwMap, gw).slice(0, 3);
  lines.push("*Season top 3*", ...season.map((r) => `${r.rank}. ${r.name} ${r.total}`));
  if (url) lines.push("", `Full tables and forfeit vote: ${url}`);
  return lines.join("\n");
}
