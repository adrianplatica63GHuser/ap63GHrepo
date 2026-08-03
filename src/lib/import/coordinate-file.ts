/**
 * src/lib/import/coordinate-file.ts
 *
 * Pure helpers for Slice #23.00.Import — "the picked folder IS one Property".
 *
 * Two jobs, both deliberately dumb:
 *
 *  1. `coordinateCandidates` — find the files in a walked folder that COULD be
 *     a Stereo 70 cadastral coordinate export, by extension alone. It does not
 *     read or parse them; whether a candidate actually contains coordinates is
 *     decided by POSTing it to /api/properties/parse-text and counting the
 *     corners that come back. A `.csv` of contact details and a `.csv` of
 *     corners are indistinguishable by name, so the extension filter is only
 *     ever a shortlist for the user to choose from — never an answer.
 *
 *  2. `nicknameFromFolderName` — turn the picked folder's name into a default
 *     Property nickname. It only tidies whitespace and underscores.
 *
 *     It deliberately does NOT expand abbreviations the way
 *     `folderNameToTitleHint` does (that is for document titles, where "CVC"
 *     really does mean "Contract de Vânzare-Cumpărare"), and it deliberately
 *     does NOT parse anything cadastral out of the name. Slice #23.00.Import
 *     retired the digit-prefix heuristic from the wizard precisely because
 *     "3 Calea Victoriei" and "2024-Arhiva" were being read as
 *     <tarla>-<parcela>. The folder name is a label, nothing more; tarla and
 *     parcela are typed by a human on the Property form.
 */

import type { FSEntry, FSFileEntry } from "./folder-utils";
import { extOf } from "./folder-utils";

// ---------------------------------------------------------------------------
// Coordinate-file candidates
// ---------------------------------------------------------------------------

/**
 * Extensions a cadastral coordinate export is plausibly delivered in.
 *
 * Matches TEXT_EXTS_SET in bulk-import-dialog.tsx — the same four extensions
 * the import surface has always treated as "plain text, might be coordinates".
 */
export const COORDINATE_FILE_EXTS: ReadonlySet<string> = new Set([
  ".txt",
  ".csv",
  ".dat",
  ".asc",
]);

/** True when `name`'s extension is one a coordinate export might use. */
export function isCoordinateFileName(name: string): boolean {
  return COORDINATE_FILE_EXTS.has(extOf(name));
}

/**
 * Every walked entry that could be a coordinate file, in walk order.
 *
 * Page-group entries are never candidates: a page group is by definition a
 * folder of sequentially-numbered IMAGES (see `isPageGroup`), so it can never
 * hold a text export.
 *
 * Returns [] when the folder holds none — a perfectly normal case (a folder of
 * scanned deeds with no cadastral file), which the caller renders as "no
 * coordinate file found" rather than as an error.
 */
export function coordinateCandidates(entries: FSEntry[]): FSFileEntry[] {
  const out: FSFileEntry[] = [];
  for (const entry of entries) {
    if (entry.kind !== "file") continue;
    if (isCoordinateFileName(entry.name)) out.push(entry);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Default nickname
// ---------------------------------------------------------------------------

/**
 * Default Property nickname for a picked folder.
 *
 * Underscores become spaces, runs of whitespace collapse to one, and the
 * result is trimmed. Everything else — digits, dashes, diacritics, casing —
 * is left exactly as the user named the folder, because the user is the one
 * who will recognise it in a list.
 *
 * The caller always shows the result in an editable field; this is a starting
 * point, not a decision.
 *
 *   "47per2-225per3per24-2716 Prisecaru" -> "47per2-225per3per24-2716 Prisecaru"
 *   "Teren_Bragadiru_2024"               -> "Teren Bragadiru 2024"
 *   "  3 Calea   Victoriei  "            -> "3 Calea Victoriei"
 *   ""                                   -> ""
 */
export function nicknameFromFolderName(name: string): string {
  return name.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Corner-set identity  (Slice #23.02.Import)
// ---------------------------------------------------------------------------

/**
 * A parsed corner, in the shape POST /api/properties/parse-text returns and
 * PATCH /api/properties/[id] accepts. `originalIndex` is carried by both but is
 * deliberately absent here — see `cornersEqual`.
 */
export type ParsedCorner = { lat: number; lon: number };

/**
 * Largest difference in decimal degrees still counted as the same point.
 *
 * 1e-9 degrees is roughly 0.1 mm on the ground: far below any precision a
 * cadastral survey claims, and far above the float noise a JSON round-trip
 * through the API can introduce.
 */
export const CORNER_EPSILON_DEG = 1e-9;

function sameCoord(x: number, y: number): boolean {
  // NaN and Infinity are never "the same point" as anything, including
  // themselves — a corner that failed to parse must not compare equal to
  // another one that also failed.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) <= CORNER_EPSILON_DEG;
}

/**
 * True when two ordered corner lists describe the same polygon.
 *
 * Slice #23.02.Import uses this to answer one question: "did this property's
 * corners already come from this very coordinate file?" If they did, the row
 * says so and writes nothing — PATCHing identical corners would append a new
 * property_version recording a change nobody made.
 *
 * Two deliberate decisions:
 *
 *  - **Order is significant.** [A, B, C] and [C, B, A] are NOT equal. The
 *    corner sequence IS the polygon's edge order, so a reorder is a real edit
 *    (it is exactly how the bow-tie fix works). Treating a reordered list as
 *    "already applied" would silently refuse to restore a file's original
 *    order after someone shuffled it.
 *
 *  - **`originalIndex` is ignored.** It is provenance metadata travelling with
 *    a corner, not geometry. The same points re-exported with different labels
 *    still describe the same land.
 */
export function cornersEqual(
  a: readonly ParsedCorner[],
  b: readonly ParsedCorner[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!sameCoord(a[i].lat, b[i].lat)) return false;
    if (!sameCoord(a[i].lon, b[i].lon)) return false;
  }
  return true;
}
