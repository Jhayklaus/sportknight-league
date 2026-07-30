import fs from "node:fs";
import path from "node:path";
import type { Deduction, LeagueState, LeagueWindow, Score } from "./league";

// Two backends:
//  - Redis over REST (Upstash / Vercel KV) when its env vars are present —
//    required on serverless hosts like Vercel, where the filesystem is read-only.
//  - A local JSON file otherwise (dev, or any host with a persistent disk).

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const REDIS_KEY = "sportknight:scores";

const DATA_DIR = process.env.LEAGUE_DATA_DIR || path.join(process.cwd(), "data");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

const EMPTY: LeagueState = { scores: {}, deductions: [], window: null };

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

/**
 * Accepts both the current `{ scores, deductions }` document and the original
 * format, which was a bare map of match id -> score.
 */
function parseState(raw: unknown): LeagueState {
  if (typeof raw !== "string" || raw === "") return { scores: {}, deductions: [], window: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { scores: {}, deductions: [], window: null };
  }
  if (!parsed || typeof parsed !== "object") return { scores: {}, deductions: [], window: null };

  const doc = parsed as Record<string, unknown>;
  if (doc.scores && typeof doc.scores === "object") {
    return {
      scores: doc.scores as LeagueState["scores"],
      deductions: Array.isArray(doc.deductions) ? (doc.deductions as Deduction[]) : [],
      window: (doc.window as LeagueWindow | null | undefined) ?? null,
    };
  }
  return { scores: doc as LeagueState["scores"], deductions: [], window: null };
}

export async function readState(): Promise<LeagueState> {
  if (redisConfigured()) {
    return parseState(await redisCommand(["GET", REDIS_KEY]));
  }
  try {
    return parseState(fs.readFileSync(SCORES_FILE, "utf8"));
  } catch {
    return { scores: {}, deductions: [], window: null };
  }
}

async function writeState(state: LeagueState): Promise<LeagueState> {
  if (redisConfigured()) {
    await redisCommand(["SET", REDIS_KEY, JSON.stringify(state)]);
    return state;
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = SCORES_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, SCORES_FILE);
  return state;
}

export async function writeScore(matchId: string, score: Score | null): Promise<LeagueState> {
  const state = await readState();
  if (score === null) {
    delete state.scores[matchId];
  } else {
    state.scores[matchId] = { ...score, at: new Date().toISOString() };
  }
  return writeState(state);
}

export async function addDeduction(
  deduction: Omit<Deduction, "id" | "at">
): Promise<LeagueState> {
  const state = await readState();
  state.deductions = [
    ...state.deductions,
    { ...deduction, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: new Date().toISOString() },
  ];
  return writeState(state);
}

export async function removeDeduction(id: string): Promise<LeagueState> {
  const state = await readState();
  state.deductions = state.deductions.filter((d) => d.id !== id);
  return writeState(state);
}

export async function setWindow(window: LeagueWindow | null): Promise<LeagueState> {
  const state = await readState();
  state.window = window;
  return writeState(state);
}

/** Wholesale replace, used by the backup restore endpoint. */
export async function replaceState(next: LeagueState): Promise<LeagueState> {
  return writeState({
    scores: next.scores ?? {},
    deductions: Array.isArray(next.deductions) ? next.deductions : [],
    window: next.window ?? null,
  });
}

export { EMPTY as EMPTY_STATE };
