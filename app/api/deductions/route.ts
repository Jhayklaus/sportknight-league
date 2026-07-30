import { NextResponse } from "next/server";
import { PLAYERS } from "@/lib/league";
import { addDeduction, removeDeduction } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STORAGE_ERROR =
  "Could not save: storage is not configured. On Vercel, connect the Upstash Redis integration (see README) and redeploy.";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin, player, points, reason, id } = (body ?? {}) as {
    pin?: unknown;
    player?: unknown;
    points?: unknown;
    reason?: unknown;
    id?: unknown;
  };

  if (!checkPin(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  try {
    if (typeof id === "string" && id) {
      return NextResponse.json(await removeDeduction(id));
    }

    if (typeof player !== "string" || !PLAYERS.includes(player)) {
      return NextResponse.json({ error: "Unknown player" }, { status: 400 });
    }
    if (typeof points !== "number" || !Number.isInteger(points) || points < 1 || points > 99) {
      return NextResponse.json(
        { error: "Deduction must be a whole number of points between 1 and 99" },
        { status: 400 }
      );
    }

    const text = typeof reason === "string" ? reason.trim().slice(0, 140) : "";
    return NextResponse.json(await addDeduction({ player, points, reason: text }));
  } catch (err) {
    console.error("Failed to update deductions:", err);
    return NextResponse.json({ error: STORAGE_ERROR }, { status: 500 });
  }
}
