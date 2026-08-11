import { NextResponse } from "next/server";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  generateFixtures,
  hasDuplicate,
  normalisePlayerName,
  validateFixtures,
} from "@/lib/leagues";
import { updateLeague } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Roster edits. Changing who plays is only safe while no results exist for the
 * season — otherwise recorded scores would point at fixtures that no longer
 * mean the same thing. Renaming is always allowed.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { league, body } = result;

  const action = body.action;
  const hasResults = Object.keys(league.scores).length > 0;

  try {
    if (action === "setRelegation") {
      const count = body.count;
      if (
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 0 ||
        count > Math.max(0, league.players.length - MIN_PLAYERS)
      ) {
        return NextResponse.json(
          { error: `Relegation count must be between 0 and ${Math.max(0, league.players.length - MIN_PLAYERS)}` },
          { status: 400 }
        );
      }
      return NextResponse.json({
        league: await updateLeague(slug, (l) => {
          l.relegationCount = count;
        }),
      });
    }

    if (action === "rename") {
      const from = normalisePlayerName(body.from);
      const to = normalisePlayerName(body.to);
      if (!from || !to) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
      if (!league.players.includes(from)) {
        return NextResponse.json({ error: "Unknown player" }, { status: 400 });
      }
      if (league.players.some((p) => p !== from && p.toLowerCase() === to.toLowerCase())) {
        return NextResponse.json({ error: "Another player already has that name" }, { status: 400 });
      }
      return NextResponse.json({
        league: await updateLeague(slug, (l) => {
          l.players = l.players.map((p) => (p === from ? to : p));
          l.fixtures = l.fixtures.map((f) => ({
            ...f,
            home: f.home === from ? to : f.home,
            away: f.away === from ? to : f.away,
          }));
          l.deductions = l.deductions.map((d) =>
            d.player === from ? { ...d, player: to } : d
          );
        }),
      });
    }

    // Everything below rewrites the schedule.
    if (hasResults) {
      return NextResponse.json(
        {
          error:
            "Results have already been recorded this season. Finish the season and use the relegation step to change the roster.",
        },
        { status: 409 }
      );
    }

    if (action === "setPlayers") {
      const incoming = Array.isArray(body.players) ? body.players : [];
      const players: string[] = [];
      for (const raw of incoming) {
        const clean = normalisePlayerName(raw);
        if (clean) players.push(clean);
      }
      if (players.length > MAX_PLAYERS) {
        return NextResponse.json({ error: `At most ${MAX_PLAYERS} players` }, { status: 400 });
      }
      if (hasDuplicate(players)) {
        return NextResponse.json({ error: "Player names must be unique" }, { status: 400 });
      }

      const regenerate = players.length >= MIN_PLAYERS && body.generate === true;
      let fixtures = regenerate ? generateFixtures(players) : [];
      if (regenerate) {
        const errors = validateFixtures(players, fixtures);
        if (errors.length) {
          return NextResponse.json(
            { error: `Could not build a valid schedule: ${errors[0]}` },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        league: await updateLeague(slug, (l) => {
          l.players = players;
          l.fixtures = regenerate ? fixtures : l.fixtures.length && !regenerate ? [] : fixtures;
          l.window = null;
          if (l.relegationCount > Math.max(0, players.length - MIN_PLAYERS)) {
            l.relegationCount = Math.max(0, players.length - MIN_PLAYERS);
          }
        }),
      });
    }

    if (action === "generate") {
      if (league.players.length < MIN_PLAYERS) {
        return NextResponse.json(
          { error: `Add at least ${MIN_PLAYERS} players first` },
          { status: 400 }
        );
      }
      const fixtures = generateFixtures(league.players);
      const errors = validateFixtures(league.players, fixtures);
      if (errors.length) {
        return NextResponse.json(
          { error: `Could not build a valid schedule: ${errors[0]}` },
          { status: 500 }
        );
      }
      return NextResponse.json({
        league: await updateLeague(slug, (l) => {
          l.fixtures = fixtures;
          l.window = null;
        }),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return serverError(err, "Failed to update roster");
  }
}
