import type { DraftState } from "./draft";
import {
  buildView,
  cleanSheetsFrom,
  scorersFrom,
  tableFrom,
  type ArchivedSeason,
  type CleanSheetRow,
  type Deduction,
  type LeagueWindow,
  type Match,
  type ScorerRow,
  type Scores,
  type TableRow,
} from "./league";

/** Credentials for a league's admin code. Never store the code itself. */
export interface AdminAuth {
  salt: string;
  hash: string;
}

export interface LeagueRecord {
  slug: string;
  name: string;
  createdAt: string;
  /** Null means "fall back to the LEAGUE_PIN env var" (the original league). */
  auth: AdminAuth | null;
  players: string[];
  fixtures: Match[];
  scores: Scores;
  deductions: Deduction[];
  window: LeagueWindow | null;
  season: number;
  seasons: ArchivedSeason[];
  /** How many players drop out at the end of a season. */
  relegationCount: number;
  /** Optional team draft for a tournament. Absent when never used. */
  draft?: DraftState | null;
  /** 2 = home and away (default), 1 = play everyone once. */
  legs?: LegCount;
}

export interface LeagueSummary {
  slug: string;
  name: string;
  players: number;
  season: number;
  played: number;
  total: number;
  createdAt: string;
  legs: LegCount;
}

/** One leg = play everyone once. Two legs = home and away. */
export type LegCount = 1 | 2;
export const DEFAULT_LEGS: LegCount = 2;

export function normaliseLegs(value: unknown): LegCount {
  return value === 1 || value === "1" ? 1 : 2;
}

export const MAX_PLAYERS = 64;
export const MIN_PLAYERS = 4;

export function emptyLeague(slug: string, name: string, auth: AdminAuth | null): LeagueRecord {
  return {
    slug,
    name,
    createdAt: new Date().toISOString(),
    auth,
    players: [],
    fixtures: [],
    scores: {},
    deductions: [],
    window: null,
    season: 1,
    seasons: [],
    relegationCount: 0,
    draft: null,
    legs: DEFAULT_LEGS,
  };
}

export function viewOf(league: LeagueRecord) {
  return buildView(league.players, league.fixtures);
}

export function summarise(league: LeagueRecord): LeagueSummary {
  return {
    slug: league.slug,
    name: league.name,
    players: league.players.length,
    season: league.season,
    played: Object.keys(league.scores).length,
    total: league.fixtures.length,
    createdAt: league.createdAt,
    legs: league.legs ?? DEFAULT_LEGS,
  };
}

/* ------------------------------------------------------------------ slugs */

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function uniqueSlug(name: string, taken: string[]): string {
  const base = slugify(name) || "league";
  if (!taken.includes(base)) return base;
  for (let i = 2; i < 500; i++) {
    const candidate = `${base}-${i}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base}-${Date.now()}`;
}

/* ------------------------------------------------------------- the roster */

export function normalisePlayerName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > 40) return null;
  return trimmed;
}

/** Case-insensitive duplicate check, since "Ye" and "ye" are the same person. */
export function hasDuplicate(players: string[]): boolean {
  const seen = new Set<string>();
  for (const p of players) {
    const key = p.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

/* -------------------------------------------------------- fixture builder */

/**
 * Round-robin via the circle method — once through for a one-legged league, or
 * twice with venues swapped for home and away. Venue orientation is then
 * optimised so nobody sits through a long run of home or away games, which the
 * naive circle method produces. An odd roster gets a bye, so one player rests
 * each matchday.
 */
export function generateFixtures(players: string[], legs: LegCount = DEFAULT_LEGS): Match[] {
  const roster = [...players];
  if (roster.length < MIN_PLAYERS) return [];

  const BYE = " __bye__";
  const odd = roster.length % 2 === 1;
  if (odd) roster.push(BYE);

  const n = roster.length;
  const rounds = n - 1;
  const rotating = roster.map((_, i) => i).slice(1);

  const halfPairs: [number, number][][] = [];
  for (let r = 0; r < rounds; r++) {
    const arr = rotating.map((_, i) => rotating[(i + r) % rotating.length]);
    const pairs: [number, number][] = [[0, arr[0]]];
    for (let k = 1; k <= (n - 2) / 2; k++) {
      pairs.push([arr[k], arr[rotating.length - k]]);
    }
    halfPairs.push(pairs);
  }

  const flags = halfPairs.map((pairs, r) => pairs.map((_, i) => (r + i) % 2 === 0));

  const venueCost = (): number => {
    const seq: string[][] = Array.from({ length: n }, () => new Array(rounds * legs));
    for (let r = 0; r < rounds; r++) {
      halfPairs[r].forEach(([a, b], i) => {
        // A pair against the bye is not a game, so it must not land in the
        // sequence — otherwise that player looks like they played an extra one.
        if (roster[a] === BYE || roster[b] === BYE) return;
        const aHome = flags[r][i];
        seq[a][r] = aHome ? "H" : "A";
        seq[b][r] = aHome ? "A" : "H";
        if (legs === 2) {
          seq[a][r + rounds] = aHome ? "A" : "H";
          seq[b][r + rounds] = aHome ? "H" : "A";
        }
      });
    }
    let total = 0;
    for (let p = 0; p < n; p++) {
      if (roster[p] === BYE) continue;

      let run = 1;
      let home = 0;
      let games = 0;
      for (let i = 0; i < seq[p].length; i++) {
        const venue = seq[p][i];
        // An odd roster leaves gaps where that player had the bye.
        if (!venue) continue;
        games++;
        if (venue === "H") home++;
        if (i > 0 && venue === seq[p][i - 1]) {
          run++;
          total += run > 2 ? 6 : 1;
        } else {
          run = 1;
        }
      }

      // Mirroring balances a two-legged season by itself, but a single round
      // robin has to be steered: an odd number of games allows a gap of one.
      const allowedGap = games % 2;
      const gap = Math.abs(home - (games - home));
      if (gap > allowedGap) total += (gap - allowedGap) * 40;
    }
    return total;
  };

  // Hill-climbing from one start can stall in a lopsided arrangement, so try a
  // few starts and keep the best. Seeded from the roster, so the same players
  // always get the same schedule.
  let seed = roster.reduce((acc, name) => (acc * 31 + name.length + name.charCodeAt(0)) >>> 0, 7);
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const climb = (): number => {
    let cost = venueCost();
    for (let pass = 0; pass < 200; pass++) {
      let improved = false;
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < flags[r].length; i++) {
          flags[r][i] = !flags[r][i];
          const next = venueCost();
          if (next < cost) {
            cost = next;
            improved = true;
          } else {
            flags[r][i] = !flags[r][i];
          }
        }
      }
      if (!improved) break;
    }
    return cost;
  };

  const venueSpread = (): { imbalance: number; excess: number[] } => {
    const home = new Array<number>(n).fill(0);
    const away = new Array<number>(n).fill(0);
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < halfPairs[r].length; i++) {
        const [a, b] = halfPairs[r][i];
        if (roster[a] === BYE || roster[b] === BYE) continue;
        if (flags[r][i]) {
          home[a]++;
          away[b]++;
        } else {
          home[b]++;
          away[a]++;
        }
      }
    }
    const excess = home.map((h, i) => h - away[i]);
    let imbalance = 0;
    for (let i = 0; i < n; i++) {
      if (roster[i] === BYE) continue;
      const games = home[i] + away[i];
      imbalance += Math.max(0, Math.abs(excess[i]) - (games % 2));
    }
    return { imbalance, excess };
  };

  /**
   * Hill-climbing alone leaves some players lopsided in a one-legged season,
   * and a strictly-improving swap often does not exist — handing a home game
   * from one over-loaded player to an equal one just moves the problem. So this
   * walks those equal-cost swaps at random, remembering the best spread it saw.
   */
  const repairBalance = () => {
    if (legs !== 1) return; // two legs balance themselves by mirroring

    let { imbalance } = venueSpread();
    if (imbalance === 0) return;
    let bestFlags = flags.map((row) => [...row]);
    let bestImbalance = imbalance;

    for (let iteration = 0; iteration < 4000 && bestImbalance > 0; iteration++) {
      const { excess } = venueSpread();
      const moves: [number, number][] = [];
      for (let r = 0; r < rounds; r++) {
        for (let i = 0; i < halfPairs[r].length; i++) {
          const [a, b] = halfPairs[r][i];
          if (roster[a] === BYE || roster[b] === BYE) continue;
          const homeSide = flags[r][i] ? a : b;
          const awaySide = flags[r][i] ? b : a;
          if (excess[homeSide] > excess[awaySide]) moves.push([r, i]);
        }
      }
      if (moves.length === 0) break;

      const [r, i] = moves[Math.floor(rand() * moves.length)];
      flags[r][i] = !flags[r][i];

      imbalance = venueSpread().imbalance;
      if (imbalance < bestImbalance) {
        bestImbalance = imbalance;
        bestFlags = flags.map((row) => [...row]);
      }
    }

    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < flags[r].length; i++) flags[r][i] = bestFlags[r][i];
    }
  };

  let best = flags.map((row) => [...row]);
  let bestCost = climb();
  best = flags.map((row) => [...row]);

  for (let restart = 0; restart < 12 && bestCost > 0; restart++) {
    for (let r = 0; r < rounds; r++) {
      for (let i = 0; i < flags[r].length; i++) flags[r][i] = rand() < 0.5;
    }
    const cost = climb();
    if (cost < bestCost) {
      bestCost = cost;
      best = flags.map((row) => [...row]);
    }
  }

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < flags[r].length; i++) flags[r][i] = best[r][i];
  }

  // Even out home and away, then tidy the venue runs that repair may have left.
  repairBalance();
  climb();

  const fixtures: Match[] = [];
  const pushRound = (matchday: number, round: number, mirrored: boolean) => {
    let index = 0;
    halfPairs[round].forEach(([a, b], i) => {
      if (roster[a] === BYE || roster[b] === BYE) return;
      // The return leg is the first leg with venues swapped.
      const aHome = mirrored ? !flags[round][i] : flags[round][i];
      index++;
      fixtures.push({
        id: `${matchday}-${index}`,
        matchday,
        home: aHome ? roster[a] : roster[b],
        away: aHome ? roster[b] : roster[a],
      });
    });
  };

  for (let r = 0; r < rounds; r++) pushRound(r + 1, r, false);
  if (legs === 2) {
    for (let r = 0; r < rounds; r++) pushRound(rounds + r + 1, r, true);
  }

  return fixtures;
}

/** Sanity check used by tests and before storing a generated schedule. */
export function validateFixtures(
  players: string[],
  fixtures: Match[],
  legs: LegCount = DEFAULT_LEGS
): string[] {
  const errors: string[] = [];
  const n = players.length;
  if (n < MIN_PLAYERS) return ["Not enough players"];

  const expectedPerPlayer = legs * (n - 1);
  const counts = new Map(players.map((p) => [p, { games: 0, home: 0, away: 0 }]));
  const ordered = new Map<string, number>();
  const perMatchday = new Map<number, Set<string>>();

  for (const f of fixtures) {
    const home = counts.get(f.home);
    const away = counts.get(f.away);
    if (!home || !away) {
      errors.push(`Fixture ${f.id} names an unknown player`);
      continue;
    }
    home.games++;
    home.home++;
    away.games++;
    away.away++;

    const key = `${f.home}|${f.away}`;
    ordered.set(key, (ordered.get(key) ?? 0) + 1);

    const seen = perMatchday.get(f.matchday) ?? new Set<string>();
    if (seen.has(f.home)) errors.push(`${f.home} plays twice on matchday ${f.matchday}`);
    if (seen.has(f.away)) errors.push(`${f.away} plays twice on matchday ${f.matchday}`);
    seen.add(f.home);
    seen.add(f.away);
    perMatchday.set(f.matchday, seen);
  }

  for (const [player, c] of counts) {
    if (c.games !== expectedPerPlayer) {
      errors.push(`${player} has ${c.games} games (expected ${expectedPerPlayer})`);
    }
    if (Math.abs(c.home - c.away) > 1) {
      errors.push(`${player} has ${c.home} home / ${c.away} away games`);
    }
  }

  for (const [key, count] of ordered) {
    if (count !== 1) errors.push(`${key.replace("|", " vs ")} appears ${count} times`);
    const [h, a] = key.split("|");
    const reverse = ordered.has(`${a}|${h}`);
    if (legs === 2 && !reverse) {
      errors.push(`Missing reverse fixture for ${h} vs ${a}`);
    }
    if (legs === 1 && reverse) {
      errors.push(`${h} and ${a} meet twice in a one-legged league`);
    }
  }

  return errors;
}

/* ------------------------------------------------------------ hall of fame */

export interface SeasonHonours {
  id: string;
  number: number;
  name: string;
  endedAt: string;
  topTable: TableRow[];
  topScorers: ScorerRow[];
  topCleanSheets: CleanSheetRow[];
}

export interface AllTimeRow {
  player: string;
  titles: number;
  podiums: number;
  seasons: number;
  goals: number;
  cleanSheets: number;
  points: number;
}

export interface HallOfFame {
  seasons: SeasonHonours[];
  allTime: AllTimeRow[];
}

export const HONOURS_TOP_N = 5;

export function computeHallOfFame(seasons: ArchivedSeason[]): HallOfFame {
  const honours: SeasonHonours[] = seasons
    .map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      endedAt: s.endedAt,
      topTable: tableFrom(s.players, s.results, s.deductions).slice(0, HONOURS_TOP_N),
      topScorers: scorersFrom(s.players, s.results).slice(0, HONOURS_TOP_N),
      topCleanSheets: cleanSheetsFrom(s.players, s.results).slice(0, HONOURS_TOP_N),
    }))
    .sort((a, b) => b.number - a.number);

  const all = new Map<string, AllTimeRow>();
  const row = (player: string): AllTimeRow => {
    const existing = all.get(player);
    if (existing) return existing;
    const created: AllTimeRow = {
      player,
      titles: 0,
      podiums: 0,
      seasons: 0,
      goals: 0,
      cleanSheets: 0,
      points: 0,
    };
    all.set(player, created);
    return created;
  };

  for (const season of seasons) {
    const table = tableFrom(season.players, season.results, season.deductions);
    table.forEach((r, i) => {
      const entry = row(r.player);
      entry.seasons++;
      entry.points += r.points;
      entry.goals += r.goalsFor;
      entry.cleanSheets += r.cleanSheets;
      if (i === 0) entry.titles++;
      if (i < 3) entry.podiums++;
    });
  }

  return {
    seasons: honours,
    allTime: [...all.values()].sort(
      (a, b) =>
        b.titles - a.titles ||
        b.podiums - a.podiums ||
        b.points - a.points ||
        b.goals - a.goals ||
        a.player.localeCompare(b.player)
    ),
  };
}

/* ------------------------------------------------------------- relegation */

export interface RelegationPlan {
  count: number;
  /** Bottom-placed players, worst last, as suggested drops. */
  candidates: string[];
  standings: TableRow[];
}

export function relegationPlan(league: LeagueRecord): RelegationPlan {
  const view = viewOf(league);
  const standings = tableFrom(
    view.players,
    // Use the live season's results.
    league.fixtures
      .map((f) => {
        const score = league.scores[f.id];
        if (!score) return null;
        return {
          matchday: f.matchday,
          home: f.home,
          away: f.away,
          homeGoals: score.home,
          awayGoals: score.away,
          noShow: Boolean(score.noShow),
          at: score.at,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null),
    league.deductions
  );

  const count = Math.max(0, Math.min(league.relegationCount, Math.max(0, standings.length - MIN_PLAYERS)));
  return {
    count,
    candidates: count === 0 ? [] : standings.slice(-count).map((r) => r.player),
    standings,
  };
}

/** What the browser receives: everything except the stored admin credentials. */
export type PublicLeague = Omit<LeagueRecord, "auth"> & { hasCustomCode?: boolean };

/* ----------------------------------------------------- all-time head to head */

export interface H2HMeeting {
  seasonLabel: string;
  seasonNumber: number;
  live: boolean;
  matchday: number;
  /** Always oriented as stored: home player first. */
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  noShow: boolean;
  played: boolean;
}

export interface H2HSeasonSplit {
  seasonLabel: string;
  seasonNumber: number;
  live: boolean;
  aWins: number;
  bWins: number;
  draws: number;
  played: number;
}

export interface HeadToHeadAllTime {
  a: string;
  b: string;
  meetings: H2HMeeting[];
  played: number;
  scheduled: number;
  aWins: number;
  bWins: number;
  draws: number;
  aGoals: number;
  bGoals: number;
  bySeason: H2HSeasonSplit[];
}

/**
 * Every meeting between two players across the live season and every archived
 * one. Archived results carry their own player names, so historic meetings stay
 * correct even after roster changes.
 */
export function computeHeadToHeadAllTime(
  league: Pick<LeagueRecord, "players" | "fixtures" | "scores" | "season" | "seasons">,
  a: string,
  b: string
): HeadToHeadAllTime {
  const out: HeadToHeadAllTime = {
    a,
    b,
    meetings: [],
    played: 0,
    scheduled: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aGoals: 0,
    bGoals: 0,
    bySeason: [],
  };

  const involves = (home: string, away: string) =>
    (home === a && away === b) || (home === b && away === a);

  const tally = (meeting: H2HMeeting, split: H2HSeasonSplit) => {
    out.meetings.push(meeting);
    if (!meeting.played || meeting.noShow) return;

    const aGoals = meeting.home === a ? meeting.homeGoals : meeting.awayGoals;
    const bGoals = meeting.home === a ? meeting.awayGoals : meeting.homeGoals;
    out.played++;
    out.aGoals += aGoals;
    out.bGoals += bGoals;
    split.played++;
    if (aGoals > bGoals) {
      out.aWins++;
      split.aWins++;
    } else if (aGoals < bGoals) {
      out.bWins++;
      split.bWins++;
    } else {
      out.draws++;
      split.draws++;
    }
  };

  // Archived seasons, oldest first.
  for (const season of [...league.seasons].sort((x, y) => x.number - y.number)) {
    const split: H2HSeasonSplit = {
      seasonLabel: season.name,
      seasonNumber: season.number,
      live: false,
      aWins: 0,
      bWins: 0,
      draws: 0,
      played: 0,
    };
    for (const r of season.results) {
      if (!involves(r.home, r.away)) continue;
      tally(
        {
          seasonLabel: season.name,
          seasonNumber: season.number,
          live: false,
          matchday: r.matchday,
          home: r.home,
          away: r.away,
          homeGoals: r.homeGoals,
          awayGoals: r.awayGoals,
          noShow: r.noShow,
          played: true,
        },
        split
      );
    }
    if (split.played > 0) out.bySeason.push(split);
  }

  // The live season, including fixtures that have not been played yet.
  const liveSplit: H2HSeasonSplit = {
    seasonLabel: `Season ${league.season}`,
    seasonNumber: league.season,
    live: true,
    aWins: 0,
    bWins: 0,
    draws: 0,
    played: 0,
  };
  let liveScheduled = 0;
  for (const f of league.fixtures) {
    if (!involves(f.home, f.away)) continue;
    liveScheduled++;
    const score = league.scores[f.id];
    tally(
      {
        seasonLabel: liveSplit.seasonLabel,
        seasonNumber: league.season,
        live: true,
        matchday: f.matchday,
        home: f.home,
        away: f.away,
        homeGoals: score?.home ?? 0,
        awayGoals: score?.away ?? 0,
        noShow: Boolean(score?.noShow),
        played: Boolean(score),
      },
      liveSplit
    );
  }
  if (liveScheduled > 0) out.bySeason.push(liveSplit);
  out.scheduled = out.meetings.length;

  return out;
}
