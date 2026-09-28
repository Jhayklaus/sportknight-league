import { NextResponse } from "next/server";
import { loadLeague } from "@/lib/store";
import { toPublicLeague } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Public read. The admin code hash is never sent to the client. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const league = await loadLeague(slug);
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
    return NextResponse.json({ league: toPublicLeague(league) });
  } catch (err) {
    console.error("Failed to read league:", err);
    return NextResponse.json({ error: "Could not read league data" }, { status: 500 });
  }
}
