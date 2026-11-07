import "server-only";
import { Redis } from "@upstash/redis";
import { randomUUID } from "node:crypto";

export interface Forfeit {
  id: string;
  text: string;
  votes: number;
  createdAt: number;
  /** Whether the current voter has upvoted it */
  voted: boolean;
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
 * Keys per cycle:
 *   <key>:votes        sorted set  id -> vote count
 *   <key>:items        hash        id -> { text, createdAt }
 *   <key>:voters:<id>  set         voter ids who upvoted that suggestion
 * The voters set is what limits each voter to one upvote: SADD/SREM report
 * whether anything changed, and only then is the count moved.
 */
type Item = { text: string; createdAt: number };
type MemItem = Item & { id: string; votes: number; voters: Set<string> };

// Local dev without Redis: in-memory, lost on restart. Kept on globalThis to survive hot reloads.
const g = globalThis as unknown as { __forfeits?: Map<number, Map<string, MemItem>> };
const memory = (g.__forfeits ??= new Map());
const SAMPLE: Record<number, [string, number][]> = {
  2: [["Wear the winner's club shirt to work for a day", 7], ["Profile picture of the winner for a week", 4], ["Buy the first round", 2]],
  3: [["Karaoke video of a song the group picks", 5], ["Set the group chat name for a week", 3], ["Do a parkrun in fancy dress", 1]],
};
const memCycle = (cycle: number) => {
  if (!memory.has(cycle)) {
    const seed = process.env.FPL_FIXTURE === "1" ? (SAMPLE[cycle] ?? []) : [];
    memory.set(
      cycle,
      new Map(seed.map(([text, votes], i) => {
        const id = `s${cycle}${i}`;
        // Sample votes come from made-up voters so your own vote still counts
        return [id, { id, text, createdAt: i, votes, voters: new Set(Array.from({ length: votes }, (_, v) => `sample${v}`)) }];
      })),
    );
  }
  return memory.get(cycle)!;
};

export async function listForfeits(cycle: number, voter?: string | null): Promise<Forfeit[]> {
  let items: Forfeit[];
  if (!redis) {
    items = [...memCycle(cycle).values()].map(({ voters, ...i }) => ({ ...i, voted: !!voter && voters.has(voter) }));
  } else {
    const [scores, meta] = await Promise.all([
      redis.zrange<string[]>(`${key(cycle)}:votes`, 0, -1, { withScores: true }),
      redis.hgetall<Record<string, Item>>(`${key(cycle)}:items`),
    ]);
    const votes = new Map<string, number>();
    for (let i = 0; i < scores.length; i += 2) votes.set(String(scores[i]), Number(scores[i + 1]));
    const ids = Object.keys(meta ?? {});

    // One round trip to find which of these this voter has already upvoted
    let mine: number[] = [];
    if (voter && ids.length) {
      const p = redis.pipeline();
      for (const id of ids) p.sismember(`${key(cycle)}:voters:${id}`, voter);
      mine = (await p.exec()) as number[];
    }
    items = ids.map((id, i) => ({ id, ...meta![id], votes: votes.get(id) ?? 0, voted: mine[i] === 1 }));
  }
  // Most votes first; ties go to whoever suggested it first
  return items.sort((a, b) => b.votes - a.votes || a.createdAt - b.createdAt);
}

export async function addForfeit(cycle: number, text: string): Promise<Forfeit> {
  const item = { id: randomUUID().slice(0, 8), text, createdAt: Date.now() };
  if (!redis) {
    memCycle(cycle).set(item.id, { ...item, votes: 0, voters: new Set() });
  } else {
    await Promise.all([
      redis.hset(`${key(cycle)}:items`, { [item.id]: { text: item.text, createdAt: item.createdAt } }),
      redis.zadd(`${key(cycle)}:votes`, { score: 0, member: item.id }),
    ]);
  }
  return { ...item, votes: 0, voted: false };
}

/**
 * Sets this voter's upvote on or off. Idempotent: voting twice still counts
 * once. Returns the new state, or null if the suggestion doesn't exist.
 */
export async function setVote(cycle: number, id: string, voter: string, on: boolean) {
  if (!redis) {
    const item = memCycle(cycle).get(id);
    if (!item) return null;
    const had = item.voters.has(voter);
    if (on && !had) item.voters.add(voter), item.votes++;
    if (!on && had) item.voters.delete(voter), item.votes--;
    return { votes: item.votes, voted: on };
  }
  if (!(await redis.hexists(`${key(cycle)}:items`, id))) return null;
  const voters = `${key(cycle)}:voters:${id}`;
  const changed = on ? await redis.sadd(voters, voter) : await redis.srem(voters, voter);
  const votes = changed
    ? await redis.zincrby(`${key(cycle)}:votes`, on ? 1 : -1, id)
    : Number((await redis.zscore(`${key(cycle)}:votes`, id)) ?? 0);
  return { votes, voted: on };
}

/** Top suggestion per cycle, for Records and the round-up. */
export async function forfeitLeaders(cycles: number[]) {
  const lists = await Promise.all(cycles.map((c) => listForfeits(c)));
  return new Map(cycles.map((c, i) => [c, lists[i][0] ?? null]));
}
