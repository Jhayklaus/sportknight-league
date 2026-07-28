import { NextResponse } from "next/server";
import { MATCH_BY_ID, isValidScore } from "@/lib/league";
import { readScores, writeScore } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ scores: await readScores() });
  } catch (err) {
    console.error("Failed to read scores:", err);
    return NextResponse.json({ scores: {}, warning: "storage unavailable" });
  }
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

  try {
    // home/away both null clears the result; otherwise both must be integers 0–99.
    if (home === null && away === null) {
      return NextResponse.json({ scores: await writeScore(matchId, null) });
    }
    if (!isValidScore(home) || !isValidScore(away)) {
      return NextResponse.json(
        { error: "Scores must be whole numbers between 0 and 99" },
        { status: 400 }
      );
    }
    return NextResponse.json({ scores: await writeScore(matchId, { home, away }) });
  } catch (err) {
    console.error("Failed to write score:", err);
    return NextResponse.json(
      {
        error:
          "Could not save: storage is not configured. On Vercel, connect the Upstash Redis integration (see README) and redeploy.",
      },
      { status: 500 }
    );
  }
}
