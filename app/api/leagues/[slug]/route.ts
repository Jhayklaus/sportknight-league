import { NextResponse } from "next/server";
import { loadLeague } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public read. The admin code hash is never sent to the client. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const league = await loadLeague(slug);
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
    const { auth, ...safe } = league;
    return NextResponse.json({ league: { ...safe, hasCustomCode: auth !== null } });
  } catch (err) {
    console.error("Failed to read league:", err);
    return NextResponse.json({ error: "Could not read league data" }, { status: 500 });
  }
}
