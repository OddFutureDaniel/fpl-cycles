import { NextResponse } from "next/server";
import { setVote } from "@/lib/forfeits";
import { cycleState } from "@/lib/league";
import { ensureVoter } from "@/lib/voter";

type Ctx = { params: Promise<{ cycle: string; id: string }> };

/** POST adds this browser's upvote, DELETE removes it. One per suggestion, enforced here. */
async function handle(on: boolean, { params }: Ctx) {
  const { cycle: c, id } = await params;
  const cycle = Number(c);
  const state = await cycleState(cycle);
  if (!state) return NextResponse.json({ error: "Unknown cycle" }, { status: 404 });
  if (state === "complete") return NextResponse.json({ error: "Voting has closed for this cycle" }, { status: 409 });

  const result = await setVote(cycle, id, await ensureVoter(), on);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}

export const POST = (_req: Request, ctx: Ctx) => handle(true, ctx);
export const DELETE = (_req: Request, ctx: Ctx) => handle(false, ctx);
