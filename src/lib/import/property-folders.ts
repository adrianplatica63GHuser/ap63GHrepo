/**
 * The chosen folder, split into the properties it holds.   (Slice #26.07)
 *
 * Pure. Handed the walk's entries, it says which property subfolder each one
 * belongs to — and therefore which Property its Document will be linked to
 * once #26.07's property step has created or found them all.
 *
 * WHY THIS EXISTS NOW AND NOT BEFORE
 * ──────────────────────────────────
 * Since #23.00 the chosen folder WAS one Property: the user named it once in a
 * dialog and every document in the run was linked to it. The redesign moved
 * that boundary. A chosen folder now holds up to five property subfolders plus
 * `common` and `floating`, so "which property is this document's?" is a
 * question per entry rather than per run, and it is answered by the first
 * segment of the entry's path and nothing else.
 *
 * ⚠️ **THE FIRST SEGMENT, NOT A SEARCH UP THE TREE.** `parseFolderName`'s
 * retired heuristic walked to the nearest digit-prefixed ancestor, which is how
 * `3 Calea Victoriei` became tarla 3. Here the property folder is at depth 1 by
 * rule — STR-04 refuses anything else at that depth, and STR-10 refuses folders
 * below a page folder — so `pathParts[0]` is the whole answer and there is
 * nothing to infer. That is the difference between reading a structure the user
 * was told to build and guessing at one they were not.
 *
 * ⚠️ **AND SINCE SLICE #28.02 THE PARSE ITSELF IS POSITIONAL, SO STR-04 REFUSES
 * MUCH LESS.** `2024-Arhiva` now parses, and what stops it becoming a Property
 * is STR-15 — a question the user answers in the Structure stage, which BLOCKS
 * until they do. This module is downstream of that block and deliberately knows
 * nothing about it: by the time anything calls `groupByPropertyFolder` for real,
 * every property folder in the grouping has either been confirmed or carries a
 * `per`. It still groups an unconfirmed folder if asked, for the same reason it
 * carries `unassigned` — a grouping function that silently dropped an entry
 * would make a file vanish between the count on the Evaluation screen and the
 * rows in the result.
 *
 * WHAT IT DOES WITH THINGS THE RULES FORBID
 * ─────────────────────────────────────────
 * It carries them, in `unassigned`, and links them to nothing. The Structure
 * stage blocks every one of them (a loose file at depth 0 is STR-01, a
 * top-level folder that is neither a property nor `common`/`floating` is
 * STR-04), so an import cannot reach here holding any — but a grouping function
 * that silently dropped an entry would make a file vanish between the count on
 * the Evaluation screen and the rows in the result, and the reader of those two
 * numbers would have no way to find out why. Everything the walk produced
 * appears in exactly one bucket.
 *
 * COMMON AND FLOATING
 * ───────────────────
 * From the source document, and neither is a guess: `common` holds documents
 * "which concern all the properties in the root folder A" and is "processed
 * after all the properties were created and will be linked to all of them";
 * `floating` holds documents "unrelated to any of the properties currently
 * imported … not linked to any Property as of now". `assignEntryProperties`
 * below is those two sentences and the per-folder one, as a map.
 */

import { sortedForDisplay } from "./folder-utils";
import type { FSEntry, FSFileEntry } from "./folder-utils";
import {
  isDeclaredCoordinateFile,
  parsePropertyFolderName,
  propertyIdentityOf,
  sharedFolderName,
  type SharedFolderName,
} from "./structure-rules";

// ---------------------------------------------------------------------------
// The grouping
// ---------------------------------------------------------------------------

/** One property subfolder and everything the walk found under it. */
export type PropertyFolderGroup = {
  /** The subfolder name, exactly as it is on disk. */
  folderName: string;
  /** As written, `per` and all — the DB boundary applies `perToSlash`, not this. */
  tarlaSola: string;
  parcela: string;
  /**
   * Everything after the SECOND dash, or null. Free text; never part of
   * identity. (It was everything after `||` until Slice #28.02 retired the
   * separator.)
   */
  description: string | null;
  /** `propertyIdentityOf`'s key — what makes two folders the same parcel. */
  identity: string;
  /** Every entry under this folder, in walk order. */
  entries: FSEntry[];
  /**
   * The folder's coordinate file, or null.
   *
   * ⚠️ **`isDeclaredCoordinateFile`, which is STR-08's definition, and NOT
   * `isCoordinateFileName`'s extension test.** The two answer different
   * questions and this is the one the rules enforce: STR-08 allows at most one
   * `coord….txt` per property folder, and the source document is explicit that
   * other `.txt` files "may be under the property subfolder and they will be
   * interpreted as business content". Shortlisting by extension here would
   * offer a user a list containing their notes file — the choice the old
   * dialog had to make because nothing had told the user to name anything.
   *
   * Null when the folder has none, which the source document also covers: "a
   * property subfolder without a coordinate file will still result in the
   * creation of a property that will not have a Polygon associated."
   */
  coordinateFile: FSFileEntry | null;
  /**
   * Every declared coordinate file, when the folder somehow holds more than
   * one. STR-08 blocks that folder, so this is length ≤ 1 in any import that
   * gets this far; it is carried so that a caller can say WHY it refused
   * rather than silently taking the first.
   */
  declaredCoordinateFiles: FSFileEntry[];
};

export type FolderGrouping = {
  /** Sorted by folder name — see the seeding loop in `groupByPropertyFolder`. */
  properties: PropertyFolderGroup[];
  /** Entries under `common`: linked to every property in this run. */
  common: FSEntry[];
  /** Entries under `floating`: linked to no property at all. */
  floating: FSEntry[];
  /** Entries the structure rules forbid. Linked to nothing; never dropped. */
  unassigned: FSEntry[];
};

/** A property folder with nothing in it yet. */
function emptyGroup(
  folderName: string,
  tarlaSola: string,
  parcela: string,
  description: string | null,
): PropertyFolderGroup {
  return {
    folderName,
    tarlaSola,
    parcela,
    description,
    // Non-null by construction: `propertyIdentityOf` returns null only for a
    // name that does not parse, and every caller here has already parsed it.
    // The `?? ""` is a type narrowing over an UNREACHABLE branch, so no test
    // can pin the value it would produce — an adversarial round changed it to
    // `"x"` and nothing went red, correctly. What is pinned, and what matters,
    // is the positive invariant: every group's identity is `propertyIdentityOf`
    // answer for its own folder name, and no two folders share one by accident.
    identity: propertyIdentityOf(folderName) ?? "",
    entries: [],
    coordinateFile: null,
    declaredCoordinateFiles: [],
  };
}

/** The top-level segment an entry sits under, or null when it sits loose. */
function topSegmentOf(entry: FSEntry): string | null {
  return entry.pathParts.length > 0 ? entry.pathParts[0] : null;
}

/**
 * Split the walked entries by the property folder they belong to.
 *
 * Order is the order the entries arrive in, for both the property list and the
 * entries inside each property. `walkFolder` sorts before it returns, so the
 * screen built from this reads the same way twice — the same promise
 * `structure-check.ts` makes about its violation list, and for the same reason:
 * the user reads this, goes to File Explorer, and reads it again.
 */
export function groupByPropertyFolder(
  entries: readonly FSEntry[],
  topLevelDirNames: readonly string[] = [],
): FolderGrouping {
  const properties: PropertyFolderGroup[] = [];
  const byName = new Map<string, PropertyFolderGroup>();
  const shared: Record<SharedFolderName, FSEntry[]> = { common: [], floating: [] };
  const unassigned: FSEntry[] = [];

  /**
   * ⚠️ **Seeded from the DIRECTORY LISTING first, and that is not tidiness.**
   *
   * The first version built this list purely by walking entries, creating a
   * group the first time a folder was seen. A property subfolder that holds no
   * importable file — genuinely empty, or holding only `Thumbs.db`, a hidden
   * file or a `.dwg` the walk drops — produces no entries, so it was never
   * seen. Nothing else covers it either: an empty folder breaks no structure
   * rule, and STR-02 counts properties from `dirNames`, so the Structure stage
   * says five properties and this said four. The user got four cards, four
   * Properties, `common` fanned out to four, and no mention anywhere of the
   * fifth — and where EVERY property folder was empty, a screen reading "this
   * folder holds no property subfolders" over a folder holding five.
   *
   * `topLevelDirNames` is the walk's own listing of the chosen folder, which is
   * the same source STR-02 counts, so the two stages can no longer disagree
   * about how many properties there are. It defaults to `[]` so a caller that
   * only has entries still gets the old behaviour rather than a type error.
   */
  // ⚠️ SORTED. `dirNames` is built before `walkFolder` sorts its children —
  // `folder-utils.ts` says so outright, and `structure-check.ts` sorts every
  // one of its lists for exactly this reason: the user reads this screen, goes
  // to File Explorer, and reads it again, and a list that reshuffles in between
  // is unusable. Seeding from the raw listing made the whole property order
  // filesystem-enumeration order, which on a FAT-formatted USB stick is
  // directory-creation order and matches nothing the user can see.
  for (const name of sortedForDisplay(topLevelDirNames)) {
    if (sharedFolderName(name) !== null) continue;
    const parsed = parsePropertyFolderName(name);
    if (!parsed.ok) continue;
    if (byName.has(name)) continue;
    const seeded = emptyGroup(name, parsed.tarla, parsed.parcela, parsed.description);
    byName.set(name, seeded);
    properties.push(seeded);
  }

  for (const entry of entries) {
    const top = topSegmentOf(entry);
    if (top === null) {
      unassigned.push(entry);
      continue;
    }

    const asShared = sharedFolderName(top);
    if (asShared !== null) {
      shared[asShared].push(entry);
      continue;
    }

    const parsed = parsePropertyFolderName(top);
    if (!parsed.ok) {
      unassigned.push(entry);
      continue;
    }

    let group = byName.get(top);
    if (group === undefined) {
      group = emptyGroup(top, parsed.tarla, parsed.parcela, parsed.description);
      byName.set(top, group);
      properties.push(group);
    }

    group.entries.push(entry);

    // A page group is a folder of numbered images and can never be a text
    // export, so only plain files are considered.
    if (entry.kind === "file" && isDeclaredCoordinateFile(entry.name)) {
      group.declaredCoordinateFiles.push(entry);
      if (group.coordinateFile === null) group.coordinateFile = entry;
    }
  }

  return { properties, common: shared.common, floating: shared.floating, unassigned };
}

// ---------------------------------------------------------------------------
// Which Property (or Properties) an entry's Document is linked to
// ---------------------------------------------------------------------------

/**
 * The Property ids each entry's Document must be linked to, keyed by entry
 * path.
 *
 * Three rules, one per bucket, and every one of them from the source document:
 *
 *   - an entry under a property folder → that folder's Property, and only it;
 *   - an entry under `common`          → EVERY property created by this run;
 *   - anything else                    → nothing.
 *
 * An entry always has a key, even when its list is empty. A `Map.get` that
 * answers `undefined` for "this file was never considered" and for "this file
 * is deliberately linked to nothing" cannot tell a bug from a floating
 * document, and the import loop is the wrong place to find that out.
 *
 * `resolvedByFolder` holds only the folders the user confirmed. A property
 * folder missing from it contributes no links rather than throwing: the
 * property step can be cancelled halfway, and the honest result of a folder
 * whose Property was never resolved is a document linked to nothing, not a
 * crash inside a loop that has already written rows.
 */
/**
 * Where an entry came from, and what it is linked to.
 *
 * ⚠️ **The bucket is carried, not inferred from the list, and an adversarial
 * round is why.** Two row actions in the import loop — "create a Person from
 * this ID card" and "apply these corners to the property" — each write to ONE
 * Property, and both were gated on "this entry has exactly one property id".
 * In the ordinary shape (one property subfolder plus `common`) a `common`
 * document HAS exactly one, so both actions were offered on it, and the
 * coordinate one opens the last remaining dialog that REPLACES a Property's
 * corners — from a file the property step had deliberately refused to treat as
 * a corner source. The list length was never the question; the bucket was.
 */
export type EntryAssignment = {
  bucket: "property" | "common" | "floating" | "unassigned";
  /** The Property ids this entry's Document is linked to. May be empty. */
  propertyIds: string[];
};

export function assignEntryProperties(
  grouping: FolderGrouping,
  resolvedByFolder: ReadonlyMap<string, string>,
): Map<string, EntryAssignment> {
  const out = new Map<string, EntryAssignment>();

  /**
   * DEDUPED, and that is not belt-and-braces.
   *
   * Two property subfolders in one chosen folder can name the same parcel —
   * `48-50D` and `48-50D-Livada` — in which case both resolve to ONE Property
   * id. STR-03 refuses that folder, so no import should reach here holding it;
   * but if it ever did, a `common` document would be associated to the same
   * Property twice, and `associateDocumentsWithProperty` would be called twice
   * for one pair. A `Set` costs nothing and makes this function's answer
   * correct on its own terms rather than on another stage's.
   */
  const allPropertyIds = [
    ...new Set(
      grouping.properties
        .map((group) => resolvedByFolder.get(group.folderName))
        .filter((id): id is string => id !== undefined),
    ),
  ];

  for (const group of grouping.properties) {
    const id = resolvedByFolder.get(group.folderName);
    const propertyIds = id === undefined ? [] : [id];
    for (const entry of group.entries) {
      out.set(entry.path, { bucket: "property", propertyIds });
    }
  }
  for (const entry of grouping.common) {
    out.set(entry.path, { bucket: "common", propertyIds: allPropertyIds });
  }
  for (const entry of grouping.floating) {
    out.set(entry.path, { bucket: "floating", propertyIds: [] });
  }
  for (const entry of grouping.unassigned) {
    out.set(entry.path, { bucket: "unassigned", propertyIds: [] });
  }

  return out;
}
