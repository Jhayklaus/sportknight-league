import { NextResponse } from "next/server";
import { MATCH_BY_ID, isValidScore } from "@/lib/league";
import { readState, writeScore } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STORAGE_ERROR =
  "Could not save: storage is not configured. On Vercel, connect the Upstash Redis integration (see README) and redeploy.";

export async function GET() {
  try {
    return NextResponse.json(await readState());
  } catch (err) {
    console.error("Failed to read league state:", err);
    return NextResponse.json({ scores: {}, deductions: [], warning: "storage unavailable" });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin, matchId, home, away, noShow } = (body ?? {}) as {
    pin?: unknown;
    matchId?: unknown;
    home?: unknown;
    away?: unknown;
    noShow?: unknown;
  };

  if (!checkPin(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  if (typeof matchId !== "string" || !MATCH_BY_ID.has(matchId)) {
    return NextResponse.json({ error: "Unknown match" }, { status: 400 });
  }

  try {
    // Rule 5: neither player tried to arrange the game — 0–0, no points for anyone.
    if (noShow === true) {
      return NextResponse.json(await writeScore(matchId, { home: 0, away: 0, noShow: true }));
    }
    // home/away both null clears the result; otherwise both must be integers 0–99.
    if (home === null && away === null) {
      return NextResponse.json(await writeScore(matchId, null));
    }
    if (!isValidScore(home) || !isValidScore(away)) {
      return NextResponse.json(
        { error: "Scores must be whole numbers between 0 and 99" },
        { status: 400 }
      );
    }
    return NextResponse.json(await writeScore(matchId, { home, away }));
  } catch (err) {
    console.error("Failed to write score:", err);
    return NextResponse.json({ error: STORAGE_ERROR }, { status: 500 });
  }
}
