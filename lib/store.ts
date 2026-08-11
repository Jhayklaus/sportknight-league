import fs from "node:fs";
import path from "node:path";
import legacyFixtures from "./fixtures.json";
import { archiveCurrentSeason, isSeasonComplete, type Deduction, type LeagueWindow, type Match, type Score } from "./league";
import {
  emptyLeague,
  generateFixtures,
  viewOf,
  type LeagueRecord,
  type LeagueSummary,
} from "./leagues";
import { summarise } from "./leagues";

// Two backends:
//  - Redis over REST (Upstash / Vercel KV) when its env vars are present —
//    required on serverless hosts like Vercel, where the filesystem is read-only.
//  - Local JSON files otherwise (dev, or any host with a persistent disk).

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

/** Where the original single-league app kept everything. */
const LEGACY_KEY = "sportknight:scores";
const INDEX_KEY = "sportknight:leagues";
const leagueKey = (slug: string) => `sportknight:league:${slug}`;

const DATA_DIR = process.env.LEAGUE_DATA_DIR || path.join(process.cwd(), "data");
const LEGACY_FILE = path.join(DATA_DIR, "scores.json");
const LEAGUES_DIR = path.join(DATA_DIR, "leagues");

/** The league shown at the site root, so the original link keeps working. */
export const ROOT_LEAGUE_SLUG = process.env.ROOT_LEAGUE_SLUG || "sportknight";
const ROOT_LEAGUE_NAME = process.env.ROOT_LEAGUE_NAME || "SportKnight League";

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
  if (!res.ok) throw new Error(`Redis request failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (data.error) throw new Error(`Redis error: ${data.error}`);
  return data.result;
}

/* --------------------------------------------------------------- raw i/o */

async function readRaw(key: string, file: string): Promise<string | null> {
  if (redisConfigured()) {
    const value = await redisCommand(["GET", key]);
    return typeof value === "string" ? value : null;
  }
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

async function writeRaw(key: string, file: string, value: string): Promise<void> {
  if (redisConfigured()) {
    await redisCommand(["SET", key, value]);
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, value);
  fs.renameSync(tmp, file);
}

function leagueFile(slug: string) {
  return path.join(LEAGUES_DIR, `${slug}.json`);
}

const indexFile = path.join(LEAGUES_DIR, "index.json");

async function readIndex(): Promise<string[]> {
  const raw = await readRaw(INDEX_KEY, indexFile);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

async function writeIndex(slugs: string[]): Promise<void> {
  await writeRaw(INDEX_KEY, indexFile, JSON.stringify([...new Set(slugs)]));
}

/* ------------------------------------------------------------- migration */

/**
 * The first version of this app stored one league under a single key, with
 * fixtures compiled in from fixtures.json. Convert that document into a
 * regular league record, keeping the original fixture ids so every recorded
 * result stays attached to the right match.
 */
function legacyToLeague(doc: Record<string, unknown>): LeagueRecord {
  const fixtures: Match[] = (
    legacyFixtures as { matchday: number; matches: { home: string; away: string }[] }[]
  ).flatMap((md) =>
    md.matches.map((m, i) => ({
      id: `${md.matchday}-${i + 1}`,
      matchday: md.matchday,
      home: m.home,
      away: m.away,
    }))
  );

  const scores = (doc.scores && typeof doc.scores === "object" ? doc.scores : doc) as LeagueRecord["scores"];
  const players = [...new Set(fixtures.flatMap((f) => [f.home, f.away]))].sort();

  return {
    ...emptyLeague(ROOT_LEAGUE_SLUG, ROOT_LEAGUE_NAME, null),
    players,
    fixtures,
    scores: scores ?? {},
    deductions: Array.isArray(doc.deductions) ? (doc.deductions as Deduction[]) : [],
    window: (doc.window as LeagueWindow | null | undefined) ?? null,
    season: typeof doc.season === "number" ? doc.season : 1,
    seasons: Array.isArray(doc.seasons) ? (doc.seasons as LeagueRecord["seasons"]) : [],
  };
}

function parseLeague(raw: string): LeagueRecord | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const doc = parsed as Partial<LeagueRecord>;
    if (!doc.slug) return null;
    return {
      slug: doc.slug,
      name: doc.name ?? doc.slug,
      createdAt: doc.createdAt ?? new Date().toISOString(),
      auth: doc.auth ?? null,
      players: Array.isArray(doc.players) ? doc.players : [],
      fixtures: Array.isArray(doc.fixtures) ? doc.fixtures : [],
      scores: doc.scores ?? {},
      deductions: Array.isArray(doc.deductions) ? doc.deductions : [],
      window: doc.window ?? null,
      season: typeof doc.season === "number" ? doc.season : 1,
      seasons: Array.isArray(doc.seasons) ? doc.seasons : [],
      relegationCount: typeof doc.relegationCount === "number" ? doc.relegationCount : 0,
    };
  } catch {
    return null;
  }
}

/** Runs at most once: pulls the old single-league document into the new shape. */
async function migrateLegacyIfNeeded(): Promise<void> {
  const slugs = await readIndex();
  if (slugs.length > 0) return;

  const legacyRaw = await readRaw(LEGACY_KEY, LEGACY_FILE);
  if (legacyRaw) {
    try {
      const doc = JSON.parse(legacyRaw) as Record<string, unknown>;
      const league = legacyToLeague(doc);
      await writeRaw(leagueKey(league.slug), leagueFile(league.slug), JSON.stringify(league));
      await writeIndex([league.slug]);
      return;
    } catch {
      // fall through to a fresh root league
    }
  }

  // No prior data: still seed the root league so the site works out of the box.
  const league = legacyToLeague({});
  await writeRaw(leagueKey(league.slug), leagueFile(league.slug), JSON.stringify(league));
  await writeIndex([league.slug]);
}

/* ------------------------------------------------------------ public api */

export async function listLeagues(): Promise<LeagueSummary[]> {
  await migrateLegacyIfNeeded();
  const slugs = await readIndex();
  const out: LeagueSummary[] = [];
  for (const slug of slugs) {
    const league = await getLeague(slug);
    if (league) out.push(summarise(league));
  }
  return out.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getLeague(slug: string): Promise<LeagueRecord | null> {
  const raw = await readRaw(leagueKey(slug), leagueFile(slug));
  return raw ? parseLeague(raw) : null;
}

/** Read a league, running the one-time migration first when needed. */
export async function loadLeague(slug: string): Promise<LeagueRecord | null> {
  await migrateLegacyIfNeeded();
  return getLeague(slug);
}

export async function saveLeague(league: LeagueRecord): Promise<LeagueRecord> {
  await writeRaw(leagueKey(league.slug), leagueFile(league.slug), JSON.stringify(league));
  const slugs = await readIndex();
  if (!slugs.includes(league.slug)) await writeIndex([...slugs, league.slug]);
  return league;
}

export async function createLeague(league: LeagueRecord): Promise<LeagueRecord> {
  await migrateLegacyIfNeeded();
  return saveLeague(league);
}

/** Apply a change to a league and persist it. */
export async function updateLeague(
  slug: string,
  mutate: (league: LeagueRecord) => void | Promise<void>
): Promise<LeagueRecord | null> {
  const league = await loadLeague(slug);
  if (!league) return null;
  await mutate(league);
  return saveLeague(league);
}

export async function writeScore(
  slug: string,
  matchId: string,
  score: Score | null
): Promise<LeagueRecord | null> {
  return updateLeague(slug, (league) => {
    if (score === null) delete league.scores[matchId];
    else league.scores[matchId] = { ...score, at: new Date().toISOString() };
  });
}

export async function addDeduction(
  slug: string,
  deduction: Omit<Deduction, "id" | "at">
): Promise<LeagueRecord | null> {
  return updateLeague(slug, (league) => {
    league.deductions = [
      ...league.deductions,
      {
        ...deduction,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        at: new Date().toISOString(),
      },
    ];
  });
}

export async function removeDeduction(slug: string, id: string): Promise<LeagueRecord | null> {
  return updateLeague(slug, (league) => {
    league.deductions = league.deductions.filter((d) => d.id !== id);
  });
}

export async function setWindow(
  slug: string,
  window: LeagueWindow | null
): Promise<LeagueRecord | null> {
  return updateLeague(slug, (league) => {
    league.window = window;
  });
}

export async function replaceLeagueData(
  slug: string,
  next: Partial<LeagueRecord>
): Promise<LeagueRecord | null> {
  return updateLeague(slug, (league) => {
    league.scores = next.scores ?? {};
    league.deductions = Array.isArray(next.deductions) ? next.deductions : [];
    league.window = next.window ?? null;
    league.season = typeof next.season === "number" ? next.season : 1;
    league.seasons = Array.isArray(next.seasons) ? next.seasons : [];
    if (Array.isArray(next.players) && next.players.length) league.players = next.players;
    if (Array.isArray(next.fixtures) && next.fixtures.length) league.fixtures = next.fixtures;
    if (typeof next.relegationCount === "number") league.relegationCount = next.relegationCount;
  });
}

export class SeasonIncompleteError extends Error {
  constructor() {
    super("SEASON_INCOMPLETE");
  }
}

/**
 * Archive the finished season, apply relegation, and generate the next
 * season's fixtures from the new roster.
 */
export async function rolloverSeason(
  slug: string,
  options: { name?: string; relegated?: string[]; replacements?: string[] }
): Promise<LeagueRecord | null> {
  return updateLeague(slug, (league) => {
    const view = viewOf(league);
    if (!isSeasonComplete(view, league.scores)) throw new SeasonIncompleteError();

    const archived = archiveCurrentSeason(
      view,
      { scores: league.scores, deductions: league.deductions },
      league.season,
      options.name
    );

    const leaving = new Set(options.relegated ?? []);
    const remaining = league.players.filter((p) => !leaving.has(p));
    const players = [...remaining, ...(options.replacements ?? [])];

    league.seasons = [...league.seasons, archived];
    league.season += 1;
    league.scores = {};
    league.deductions = [];
    league.window = null;
    league.players = players;
    league.fixtures = generateFixtures(players);
  });
}
