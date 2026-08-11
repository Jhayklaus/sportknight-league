import { NextResponse } from "next/server";
import { DEFAULT_WINDOW_MATCHDAYS } from "@/lib/league";
import { viewOf } from "@/lib/leagues";
import { setWindow } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { league, body } = result;

  const { firstMatchday, startedAt, matchdays, clear } = body as {
    firstMatchday?: unknown;
    startedAt?: unknown;
    matchdays?: unknown;
    clear?: unknown;
  };

  const total = viewOf(league).matchdays.length;

  try {
    if (clear === true) return NextResponse.json({ league: await setWindow(slug, null) });

    if (
      typeof firstMatchday !== "number" ||
      !Number.isInteger(firstMatchday) ||
      firstMatchday < 1 ||
      firstMatchday > total
    ) {
      return NextResponse.json({ error: "Invalid matchday" }, { status: 400 });
    }

    const started = typeof startedAt === "string" && startedAt ? new Date(startedAt) : new Date();
    if (Number.isNaN(started.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }

    const size = matchdays === undefined ? DEFAULT_WINDOW_MATCHDAYS : matchdays;
    if (typeof size !== "number" || !Number.isInteger(size) || size < 1 || size > total) {
      return NextResponse.json(
        { error: `Matchdays per window must be a whole number between 1 and ${total}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      league: await setWindow(slug, {
        firstMatchday,
        startedAt: started.toISOString(),
        matchdays: size,
      }),
    });
  } catch (err) {
    return serverError(err, "Failed to set window");
  }
}
