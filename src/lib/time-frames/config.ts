// src/lib/time-frames/config.ts
//
// Pure types and utilities for the time_frame_setting feature (Slice #20.19).
// Safe to import from both client and server modules.

export type TimeFrameUnit = "days" | "hours" | "minutes" | "months";

export interface TimeFrameRow {
  key: string;
  value: number;
  unit: TimeFrameUnit;
  labelEn: string;
  labelRo: string;
  descriptionEn: string | null;
  descriptionRo: string | null;
  updatedAt: string; // ISO string — serialisable across the API boundary
}

/** All known time-frame keys, as a const enum so consumers get autocomplete. */
export const TIME_FRAME_KEYS = [
  "dashboard_recent_days",
  "dashboard_expiring_docs",
  "dashboard_stale_metadata",
  "dashboard_expiring_amber",
  "documents_expiring_soon",
  "metadata_review_warning",
  "id_card_expiring_soon",
  "recency_badge_red",
  "recency_badge_amber",
  "recency_badge_window",
] as const;

export type TimeFrameKey = (typeof TIME_FRAME_KEYS)[number];

/** A record of all settings keyed by their key string. */
export type TimeFrameMap = Record<TimeFrameKey, TimeFrameRow>;

/**
 * Convert a time-frame value+unit to milliseconds.
 * Used client-side by recency-badge.tsx.
 */
export function toMs(value: number, unit: TimeFrameUnit): number {
  switch (unit) {
    case "minutes": return value * 60 * 1000;
    case "hours":   return value * 60 * 60 * 1000;
    case "days":    return value * 24 * 60 * 60 * 1000;
    case "months":  return value * 30 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Fallback values used when the DB is unreachable or a key is missing.
 * Must match the seeded defaults in migration_063.
 */
export const TIME_FRAME_DEFAULTS: Record<TimeFrameKey, { value: number; unit: TimeFrameUnit }> = {
  dashboard_recent_days:    { value: 7,  unit: "days" },
  dashboard_expiring_docs:  { value: 60, unit: "days" },
  dashboard_stale_metadata: { value: 90, unit: "days" },
  dashboard_expiring_amber: { value: 14, unit: "days" },
  documents_expiring_soon:  { value: 30, unit: "days" },
  metadata_review_warning:  { value: 90, unit: "days" },
  id_card_expiring_soon:    { value: 90, unit: "days" },
  recency_badge_red:        { value: 5,  unit: "minutes" },
  recency_badge_amber:      { value: 15, unit: "minutes" },
  recency_badge_window:     { value: 30, unit: "minutes" },
};

/** Read a numeric day-value from a TimeFrameMap (falls back to default). */
export function getDays(map: TimeFrameMap | null, key: TimeFrameKey): number {
  if (!map) return TIME_FRAME_DEFAULTS[key].value;
  const row = map[key];
  if (!row) return TIME_FRAME_DEFAULTS[key].value;
  // For day-based keys the unit should always be "days", but guard anyway.
  return row.value;
}

/** Read a value in milliseconds from a TimeFrameMap (falls back to default). */
export function getMs(map: TimeFrameMap | null, key: TimeFrameKey): number {
  if (!map) return toMs(TIME_FRAME_DEFAULTS[key].value, TIME_FRAME_DEFAULTS[key].unit);
  const row = map[key];
  if (!row) return toMs(TIME_FRAME_DEFAULTS[key].value, TIME_FRAME_DEFAULTS[key].unit);
  return toMs(row.value, row.unit);
}

// ---------------------------------------------------------------------------
// The client-side rule for a typed value                        (Slice #32.18)
// ---------------------------------------------------------------------------

/** Smallest and largest value the editor and the API both accept. */
export const TIME_FRAME_MIN = 1;
export const TIME_FRAME_MAX = 3650;

/**
 * Read a value typed into the Settings editor, or `null` if it is not one.
 *
 * This exists to agree with `z.number().int().min(1).max(3650)` in
 * `src/app/api/time-frames/route.ts`, which is the rule that actually holds.
 * The screen used to check with `parseInt(raw, 10)`, and `parseInt("7.9")` is
 * `7` — so a fraction was not rejected, it was TRUNCATED, the request carried
 * the whole number, the server was satisfied, and the user was told the save
 * had succeeded while the value they typed was gone.
 *
 * `Number()` rather than `parseInt` is the whole fix: it reads the string as a
 * whole or not at all, so `Number.isInteger` can see the fraction that
 * `parseInt` has already thrown away. Everything else here is guarding
 * `Number`'s own edges rather than adding rules of its own —
 * `Number("")` and `Number("   ")` are both `0`, which the range check would
 * catch, but only by accident and with a message about a range; and
 * `Number("7.0")` is `7`, an integer, which is correct and is accepted.
 * `Number("1e3")` is `1000`, likewise an integer and likewise accepted — the
 * server would accept it too, and this function's job is to agree with the
 * server, not to be stricter than it.
 */
export function parseTimeFrameDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return null;
  if (n < TIME_FRAME_MIN || n > TIME_FRAME_MAX) return null;
  return n;
}
