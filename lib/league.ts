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
