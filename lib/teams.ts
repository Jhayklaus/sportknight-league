/**
 * The draft pool: the strongest ten clubs from four of Europe's top leagues.
 *
 * Bundesliga is left out because eFootball's coverage of it is thin, and each
 * league is trimmed to ten so every entrant draws a competitive side. These are
 * plain lists — edit them freely as clubs rise, fall, or lose their licence.
 */

export interface Competition {
  id: string;
  name: string;
  country: string;
  teams: string[];
}

export const COMPETITIONS: Competition[] = [
  {
    id: "premier-league",
    name: "Premier League",
    country: "England",
    teams: [
      "Arsenal",
      "Aston Villa",
      "Brighton & Hove Albion",
      "Chelsea",
      "Liverpool",
      "Manchester City",
      "Manchester United",
      "Newcastle United",
      "Nottingham Forest",
      "Tottenham Hotspur",
    ],
  },
  {
    id: "la-liga",
    name: "LaLiga",
    country: "Spain",
    teams: [
      "Athletic Club",
      "Atletico Madrid",
      "Barcelona",
      "Celta Vigo",
      "Real Betis",
      "Real Madrid",
      "Real Sociedad",
      "Sevilla",
      "Valencia",
      "Villarreal",
    ],
  },
  {
    id: "serie-a",
    name: "Serie A",
    country: "Italy",
    teams: [
      "AC Milan",
      "Atalanta",
      "Bologna",
      "Fiorentina",
      "Inter Milan",
      "Juventus",
      "Lazio",
      "Napoli",
      "Roma",
      "Torino",
    ],
  },
  {
    id: "ligue-1",
    name: "Ligue 1",
    country: "France",
    teams: [
      "Brest",
      "Lens",
      "Lille",
      "Lyon",
      "Marseille",
      "Monaco",
      "Nice",
      "Paris Saint-Germain",
      "Rennes",
      "Strasbourg",
    ],
  },
];

export const COMPETITION_BY_ID = new Map(COMPETITIONS.map((c) => [c.id, c]));

export const COMPETITION_IDS = COMPETITIONS.map((c) => c.id);

export function competitionName(id: string): string {
  return COMPETITION_BY_ID.get(id)?.name ?? id;
}

/** How many distinct competitions each entrant ranks. */
export const PREFERENCES_REQUIRED = 3;

/** Every club in the pool — the hard ceiling on how many can be drafted. */
export const TOTAL_CLUBS = COMPETITIONS.reduce((n, c) => n + c.teams.length, 0);

/**
 * The smallest pool anyone can end up with: the required number of
 * competitions, taking the smallest ones. No draft should allow more entries
 * than this, or a late entrant could find all their leagues exhausted.
 */
export const SAFE_MAX_ENTRIES = [...COMPETITIONS]
  .map((c) => c.teams.length)
  .sort((a, b) => a - b)
  .slice(0, PREFERENCES_REQUIRED)
  .reduce((n, size) => n + size, 0);
