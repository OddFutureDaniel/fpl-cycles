import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

export interface Forfeit {
  id: string;
  text: string;
  votes: number;
  createdAt: number;
}

export const MAX_FORFEIT_LENGTH = 140;

// Vercel's Upstash integration sets KV_*; a manual Upstash setup uses UPSTASH_*
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
export const usingMemoryStore = !redis;

const SEASON = process.env.FPL_SEASON ?? "2026-27";
const LEAGUE = process.env.FPL_LEAGUE_ID ?? "1447874";
const key = (cycle: number) => `forfeits:${LEAGUE}:${SEASON}:c${cycle}`;

/**
 * Two keys per cycle:
 *   <key>:votes  sorted set  id -> vote count (ZINCRBY makes upvotes atomic)
 *   <key>:items  hash        id -> { text, createdAt }
 */
type Item = { text: string; createdAt: number };

// Local dev without Redis: in-memory, lost on restart. Kept on globalThis to survive hot reloads.
const g = globalThis as unknown as { __forfeits?: Map<number, Map<string, Forfeit>> };
const memory = (g.__forfeits ??= new Map());
const SAMPLE: Record<number, [string, number][]> = {
  2: [["Wear the winner's club shirt to work for a day", 14], ["Profile picture of the winner for a week", 9], ["Buy the first round", 6]],
  3: [["Karaoke video of a song the group picks", 7], ["Set the group chat name for a week", 4], ["Do a parkrun in fancy dress", 2]],
};
const memCycle = (cycle: number) => {
  if (!memory.has(cycle)) {
    const seed = process.env.FPL_FIXTURE === "1" ? (SAMPLE[cycle] ?? []) : [];
    memory.set(cycle, new Map(seed.map(([text, votes], i) => [`s${cycle}${i}`, { id: `s${cycle}${i}`, text, votes, createdAt: i }])));
  }
  return memory.get(cycle)!;
};

export async function listForfeits(cycle: number): Promise<Forfeit[]> {
  let items: Forfeit[];
  if (!redis) {
    items = [...memCycle(cycle).values()];
  } else {
    const [scores, meta] = await Promise.all([
      redis.zrange<string[]>(`${key(cycle)}:votes`, 0, -1, { withScores: true }),
      redis.hgetall<Record<string, Item>>(`${key(cycle)}:items`),
    ]);
    const votes = new Map<string, number>();
    for (let i = 0; i < scores.length; i += 2) votes.set(String(scores[i]), Number(scores[i + 1]));
    items = Object.entries(meta ?? {}).map(([id, m]) => ({ id, ...m, votes: votes.get(id) ?? 0 }));
  }
  // Most votes first; ties go to whoever suggested it first
  return items.sort((a, b) => b.votes - a.votes || a.createdAt - b.createdAt);
}

export async function addForfeit(cycle: number, text: string): Promise<Forfeit> {
  const item: Forfeit = { id: randomUUID().slice(0, 8), text, votes: 0, createdAt: Date.now() };
  if (!redis) {
    memCycle(cycle).set(item.id, item);
  } else {
    await Promise.all([
      redis.hset(`${key(cycle)}:items`, { [item.id]: { text: item.text, createdAt: item.createdAt } }),
      redis.zadd(`${key(cycle)}:votes`, { score: 0, member: item.id }),
    ]);
  }
  return item;
}

/** Returns the new count, or null if the suggestion doesn't exist. */
export async function upvote(cycle: number, id: string, by = 1): Promise<number | null> {
  if (!redis) {
    const item = memCycle(cycle).get(id);
    if (!item) return null;
    return (item.votes += by);
  }
  if (!(await redis.hexists(`${key(cycle)}:items`, id))) return null;
  return redis.zincrby(`${key(cycle)}:votes`, by, id);
}

/** Top suggestion per cycle, for Records and the round-up. */
export async function forfeitLeaders(cycles: number[]) {
  const lists = await Promise.all(cycles.map(listForfeits));
  return new Map(cycles.map((c, i) => [c, lists[i][0] ?? null]));
}
