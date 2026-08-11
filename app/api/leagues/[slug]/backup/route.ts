import { NextResponse } from "next/server";
import { loadLeague, replaceLeagueData } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const league = await loadLeague(slug);
    if (!league) return NextResponse.json({ error: "League not found" }, { status: 404 });
    const { auth, ...safe } = league;
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(
      JSON.stringify({ exportedAt: new Date().toISOString(), ...safe }, null, 2),
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${slug}-backup-${stamp}.json"`,
        },
      }
    );
  } catch (err) {
    console.error("Backup export failed:", err);
    return NextResponse.json({ error: "Could not read league data" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { body } = result;

  const backup = body.backup;
  if (!backup || typeof backup !== "object") {
    return NextResponse.json({ error: "Backup file is not valid JSON" }, { status: 400 });
  }
  const doc = backup as Record<string, unknown>;
  if (!doc.scores || typeof doc.scores !== "object") {
    return NextResponse.json(
      { error: "Backup is missing its scores — is this a SportKnight backup file?" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json({ league: await replaceLeagueData(slug, doc) });
  } catch (err) {
    return serverError(err, "Backup restore failed");
  }
}
