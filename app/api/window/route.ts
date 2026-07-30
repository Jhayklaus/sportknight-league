import { NextResponse } from "next/server";
import { MATCHDAYS } from "@/lib/league";
import { setWindow } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin, firstMatchday, startedAt, clear } = (body ?? {}) as {
    pin?: unknown;
    firstMatchday?: unknown;
    startedAt?: unknown;
    clear?: unknown;
  };

  if (!checkPin(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  try {
    if (clear === true) {
      return NextResponse.json(await setWindow(null));
    }

    if (
      typeof firstMatchday !== "number" ||
      !Number.isInteger(firstMatchday) ||
      firstMatchday < 1 ||
      firstMatchday > MATCHDAYS.length
    ) {
      return NextResponse.json({ error: "Invalid matchday" }, { status: 400 });
    }

    const started = typeof startedAt === "string" && startedAt ? new Date(startedAt) : new Date();
    if (Number.isNaN(started.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }

    return NextResponse.json(
      await setWindow({ firstMatchday, startedAt: started.toISOString() })
    );
  } catch (err) {
    console.error("Failed to set window:", err);
    return NextResponse.json(
      { error: "Could not save: storage is not configured (see README)." },
      { status: 500 }
    );
  }
}
