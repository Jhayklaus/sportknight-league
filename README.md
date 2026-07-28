# SportKnight League ⚔️

A Next.js app for an 18-player home & away league — 306 matches across 34
matchdays, with every player in action each matchday.

## Features

- **League table** — computed live from entered results (win 3 · draw 1 · loss 0;
  ties broken by goal difference, then goals scored, then wins).
- **Fixtures & results** — all 34 matchdays with a completion indicator per matchday.
  Anyone can view; only people with the secret PIN can add, edit, or clear scores.
- **Top scorers** — players ranked by total goals scored across their matches.

Scores update the table and scorer rankings instantly.

## Getting started

```bash
npm install
cp .env.example .env.local   # then change LEAGUE_PIN to your secret
npm run dev
```

Open http://localhost:3000.

To enter scores, click **🔒 Update scores**, enter the PIN, then use
**Add score / Edit / Clear** on any fixture. The unlock lasts for the browser
session; the PIN is verified server-side on every save.

## Configuration

| Variable          | Default  | Purpose                                        |
| ----------------- | -------- | ---------------------------------------------- |
| `LEAGUE_PIN`      | `1234`   | Secret PIN required to update scores. **Change it.** |
| `LEAGUE_DATA_DIR` | `./data` | Where `scores.json` lives (file backend only). |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | — | Redis REST credentials (Vercel KV naming). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | Redis REST credentials (Upstash naming). |

## How results are stored

`lib/store.ts` picks a backend automatically:

- **Redis over REST** (Upstash / Vercel KV) whenever its env vars are set —
  results survive redeploys and work on serverless hosts.
- **A local JSON file** (`data/scores.json`, atomic writes) otherwise — fine
  for local dev or any host with a persistent disk (VPS, Railway, Fly.io…).

### Deploying on Vercel

Vercel's serverless filesystem is **read-only**, so the file backend cannot
save scores there (`POST /api/scores` returns 500). Set up the Redis backend:

1. In your Vercel project, open **Storage → Create Database → Upstash for
   Redis** (free tier is plenty) and connect it to the project. This adds the
   `KV_REST_API_URL`/`KV_REST_API_TOKEN` (or `UPSTASH_REDIS_REST_*`) env vars.
2. While you're in **Settings → Environment Variables**, also set `LEAGUE_PIN`
   to your real secret — otherwise the default `1234` is live.
3. Redeploy. Score updates now persist in Redis.

## Fixture data

The full schedule lives in `lib/fixtures.json`. Regenerate it (e.g. after
adding or renaming players) with:

```bash
node scripts/generate-fixtures.mjs "Player A" "Player B" ...
```

This produces a balanced double round-robin: every pair meets home and away,
and every player gets an equal number of home and away games.
**Regenerating resets match IDs, so clear `data/scores.json` afterwards.**

Verify integrity with:

```bash
npm run validate:fixtures
```
