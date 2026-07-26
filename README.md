# SportKnight League ⚔️

A Next.js app for a 13-player home & away league — 156 matches across 26 matchdays,
with one player resting each matchday.

## Features

- **League table** — computed live from entered results (win 3 · draw 1 · loss 0;
  ties broken by goal difference, then goals scored, then wins).
- **Fixtures & results** — all 26 matchdays with a completion indicator per matchday.
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

The full schedule lives in `lib/fixtures.json`. Verify its integrity
(24 games per player, 12 home / 12 away, every pair meets home and away) with:

```bash
npm run validate:fixtures
```
