import { NextResponse } from "next/server";
import type { LeagueState } from "@/lib/league";
import { readState, replaceState } from "@/lib/store";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Download the whole league as a JSON backup. */
export async function GET() {
  try {
    const state = await readState();
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="sportknight-backup-${stamp}.json"`,
      },
    });
  } catch (err) {
    console.error("Backup export failed:", err);
    return NextResponse.json({ error: "Could not read league data" }, { status: 500 });
  }
}

/** Restore a previously exported backup. Replaces everything. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin, backup } = (body ?? {}) as { pin?: unknown; backup?: unknown };

  if (!checkPin(pin)) {
    return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
  }

  if (!backup || typeof backup !== "object") {
    return NextResponse.json({ error: "Backup file is not valid JSON" }, { status: 400 });
  }

  const doc = backup as Partial<LeagueState>;
  if (!doc.scores || typeof doc.scores !== "object") {
    return NextResponse.json(
      { error: "Backup is missing its scores — is this a SportKnight backup file?" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(
      await replaceState({
        scores: doc.scores,
        deductions: Array.isArray(doc.deductions) ? doc.deductions : [],
        window: doc.window ?? null,
      })
    );
  } catch (err) {
    console.error("Backup restore failed:", err);
    return NextResponse.json(
      { error: "Could not save: storage is not configured (see README)." },
      { status: 500 }
    );
  }
}
