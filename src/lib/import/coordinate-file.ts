/**
 * src/lib/import/coordinate-file.ts
 *
 * Pure helpers for the import wizard's property step.
 *
 * WHAT LIVES HERE
 * ───────────────
 *
 *  1. `coordinateCandidates` / `isCoordinateFileName` — find the files in a
 *     walked folder that COULD be a Stereo 70 cadastral coordinate export, by
 *     extension alone. They do not read or parse anything; whether a candidate
 *     actually contains coordinates is decided by POSTing it to
 *     /api/properties/parse-text and counting the corners that come back. A
 *     `.txt` of contact details and a `.txt` of corners are indistinguishable
 *     by name, so the extension filter is only ever a shortlist for the user to
 *     choose from — never an answer.
 *
 *  2. `coordinateNameConfidence` — Slice #23.07.Import. How well a candidate's
 *     NAME matches the convention Adrian's coordinate files follow ("coord
 *     47per2-225per3per24-2716.txt").
 *
 *     ⚠️ **The name is a ranking signal and a warning. It is never a filter.**
 *     Only the parse decides whether a file is usable: a correctly-formed
 *     export with an unconventional name still imports, and nothing here
 *     narrows the extension shortlist above. What the confidence buys is (a) a
 *     tie-break when two files both parse, so the user is not asked a question
 *     the naming convention already answers, and (b) a quiet note when the one
 *     usable file breaks the convention — Adrian's "the creator of the file may
 *     have made a mistake" case, surfaced rather than silently accepted.
 *
 *  3. `nicknameFromFolderName` — turn the picked folder's name into a default
 *     Property nickname. It only tidies whitespace and underscores.
 *
 *     It deliberately does NOT expand abbreviations the way
 *     `folderNameToTitleHint` does (that is for document titles, where "CVC"
 *     really does mean "Contract de Vânzare-Cumpărare"), and it deliberately
 *     decodes nothing cadastral: a nickname is a label the user recognises in a
 *     list, so "47per2-225per3per24-2716 Prisecaru" stays verbatim.
 *
 *  4. `cadastralSuggestionFromFolderName` — Slice #23.07.Import. A SUGGESTED
 *     tarla/parcela pair for the create-new-Property branch, derived from the
 *     picked folder name via `parseFolderName`.
 *
 *     ⚠️ **This is not a reintroduction of the retired digit-prefix
 *     heuristic**, and CLAUDE.md's standing "do not reintroduce
 *     `parseFolderName` into the import wizard" rule is intact. That rule
 *     forbids a silent INFERENCE — Slice #23.00.Import retired the heuristic
 *     because the wizard wrote tarla "3" for "3 Calea Victoriei" and tarla
 *     "2024" / parcela "Arhiva" for "2024-Arhiva" without ever showing the user
 *     what it had decided. What this returns is a SUGGESTION: it lands in two
 *     visible, editable, explicitly-labelled inputs that the user confirms
 *     before anything is written, and an unparseable name yields two blank
 *     fields rather than a guess. A value the user can see and correct before
 *     it is saved is a different thing from a value the system decides alone.
 *
 *  5. `cornersEqual` / `CORNER_EPSILON_DEG` — corner-set identity, so a row can
 *     tell "these corners already came from this very file" from "these are
 *     different corners" without burning a property_version on a no-op.
 */

import type { FSEntry, FSFileEntry } from "./folder-utils";
import { parseFolderName, perToSlash } from "./folder-utils";
import { extensionsOfKind, isFileKind } from "@/lib/files/file-kinds";
import { foldRomanian } from "./id-card";

// ---------------------------------------------------------------------------
// Coordinate-file candidates
// ---------------------------------------------------------------------------

/**
 * Extensions a cadastral coordinate export is plausibly delivered in.
 *
 * ⚠️ This is a DERIVED VIEW, not a list. The membership lives in the
 * `"coordinate-candidate"` kind in src/lib/files/file-kinds.ts (Slice #24.03),
 * which is the only place it can be changed. The constant survives because
 * callers and tests already import it by this name, and a shortlist is easier
 * to read as a set than as a kind query.
 *
 * Slice #24.03 narrowed the shortlist from four extensions to one, on Adrian's
 * decision: `.dat` and `.asc` were coordinate candidates and nothing else,
 * which made them the only coordinate extensions that could not also infer a
 * provenance; `.csv` followed, because a cadastral export arrives as a `.txt`.
 *
 * What did NOT change is the rule one section down: the NAME still ranks and
 * warns and is never a filter. Narrowing the extension shortlist and turning
 * the name into a gate are different decisions, and only the first was taken.
 *
 * Slice #23.07.Import deliberately left this list untouched. The name
 * convention ranks and warns; it does not shorten the shortlist.
 */
export const COORDINATE_FILE_EXTS: ReadonlySet<string> =
  extensionsOfKind("coordinate-candidate");

/** True when `name`'s extension is one a coordinate export might use. */
export function isCoordinateFileName(name: string): boolean {
  return isFileKind(name, "coordinate-candidate");
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
// Name-convention confidence  (Slice #23.07.Import)
// ---------------------------------------------------------------------------

/**
 * How much the file NAME agrees that this is a coordinate export.
 *
 *  - `"strong"` — the extension is in the shortlist AND the name follows the
 *    convention. Both signals agree.
 *  - `"weak"`   — the extension is in the shortlist but the name does not
 *    follow the convention. Still perfectly importable; worth a quiet note.
 *  - `"none"`   — the extension is not one a coordinate export uses, so the
 *    file was never a candidate in the first place.
 */
export type CoordinateNameConfidence = "strong" | "weak" | "none";

/**
 * The prefix Adrian's coordinate files start with, in folded form.
 *
 * Compared against `foldRomanian(name)`, so "COORD", "Coord" and a name with
 * leading whitespace all match. It also matches the longer Romanian spelling
 * ("coordonate …"), which is the same convention written out.
 */
export const COORDINATE_NAME_PREFIX = "coord";

/**
 * Does this file name follow the coordinate-file naming convention?
 *
 * Two independent signals, and the answer says which of them agree:
 * the extension (already the shortlist rule) and the name's opening word.
 * Adrian's example is `coord 47per2-225per3per24-2716.txt` — a name that
 * carries the convention AND the cadastral identifiers.
 *
 * Why a folded prefix comparison and not a regex
 * ----------------------------------------------
 * `foldRomanian` (src/lib/import/id-card.ts) lowercases, trims, collapses
 * whitespace and strips diacritics via NFD — which covers both the comma-below
 * (U+0219/U+021B) and cedilla (U+015F/U+0163) encodings of ș/ț that appear in
 * real data. On the folded string a plain `startsWith` is the whole test.
 *
 * ⚠️ Never reach for `\b` here. JavaScript's word-boundary assertion is defined
 * over the ASCII word set, so it does not count ă â î ș ț as word characters at
 * all — `/\bÎnch\b/i` can never match a string starting with "Î", and the
 * symptom is a silent non-match that reads like a missing dictionary entry
 * rather than a regex bug (CLAUDE.md records the slice that cost). Where a
 * boundary really is needed, use Unicode-property lookarounds
 * `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` with the `u` flag. Here nothing is
 * needed: the question is only "how does the name START", and a prefix
 * comparison on the folded string answers it outright.
 */
export function coordinateNameConfidence(name: string): CoordinateNameConfidence {
  if (!isCoordinateFileName(name)) return "none";
  return foldRomanian(name).startsWith(COORDINATE_NAME_PREFIX) ? "strong" : "weak";
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
// Cadastral suggestion  (Slice #23.07.Import)
// ---------------------------------------------------------------------------

/**
 * A suggested tarla/parcela pair. `""` means "nothing to suggest" — the caller
 * binds both straight to text inputs, and an empty input is the honest answer
 * to a folder name that carries no cadastral identifiers.
 */
export type CadastralSuggestion = {
  tarlaSola: string;
  parcela: string;
};

/**
 * Suggest tarla and parcela from the picked folder's name.
 *
 * Composes two existing, already-tested helpers and adds no new guessing of
 * its own:
 *
 *   - `parseFolderName` decides whether the name looks cadastral at all (it
 *     must start with a digit) and splits it into `<tarla>-<parcela>-<rest>`;
 *   - `perToSlash` turns the filesystem-safe encoding into the form the DB
 *     stores, because "/" cannot appear in a folder name: "47per2" -> "47/2",
 *     "225per3per24" -> "225/3/24".
 *
 * The `perToSlash` step is what makes this path agree with the OTHER one.
 * `/api/documents/[id]/process` has always applied it before writing
 * `tarla_sola` / `parcela`, so a Property built there holds "47/2". Suggesting
 * the raw "47per2" here would have produced two Properties whose cadastral
 * identifiers differ only in encoding — the asymmetry this slice exists to
 * remove, reintroduced one layer down.
 *
 * The bar for suggesting anything is the FULL "<tarla>-<parcela>" shape, not
 * merely `parseFolderName`'s leading-digit test. With no separator the parser
 * hands back the entire name as the tarla — "3 Calea Victoriei" becomes tarla
 * "3 Calea Victoriei" — which is the #23.00 false positive wearing a different
 * hat, and there is no parcela to go with it either way. Requiring the
 * separator costs nothing real (Adrian's folders all carry it) and keeps a
 * street address out of a cadastral field.
 *
 * What it does NOT do is decide whether the two halves are plausible. A name
 * like "2024-Arhiva" still suggests tarla "2024" / parcela "Arhiva", and that
 * is the design working rather than failing: the values land in two labelled,
 * editable inputs, the user sees them before anything is written, and clearing
 * them is one keystroke. The failure mode #23.00 retired was not a wrong guess
 * — it was a wrong guess nobody was shown.
 *
 * A name that does not parse yields two empty strings, and a blank field is
 * the honest answer to a folder name that carries no cadastral identifiers.
 *
 *   "47per2-225per3per24-2716 Prisecaru" -> { tarlaSola: "47/2", parcela: "225/3/24" }
 *   "2024-Arhiva"                        -> { tarlaSola: "2024", parcela: "Arhiva" }
 *   "3 Calea Victoriei"                  -> { tarlaSola: "", parcela: "" }
 *   "Documente generale"                 -> { tarlaSola: "", parcela: "" }
 */
export function cadastralSuggestionFromFolderName(name: string): CadastralSuggestion {
  const parsed = parseFolderName(name);
  // `parcela` is only set when parseFolderName found a "-" separator, so this
  // one test enforces the whole "<tarla>-<parcela>" shape.
  if (!parsed.isPropertyFolder || !parsed.parcela) return { tarlaSola: "", parcela: "" };
  return {
    tarlaSola: parsed.tarlaSola ? perToSlash(parsed.tarlaSola).trim() : "",
    parcela: parsed.parcela ? perToSlash(parsed.parcela).trim() : "",
  };
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
