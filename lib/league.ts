import fixturesData from "./fixtures.json";

export interface Match {
  id: string;
  matchday: number;
  home: string;
  away: string;
}

export interface Matchday {
  matchday: number;
  resting: string;
  matches: Match[];
}

export interface Score {
  home: number;
  away: number;
}

export type Scores = Record<string, Score>;

export interface TableRow {
  player: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
}

export interface ScorerRow {
  player: string;
  played: number;
  goals: number;
}

export const MATCHDAYS: Matchday[] = (
  fixturesData as { matchday: number; resting: string; matches: { home: string; away: string }[] }[]
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

export function computeTable(scores: Scores): TableRow[] {
  const rows = new Map<string, TableRow>(
    PLAYERS.map((p) => [
      p,
      { player: p, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0 },
    ])
  );

  for (const match of ALL_MATCHES) {
    const score = scores[match.id];
    if (!score) continue;
    const home = rows.get(match.home)!;
    const away = rows.get(match.away)!;
    home.played++;
    away.played++;
    home.goalsFor += score.home;
    home.goalsAgainst += score.away;
    away.goalsFor += score.away;
    away.goalsAgainst += score.home;
    if (score.home > score.away) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (score.home < score.away) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
  }

  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst;
  }

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
    if (!score) continue;
    const home = rows.get(match.home)!;
    const away = rows.get(match.away)!;
    home.played++;
    away.played++;
    home.goals += score.home;
    away.goals += score.away;
  }

  return [...rows.values()].sort(
    (a, b) => b.goals - a.goals || a.played - b.played || a.player.localeCompare(b.player)
  );
}
