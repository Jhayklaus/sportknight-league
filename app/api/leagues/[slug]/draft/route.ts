import { NextResponse } from "next/server";
import {
  DEFAULT_MAX_ENTRIES,
  emptyDraft,
  summariseDraft,
  type DraftState,
} from "@/lib/draft";
import { MAX_PLAYERS } from "@/lib/leagues";
import { COMPETITIONS, PREFERENCES_REQUIRED, SAFE_MAX_ENTRIES } from "@/lib/teams";
import { loadLeague, setDraft, updateLeague } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Public: what the share link needs to render. No admin code required. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const league = await loadLeague(slug);
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

    return NextResponse.json({
      leagueName: league.name,
      slug: league.slug,
      seasonStarted: Object.keys(league.scores).length > 0,
      preferencesRequired: PREFERENCES_REQUIRED,
      competitions: COMPETITIONS.map((c) => ({
        id: c.id,
        name: c.name,
        country: c.country,
        teams: c.teams,
      })),
      draft: league.draft ? summariseDraft(league.draft) : null,
    });
  } catch (err) {
    console.error("Failed to read draft:", err);
    return NextResponse.json({ error: "Could not read the draft" }, { status: 500 });
  }
}

/** Admin: open, close, reopen, resize or scrap the draft. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { league, body } = result;

  const action = body.action;

  try {
    if (action === "open") {
      const raw = body.maxEntries;
      const maxEntries = typeof raw === "number" ? raw : DEFAULT_MAX_ENTRIES;
      const ceiling = Math.min(MAX_PLAYERS, SAFE_MAX_ENTRIES);
      if (!Number.isInteger(maxEntries) || maxEntries < 2 || maxEntries > ceiling) {
        return NextResponse.json(
          {
            error: `Maximum entries must be a whole number between 2 and ${ceiling} — beyond that, a late entrant could find every club in their leagues taken.`,
          },
          { status: 400 }
        );
      }
      if (Object.keys(league.scores).length > 0) {
        return NextResponse.json(
          { error: "This season already has results, so players cannot be drafted into it." },
          { status: 409 }
        );
      }

      // Reopening keeps the entries already drafted.
      const existing = league.draft;
      const draft: DraftState = existing
        ? { ...existing, open: true, maxEntries, closedAt: null }
        : emptyDraft(maxEntries);

      if (draft.entries.length >= draft.maxEntries) {
        return NextResponse.json(
          { error: `There are already ${draft.entries.length} entries — raise the maximum first.` },
          { status: 409 }
        );
      }
      return NextResponse.json({ league: await setDraft(slug, draft) });
    }

    if (action === "close") {
      if (!league.draft) return NextResponse.json({ error: "No draft to close" }, { status: 400 });
      return NextResponse.json({
        league: await setDraft(slug, {
          ...league.draft,
          open: false,
          closedAt: new Date().toISOString(),
        }),
      });
    }

    if (action === "reset") {
      if (!league.draft) return NextResponse.json({ error: "No draft to reset" }, { status: 400 });
      if (Object.keys(league.scores).length > 0) {
        return NextResponse.json(
          { error: "Results have been recorded, so drafted players cannot be removed." },
          { status: 409 }
        );
      }
      // Take the drafted names back out of the roster, leaving anyone added by hand.
      const drafted = new Set(league.draft.entries.map((e) => e.player));
      return NextResponse.json({
        league: await updateLeague(slug, (l) => {
          l.players = l.players.filter((p) => !drafted.has(p));
          l.fixtures = [];
          l.draft = null;
        }),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return serverError(err, "Failed to update draft");
  }
}
