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
| `LEAGUE_DATA_DIR` | `./data` | Where `scores.json` (the results store) lives. |

## How results are stored

Results are kept in a single JSON file (`data/scores.json`), written atomically
on every update. This is simple and dependable for a friends league on any
Node host (VPS, Railway, Render, Fly.io, a Raspberry Pi…).

> **Note for serverless hosts (e.g. Vercel):** the filesystem there is
> ephemeral, so entered scores would vanish on redeploy. Deploy to a host with a
> persistent disk, or swap `lib/store.ts` for a hosted store (Vercel KV, Upstash,
> Supabase) — it is the only file that touches storage.

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
