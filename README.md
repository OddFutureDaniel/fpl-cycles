# FPL Cycle Tracker

Four-gameweek mini-league standings for an FPL classic league, pulled live from the FPL API. Next.js 16 (App Router), TypeScript, Tailwind 4. No database.

## Run it

```bash
npm install
cp .env.example .env.local     # set FPL_LEAGUE_ID
npm run dev                    # live FPL data
npm run dev:fixture            # generated sample data, no API calls
npm test                       # cycle and ranking tests
```

Deploy to Vercel as-is and set `FPL_LEAGUE_ID` in the project's environment variables.

## League rules (as configured)

| Rule | Setting | Where |
| --- | --- | --- |
| Cycles | GW1–4, GW5–8 … GW29–32, then GW33–38 (six weeks) | `CYCLE_RULES` in `src/lib/cycles.ts` |
| Scoring | Net of transfer hits | `scoresFromHistory` in `src/lib/scoring.ts` |
| Ties | Joint winners; tied managers share a rank (1, 1, 3) | `rankBy` |
| Provisional weeks | Shown in orange; no winner until every GW in the cycle is finished and data-checked | `cycleStatus` |
| Late entrants | Included in every cycle, with missed gameweeks scoring 0 and flagged | `cycleStandings` |

## Live view

The default tab while a gameweek is in play. It refreshes itself every minute while matches are on.

- **Ticker:** every fixture this gameweek with score, minute, scorers and assisters.
- **Live table:** #, movement, team, GW (net), total, gap, captain, chip, auto-subs, BPS, DEFCON, status (live / to play), overall rank. Click any header to sort.
- **Row breakdown:** the squad laid out by position with bench, live points, minutes, bonus, DEFCON, captain/vice, predicted auto-subs, this week's transfers and an estimated free-transfer count.
- **Player pop-up:** last five gameweeks with position-specific columns.

How the predictions work (all in `src/lib/live.ts`, tested in `live.test.ts`):

- **Provisional bonus:** for fixtures not yet `finished`, the top three BPS get 3/2/1 using FPL's tie rules. Once FPL marks the fixture finished, its confirmed bonus is used instead.
- **Auto-subs:** a starter who got 0 minutes and has no game left is replaced by the first bench player (in bench order) who has played and keeps a legal formation (1 GK, 3+ DEF, 2+ MID, 1+ FWD). If the next bench player hasn't played yet, the prediction waits. When FPL publishes `automatic_subs`, its version replaces the prediction.
- **Vice-captain:** if the captain can no longer play and didn't, the vice gets the multiplier (×3 on Triple Captain).
- **Free transfers:** FPL doesn't publish this, so it's rebuilt from history: +1 a week up to 5, wildcard and free hit keep the bank. Treat it as an estimate.

## Charts

Points race, gap to leader, weekly scores (heatmap, top score each week outlined) and league position. Toggle up to six managers to compare; everyone else stays as grey context lines.

## Head to head

Pick any two managers. Shows each side's live score, captain, chip and players left, then every differential with the points swing it makes (captaincy counts: both own a player but one captains him = a differential). Shared players are listed separately as they cancel out.

## "I'm…" picker

Choose yourself in the header once per device (saved in the browser). Your row is highlighted in every table, the charts open on you vs the leader and head to head opens on you.

## Early vice-captain switch

If a captain has 0 minutes while every one of his matches has kicked off and his team-mates are on the pitch, he's treated as benched or dropped: the vice gets the armband straight away, shown as **VC?**. It reverts the moment he comes on. Benched starters are crossed out in the squad view. Auto-subs still wait until the player's match is over.

## Forfeit vote

Every cycle page has a board: anyone can suggest as many forfeits as they like and upvote each suggestion once (tap again to take the vote back). Votes are tied to an anonymous cookie per browser and checked on the server, so repeat taps or replayed requests don't count twice; someone could still vote again from a second device or after clearing cookies. Voting closes when the cycle's last gameweek is final; the top suggestion becomes the forfeit for whoever finished bottom (joint if tied), shown on the cycle page, in Records and in the round-up. There's no login or moderation, so anyone with the link can post.

**Storage setup (Vercel):** Project → Storage → add **Upstash for Redis** (free tier) and connect it to the project. It sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`, which the app reads automatically (`UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work). Locally without them, suggestions are kept in memory and vanish on restart. Keys are namespaced by league and `FPL_SEASON` (default `2026-27`), so next season starts clean.

## WhatsApp round-up

The **Round-up** button in the header builds a summary of the latest gameweek: manager of the week, wooden spoon, the cycle table, the cycle winner and forfeit (or the leading forfeit mid-cycle) and the season top three, with a link back to the site. Copy it, or open WhatsApp with it pre-filled. Set `SITE_URL` if the link should use a custom domain.

## Request volume

A Live page load needs bootstrap + live + fixtures + league pages + three requests per manager (history, picks, transfers). Everything is cached (live data 60 s, picks and transfers 10 min, history 5 min), so a 20-manager league costs roughly 65 FPL requests a minute at most, however many people are watching. Other tabs skip the picks and transfers calls.

## How it fits together

```
src/lib/fpl/client.ts   fetches, retries (429/5xx), pagination, max 6 requests in flight, 5-min cache
src/lib/fpl/fixture.ts  sample data in the raw API shape
src/lib/league.ts       turns the three endpoints into managers + gameweek states
src/lib/cycles.ts       cycle boundaries and status
src/lib/scoring.ts      pure functions: net scores, ranking, cycle/overall tables, records
src/lib/live.ts         pure live engine: bonus, auto-subs, captaincy, DEFCON, ticker
src/app/page.tsx        one server-rendered page; ?view=live | overall | cycle-N | charts | records
src/app/api/player/     last-5 history for the player pop-up
src/app/api/forfeits/   list, suggest and upvote forfeits (Redis)
src/lib/forfeits.ts     Redis store with an in-memory fallback
src/lib/roundup.ts      WhatsApp text builder
```

### Notes on the less obvious bits

- **Hits are never subtracted by hand.** `history.current[].points` is the gross score and `event_transfers_cost` is separate, but `total_points` (the running total) already has hits taken off. Each gameweek's net score is the difference between consecutive `total_points` values, so double-deducting is impossible.
- **Caching.** Every fetch uses `next: { revalidate: 300 }`, so a league of 20 makes ~22 FPL requests at most once every five minutes, however many people load the page.
- **`mapPool`** in the client runs workers that each pull the next index from a shared counter. That's safe without locks because JavaScript only switches between them at `await`.
- **Views are links, not client state**, so every tab is shareable. Only the live table, player pop-up and charts are client components.
- **bootstrap-static is over 2 MB**, which is Next's per-fetch cache limit, so it's fetched uncached and only the trimmed fields are cached with `unstable_cache`.
