import { NextResponse } from "next/server";
import { isValidScore } from "@/lib/league";
import { viewOf } from "@/lib/leagues";
import { writeScore } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { league, body } = result;

  const { matchId, home, away, noShow } = body as {
    matchId?: unknown;
    home?: unknown;
    away?: unknown;
    noShow?: unknown;
  };

  const view = viewOf(league);
  if (typeof matchId !== "string" || !view.matchById.has(matchId)) {
    return NextResponse.json({ error: "Unknown match" }, { status: 400 });
  }

  try {
    // Rule 5: neither player tried to arrange it — 0–0, no points for anyone.
    if (noShow === true) {
      return NextResponse.json({
        league: await writeScore(slug, matchId, { home: 0, away: 0, noShow: true }),
      });
    }
    if (home === null && away === null) {
      return NextResponse.json({ league: await writeScore(slug, matchId, null) });
    }
    if (!isValidScore(home) || !isValidScore(away)) {
      return NextResponse.json(
        { error: "Scores must be whole numbers between 0 and 99" },
        { status: 400 }
      );
    }
    return NextResponse.json({ league: await writeScore(slug, matchId, { home, away }) });
  } catch (err) {
    return serverError(err, "Failed to write score");
  }
}
