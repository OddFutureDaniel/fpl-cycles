import { NextResponse } from "next/server";
import { upvote } from "@/lib/forfeits";
import { cycleState } from "@/lib/league";

/** Upvotes are unlimited; the client batches quick taps into one request via `by`. */
export async function POST(req: Request, { params }: { params: Promise<{ cycle: string; id: string }> }) {
  const { cycle: c, id } = await params;
  const cycle = Number(c);
  const state = await cycleState(cycle);
  if (!state) return NextResponse.json({ error: "Unknown cycle" }, { status: 404 });
  if (state === "complete") return NextResponse.json({ error: "Voting has closed for this cycle" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const by = Math.min(Math.max(Math.floor(Number(body.by) || 1), 1), 50);
  const votes = await upvote(cycle, id, by);
  if (votes === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ votes });
}
