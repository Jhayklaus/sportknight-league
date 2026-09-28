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
  /** Secret: the browser token that entered, so the same device cannot re-enter. */
  deviceId?: string;
  /** Secret: the invite this entry consumed, when invites are required. */
  inviteCode?: string;
}

/** A single-use code, when the admin wants exactly one entry per person. */
export interface DraftInvite {
  code: string;
  usedBy: string | null;
  usedAt: string | null;
}

export interface DraftState {
  open: boolean;
  maxEntries: number;
  entries: DraftEntry[];
  openedAt: string | null;
  closedAt: string | null;
  /** When true, an unused invite code is required to enter. */
  requireInvite?: boolean;
  /** Secret: never sent to the public draft page. */
  invites?: DraftInvite[];
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
    requireInvite: false,
    invites: [],
  };
}

/* ----------------------------------------------------------- invite codes */

// Unambiguous alphabet: no O/0, I/1, so codes survive being read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${out.slice(0, 3)}-${out.slice(3)}`;
}

/** Top the pool up to `count` codes, keeping any already issued. */
export function ensureInvites(draft: DraftState, count: number): DraftInvite[] {
  const invites = [...(draft.invites ?? [])];
  const seen = new Set(invites.map((i) => i.code));
  while (invites.length < count) {
    let code = randomCode();
    let guard = 0;
    while (seen.has(code) && guard++ < 50) code = randomCode();
    seen.add(code);
    invites.push({ code, usedBy: null, usedAt: null });
  }
  return invites;
}

export function normaliseInviteCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (cleaned.length !== CODE_LENGTH) return null;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
}

export function findUnusedInvite(draft: DraftState, code: string): DraftInvite | null {
  return (draft.invites ?? []).find((i) => i.code === code && !i.usedBy) ?? null;
}

/** A device token is minted per entry and stored in an http-only cookie. */
export function newDeviceId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function entryForDevice(draft: DraftState, deviceId: string | undefined): DraftEntry | null {
  if (!deviceId) return null;
  return draft.entries.find((e) => e.deviceId === deviceId) ?? null;
}

/**
 * Strip everything an entrant should not see: other people's device tokens and
 * every invite code. Used for the public league payloads.
 */
export function sanitiseDraft(draft: DraftState): DraftState {
  return {
    ...draft,
    entries: draft.entries.map(({ deviceId, inviteCode, ...rest }) => rest),
    invites: undefined,
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
