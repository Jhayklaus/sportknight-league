import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { AdminAuth } from "./leagues";

/**
 * Admin codes are stored salted and hashed, never in plain text. The original
 * SportKnight league has `auth: null` and keeps using the LEAGUE_PIN env var.
 */

export function hashCode(code: string): AdminAuth {
  const salt = randomBytes(16).toString("hex");
  return { salt, hash: scryptSync(code, salt, 64).toString("hex") };
}

function matches(code: string, auth: AdminAuth): boolean {
  try {
    const expected = Buffer.from(auth.hash, "hex");
    const actual = scryptSync(code, auth.salt, expected.length);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function envPin(): string {
  return process.env.LEAGUE_PIN || "1234";
}

/** Verify a submitted code against a league's stored credentials. */
export function checkLeagueCode(code: unknown, auth: AdminAuth | null): boolean {
  if (typeof code !== "string" || code.length === 0) return false;
  if (!auth) {
    const pin = envPin();
    const a = Buffer.from(code);
    const b = Buffer.from(pin);
    return a.length === b.length && timingSafeEqual(a, b);
  }
  return matches(code, auth);
}

export function isValidNewCode(code: unknown): code is string {
  return typeof code === "string" && code.trim().length >= 4 && code.length <= 64;
}

/** Gate on league creation, if the deployment sets one. */
export function checkCreationCode(code: unknown): boolean {
  const required = process.env.LEAGUE_CREATION_CODE;
  if (!required) return true;
  return typeof code === "string" && code === required;
}

export function creationIsGated(): boolean {
  return Boolean(process.env.LEAGUE_CREATION_CODE);
}
