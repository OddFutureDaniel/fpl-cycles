import { NextResponse } from "next/server";
import { getBootstrap, getElementSummary } from "@/lib/fpl/client";
import { fixtureBootstrap, fixtureElementSummary } from "@/lib/fpl/fixture";
import { useFixture } from "@/lib/league";

/** Last five gameweeks for one player, for the squad pop-up. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Bad id" }, { status: 400 });
  try {
    const [bootstrap, summary] = useFixture
      ? [fixtureBootstrap(), fixtureElementSummary(id)]
      : await Promise.all([getBootstrap(), getElementSummary(id)]);
    const team = new Map(bootstrap.teams.map((t) => [t.id, t.short_name]));
    const history = summary.history.slice(-5).reverse().map((h) => ({
      ...h,
      opponent: `${team.get(h.opponent_team) ?? "?"} (${h.was_home ? "H" : "A"})`,
    }));
    return NextResponse.json({ history });
  } catch {
    return NextResponse.json({ error: "FPL unavailable" }, { status: 502 });
  }
}
