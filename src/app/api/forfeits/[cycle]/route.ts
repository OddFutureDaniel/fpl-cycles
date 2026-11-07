import { NextResponse } from "next/server";
import { addForfeit, listForfeits, MAX_FORFEIT_LENGTH } from "@/lib/forfeits";
import { cycleState } from "@/lib/league";

type Ctx = { params: Promise<{ cycle: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const cycle = Number((await params).cycle);
  const state = await cycleState(cycle);
  if (!state) return NextResponse.json({ error: "Unknown cycle" }, { status: 404 });
  return NextResponse.json({ open: state !== "complete", items: await listForfeits(cycle) });
}

export async function POST(req: Request, { params }: Ctx) {
  const cycle = Number((await params).cycle);
  const state = await cycleState(cycle);
  if (!state) return NextResponse.json({ error: "Unknown cycle" }, { status: 404 });
  if (state === "complete") return NextResponse.json({ error: "Voting has closed for this cycle" }, { status: 409 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text || text.length > MAX_FORFEIT_LENGTH) {
    return NextResponse.json({ error: `Keep it between 1 and ${MAX_FORFEIT_LENGTH} characters` }, { status: 400 });
  }
  return NextResponse.json(await addForfeit(cycle, text), { status: 201 });
}
