import { NextResponse } from "next/server";
import { ALL_MATCHES } from "@/lib/league";
import { readState, rolloverSeason } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin, name } = (body ?? {}) as { pin?: unknown; name?: unknown };

  if (!checkPin(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  try {
    const state = await readState();
    const played = ALL_MATCHES.filter((m) => state.scores[m.id]).length;
    if (played < ALL_MATCHES.length) {
      return NextResponse.json(
        {
          error: `Season is not finished — ${ALL_MATCHES.length - played} of ${ALL_MATCHES.length} fixtures still have no result.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      await rolloverSeason(typeof name === "string" ? name : undefined)
    );
  } catch (err) {
    if (err instanceof Error && err.message === "SEASON_INCOMPLETE") {
      return NextResponse.json({ error: "Season is not finished yet." }, { status: 409 });
    }
    console.error("Season rollover failed:", err);
    return NextResponse.json(
      { error: "Could not save: storage is not configured (see README)." },
      { status: 500 }
    );
  }
}
