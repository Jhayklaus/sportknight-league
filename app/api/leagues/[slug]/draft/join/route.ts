import { NextResponse } from "next/server";
import {
  assignTeam,
  draftLabel,
  isDraftJoinable,
  normaliseNickname,
  normalisePreferences,
  spotsLeft,
  summariseDraft,
  takenTeams,
  MAX_NICKNAME,
  MAX_PLAYER_LABEL,
  type DraftEntry,
} from "@/lib/draft";
import { MAX_PLAYERS } from "@/lib/leagues";
import { competitionName, PREFERENCES_REQUIRED } from "@/lib/teams";
import { DraftClosedError, commitDraftEntry, loadLeague } from "@/lib/store";
import { readBody, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Public: anyone with the share link can enter once. No admin code — the draft
 * being open, and having a free spot, is the only gate.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const league = await loadLeague(slug);
  if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

  const draft = league.draft;
  if (!draft) {
    return NextResponse.json({ error: "There is no draft running for this league." }, { status: 404 });
  }
  if (!draft.open) {
    return NextResponse.json({ error: "This draft has been closed." }, { status: 409 });
  }
  if (spotsLeft(draft) <= 0) {
    return NextResponse.json(
      { error: `The draft is full — all ${draft.maxEntries} places have been taken.` },
      { status: 409 }
    );
  }
  if (Object.keys(league.scores).length > 0) {
    return NextResponse.json(
      { error: "This season has already started, so the draft is closed." },
      { status: 409 }
    );
  }

  const name = normaliseNickname(body.name);
  if (!name) {
    return NextResponse.json(
      { error: `Enter a name between 2 and ${MAX_NICKNAME} characters, without brackets.` },
      { status: 400 }
    );
  }

  const preferences = normalisePreferences(body.preferences);
  if (!preferences) {
    return NextResponse.json(
      { error: `Pick exactly ${PREFERENCES_REQUIRED} different leagues.` },
      { status: 400 }
    );
  }

  const nameTaken = draft.entries.some((e) => e.name.toLowerCase() === name.toLowerCase());
  if (nameTaken) {
    return NextResponse.json(
      { error: "Somebody has already entered with that name — try another." },
      { status: 409 }
    );
  }

  const assignment = assignTeam(preferences, takenTeams(draft));
  if (!assignment) {
    return NextResponse.json(
      { error: "Every club in those three leagues is taken. Pick a different league." },
      { status: 409 }
    );
  }

  const player = draftLabel(name, assignment.team);
  if (player.length > MAX_PLAYER_LABEL) {
    return NextResponse.json({ error: "That name is too long for the table." }, { status: 400 });
  }
  if (league.players.some((p) => p.toLowerCase() === player.toLowerCase())) {
    return NextResponse.json({ error: "That entry already exists." }, { status: 409 });
  }
  if (league.players.length >= MAX_PLAYERS) {
    return NextResponse.json({ error: "This league is full." }, { status: 409 });
  }

  try {
    // Re-checked against fresh state inside the commit, in case someone else
    // claimed the same club a moment ago.
    const updated = await commitDraftEntry(slug, (fresh) => {
      const freshDraft = fresh.draft;
      if (!isDraftJoinable(freshDraft)) {
        throw new DraftClosedError("The draft closed while you were picking.");
      }
      if (freshDraft.entries.some((e) => e.name.toLowerCase() === name.toLowerCase())) {
        throw new DraftClosedError("Somebody just entered with that name — try another.");
      }

      const stillFree = !takenTeams(freshDraft).has(assignment.team);
      const final = stillFree ? assignment : assignTeam(preferences, takenTeams(freshDraft));
      if (!final) {
        throw new DraftClosedError("Every club in those three leagues is now taken.");
      }

      const entry: DraftEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name,
        team: final.team,
        competitionId: final.competitionId,
        preferences,
        player: draftLabel(name, final.team),
        at: new Date().toISOString(),
      };
      return { entry, player: entry.player };
    });

    const mine = updated.draft?.entries.find((e) => e.name === name);
    return NextResponse.json({
      entry: mine
        ? {
            name: mine.name,
            team: mine.team,
            competition: competitionName(mine.competitionId),
            player: mine.player,
          }
        : null,
      draft: updated.draft ? summariseDraft(updated.draft) : null,
    });
  } catch (err) {
    if (err instanceof DraftClosedError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    return serverError(err, "Draft entry failed");
  }
}
