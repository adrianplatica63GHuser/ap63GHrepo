// src/lib/time-frames/config.ts
//
// Pure types and utilities for the time_frame_setting feature (Slice #20.19).
// Safe to import from both client and server modules.

/**
 * Slice 39.92: "milliseconds" — the make-room delay, typed and shown in seconds with decimals.
 * Slice 41.76: "hundredths" — a number that is not a time, the search flight's coefficient a, typed and shown with two
 * decimals and stored ×100 so the column stays an integer (1,00 is 100).
 */
export type TimeFrameUnit = "days" | "hours" | "minutes" | "months" | "milliseconds" | "hundredths";

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
  "tile_make_room_delay",
  // Slice 41.75: „Hartă extinsă" opens in two animated parts, each its own length.
  "map_expand_grow",
  "map_expand_zoom_out",
  // Slice 41.76: „Caută pe hartă"'s flight — its length and the parabola's coefficient a.
  "map_search_flight",
  "map_search_arc",
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
    case "milliseconds": return value;
    // Not a time: a coefficient's hundredths have no length. Read with `getHundredths`.
    case "hundredths": return 0;
  }
}

/**
 * Fallback values used when the DB is unreachable or a key is missing.
 * Must match the seeded defaults in migration_063 — and migration_117 for the
 * make-room delay (Slice 39.92), migration_127 for „Hartă extinsă"'s two parts (Slice 41.75), migration_128 for the
 * search flight's length and arc (Slice 41.76).
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
  tile_make_room_delay:     { value: 1000, unit: "milliseconds" },
  map_expand_grow:          { value: 3000, unit: "milliseconds" },
  map_expand_zoom_out:      { value: 3000, unit: "milliseconds" },
  map_search_flight:        { value: 4000, unit: "milliseconds" },
  map_search_arc:           { value: 100,  unit: "hundredths" },
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

// ---------------------------------------------------------------------------
// Seconds with decimals                                          (Slice 39.92)
// ---------------------------------------------------------------------------

/** The make-room delay's key: how long a dragged tile is held over another before that one makes room (39.91). */
export const MAKE_ROOM_DELAY_KEY = "tile_make_room_delay" satisfies TimeFrameKey;

/** The range the editor and the API both accept for a value typed in seconds, in ms: 0,2 s to 10 s. */
export const SECONDS_MIN_MS = 200;
export const SECONDS_MAX_MS = 10_000;

/** Is a row of this unit typed and shown in seconds, with decimals? Stored in ms, so the column stays an integer. */
export function isTypedInSeconds(unit: TimeFrameUnit): boolean {
  return unit === "milliseconds";
}

/**
 * Slice 41.75: „Hartă extinsă"'s two parts, typed in seconds like the make-room delay, but from 0 — a part of 0 is
 * skipped — to 10 s.
 */
export const MAP_EXPAND_KEYS = ["map_expand_grow", "map_expand_zoom_out"] as const satisfies readonly TimeFrameKey[];

/** Slice 41.76: the search flight's length — 0 (a jump) to 15 s. */
export const MAP_SEARCH_FLIGHT_KEY = "map_search_flight" satisfies TimeFrameKey;
export const MAP_SEARCH_FLIGHT_MAX_MS = 15_000;

/**
 * The range a key typed in seconds accepts, in ms: 0,2 s – 10 s for the make-room delay, 0 – 10 s for „Hartă extinsă"'s
 * parts, 0 – 15 s for the search flight.
 */
export function secondsRangeMs(key: string): { min: number; max: number } {
  if (key === MAP_SEARCH_FLIGHT_KEY) return { min: 0, max: MAP_SEARCH_FLIGHT_MAX_MS };
  return (MAP_EXPAND_KEYS as readonly string[]).includes(key) ? { min: 0, max: SECONDS_MAX_MS } : { min: SECONDS_MIN_MS, max: SECONDS_MAX_MS };
}

/**
 * Read seconds typed with a comma or a dot — „1,5" or „1.5" — up to two
 * decimals, as ms; `null` if it is not one, or outside 0,2 s – 10 s. Whole
 * seconds („2") are accepted; „1e3", a sign, a third decimal or a space inside
 * are not: the field says seconds, and anything else is a mistyping.
 */
export function parseSecondsDraft(raw: string, range: { min: number; max: number } = { min: SECONDS_MIN_MS, max: SECONDS_MAX_MS }): number | null {
  const trimmed = raw.trim();
  if (!/^\d{1,2}(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const ms = Math.round(Number(trimmed.replace(",", ".")) * 1000);
  return ms >= range.min && ms <= range.max ? ms : null;
}

/** A value in ms as the editor shows it: seconds, one or two decimals, the locale's separator („1,5" / „1.5"). */
export function formatSeconds(ms: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: false }).format(ms / 1000);
}

// ---------------------------------------------------------------------------
// Hundredths — a coefficient with two decimals                    (Slice 41.76)
// ---------------------------------------------------------------------------

/** The search flight's parabola coefficient a, stored in hundredths: 0,00 to 3,00. */
export const MAP_SEARCH_ARC_KEY = "map_search_arc" satisfies TimeFrameKey;
export const HUNDREDTHS_MIN = 0;
export const HUNDREDTHS_MAX = 300;

/** Is a row of this unit typed and shown as a number with two decimals? */
export function isTypedInHundredths(unit: TimeFrameUnit): boolean {
  return unit === "hundredths";
}

/**
 * Read a coefficient typed with a comma or a dot — „1,5", „1.25", „2" — as hundredths; `null` if it is not one, or
 * outside 0,00 – 3,00. As with seconds, a sign, „1e3", a third decimal or a space inside are refused.
 */
export function parseHundredthsDraft(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  const v = Math.round(Number(trimmed.replace(",", ".")) * 100);
  return v >= HUNDREDTHS_MIN && v <= HUNDREDTHS_MAX ? v : null;
}

/** Hundredths as the editor shows them: two decimals, the locale's separator („1,00" / „1.00"). */
export function formatHundredths(v: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(v / 100);
}
