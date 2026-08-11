import { NextResponse } from "next/server";
import { isSeasonComplete } from "@/lib/league";
import { MAX_PLAYERS, MIN_PLAYERS, hasDuplicate, normalisePlayerName, viewOf } from "@/lib/leagues";
import { SeasonIncompleteError, rolloverSeason } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { league, body } = result;

  const view = viewOf(league);
  const played = view.allMatches.filter((m) => league.scores[m.id]).length;
  if (!isSeasonComplete(view, league.scores)) {
    return NextResponse.json(
      {
        error: `Season is not finished — ${view.allMatches.length - played} of ${view.allMatches.length} fixtures still have no result.`,
      },
      { status: 409 }
    );
  }

  const relegated: string[] = [];
  if (Array.isArray(body.relegated)) {
    for (const raw of body.relegated) {
      if (typeof raw === "string" && league.players.includes(raw)) relegated.push(raw);
    }
  }

  const replacements: string[] = [];
  if (Array.isArray(body.replacements)) {
    for (const raw of body.replacements) {
      const clean = normalisePlayerName(raw);
      if (clean) replacements.push(clean);
    }
  }

  const staying = league.players.filter((p) => !relegated.includes(p));
  const nextRoster = [...staying, ...replacements];

  if (hasDuplicate(nextRoster)) {
    return NextResponse.json(
      { error: "A replacement name clashes with a player who is staying" },
      { status: 400 }
    );
  }
  if (nextRoster.length < MIN_PLAYERS) {
    return NextResponse.json(
      { error: `The new season needs at least ${MIN_PLAYERS} players` },
      { status: 400 }
    );
  }
  if (nextRoster.length > MAX_PLAYERS) {
    return NextResponse.json({ error: `At most ${MAX_PLAYERS} players` }, { status: 400 });
  }

  try {
    const updated = await rolloverSeason(slug, {
      name: typeof body.name === "string" ? body.name : undefined,
      relegated,
      replacements,
    });
    return NextResponse.json({ league: updated });
  } catch (err) {
    if (err instanceof SeasonIncompleteError) {
      return NextResponse.json({ error: "Season is not finished yet." }, { status: 409 });
    }
    return serverError(err, "Season rollover failed");
  }
}
