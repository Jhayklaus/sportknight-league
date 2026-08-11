import { NextResponse } from "next/server";
import { checkCreationCode, creationIsGated, hashCode, isValidNewCode } from "@/lib/auth";
import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  emptyLeague,
  generateFixtures,
  hasDuplicate,
  normalisePlayerName,
  uniqueSlug,
  validateFixtures,
} from "@/lib/leagues";
import { createLeague, listLeagues } from "@/lib/store";
import { readBody, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ leagues: await listLeagues(), gated: creationIsGated() });
  } catch (err) {
    console.error("Failed to list leagues:", err);
    return NextResponse.json({ leagues: [], gated: creationIsGated() });
  }
}

export async function POST(request: Request) {
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const { name, adminCode, players, creationCode, relegationCount } = body as {
    name?: unknown;
    adminCode?: unknown;
    players?: unknown;
    creationCode?: unknown;
    relegationCount?: unknown;
  };

  if (!checkCreationCode(creationCode)) {
    return NextResponse.json(
      { error: "This site requires a creation code to start a new league." },
      { status: 401 }
    );
  }

  const leagueName = typeof name === "string" ? name.trim() : "";
  if (leagueName.length < 3 || leagueName.length > 60) {
    return NextResponse.json(
      { error: "League name must be between 3 and 60 characters" },
      { status: 400 }
    );
  }

  if (!isValidNewCode(adminCode)) {
    return NextResponse.json(
      { error: "Admin code must be at least 4 characters" },
      { status: 400 }
    );
  }

  const roster: string[] = [];
  if (Array.isArray(players)) {
    for (const raw of players) {
      const clean = normalisePlayerName(raw);
      if (clean) roster.push(clean);
    }
  }
  if (roster.length > MAX_PLAYERS) {
    return NextResponse.json({ error: `At most ${MAX_PLAYERS} players` }, { status: 400 });
  }
  if (hasDuplicate(roster)) {
    return NextResponse.json({ error: "Player names must be unique" }, { status: 400 });
  }

  try {
    const existing = (await listLeagues()).map((l) => l.slug);
    const league = emptyLeague(uniqueSlug(leagueName, existing), leagueName, hashCode(adminCode));
    league.players = roster;
    league.relegationCount =
      typeof relegationCount === "number" && Number.isInteger(relegationCount) && relegationCount >= 0
        ? relegationCount
        : 0;

    // Generating now is optional: a league can add players first and generate later.
    if (roster.length >= MIN_PLAYERS) {
      const fixtures = generateFixtures(roster);
      const errors = validateFixtures(roster, fixtures);
      if (errors.length) {
        return NextResponse.json(
          { error: `Could not build a valid schedule: ${errors[0]}` },
          { status: 500 }
        );
      }
      league.fixtures = fixtures;
    }

    await createLeague(league);
    return NextResponse.json({ league });
  } catch (err) {
    return serverError(err, "Failed to create league");
  }
}
