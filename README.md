# SportKnight League ⚔️

A Next.js app for running home & away leagues. Anyone can create a league, add
players, and get a full double round-robin schedule generated for them. The
original SportKnight league lives at the site root; every other league gets its
own page at `/l/<slug>`.

## Features

- **League table** — computed live from entered results (win 3 · draw 1 · loss 0;
  ties broken by goal difference, then goals scored, then wins).
- **Fixtures & results** — every matchday with a completion indicator.
  Anyone can view; only people with the admin code can add, edit or clear scores.
- **Top scorers** and **clean sheets** — players ranked by goals and by shutouts.
- **Player profiles** — position, form, home/away split, biggest win/loss, full
  results and remaining fixtures. Names in the table link straight to them.
- **Head to head** — every meeting between two players across all seasons: the
  all-time record, a per-season breakdown, and each result grouped by season.
  Players who have left the league can still be picked.
- **Deadline tracker** — rule 5's 48-hour play window: recorders choose how many
  matchdays it covers (default 6) and can resize a running window without
  restarting its countdown. Shows the countdown, an overdue state, outstanding
  fixtures and a ranked "who needs chasing" list.
- **What if** — project the table by picking imagined winners for unplayed
  fixtures (nothing is saved).
- **Activity feed** — the most recently recorded results, newest first.
- **Export & backup** — download the season as JSON or CSV, and restore a backup.
- **Seasons** — everyone can browse past seasons (final table, scorers, clean
  sheets, every result). Admins archive the season and start the next one, but
  only once every fixture has a result.
- **Hall of Fame** — the top 5 in the table, top 5 scorers and top 5 clean-sheet
  keepers for every completed season, plus an all-time roll of titles, podiums,
  goals and clean sheets.
- **Relegation** — each league sets how many players drop out per season. At the
  rollover the bottom placings are pre-ticked, admins adjust who leaves, name the
  replacements, and next season's fixtures are generated automatically.
- **Multiple leagues** — create one at `/leagues` with its own admin code. Codes
  are salted and hashed, checked server-side on every write, and never shared
  between leagues.

Finished seasons are archived with player names baked into each result, so past
seasons stay correct even if the roster or fixture list changes later.

Scores update the table and scorer rankings instantly.

## Getting started

```bash
npm install
cp .env.example .env.local   # then change LEAGUE_PIN to your secret
npm run dev
```

Open http://localhost:3000.

To enter scores, click **🔒 Admin**, enter the league's admin code, then use
**Add score / Edit / Clear** on any fixture. The unlock lasts for the browser
session; the code is verified server-side on every save.

Visit `/leagues` to see every league or create a new one.

## Configuration

| Variable          | Default  | Purpose                                        |
| ----------------- | -------- | ---------------------------------------------- |
| `LEAGUE_PIN`      | `1234`   | Admin code for the original root league only. **Change it.** New leagues set their own code at creation. |
| `LEAGUE_CREATION_CODE` | — | If set, creating a league requires this shared code. Leave unset to let anyone create one. |
| `ROOT_LEAGUE_SLUG` | `sportknight` | Which league is served at `/`. |
| `LEAGUE_DATA_DIR` | `./data` | Where league files live (file backend only). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | — | Redis REST credentials (Vercel KV naming). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | Redis REST credentials (Upstash naming). |

## How results are stored

`lib/store.ts` picks a backend automatically:

- **Redis over REST** (Upstash / Vercel KV) whenever its env vars are set —
  results survive redeploys and work on serverless hosts.
- **Local JSON files** (`data/leagues/<slug>.json`, atomic writes) otherwise —
  fine for local dev or any host with a persistent disk (VPS, Railway, Fly.io…).

### Deploying on Vercel

Vercel's serverless filesystem is **read-only**, so the file backend cannot
save scores there (writes return 500). Set up the Redis backend:

1. In your Vercel project, open **Storage → Create Database → Upstash for
   Redis** (free tier is plenty) and connect it to the project. This adds the
   `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) env vars.
2. While you're in **Settings → Environment Variables**, also set `LEAGUE_PIN`
   to your real secret — otherwise the default `1234` is live.
3. Redeploy. Score updates now persist in Redis.

## Fixtures

Schedules are generated per league from its roster — there is no fixture file to
edit. `lib/leagues.ts` builds a balanced double round-robin (every pair meets
home and away, equal home/away counts) and then optimises venue order so nobody
sits through a long run of home or away games. Odd rosters get a bye, so one
player rests each matchday.

Rosters can only be changed while a season has no results; after that, use the
relegation step at the season rollover. `lib/fixtures.json` is kept solely so the
original league's data can be migrated on first read.

## Upgrading from the single-league version

The first release stored one league under a single key. On first read the app
migrates that document into a league record automatically, keeping the original
fixture ids so every recorded result stays attached to the right match, along
with its deductions, window, season number and archives. The migrated league
keeps using `LEAGUE_PIN` until an admin code is set for it.
