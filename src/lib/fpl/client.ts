import "server-only";
import { unstable_cache } from "next/cache";
import type {
  FplBootstrap,
  FplElementSummary,
  FplEntryHistory,
  FplFixture,
  FplLeagueStandings,
  FplLive,
  FplPicks,
  FplStandingsResult,
  FplTransfer,
} from "./types";

const BASE = "https://fantasy.premierleague.com/api";
const MAX_RETRIES = 3;
const CONCURRENCY = 6;

export class FplError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a JSON endpoint with Next's data cache (revalidate in seconds),
 * a timeout and exponential backoff on 429/5xx. FPL returns 503 while
 * "the game is being updated" between gameweeks, so retries matter.
 */
async function getJson<T>(path: string, revalidate: number | false): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(`${BASE}${path}`, {
        headers: { "User-Agent": "fpl-cycle-tracker" },
        // false = skip Next's fetch cache (used inside unstable_cache, which caches the trimmed result)
        ...(revalidate === false ? { cache: "no-store" as const } : { next: { revalidate } }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return (await res.json()) as T;
      if (res.status !== 429 && res.status < 500) {
        throw new FplError(`FPL API ${res.status} for ${path}`, res.status);
      }
      lastError = new FplError(`FPL API ${res.status} for ${path}`, res.status);
    } catch (err) {
      if (err instanceof FplError && err.status && err.status < 500 && err.status !== 429) throw err;
      lastError = err;
    }
    if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt);
  }
  throw lastError instanceof Error ? lastError : new FplError(`FPL API failed for ${path}`);
}

/** Run `fn` over items with at most `limit` requests in flight. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++; // safe: JS is single-threaded between awaits
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * bootstrap-static is over Next's 2 MB fetch-cache limit, so fetch it uncached
 * and cache only the fields we use (a few KB) with unstable_cache.
 */
export const getBootstrap = unstable_cache(
  async (): Promise<FplBootstrap> => {
    const raw = await getJson<FplBootstrap>("/bootstrap-static/", false);
    return {
      events: raw.events.map(({ id, name, deadline_time, finished, data_checked, is_current, is_next }) => ({
        id, name, deadline_time, finished, data_checked, is_current, is_next,
      })),
      elements: raw.elements.map(({ id, web_name, team, element_type }) => ({ id, web_name, team, element_type })),
      teams: raw.teams.map(({ id, short_name }) => ({ id, short_name })),
    };
  },
  ["fpl-bootstrap"],
  { revalidate: 120 },
);

/** Walks every standings page (50 per page) so large leagues are complete. */
export async function getLeague(leagueId: number) {
  const results: FplStandingsResult[] = [];
  let name = "";
  for (let page = 1; ; page++) {
    const data = await getJson<FplLeagueStandings>(
      `/leagues-classic/${leagueId}/standings/?page_standings=${page}`,
      300,
    );
    name = data.league.name;
    results.push(...data.standings.results);
    if (!data.standings.has_next) break;
  }
  return { name, managers: results };
}

export const getHistories = (entryIds: number[]) =>
  mapPool(entryIds, CONCURRENCY, (id) => getJson<FplEntryHistory>(`/entry/${id}/history/`, 120));

// Live data: short cache while matches are on
export const getLive = (gw: number) => getJson<FplLive>(`/event/${gw}/live/`, 60);
export const getFixtures = (gw: number) => getJson<FplFixture[]>(`/fixtures/?event=${gw}`, 60);

// Picks are locked at the deadline; automatic_subs only appear once FPL processes the gameweek
export const getAllPicks = (entryIds: number[], gw: number) =>
  mapPool(entryIds, CONCURRENCY, (id) => getJson<FplPicks>(`/entry/${id}/event/${gw}/picks/`, 600));

export const getAllTransfers = (entryIds: number[]) =>
  mapPool(entryIds, CONCURRENCY, (id) => getJson<FplTransfer[]>(`/entry/${id}/transfers/`, 600));

export const getElementSummary = (id: number) => getJson<FplElementSummary>(`/element-summary/${id}/`, 1800);
