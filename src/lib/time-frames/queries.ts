// src/lib/time-frames/queries.ts
//
// Server-side DB access for time_frame_setting (Slice #20.19).

import { db } from "@/db";
import { timeFrameSetting } from "@/db/schema";
import type { TimeFrameKey, TimeFrameMap, TimeFrameRow } from "./config";
import { TIME_FRAME_DEFAULTS } from "./config";

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Return all rows as an array (for the API route). */
export async function getAllTimeFrameRows(): Promise<TimeFrameRow[]> {
  const rows = await db.select().from(timeFrameSetting);
  return rows.map((r) => ({
    key:           r.key,
    value:         r.value,
    unit:          r.unit as TimeFrameRow["unit"],
    labelEn:       r.labelEn,
    labelRo:       r.labelRo,
    descriptionEn: r.descriptionEn ?? null,
    descriptionRo: r.descriptionRo ?? null,
    updatedAt:     r.updatedAt.toISOString(),
  }));
}

/**
 * Return a key-indexed map of all settings.
 * Falls back to hard-coded defaults for missing keys so callers never need to
 * guard for undefined.
 */
export async function getTimeFrameSettings(): Promise<TimeFrameMap> {
  const rows = await getAllTimeFrameRows();
  const map = {} as TimeFrameMap;

  // Seed with defaults so every key is always present.
  for (const key of Object.keys(TIME_FRAME_DEFAULTS) as TimeFrameKey[]) {
    const d = TIME_FRAME_DEFAULTS[key];
    map[key] = {
      key,
      value:         d.value,
      unit:          d.unit,
      labelEn:       key,
      labelRo:       key,
      descriptionEn: null,
      descriptionRo: null,
      updatedAt:     new Date(0).toISOString(),
    };
  }

  // Overwrite with actual DB values.
  for (const row of rows) {
    map[row.key as TimeFrameKey] = row;
  }

  return map;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface UpsertTimeFrameInput {
  key: string;
  value: number;
}

/** Upsert a single key/value pair (does not change unit or labels). */
export async function upsertTimeFrameSetting(
  input: UpsertTimeFrameInput,
): Promise<void> {
  await db
    .insert(timeFrameSetting)
    .values({
      key:       input.key,
      value:     input.value,
      // These will be set to defaults by DB on first insert;
      // on conflict (existing row) we only update value + updatedAt.
      unit:      "days",
      labelEn:   input.key,
      labelRo:   input.key,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: timeFrameSetting.key,
      set: {
        value:     input.value,
        updatedAt: new Date(),
      },
    });
}

/** Batch upsert — used by the PATCH /api/time-frames route. */
export async function upsertTimeFrameSettings(
  inputs: UpsertTimeFrameInput[],
): Promise<void> {
  await Promise.all(inputs.map(upsertTimeFrameSetting));
}
