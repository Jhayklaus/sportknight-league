export interface Match {
  id: string;
  matchday: number;
  home: string;
  away: string;
}

export interface Matchday {
  matchday: number;
  resting: string | null;
  matches: Match[];
}

export interface Score {
  home: number;
  away: number;
  /**
   * Rule 5: "If neither of you tried to arrange the game, it is 0–0 and nobody
   * gets a point." A no-show fixture is void — it counts for neither player's
   * played count, goals, points, nor clean sheets.
   */
  noShow?: boolean;
  /** When the result was recorded. Absent for results logged before this was tracked. */
  at?: string;
}

export type Scores = Record<string, Score>;

export interface Deduction {
  id: string;
  player: string;
  points: number;
  reason: string;
  at: string;
}

/** Rule 5: players get 48 hours to play a block of matchdays. */
export interface LeagueWindow {
  firstMatchday: number;
  startedAt: string;
  /** How many matchdays this window covers. Falls back to the default. */
  matchdays?: number;
}

/**
 * A finished result with player names baked in. Archived seasons store these
 * rather than match ids, so past seasons stay correct even when the roster or
 * fixture list changes for a later season.
 */
export interface ResolvedMatch {
  matchday: number;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  noShow: boolean;
  at?: string;
}

export interface ArchivedSeason {
  id: string;
  number: number;
  name: string;
  players: string[];
  results: ResolvedMatch[];
  deductions: Deduction[];
  endedAt: string;
}

/** The live, editable part of a league. */
export interface LeagueState {
  scores: Scores;
  deductions: Deduction[];
  window?: LeagueWindow | null;
  /** Current season number; seasons before it live in `seasons`. */
  season?: number;
  seasons?: ArchivedSeason[];
}

/** Used when a window does not carry its own size (older stored windows). */
export const DEFAULT_WINDOW_MATCHDAYS = 6;
export const WINDOW_HOURS = 48;

export type FormResult = "W" | "D" | "L" | "N";

export interface FormEntry {
  result: FormResult;
  matchday: number;
  opponent: string;
  scoreFor: number;
  scoreAgainst: number;
  home: boolean;
}

export interface TableRow {
  player: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  cleanSheets: number;
  deducted: number;
  points: number;
  form: FormEntry[];
}

export interface ScorerRow {
  player: string;
  played: number;
  goals: number;
}

export interface CleanSheetRow {
  player: string;
  played: number;
  cleanSheets: number;
  goalsAgainst: number;
}

/** Number of recent matches shown in the table's form column. */
export const FORM_LENGTH = 3;

/**
 * Everything the UI and stats need about one league's schedule. Built from a
 * league's stored fixtures rather than a file, so each league has its own.
 */
export interface LeagueView {
  players: string[];
  matchdays: Matchday[];
  allMatches: Match[];
  matchById: Map<string, Match>;
}

export function buildView(players: string[], fixtures: Match[]): LeagueView {
  const byMatchday = new Map<number, Match[]>();
  for (const f of fixtures) {
    const list = byMatchday.get(f.matchday) ?? [];
    list.push(f);
    byMatchday.set(f.matchday, list);
  }
  const matchdays: Matchday[] = [...byMatchday.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([matchday, matches]) => {
      const busy = new Set(matches.flatMap((m) => [m.home, m.away]));
      const resting = players.find((p) => !busy.has(p)) ?? null;
      return { matchday, resting, matches };
    });

  const allMatches = matchdays.flatMap((md) => md.matches);
  return {
    players: [...players].sort((a, b) => a.localeCompare(b)),
    matchdays,
    allMatches,
    matchById: new Map(allMatches.map((m) => [m.id, m])),
  };
}

export const EMPTY_VIEW: LeagueView = {
  players: [],
  matchdays: [],
  allMatches: [],
  matchById: new Map(),
};

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
}

/** A no-show is recorded but void: it contributes nothing to any statistic. */
function countsForStats(score: Score | undefined): score is Score {
  return Boolean(score && !score.noShow);
}

/** Resolve the current season's stored scores into name-bearing results. */
export function resolveMatches(view: LeagueView, scores: Scores): ResolvedMatch[] {
  const out: ResolvedMatch[] = [];
  for (const match of view.allMatches) {
    const score = scores[match.id];
    if (!score) continue;
    out.push({
      matchday: match.matchday,
      home: match.home,
      away: match.away,
      homeGoals: score.home,
      awayGoals: score.away,
      noShow: Boolean(score.noShow),
      at: score.at,
    });
  }
  return out;
}

/** Players named anywhere in a set of resolved results. */
export function playersFromResults(results: ResolvedMatch[]): string[] {
  return [...new Set(results.flatMap((r) => [r.home, r.away]))].sort();
}

export function tableFrom(
  players: string[],
  results: ResolvedMatch[],
  deductions: Deduction[] = []
): TableRow[] {
  const rows = new Map<string, TableRow>(
    players.map((p) => [
      p,
      {
        player: p,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        cleanSheets: 0,
        deducted: 0,
        points: 0,
        form: [],
      },
    ])
  );

  // Results arrive in matchday order, so form accumulates chronologically.
  for (const match of results) {
    if (match.noShow) continue;

    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += match.homeGoals;
    home.goalsAgainst += match.awayGoals;
    away.goalsFor += match.awayGoals;
    away.goalsAgainst += match.homeGoals;
    if (match.awayGoals === 0) home.cleanSheets++;
    if (match.homeGoals === 0) away.cleanSheets++;

    let homeResult: FormResult;
    if (match.homeGoals > match.awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
      homeResult = "W";
    } else if (match.homeGoals < match.awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
      homeResult = "L";
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
      homeResult = "D";
    }

    home.form.push({
      result: homeResult,
      matchday: match.matchday,
      opponent: match.away,
      scoreFor: match.homeGoals,
      scoreAgainst: match.awayGoals,
      home: true,
    });
    away.form.push({
      result: homeResult === "W" ? "L" : homeResult === "L" ? "W" : "D",
      matchday: match.matchday,
      opponent: match.home,
      scoreFor: match.awayGoals,
      scoreAgainst: match.homeGoals,
      home: false,
    });
  }

  for (const deduction of deductions) {
    const row = rows.get(deduction.player);
    if (!row) continue;
    row.deducted += deduction.points;
    row.points -= deduction.points;
  }

  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
    row.form = row.form.slice(-FORM_LENGTH);
  }

  // Rule 1 tiebreakers: goal difference, then goals scored, then wins.
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDiff - a.goalDiff ||
      b.goalsFor - a.goalsFor ||
      b.won - a.won ||
      a.player.localeCompare(b.player)
  );
}

export function computeTable(
  view: LeagueView,
  scores: Scores,
  deductions: Deduction[] = []
): TableRow[] {
  return tableFrom(view.players, resolveMatches(view, scores), deductions);
}

export function scorersFrom(players: string[], results: ResolvedMatch[]): ScorerRow[] {
  const rows = new Map<string, ScorerRow>(players.map((p) => [p, { player: p, played: 0, goals: 0 }]));

  for (const match of results) {
    if (match.noShow) continue;
    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goals += match.homeGoals;
    away.goals += match.awayGoals;
  }

  return [...rows.values()].sort(
    (a, b) => b.goals - a.goals || a.played - b.played || a.player.localeCompare(b.player)
  );
}

export function computeTopScorers(view: LeagueView, scores: Scores): ScorerRow[] {
  return scorersFrom(view.players, resolveMatches(view, scores));
}

export interface PlayerMatch {
  matchId: string;
  matchday: number;
  opponent: string;
  home: boolean;
  goalsFor: number;
  goalsAgainst: number;
  result: FormResult;
  noShow: boolean;
}

export interface SplitStats {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  points: number;
}

export interface PlayerProfile {
  player: string;
  position: number;
  row: TableRow;
  matches: PlayerMatch[];
  played: PlayerMatch[];
  upcoming: PlayerMatch[];
  home: SplitStats;
  away: SplitStats;
  biggestWin: PlayerMatch | null;
  biggestLoss: PlayerMatch | null;
  longestWinStreak: number;
  currentStreak: { result: FormResult; count: number } | null;
  deductions: Deduction[];
}

export interface HeadToHead {
  a: string;
  b: string;
  matches: PlayerMatch[];
  played: number;
  aWins: number;
  bWins: number;
  draws: number;
  aGoals: number;
  bGoals: number;
}

function emptySplit(): SplitStats {
  return {
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    cleanSheets: 0,
    points: 0,
  };
}

function addToSplit(split: SplitStats, m: PlayerMatch): void {
  split.played++;
  split.goalsFor += m.goalsFor;
  split.goalsAgainst += m.goalsAgainst;
  if (m.goalsAgainst === 0) split.cleanSheets++;
  if (m.result === "W") {
    split.won++;
    split.points += 3;
  } else if (m.result === "D") {
    split.drawn++;
    split.points += 1;
  } else {
    split.lost++;
  }
}

/** Every fixture involving a player, in matchday order, played or not. */
export function playerMatches(view: LeagueView, player: string, scores: Scores): PlayerMatch[] {
  const out: PlayerMatch[] = [];
  for (const match of view.allMatches) {
    if (match.home !== player && match.away !== player) continue;
    const isHome = match.home === player;
    const score = scores[match.id];
    const goalsFor = score ? (isHome ? score.home : score.away) : 0;
    const goalsAgainst = score ? (isHome ? score.away : score.home) : 0;
    out.push({
      matchId: match.id,
      matchday: match.matchday,
      opponent: isHome ? match.away : match.home,
      home: isHome,
      goalsFor,
      goalsAgainst,
      result:
        !score || score.noShow
          ? "N"
          : goalsFor > goalsAgainst
            ? "W"
            : goalsFor < goalsAgainst
              ? "L"
              : "D",
      noShow: Boolean(score?.noShow),
    });
  }
  return out;
}

export function computePlayerProfile(
  view: LeagueView,
  player: string,
  scores: Scores,
  deductions: Deduction[] = []
): PlayerProfile {
  const table = computeTable(view, scores, deductions);
  const position = table.findIndex((r) => r.player === player) + 1;
  const row = table.find((r) => r.player === player)!;

  const matches = playerMatches(view, player, scores);
  const played = matches.filter((m) => scores[m.matchId] && !m.noShow);
  const upcoming = matches.filter((m) => !scores[m.matchId]);

  const home = emptySplit();
  const away = emptySplit();
  let biggestWin: PlayerMatch | null = null;
  let biggestLoss: PlayerMatch | null = null;
  let longestWinStreak = 0;
  let running = 0;

  for (const m of played) {
    addToSplit(m.home ? home : away, m);

    const margin = m.goalsFor - m.goalsAgainst;
    if (m.result === "W") {
      running++;
      longestWinStreak = Math.max(longestWinStreak, running);
      if (!biggestWin || margin > biggestWin.goalsFor - biggestWin.goalsAgainst) biggestWin = m;
    } else {
      running = 0;
      if (m.result === "L" && (!biggestLoss || margin < biggestLoss.goalsFor - biggestLoss.goalsAgainst)) {
        biggestLoss = m;
      }
    }
  }

  let currentStreak: PlayerProfile["currentStreak"] = null;
  for (let i = played.length - 1; i >= 0; i--) {
    const result = played[i].result;
    if (!currentStreak) currentStreak = { result, count: 1 };
    else if (currentStreak.result === result) currentStreak.count++;
    else break;
  }

  return {
    player,
    position,
    row,
    matches,
    played,
    upcoming,
    home,
    away,
    biggestWin,
    biggestLoss,
    longestWinStreak,
    currentStreak,
    deductions: deductions.filter((d) => d.player === player),
  };
}

export function computeHeadToHead(
  view: LeagueView,
  a: string,
  b: string,
  scores: Scores
): HeadToHead {
  const matches = playerMatches(view, a, scores).filter((m) => m.opponent === b);
  const h2h: HeadToHead = {
    a,
    b,
    matches,
    played: 0,
    aWins: 0,
    bWins: 0,
    draws: 0,
    aGoals: 0,
    bGoals: 0,
  };

  for (const m of matches) {
    if (!scores[m.matchId] || m.noShow) continue;
    h2h.played++;
    h2h.aGoals += m.goalsFor;
    h2h.bGoals += m.goalsAgainst;
    if (m.result === "W") h2h.aWins++;
    else if (m.result === "L") h2h.bWins++;
    else h2h.draws++;
  }

  return h2h;
}

export function cleanSheetsFrom(players: string[], results: ResolvedMatch[]): CleanSheetRow[] {
  const rows = new Map<string, CleanSheetRow>(
    players.map((p) => [p, { player: p, played: 0, cleanSheets: 0, goalsAgainst: 0 }])
  );

  for (const match of results) {
    if (match.noShow) continue;
    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsAgainst += match.awayGoals;
    away.goalsAgainst += match.homeGoals;
    if (match.awayGoals === 0) home.cleanSheets++;
    if (match.homeGoals === 0) away.cleanSheets++;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.cleanSheets - a.cleanSheets ||
      a.goalsAgainst - b.goalsAgainst ||
      a.played - b.played ||
      a.player.localeCompare(b.player)
  );
}

export function computeCleanSheets(view: LeagueView, scores: Scores): CleanSheetRow[] {
  return cleanSheetsFrom(view.players, resolveMatches(view, scores));
}

/** Every fixture has a recorded outcome — the precondition for a new season. */
export function isSeasonComplete(view: LeagueView, scores: Scores): boolean {
  return view.allMatches.length > 0 && view.allMatches.every((m) => Boolean(scores[m.id]));
}

/** Snapshot the live season so it can be stored in `seasons`. */
export function archiveCurrentSeason(
  view: LeagueView,
  state: { scores: Scores; deductions: Deduction[] },
  number: number,
  name?: string
): ArchivedSeason {
  const results = resolveMatches(view, state.scores);
  return {
    id: `season-${number}-${Date.now()}`,
    number,
    name: name?.trim() || `Season ${number}`,
    players: view.players,
    results,
    deductions: state.deductions,
    endedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 48-hour matchday window (rule 5)
// ---------------------------------------------------------------------------

export interface ChaseEntry {
  player: string;
  outstanding: number;
  opponents: { opponent: string; matchday: number; home: boolean }[];
}

export interface WindowStatus {
  window: LeagueWindow | null;
  matchdays: number[];
  deadline: string | null;
  msRemaining: number | null;
  overdue: boolean;
  pending: Match[];
  played: number;
  total: number;
  chase: ChaseEntry[];
}

/** The matchdays covered by a window, clamped to the season length. */
/** How many matchdays a window covers, clamped to something sensible. */
export function windowSize(
  view: LeagueView,
  window: LeagueWindow | null | undefined
): number {
  const total = view.matchdays.length || DEFAULT_WINDOW_MATCHDAYS;
  const raw = window?.matchdays ?? DEFAULT_WINDOW_MATCHDAYS;
  if (!Number.isInteger(raw) || raw < 1) return Math.min(DEFAULT_WINDOW_MATCHDAYS, total);
  return Math.min(raw, total);
}

export function windowMatchdays(
  view: LeagueView,
  window: LeagueWindow | null | undefined
): number[] {
  if (!window) return [];
  const out: number[] = [];
  const size = windowSize(view, window);
  const total = view.matchdays.length;
  for (let i = 0; i < size; i++) {
    const md = window.firstMatchday + i;
    if (md >= 1 && md <= total) out.push(md);
  }
  return out;
}

/** First matchday that still has unplayed fixtures — the natural next window. */
export function suggestedWindowStart(view: LeagueView, scores: Scores): number {
  for (const md of view.matchdays) {
    if (md.matches.some((m) => !scores[m.id])) return md.matchday;
  }
  return view.matchdays.length || 1;
}

export function computeWindowStatus(
  view: LeagueView,
  scores: Scores,
  window: LeagueWindow | null | undefined,
  now: number = Date.now()
): WindowStatus {
  const mds = windowMatchdays(view, window);
  const matches = view.allMatches.filter((m) => mds.includes(m.matchday));
  const pending = matches.filter((m) => !scores[m.id]);

  const deadlineMs = window ? new Date(window.startedAt).getTime() + WINDOW_HOURS * 3600_000 : null;
  const msRemaining = deadlineMs === null ? null : deadlineMs - now;

  const chaseMap = new Map<string, ChaseEntry>();
  for (const m of pending) {
    for (const [player, opponent, home] of [
      [m.home, m.away, true],
      [m.away, m.home, false],
    ] as const) {
      const entry = chaseMap.get(player) ?? { player, outstanding: 0, opponents: [] };
      entry.outstanding++;
      entry.opponents.push({ opponent, matchday: m.matchday, home });
      chaseMap.set(player, entry);
    }
  }

  return {
    window: window ?? null,
    matchdays: mds,
    deadline: deadlineMs === null ? null : new Date(deadlineMs).toISOString(),
    msRemaining,
    overdue: msRemaining !== null && msRemaining < 0 && pending.length > 0,
    pending,
    played: matches.length - pending.length,
    total: matches.length,
    chase: [...chaseMap.values()].sort(
      (a, b) => b.outstanding - a.outstanding || a.player.localeCompare(b.player)
    ),
  };
}

// ---------------------------------------------------------------------------
// What-if projections
// ---------------------------------------------------------------------------

export type Outcome = "H" | "D" | "A";
export type Hypotheticals = Record<string, Outcome>;

/**
 * Overlays hypothetical outcomes on the real results. Projected games use a
 * one-goal margin (1–0 / 0–0 / 0–1) so goal difference stays realistic.
 */
export function applyHypotheticals(scores: Scores, hypo: Hypotheticals): Scores {
  const merged: Scores = { ...scores };
  for (const [matchId, outcome] of Object.entries(hypo)) {
    if (merged[matchId]) continue; // never override a real result
    merged[matchId] =
      outcome === "H" ? { home: 1, away: 0 } : outcome === "A" ? { home: 0, away: 1 } : { home: 0, away: 0 };
  }
  return merged;
}

export interface ProjectedRow extends TableRow {
  currentPosition: number;
  movement: number;
}

export function computeProjection(
  view: LeagueView,
  scores: Scores,
  hypo: Hypotheticals,
  deductions: Deduction[] = []
): ProjectedRow[] {
  const current = computeTable(view, scores, deductions);
  const positions = new Map(current.map((r, i) => [r.player, i + 1]));
  const projected = computeTable(view, applyHypotheticals(scores, hypo), deductions);
  return projected.map((row, i) => {
    const currentPosition = positions.get(row.player) ?? i + 1;
    return { ...row, currentPosition, movement: currentPosition - (i + 1) };
  });
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export interface ActivityEntry {
  matchId: string;
  matchday: number;
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  noShow: boolean;
  at: string | null;
}

/**
 * Newest results first. Entries recorded before timestamps were tracked have no
 * `at` value and are listed after the timestamped ones, latest matchday first.
 */
export function computeActivity(view: LeagueView, scores: Scores): ActivityEntry[] {
  const entries: ActivityEntry[] = [];
  for (const match of view.allMatches) {
    const score = scores[match.id];
    if (!score) continue;
    entries.push({
      matchId: match.id,
      matchday: match.matchday,
      home: match.home,
      away: match.away,
      homeGoals: score.home,
      awayGoals: score.away,
      noShow: Boolean(score.noShow),
      at: score.at ?? null,
    });
  }

  return entries.sort((a, b) => {
    if (a.at && b.at) return b.at.localeCompare(a.at);
    if (a.at) return -1;
    if (b.at) return 1;
    return b.matchday - a.matchday || a.matchId.localeCompare(b.matchId);
  });
}

/** Full season as CSV, for the export/backup tab. */
export function toCsv(view: LeagueView, scores: Scores): string {
  const rows = [["matchday", "home", "away", "home_goals", "away_goals", "no_show", "recorded_at"]];
  for (const match of view.allMatches) {
    const score = scores[match.id];
    rows.push([
      String(match.matchday),
      match.home,
      match.away,
      score && !score.noShow ? String(score.home) : "",
      score && !score.noShow ? String(score.away) : "",
      score?.noShow ? "yes" : "",
      score?.at ?? "",
    ]);
  }
  return rows
    .map((r) => r.map((cell) => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(","))
    .join("\n");
}
