/** Per-league cookie holding the browser's draft token. */
export const DRAFT_COOKIE = (slug: string) => `skdraft_${slug.replace(/[^a-z0-9-]/gi, "")}`;

/** Long enough to cover a tournament's sign-up window. */
export const DRAFT_COOKIE_MAX_AGE = 60 * 60 * 24 * 120;
