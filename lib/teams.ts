/**
 * First-division clubs of the top five European leagues, for the draft.
 *
 * Kept as plain data so it is easy to correct after promotions and
 * relegations, or to trim to the clubs your game actually licenses.
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
      "Bournemouth",
      "Brentford",
      "Brighton & Hove Albion",
      "Burnley",
      "Chelsea",
      "Crystal Palace",
      "Everton",
      "Fulham",
      "Leeds United",
      "Liverpool",
      "Manchester City",
      "Manchester United",
      "Newcastle United",
      "Nottingham Forest",
      "Sunderland",
      "Tottenham Hotspur",
      "West Ham United",
      "Wolverhampton Wanderers",
    ],
  },
  {
    id: "la-liga",
    name: "LaLiga",
    country: "Spain",
    teams: [
      "Alaves",
      "Athletic Club",
      "Atletico Madrid",
      "Barcelona",
      "Celta Vigo",
      "Elche",
      "Espanyol",
      "Getafe",
      "Girona",
      "Levante",
      "Mallorca",
      "Osasuna",
      "Rayo Vallecano",
      "Real Betis",
      "Real Madrid",
      "Real Oviedo",
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
      "Cagliari",
      "Como",
      "Cremonese",
      "Fiorentina",
      "Genoa",
      "Hellas Verona",
      "Inter Milan",
      "Juventus",
      "Lazio",
      "Lecce",
      "Napoli",
      "Parma",
      "Pisa",
      "Roma",
      "Sassuolo",
      "Torino",
      "Udinese",
    ],
  },
  {
    id: "bundesliga",
    name: "Bundesliga",
    country: "Germany",
    teams: [
      "Augsburg",
      "Bayer Leverkusen",
      "Bayern Munich",
      "Borussia Dortmund",
      "Borussia Monchengladbach",
      "Eintracht Frankfurt",
      "FC Koln",
      "Freiburg",
      "Hamburger SV",
      "Heidenheim",
      "Hoffenheim",
      "Mainz 05",
      "RB Leipzig",
      "St. Pauli",
      "Stuttgart",
      "Union Berlin",
      "Werder Bremen",
      "Wolfsburg",
    ],
  },
  {
    id: "ligue-1",
    name: "Ligue 1",
    country: "France",
    teams: [
      "Angers",
      "Auxerre",
      "Brest",
      "Le Havre",
      "Lens",
      "Lille",
      "Lorient",
      "Lyon",
      "Marseille",
      "Metz",
      "Monaco",
      "Nantes",
      "Nice",
      "Paris FC",
      "Paris Saint-Germain",
      "Rennes",
      "Strasbourg",
      "Toulouse",
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
