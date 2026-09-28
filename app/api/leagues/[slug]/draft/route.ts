import { type NextRequest, NextResponse } from "next/server";
import {
  DEFAULT_MAX_ENTRIES,
  emptyDraft,
  ensureInvites,
  entryForDevice,
  summariseDraft,
  type DraftState,
} from "@/lib/draft";
import { MAX_PLAYERS } from "@/lib/leagues";
import { COMPETITIONS, PREFERENCES_REQUIRED, SAFE_MAX_ENTRIES, competitionName } from "@/lib/teams";
import { loadLeague, setDraft, updateLeague } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";
import { DRAFT_COOKIE } from "@/lib/draftCookie";

export const dynamic = "force-dynamic";

/** Public: what the share link needs to render. No admin code required. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const league = await loadLeague(slug);
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });

    // If this browser already entered, hand back its own entry so the page can
    // show it instead of the form.
    const deviceId = request.cookies.get(DRAFT_COOKIE(slug))?.value;
    const mine = league.draft ? entryForDevice(league.draft, deviceId) : null;

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
      requireInvite: Boolean(league.draft?.requireInvite),
      you: mine
        ? {
            name: mine.name,
            team: mine.team,
            competition: competitionName(mine.competitionId),
            player: mine.player,
          }
        : null,
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
      if (draft.requireInvite) draft.invites = ensureInvites(draft, draft.maxEntries);
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

    if (action === "invites") {
      const draft = league.draft;
      if (!draft) return NextResponse.json({ error: "No draft running" }, { status: 400 });

      const wanted = body.require;
      if (typeof wanted === "boolean") {
        const invites = wanted ? ensureInvites(draft, draft.maxEntries) : (draft.invites ?? []);
        const updated = await setDraft(slug, { ...draft, requireInvite: wanted, invites });
        return NextResponse.json({
          league: updated,
          invites: wanted ? invites : [],
        });
      }

      // Just reading the codes back for the admin screen.
      const invites = ensureInvites(draft, draft.maxEntries);
      if (invites.length !== (draft.invites ?? []).length) {
        await setDraft(slug, { ...draft, invites });
      }
      return NextResponse.json({ league: { ...league, draft: { ...draft, invites } }, invites });
    }

    if (action === "removeEntry") {
      const draft = league.draft;
      const entryId = body.entryId;
      if (!draft || typeof entryId !== "string") {
        return NextResponse.json({ error: "Unknown entry" }, { status: 400 });
      }
      const entry = draft.entries.find((e) => e.id === entryId);
      if (!entry) return NextResponse.json({ error: "Unknown entry" }, { status: 404 });
      if (Object.keys(league.scores).length > 0) {
        return NextResponse.json(
          { error: "Results have been recorded, so entries cannot be removed." },
          { status: 409 }
        );
      }

      return NextResponse.json({
        league: await updateLeague(slug, (l) => {
          if (!l.draft) return;
          l.draft = {
            ...l.draft,
            entries: l.draft.entries.filter((e) => e.id !== entryId),
            // Free the invite so that person can enter again.
            invites: (l.draft.invites ?? []).map((i) =>
              i.usedBy === entryId ? { ...i, usedBy: null, usedAt: null } : i
            ),
          };
          l.players = l.players.filter((p) => p !== entry.player);
          l.fixtures = [];
        }),
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return serverError(err, "Failed to update draft");
  }
}
