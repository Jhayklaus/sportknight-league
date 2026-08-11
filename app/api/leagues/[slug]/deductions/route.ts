import { NextResponse } from "next/server";
import { addDeduction, removeDeduction } from "@/lib/store";
import { authorise, serverError } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await authorise(request, slug);
  if ("error" in result) return result.error;
  const { league, body } = result;

  const { player, points, reason, id } = body as {
    player?: unknown;
    points?: unknown;
    reason?: unknown;
    id?: unknown;
  };

  try {
    if (typeof id === "string" && id) {
      return NextResponse.json({ league: await removeDeduction(slug, id) });
    }
    if (typeof player !== "string" || !league.players.includes(player)) {
      return NextResponse.json({ error: "Unknown player" }, { status: 400 });
    }
    if (typeof points !== "number" || !Number.isInteger(points) || points < 1 || points > 99) {
      return NextResponse.json(
        { error: "Deduction must be a whole number of points between 1 and 99" },
        { status: 400 }
      );
    }
    const text = typeof reason === "string" ? reason.trim().slice(0, 140) : "";
    return NextResponse.json({ league: await addDeduction(slug, { player, points, reason: text }) });
  } catch (err) {
    return serverError(err, "Failed to update deductions");
  }
}
