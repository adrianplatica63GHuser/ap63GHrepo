// src/app/api/time-frames/route.ts
//
// GET  /api/time-frames  — return all time-frame settings as a JSON array
// PATCH /api/time-frames — upsert an array of { key, value } objects

import { NextResponse } from "next/server";
import { getAllTimeFrameRows, upsertTimeFrameSettings } from "@/lib/time-frames/queries";
import { z } from "zod/v4";

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const rows = await getAllTimeFrameRows();
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("[time-frames] GET error:", err);
    return NextResponse.json({ error: "Failed to load time frame settings" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH
// ---------------------------------------------------------------------------

const PatchSchema = z.object({
  settings: z.array(
    z.object({
      key:   z.string().min(1),
      value: z.number().int().min(1).max(3650),
    }),
  ).min(1),
});

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.issues }, { status: 400 });
  }

  try {
    await upsertTimeFrameSettings(parsed.data.settings);
    const rows = await getAllTimeFrameRows();
    return NextResponse.json({ items: rows });
  } catch (err) {
    console.error("[time-frames] PATCH error:", err);
    return NextResponse.json({ error: "Failed to save time frame settings" }, { status: 500 });
  }
}
