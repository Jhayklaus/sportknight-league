import { NextResponse } from "next/server";
import { checkPin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { pin } = (body ?? {}) as { pin?: unknown };
  if (!checkPin(pin)) {
    return NextResponse.json({ ok: false, error: "Invalid PIN" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
