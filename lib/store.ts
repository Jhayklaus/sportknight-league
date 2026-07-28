import fs from "node:fs";
import path from "node:path";
import type { Score, Scores } from "./league";

// Two backends:
//  - Redis over REST (Upstash / Vercel KV) when its env vars are present —
//    required on serverless hosts like Vercel, where the filesystem is read-only.
//  - A local JSON file otherwise (dev, or any host with a persistent disk).

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = "sportknight:scores";

const DATA_DIR = process.env.LEAGUE_DATA_DIR || path.join(process.cwd(), "data");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

function redisConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redisCommand(command: string[]): Promise<unknown> {
  const res = await fetch(REDIS_URL!, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Redis request failed (${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

function parseScores(raw: unknown): Scores {
  if (typeof raw !== "string" || raw === "") return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Scores) : {};
  } catch {
    return {};
  }
}

export async function readScores(): Promise<Scores> {
  if (redisConfigured()) {
    return parseScores(await redisCommand(["GET", REDIS_KEY]));
  }
  try {
    return parseScores(fs.readFileSync(SCORES_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function writeScore(matchId: string, score: Score | null): Promise<Scores> {
  const scores = await readScores();
  if (score === null) {
    delete scores[matchId];
  } else {
    scores[matchId] = score;
  }

  if (redisConfigured()) {
    await redisCommand(["SET", REDIS_KEY, JSON.stringify(scores)]);
    return scores;
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SCORES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(scores, null, 2));
  fs.renameSync(tmp, SCORES_FILE);
  return scores;
}
