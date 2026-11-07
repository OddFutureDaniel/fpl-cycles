import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Anonymous voter id, one per browser, kept in an httpOnly cookie for a year.
 * It's what stops repeat upvotes; clearing cookies or switching device gets a
 * new one, which is an acceptable trade-off for a no-login friends' league.
 */
const COOKIE = "fpl_voter";

export async function readVoter() {
  return (await cookies()).get(COOKIE)?.value ?? null;
}

/** Only call from a route handler: setting cookies isn't allowed during render. */
export async function ensureVoter() {
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 60 * 60 * 24 * 365, path: "/" });
  return id;
}
