// src/app/api/time-frames/route.ts
//
// GET  /api/time-frames  — return all time-frame settings as a JSON array
// PATCH /api/time-frames — upsert an array of { key, value } objects

import { NextResponse } from "next/server";
import { getAllTimeFrameRows, upsertTimeFrameSettings } from "@/lib/time-frames/queries";
import { z } from "zod/v4";
import { requireFullAccess } from "@/lib/auth/current-role";
import {
  HUNDREDTHS_MAX,
  HUNDREDTHS_MIN,
  MAKE_ROOM_DELAY_KEY,
  MAP_EXPAND_KEYS,
  MAP_SEARCH_ARC_KEY,
  MAP_SEARCH_FLIGHT_KEY,
  MAP_SEARCH_FLIGHT_MAX_MS,
  WORKFLOW_HIGHLIGHT_KEY,
  SECONDS_MAX_MS,
  SECONDS_MIN_MS,
} from "@/lib/time-frames/config";

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

// Slice 39.92: the make-room delay is stored in ms and has its own range (0,2 s – 10 s); every other key keeps 1..3650.
// Slice 41.75: „Hartă extinsă"'s two parts are stored in ms too, from 0 (the part skipped) to 10 s.
// Slice 41.76: the search flight in ms, 0..15 s; its coefficient a in hundredths, 0..300.
// Slice 41.98: the wizard's highlight in ms, 0..10 s.
const IN_MS: readonly string[] = [MAKE_ROOM_DELAY_KEY, ...MAP_EXPAND_KEYS, MAP_SEARCH_FLIGHT_KEY, MAP_SEARCH_ARC_KEY, WORKFLOW_HIGHLIGHT_KEY];
const PatchSchema = z.object({
  settings: z.array(
    z.union([
      z.object({
        key:   z.literal(MAKE_ROOM_DELAY_KEY),
        value: z.number().int().min(SECONDS_MIN_MS).max(SECONDS_MAX_MS),
      }),
      z.object({
        key:   z.enum(MAP_EXPAND_KEYS),
        value: z.number().int().min(0).max(SECONDS_MAX_MS),
      }),
      z.object({
        key:   z.literal(MAP_SEARCH_FLIGHT_KEY),
        value: z.number().int().min(0).max(MAP_SEARCH_FLIGHT_MAX_MS),
      }),
      z.object({
        key:   z.literal(WORKFLOW_HIGHLIGHT_KEY),
        value: z.number().int().min(0).max(SECONDS_MAX_MS),
      }),
      z.object({
        key:   z.literal(MAP_SEARCH_ARC_KEY),
        value: z.number().int().min(HUNDREDTHS_MIN).max(HUNDREDTHS_MAX),
      }),
      z.object({
        key:   z.string().min(1).refine((k) => !IN_MS.includes(k)),
        value: z.number().int().min(1).max(3650),
      }),
    ]),
  ).min(1),
});

export async function PATCH(req: Request) {
  // Full access only (superuser-only until #38.21) — FU-222, Slice #37.03: its only screen is „Setări" (/admin/settings).
  const denied = await requireFullAccess();
  if (denied) return denied;

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
