import fixturesData from "./fixtures.json";

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
}

export type Scores = Record<string, Score>;

export interface Deduction {
  id: string;
  player: string;
  points: number;
  reason: string;
  at: string;
}

export interface LeagueState {
  scores: Scores;
  deductions: Deduction[];
}

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

export const MATCHDAYS: Matchday[] = (
  fixturesData as {
    matchday: number;
    resting: string | null;
    matches: { home: string; away: string }[];
  }[]
).map((md) => ({
  matchday: md.matchday,
  resting: md.resting,
  matches: md.matches.map((m, i) => ({
    id: `${md.matchday}-${i + 1}`,
    matchday: md.matchday,
    home: m.home,
    away: m.away,
  })),
}));

export const ALL_MATCHES: Match[] = MATCHDAYS.flatMap((md) => md.matches);

export const MATCH_BY_ID: Map<string, Match> = new Map(ALL_MATCHES.map((m) => [m.id, m]));

export const PLAYERS: string[] = [...new Set(ALL_MATCHES.flatMap((m) => [m.home, m.away]))].sort();

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 99;
}

/** A no-show is recorded but void: it contributes nothing to any statistic. */
function countsForStats(score: Score | undefined): score is Score {
  return Boolean(score && !score.noShow);
}

export function computeTable(scores: Scores, deductions: Deduction[] = []): TableRow[] {
  const rows = new Map<string, TableRow>(
    PLAYERS.map((p) => [
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

  // ALL_MATCHES is in matchday order, so form accumulates chronologically.
  for (const match of ALL_MATCHES) {
    const score = scores[match.id];
    if (!countsForStats(score)) continue;

    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) continue;

    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;
    if (score.away === 0) home.cleanSheets++;
    if (score.home === 0) away.cleanSheets++;

    let homeResult: FormResult;
    if (score.home > score.away) {
      home.won++;
      home.points += 3;
      away.lost++;
      homeResult = "W";
    } else if (score.home < score.away) {
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
      scoreFor: score.home,
      scoreAgainst: score.away,
      home: true,
    });
    away.form.push({
      result: homeResult === "W" ? "L" : homeResult === "L" ? "W" : "D",
      matchday: match.matchday,
      opponent: match.home,
      scoreFor: score.away,
      scoreAgainst: score.home,
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

export function computeTopScorers(scores: Scores): ScorerRow[] {
  const rows = new Map<string, ScorerRow>(PLAYERS.map((p) => [p, { player: p, played: 0, goals: 0 }]));

  for (const match of ALL_MATCHES) {
    const score = scores[match.id];
    if (!countsForStats(score)) continue;
    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goals += score.home;
    away.goals += score.away;
  }

  return [...rows.values()].sort(
    (a, b) => b.goals - a.goals || a.played - b.played || a.player.localeCompare(b.player)
  );
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
export function playerMatches(player: string, scores: Scores): PlayerMatch[] {
  const out: PlayerMatch[] = [];
  for (const match of ALL_MATCHES) {
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
  player: string,
  scores: Scores,
  deductions: Deduction[] = []
): PlayerProfile {
  const table = computeTable(scores, deductions);
  const position = table.findIndex((r) => r.player === player) + 1;
  const row = table.find((r) => r.player === player)!;

  const matches = playerMatches(player, scores);
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

export function computeHeadToHead(a: string, b: string, scores: Scores): HeadToHead {
  const matches = playerMatches(a, scores).filter((m) => m.opponent === b);
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

export function computeCleanSheets(scores: Scores): CleanSheetRow[] {
  const rows = new Map<string, CleanSheetRow>(
    PLAYERS.map((p) => [p, { player: p, played: 0, cleanSheets: 0, goalsAgainst: 0 }])
  );

  for (const match of ALL_MATCHES) {
    const score = scores[match.id];
    if (!countsForStats(score)) continue;
    const home = rows.get(match.home);
    const away = rows.get(match.away);
    if (!home || !away) continue;
    home.played++;
    away.played++;
    home.goalsAgainst += score.away;
    away.goalsAgainst += score.home;
    if (score.away === 0) home.cleanSheets++;
    if (score.home === 0) away.cleanSheets++;
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.cleanSheets - a.cleanSheets ||
      a.goalsAgainst - b.goalsAgainst ||
      a.played - b.played ||
      a.player.localeCompare(b.player)
  );
}
