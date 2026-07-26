import { NextResponse } from "next/server";
import { MATCH_BY_ID, isValidScore } from "@/lib/league";
import { readScores, writeScore } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ scores: readScores() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin, matchId, home, away } = (body ?? {}) as {
    pin?: unknown;
    matchId?: unknown;
    home?: unknown;
    away?: unknown;
  };

  if (!checkPin(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  if (typeof matchId !== "string" || !MATCH_BY_ID.has(matchId)) {
    return NextResponse.json({ error: "Unknown match" }, { status: 400 });
  }

  // home/away both null clears the result; otherwise both must be integers 0–99.
  if (home === null && away === null) {
    const scores = writeScore(matchId, null);
    return NextResponse.json({ scores });
  }

  if (!isValidScore(home) || !isValidScore(away)) {
    return NextResponse.json(
      { error: "Scores must be whole numbers between 0 and 99" },
      { status: 400 }
    );
  }

  const scores = writeScore(matchId, { home, away });
  return NextResponse.json({ scores });
}
