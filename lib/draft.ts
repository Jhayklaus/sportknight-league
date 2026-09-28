import {
  COMPETITION_BY_ID,
  COMPETITION_IDS,
  PREFERENCES_REQUIRED,
  competitionName,
} from "./teams";

export interface DraftEntry {
  id: string;
  /** What the entrant typed. */
  name: string;
  team: string;
  competitionId: string;
  /** The three competitions they ranked, best first. */
  preferences: string[];
  /** The roster name this produced, e.g. "Jamiu (Real Madrid)". */
  player: string;
  at: string;
}

export interface DraftState {
  open: boolean;
  maxEntries: number;
  entries: DraftEntry[];
  openedAt: string | null;
  closedAt: string | null;
}

export const DEFAULT_MAX_ENTRIES = 20;
export const MAX_NICKNAME = 24;
/** Keeps "Name (Team)" readable in the table and within the roster name limit. */
export const MAX_PLAYER_LABEL = 60;

export function emptyDraft(maxEntries = DEFAULT_MAX_ENTRIES): DraftState {
  return {
    open: true,
    maxEntries,
    entries: [],
    openedAt: new Date().toISOString(),
    closedAt: null,
  };
}

export function draftLabel(name: string, team: string): string {
  return `${name} (${team})`;
}

export function spotsLeft(draft: DraftState): number {
  return Math.max(0, draft.maxEntries - draft.entries.length);
}

export function isDraftJoinable(draft: DraftState | null | undefined): draft is DraftState {
  return Boolean(draft && draft.open && spotsLeft(draft) > 0);
}

/** Teams already handed out, so nobody shares a club. */
export function takenTeams(draft: DraftState): Set<string> {
  return new Set(draft.entries.map((e) => e.team));
}

export function normaliseNickname(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length < 2 || trimmed.length > MAX_NICKNAME) return null;
  // Parentheses would collide with the "Name (Team)" format.
  if (/[()]/.test(trimmed)) return null;
  return trimmed;
}

/** Exactly three distinct, known competitions, order preserved. */
export function normalisePreferences(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const out: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") return null;
    if (!COMPETITION_IDS.includes(raw)) return null;
    if (out.includes(raw)) return null;
    out.push(raw);
  }
  return out.length === PREFERENCES_REQUIRED ? out : null;
}

export interface Assignment {
  team: string;
  competitionId: string;
}

/**
 * Pick a club from the entrant's ranked competitions. The first choice is
 * weighted most heavily, but any of the three can come up — and a competition
 * whose clubs are all taken is skipped rather than failing the draft.
 */
export function assignTeam(
  preferences: string[],
  taken: Set<string>,
  random: () => number = Math.random
): Assignment | null {
  const available = preferences
    .map((id, index) => {
      const competition = COMPETITION_BY_ID.get(id);
      const teams = (competition?.teams ?? []).filter((t) => !taken.has(t));
      // Weights 3 / 2 / 1 for first, second and third choice.
      return { id, teams, weight: preferences.length - index };
    })
    .filter((c) => c.teams.length > 0);

  if (available.length === 0) return null;

  const totalWeight = available.reduce((sum, c) => sum + c.weight, 0);
  let roll = random() * totalWeight;
  let chosen = available[available.length - 1];
  for (const candidate of available) {
    roll -= candidate.weight;
    if (roll < 0) {
      chosen = candidate;
      break;
    }
  }

  const team = chosen.teams[Math.floor(random() * chosen.teams.length)];
  return { team, competitionId: chosen.id };
}

export interface DraftSummary {
  open: boolean;
  full: boolean;
  maxEntries: number;
  taken: number;
  spotsLeft: number;
  entries: { name: string; team: string; competition: string; at: string }[];
}

/** What the public draft page is allowed to see. */
export function summariseDraft(draft: DraftState): DraftSummary {
  return {
    open: draft.open,
    full: spotsLeft(draft) === 0,
    maxEntries: draft.maxEntries,
    taken: draft.entries.length,
    spotsLeft: spotsLeft(draft),
    entries: draft.entries.map((e) => ({
      name: e.name,
      team: e.team,
      competition: competitionName(e.competitionId),
      at: e.at,
    })),
  };
}
