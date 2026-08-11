import { NextResponse } from "next/server";
import { checkLeagueCode } from "./auth";
import { loadLeague } from "./store";
import type { LeagueRecord } from "./leagues";

export const STORAGE_ERROR =
  "Could not save: storage is not configured. On Vercel, connect the Upstash Redis integration (see README) and redeploy.";

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}

type Authorised = { league: LeagueRecord; body: Record<string, unknown> };

/**
 * Load the league and check the submitted admin code. Every write goes through
 * this — the client's "unlocked" state is never trusted.
 */
export async function authorise(
  request: Request,
  slug: string
): Promise<{ error: NextResponse } | Authorised> {
  const body = await readBody(request);
  if (!body) {
    return { error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }) };
  }

  const league = await loadLeague(slug);
  if (!league) {
    return { error: NextResponse.json({ error: "League not found" }, { status: 404 }) };
  }

  const code = body.code ?? body.pin;
  if (!checkLeagueCode(code, league.auth)) {
    return { error: NextResponse.json({ error: "Invalid admin code" }, { status: 401 }) };
  }

  return { league, body };
}

export function serverError(err: unknown, context: string): NextResponse {
  console.error(`${context}:`, err);
  return NextResponse.json({ error: STORAGE_ERROR }, { status: 500 });
}
