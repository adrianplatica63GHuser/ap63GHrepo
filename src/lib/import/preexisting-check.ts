/**
 * src/lib/import/preexisting-check.ts — the chosen folder, measured against the
 * archive.   (Slice #26.08)
 *
 * Pure, and pure in the one way that matters most in this module: it performs
 * NO database access. It builds the fingerprints a lookup can be run on, and it
 * turns that lookup's answer into a list of decisions. The query itself lives
 * in `src/lib/documents/preexisting-lookup.ts`, server-side, and imports
 * `preexistingKeyOf` from here so that the two sides of the comparison cannot
 * come to disagree about what "the same document" means.
 *
 * ⚠️ **THIS IS THE MIRROR IMAGE OF THE DUPLICATION STAGE, AND THE TWO MUST NOT
 * MERGE.** `duplication-check.ts` compares the picked folder against ITSELF and
 * says so at length; its header names this stage as the place the other
 * question belongs. The remedies are what keep them apart: a copy inside the
 * folder is something the user REMOVES, and a document already in the archive
 * is something the import LINKS. One sends the user to File Explorer; the other
 * does not send them anywhere at all.
 *
 * WHAT COUNTS AS THE SAME DOCUMENT
 * ────────────────────────────────
 *
 * A Document already in the archive matches an entry when BOTH hold:
 *
 *   - the titles are the same, folded; and
 *   - the pages are the same set of (file name, byte size) pairs.
 *
 * ⚠️ **AND IT IS EVIDENCE, NOT PROOF — the same admission `duplication-check.ts`
 * makes, with a heavier consequence.** Two different documents can share a
 * title and a byte count: `Plan parcelar.jpg` off one scanner is the same
 * number of bytes as another `Plan parcelar.jpg` off the same scanner, because
 * an uncompressed scan's size is fixed by its dimensions and bit depth alone.
 * When that happens on a `link` row the file is NOT imported and somebody
 * else's document is attached to the user's property — and unlike a duplicate,
 * nothing in the archive afterwards records that it happened.
 *
 * Nothing cheap closes it (a content hash over a ~760-file archive is a
 * different order of cost, and it is not what the slice was asked for), so the
 * stage is arranged around making it VISIBLE and ESCAPABLE instead: every
 * matched file is listed with the code of the document it matched, and the
 * copy tells the user that renaming their file makes the system treat it as
 * new. That escape is load-bearing — if this copy is ever reworded, it is the
 * sentence to keep.
 *
 * Both halves are what the import itself writes, which is what makes the
 * comparison answerable at all: `bulk-import-dialog.ts` titles a plain file
 * with `entry.name` and a page group with `entry.titleHint`, and uploads each
 * file as a `document_page` carrying its own `file_name` and `file_size`. So a
 * folder imported once and offered again matches itself exactly.
 *
 * ⚠️ **THE TITLE IS PART OF THE KEY, AND THE DUPLICATION STAGE DELIBERATELY
 * LEFT ITS EQUIVALENT OUT.** DUP-02 signs a page folder by its page SIZES
 * alone, on the explicit grounds that a copied folder is often renumbered and
 * renamed by whoever copied it. That is the right call there and the wrong one
 * here, because the two stages fail in opposite directions:
 *
 *   - Duplication naming two folders that are NOT copies tells a user to
 *     remove a real document. So it must not over-claim.
 *   - Pre-existing naming a document that is NOT already here imports it a
 *     second time — a duplicate, visible, fixable. Pre-existing FAILING to name
 *     one that IS here silently drops a file the user believed was imported.
 *
 * Under-claiming is therefore the safe direction in this module and the
 * dangerous one in that module, so this key is the STRICTER of the two.
 *
 * ⚠️ **SLICE #32.06 INVERTED THE EXAMPLE THAT USED TO STAND HERE, and left the
 * conclusion intact.** It read: "a user who has since renamed the document in
 * the archive gets it imported again, and that is the outcome to prefer." That
 * is no longer true for a document the import created. The key now reads
 * `import_title ?? title` (see `keyTitleOf`), and `import_title` is write-once
 * - `documentUpdateSchema` refuses it - so renaming a document in the archive
 * no longer changes what it keys on and no longer forces a re-import.
 *
 * The escape the user is actually offered is unchanged and is the one the copy
 * names: RENAME THE FILE IN THE FOLDER. That still makes the system treat it as
 * new, because the folder side is computed fresh from the entry every run. If
 * that sentence is ever reworded, it is the one to keep - it is now the only
 * one of the two that works.
 *
 * ⚠️ **That asymmetry is about a NEAR miss, and it does not make an outright
 * false positive cheap** — see the note above the title rule. Strictness
 * reduces how often the key collides; it cannot make a collision harmless.
 *
 * ⚠️ **AND THE PAGE NAMES ARE IN THE KEY, for the same reason and against the
 * same precedent.** DUP-02 excludes them; this includes them. A folder
 * renumbered from `1.jpg` to `01.jpg` between two imports is a folder this
 * stage does not recognise, so it is imported again — the cheap failure.
 *
 * "WE COULD NOT MEASURE IT" IS NOT "IT IS NEW"
 * ───────────────────────────────────────────
 *
 * A file with no size cannot be fingerprinted, so it would silently become
 * unmatched — the same shape of lie as `ConstraintVerdict.unreadable` and
 * `DuplicationVerdict.unsized`, and it is carried in `unchecked` for the same
 * reason. What it does NOT do is block: this stage has nothing for the user to
 * fix, and the honest consequence of an unmeasurable file is "it will be
 * imported, and it may end up in the archive twice", which the copy says.
 *
 * It cannot be reached through today's wizard — Constraints refuses the folder
 * outright while any upload file is unreadable, and it runs first in the same
 * pass. The guard stays because this module must be sound on ITS inputs rather
 * than sound because another module happens to run before it.
 */

import { metadataKeyFor, type FileMeta } from "./checks";
import { foldRomanian, looksLikeIdCardName } from "./id-card";
import { compareForDisplay, sortedForDisplay, type FSEntry } from "./folder-utils";
import { groupByPropertyFolder } from "./property-folders";
import { isDeclaredCoordinateFile } from "./structure-rules";
import {
  PREEXISTING_SECTIONS,
  preexistingSectionOf,
  type PreexistingOutcome,
  type PreexistingReimportReason,
  type PreexistingSectionId,
} from "./preexisting-rules";

// ---------------------------------------------------------------------------
// The fingerprint
// ---------------------------------------------------------------------------

/** One uploaded file, as the archive records it. */
export type PreexistingFile = { name: string; size: number };

/** One entry, as a question to ask the archive. */
export type PreexistingCandidate = {
  /** `FSEntry.path` — the key everything downstream is joined on. */
  path: string;
  /** The title the import would give this entry's Document. */
  title: string;
  /** Every file it would upload as a page. Never empty. */
  files: PreexistingFile[];
};

/**
 * The comparison key. THE definition of "the same document", used on both
 * sides.
 *
 * ⚠️ `JSON.stringify` rather than a hand-joined string, and the reason is
 * `duplication-check.ts`'s, restated: a hand-joined key needs an ARGUMENT for
 * its injectivity — one about which characters a file name may contain, made in
 * a comment — and the last time this codebase shipped such an argument the
 * argument was wrong. The encoding below needs none.
 *
 * Sorted, so the order the walk enumerated a folder in, and the order Postgres
 * happened to return rows in, cannot make one document look like two.
 *
 * `foldRomanian` and not `toLowerCase`, for the reason `duplication-check.ts`
 * gives at length: `Adeverință` and `Adeverinţă` are one word typed on two
 * Romanian keyboard layouts, and it also normalises NFC against NFD, which is
 * what a name differs by after a trip through a Mac or a Windows share.
 */
export function preexistingKeyOf(
  title: string,
  files: readonly PreexistingFile[],
): string {
  const pages = files
    .map((f) => [foldRomanian(f.name), f.size] as const)
    .sort((a, b) => compareForDisplay(a[0], b[0]) || a[1] - b[1]);
  return JSON.stringify([foldRomanian(title), pages]);
}

/**
 * The title the import would give this entry. One definition, both sides.
 *
 * ⚠️ **The `|| entry.name` fallback is not belt-and-braces.** `titleHint` is
 * `folderNameToTitleHint`'s answer, which replaces underscores with spaces,
 * expands abbreviations and then TRIMS — so a page folder named `___` yields
 * the empty string. The route's schema requires a non-empty title, so one such
 * folder made the whole request 400, which `lookupPreexisting` reports as a
 * failure, which puts the stage on a retry that can never succeed and says
 * nothing about why. Found by this slice's adversarial review.
 *
 * The folder's own name is the right fallback rather than a loosened schema: an
 * empty title on this side would key against every archive document whose
 * `title` is null, which is a match nobody asked for. `preexisting-lookup.ts`
 * refuses those from the other direction for the same reason.
 */
export function titleForEntry(entry: FSEntry): string {
  if (entry.kind !== "page-group") return entry.name;
  return entry.titleHint.trim() === "" ? entry.name : entry.titleHint;
}

export type PreexistingCandidateInput = {
  entries: readonly FSEntry[];
  /**
   * What the metadata pass read. An EMPTY map is a legitimate input and means
   * "the pass ran and got nothing" — every entry is then `unchecked`, which is
   * the honest answer. There is no `undefined` case: a caller with no metadata
   * has not run the check yet and must not call this.
   */
  metadata: ReadonlyMap<string, FileMeta>;
};

export type PreexistingCandidates = {
  /** One per entry that could be fingerprinted completely. */
  candidates: PreexistingCandidate[];
  /** Entry paths with at least one file the pass could not measure. Sorted. */
  unchecked: string[];
};

/**
 * Turn the walk's entries into questions for the archive.
 *
 * ⚠️ **ONE UNMEASURED PAGE SINKS THE WHOLE ENTRY, not just that page.** A
 * page group matched on the pages that happened to be readable is a page group
 * matched on less than it holds, and the answer would be a confident "already
 * in the system" over a document whose fourth page nobody could see. Same
 * decision `duplication-check.ts` takes for DUP-02's signature, and for the
 * same reason.
 *
 * An entry with no files at all is not a candidate either — a page group with
 * an empty `handles` cannot be compared with anything, and STR-11 already
 * refuses the folder that produces one. It lands in `unchecked` rather than
 * being dropped, because a file that vanishes between the count on one screen
 * and the rows on the next is exactly the failure `property-folders.ts` records.
 */
export function preexistingCandidatesOf(
  input: PreexistingCandidateInput,
): PreexistingCandidates {
  const candidates: PreexistingCandidate[] = [];
  const unchecked: string[] = [];

  for (const entry of input.entries) {
    const files: PreexistingFile[] = [];
    let complete = true;

    if (entry.kind === "file") {
      const meta = input.metadata.get(metadataKeyFor(entry.path));
      if (meta === undefined) complete = false;
      else files.push({ name: entry.name, size: meta.size });
    } else {
      if (entry.handles.length === 0) complete = false;
      for (const handle of entry.handles) {
        const meta = input.metadata.get(metadataKeyFor(entry.path, handle.name));
        if (meta === undefined) {
          complete = false;
          break;
        }
        files.push({ name: handle.name, size: meta.size });
      }
    }

    if (!complete) {
      unchecked.push(entry.path);
      continue;
    }
    candidates.push({ path: entry.path, title: titleForEntry(entry), files });
  }

  return { candidates, unchecked: sortedForDisplay(unchecked) };
}

// ---------------------------------------------------------------------------
// The archive side of the comparison
// ---------------------------------------------------------------------------

/**
 * One page row as the archive stores it, joined to its Document.
 *
 * Structural, not imported from the schema: this module must stay free of
 * `@/db`, and the shape is four columns and a timestamp.
 */
export type ArchivePageRow = {
  documentId: string;
  fileName: string;
  /** Nullable in the schema, and a null makes its whole document unmatchable. */
  fileSize: number | null;
  code: string;
  title: string | null;
  /**
   * `document.import_title` — the title the IMPORT gave this document, which
   * the AI read never rewrites. Null for anything the import did not create.
   * Slice #32.06; `keyTitleOf` below is the only thing that reads it.
   */
  importTitle: string | null;
  createdAt: Date;
};

/**
 * The title this archive document is KEYED on.
 *
 * ⚠️ **`import_title` first, `title` second, and the fallback is the entire
 * compatibility story of Slice #32.06.** The folder side keys on
 * `titleForEntry(entry)` — a file's own name. The archive side used to key on
 * `document.title`, and `resolveImportedTitle` rewrites that title after the
 * pages are uploaded for every document whose name does not both name the KIND
 * and distinguish WHICH one. The two sides then key differently, the stage
 * reports a folder it has already imported as new, and imports all of it again.
 *
 * Measured on the 32.05 UAT, 2026-08-30: `03.types.noform` imported twice
 * produced three duplicate pairs out of eight documents. And the rewritten
 * title is not even stable between two reads of the SAME file — DOC01511 came
 * back "FISA CORPULUI DE PROPRIETATE" and DOC01519 "FISA CORPULUI DE
 * PROPRIETATE TARLA 46, PARCELA 222/13/1" — which is why no amount of
 * normalising `title` could have closed this and a stored value had to.
 *
 * ⚠️ **DROPPING THE FALLBACK WOULD BE A SILENT MASS REGRESSION.** Every
 * document predating the column carries null: hand-added rows, pre-wizard
 * imports, and every multi-page document, whose title came from a folder name
 * stored nowhere. Keying those as null (or as "") would make them all
 * unmatchable, or worse, all match each other — the same hole the untitled
 * guard below was written to close. They key on `title` and behave exactly as
 * they did before this slice.
 *
 * ⚠️ **The value is NOT trimmed or folded here.** `preexistingKeyOf` folds it,
 * and folding twice in two places is how the two sides come to disagree. The
 * empty check below is the caller's, for the same reason it always was.
 */
function keyTitleOf(doc: { importTitle: string | null; title: string | null }): string | null {
  // A stored `import_title` that is blank is not a title. It cannot happen
  // through `titleForEntry`, which falls back to the folder name precisely so
  // that it never returns one — but this reads a column, and a column can hold
  // whatever a future writer puts in it. Falling through to `title` is the
  // behaviour such a row had before the column existed.
  const imported = doc.importTitle?.trim() ?? "";
  if (imported !== "") return doc.importTitle;
  return doc.title;
}

/**
 * Which candidates the archive already holds, given every page of every
 * document worth comparing.
 *
 * ⚠️ **PURE, and separated from the SQL on purpose.** `preexisting-lookup.ts`
 * runs two queries and calls this; everything that DECIDES lives here, where a
 * test can reach it. Four of the decisions below are silent data outcomes — a
 * document with an unmeasured page, one with no title, a tie between two
 * archived copies, and a partially-loaded document — and none of them can be
 * seen from the outside once the answer is a list of ids.
 *
 * `rows` must contain EVERY page of each document it mentions. The key is over
 * the complete set, so a document loaded partially would key as a different —
 * and usually smaller — document and match things it does not hold. The caller
 * guarantees it by loading whole documents; this function cannot check it,
 * which is why the sentence is here.
 */
export function matchArchiveDocuments(
  rows: readonly ArchivePageRow[],
  candidates: readonly PreexistingCandidate[],
): PreexistingMatch[] {
  type Held = {
    id: string;
    code: string;
    title: string | null;
    importTitle: string | null;
    createdAt: Date;
    files: PreexistingFile[];
    /** A page with no recorded size — see below. */
    unkeyable: boolean;
  };

  const byDocument = new Map<string, Held>();
  for (const row of rows) {
    let held = byDocument.get(row.documentId);
    if (held === undefined) {
      held = {
        id: row.documentId,
        code: row.code,
        title: row.title,
        importTitle: row.importTitle,
        createdAt: row.createdAt,
        files: [],
        unkeyable: false,
      };
      byDocument.set(row.documentId, held);
    }
    // ⚠️ **A PAGE WITH NO SIZE MAKES ITS DOCUMENT UNMATCHABLE, on purpose.**
    // `document_page.file_size` is nullable and rows predating the import
    // wizard can carry null. Such a document cannot be keyed, so it is left out
    // and the incoming file is imported again — the safe direction for this
    // stage: under-claiming costs a duplicate, over-claiming loses a file.
    if (row.fileSize === null) held.unkeyable = true;
    else held.files.push({ name: row.fileName, size: row.fileSize });
  }

  const bestByKey = new Map<string, Held>();
  for (const doc of byDocument.values()) {
    if (doc.unkeyable || doc.files.length === 0) continue;
    // ⚠️ **A DOCUMENT WITH NO TITLE CAN NEVER MATCH, and keying it as `""` was
    // a real hole.** `document.title` is nullable — a row added by hand, or by
    // an import predating the wizard, can carry null — and `?? ""` would have
    // keyed every one of them under the same empty title, so an entry whose own
    // title came out empty would match an arbitrary untitled document and be
    // linked to the user's property instead of being imported. `titleForEntry`
    // closes the same hole from the folder side.
    // Slice #32.06: the title the document is KEYED on, which is the one the
    // import gave it and not the one the AI left behind. `keyTitleOf` explains
    // why the fallback to `title` is load-bearing.
    const title = keyTitleOf(doc)?.trim() ?? "";
    if (title === "") continue;
    const key = preexistingKeyOf(title, doc.files);
    const held = bestByKey.get(key);
    // ⚠️ **THE OLDEST DOCUMENT WINS A TIE, and a tie is not exotic.** The
    // archive can genuinely hold the same document twice — this stage exists
    // because nothing stopped that before it — so several rows can share one
    // key. Picking the oldest is the only stable answer: it does not change
    // when a later duplicate is added or removed, so the screen the user reads
    // before an import and the link the loop writes during it name the same
    // document. `code` breaks a same-timestamp tie, which seeded data produces.
    //
    // ⚠️ Refusing to match an ambiguous key was considered and rejected. It is
    // the obvious safety move — two candidates, so decline — and it is wrong
    // here: two archive documents with the same title, the same page names and
    // the same byte counts are overwhelmingly ONE document imported twice,
    // which is precisely the mess this stage exists to stop growing. Declining
    // would import it a third time, every time, for ever.
    if (
      held === undefined ||
      doc.createdAt.getTime() < held.createdAt.getTime() ||
      (doc.createdAt.getTime() === held.createdAt.getTime() && doc.code < held.code)
    ) {
      bestByKey.set(key, doc);
    }
  }

  const matches: PreexistingMatch[] = [];
  for (const candidate of candidates) {
    const found = bestByKey.get(preexistingKeyOf(candidate.title, candidate.files));
    if (found === undefined) continue;
    matches.push({
      path: candidate.path,
      documentId: found.id,
      documentCode: found.code,
      // `title`, deliberately, and NOT the value it was keyed on: this names
      // the document the user will find when they go and look at it, which is
      // what `document.title` holds. Since #32.06 the two can differ, because a
      // document keyed on `import_title` is often displaying a title the AI
      // rewrote.
      //
      // ⚠️ **AND IT IS NOW RENDERED, which it was not before #32.06.** The
      // field existed and reached no screen — it did not matter, because a
      // match GUARANTEED the archive's title equalled the folder's, so the path
      // already named the document. It matters now: the archive side keys on
      // `import_title` and displays `title`, and those differ for two thirds of
      // the archive, so "→ DOC01511" alone would tell a user nothing about what
      // they matched. `import-preexisting-stage.tsx` draws it on the row and
      // prints it on the saved page. ⚠️ If it is ever dropped from that
      // component again, the copy's only remedy for a wrong match — "rename
      // your file" — goes back to asking the user to notice something the
      // screen does not show.
      documentTitle: found.title,
    });
  }
  return matches;
}

// ---------------------------------------------------------------------------
// The answer, turned into decisions
// ---------------------------------------------------------------------------

/** What the lookup found, per entry path. Absent = the archive does not hold it. */
export type PreexistingMatch = {
  path: string;
  documentId: string;
  /** `DOC00042` — what the user will look the document up by. */
  documentCode: string;
  /** As recorded, NOT folded. Null is legitimate: `document.title` is nullable. */
  documentTitle: string | null;
};

/** One entry the archive already holds, and what the import will do about it. */
export type PreexistingRow = {
  path: string;
  /** What the import would have called it — the name the report shows. */
  title: string;
  documentId: string;
  documentCode: string;
  documentTitle: string | null;
  outcome: PreexistingOutcome;
  /** Non-null exactly when `outcome` is `reimport`. */
  reimportReason: PreexistingReimportReason | null;
  /** Which block of the report this row is drawn in. */
  section: PreexistingSectionId;
  /**
   * The property FOLDERS whose Property the existing Document will be linked
   * to — one for an entry under a property folder, all of them for a `common`
   * entry, none otherwise.
   *
   * ⚠️ **Folders, not Property ids, and that is forced by the running order.**
   * This stage runs before the property step, so the Properties do not exist
   * yet — #26.07 creates them at the `property` phase, three screens later. The
   * ids arrive in the import loop through `assignEntryProperties`, which reads
   * the same buckets this does; nothing here re-derives them, and nothing there
   * re-derives these.
   */
  propertyFolders: string[];
};

/** One block of the report. Only non-empty blocks are built. */
export type PreexistingSection = {
  id: PreexistingSectionId;
  rows: PreexistingRow[];
};

export type PreexistingVerdict = {
  /** In `PREEXISTING_SECTIONS` order, which is the published reading order. */
  sections: PreexistingSection[];
  /** Every row across every block — the number the heading quotes. */
  matchedCount: number;
  /** Entry paths that could not be fingerprinted. Complete and sorted. */
  unchecked: string[];
  /**
   * Nothing already in the archive, and nothing we could not look up.
   *
   * `clean` does NOT mean "may proceed" here, because this stage never refuses:
   * it means "there is nothing to tell the user", and the flow goes straight on
   * to Evaluation. Both halves are needed — a run that matched nothing because
   * it could measure nothing has something to say.
   */
  clean: boolean;
};

/**
 * The lookup did not happen.
 *
 * ⚠️ **A state of its own, and NOT an empty verdict.** "The archive holds none
 * of these" and "we could not ask the archive" produce the same import — every
 * file goes in — and they must not produce the same SCREEN, because only one of
 * them is a reason to try again. An earlier draft returned an empty verdict on
 * failure and the report then printed a green "nothing is already in the
 * system" over a request that never reached the server.
 */
export type PreexistingResult =
  | { ok: true; verdict: PreexistingVerdict }
  | { ok: false };

export type PreexistingCheckInput = {
  entries: readonly FSEntry[];
  /** What the lookup answered, keyed by entry path. */
  matches: ReadonlyMap<string, PreexistingMatch>;
  /** From `preexistingCandidatesOf` — carried through rather than recomputed. */
  unchecked: readonly string[];
  /**
   * The chosen folder's own directory listing, so a property subfolder holding
   * no importable file still counts as a property.
   *
   * Same argument `property-step-dialog.tsx` passes it for, and it matters here
   * for one case: a `common` document in a run whose only property folders are
   * empty is linked to nothing, and calling that `link` would be a promise the
   * import cannot keep.
   */
  topLevelDirNames?: readonly string[];
};

/**
 * Everything the Pre-existing STAGE needs in order to describe itself.
 *
 * The outcome per row is decided here rather than in the component, for the
 * reason every verdict in this folder gives: it is the sentence the whole stage
 * turns on, and a component cannot be tested against the states that produce
 * it. It is also, uniquely in this stage, a PROMISE about what the import loop
 * will do — see `PreexistingOutcome`.
 */
export function checkPreexistingStage(input: PreexistingCheckInput): PreexistingVerdict {
  const grouping = groupByPropertyFolder(input.entries, input.topLevelDirNames ?? []);

  const bucketOf = new Map<string, "property" | "common" | "floating" | "unassigned">();
  const foldersOf = new Map<string, string[]>();
  const everyPropertyFolder = grouping.properties.map((g) => g.folderName);

  for (const group of grouping.properties) {
    for (const entry of group.entries) {
      bucketOf.set(entry.path, "property");
      foldersOf.set(entry.path, [group.folderName]);
    }
  }
  for (const entry of grouping.common) {
    bucketOf.set(entry.path, "common");
    foldersOf.set(entry.path, everyPropertyFolder);
  }
  for (const entry of grouping.floating) bucketOf.set(entry.path, "floating");
  for (const entry of grouping.unassigned) bucketOf.set(entry.path, "unassigned");

  const rows: PreexistingRow[] = [];

  for (const entry of input.entries) {
    const match = input.matches.get(entry.path);
    if (match === undefined) continue;

    const bucket = bucketOf.get(entry.path) ?? "unassigned";
    const propertyFolders = foldersOf.get(entry.path) ?? [];

    /**
     * ⚠️ The two exceptions are tested BEFORE the link/skip question, because
     * they are not a kind of link — they are a decision not to treat the file
     * as pre-existing at all.
     *
     * The identity card goes first. Both exceptions produce the identical
     * import — the file is imported again — so the order changes only which
     * sentence the user reads, and the identity-card one carries an instruction
     * ("make a note and check after the import") that the coordinate one does
     * not. Losing that instruction is the more expensive of the two silences.
     * A `coord….txt` whose name also reads as an identity card is not a case
     * anyone has met; if it ever is, it is imported either way.
     */
    const idCard =
      entry.kind === "page-group"
        ? // BOTH the folder name and the title derived from it. `titleHint`
          // expands abbreviations, so `CI Popescu` and its expansion can carry
          // the signal in different places, and this test is allowed — is meant
          // — to over-claim. See `looksLikeIdCardName`.
          looksLikeIdCardName(entry.name) || looksLikeIdCardName(entry.titleHint)
        : looksLikeIdCardName(entry.name);

    /**
     * ⚠️ A page group can never be a coordinate file — the walk collapses a
     * folder into one only when every child is a numbered IMAGE — so the test
     * is on plain files alone, exactly as `property-folders.ts` shortlists
     * them.
     *
     * `bucket === "property"` because the hazard this exception exists for is
     * `property_corner_source`, and only a property folder's coordinate file
     * can become one. STR-09 refuses a `coord….txt` under `common` or
     * `floating` outright, so the narrower test costs nothing and says what it
     * means.
     */
    const coordinates =
      entry.kind === "file" &&
      bucket === "property" &&
      isDeclaredCoordinateFile(entry.name);

    let outcome: PreexistingOutcome;
    let reimportReason: PreexistingReimportReason | null = null;
    if (idCard) {
      outcome = "reimport";
      reimportReason = "id-card";
    } else if (coordinates) {
      outcome = "reimport";
      reimportReason = "coordinates";
    } else {
      // ⚠️ `link` requires somewhere to link TO. A `common` document in a run
      // that resolves no Property at all — every property folder empty, or a
      // chosen folder of `common` and `floating` only — has nowhere to go, and
      // promising the user it will be attached to their property would be a
      // sentence the import cannot honour.
      outcome = propertyFolders.length > 0 ? "link" : "skip";
    }

    rows.push({
      path: entry.path,
      title: titleForEntry(entry),
      documentId: match.documentId,
      documentCode: match.documentCode,
      documentTitle: match.documentTitle,
      outcome,
      reimportReason,
      section: preexistingSectionOf(outcome, reimportReason),
      propertyFolders: outcome === "link" ? propertyFolders : [],
    });
  }

  // Stable across two readings of the same screen, and ordered by where the
  // file sits — which is how the user will look for it. The same promise every
  // other checker in this folder makes about its lists.
  rows.sort((a, b) => compareForDisplay(a.path, b.path));

  const sections: PreexistingSection[] = [];
  for (const id of PREEXISTING_SECTIONS) {
    const inSection = rows.filter((r) => r.section === id);
    if (inSection.length > 0) sections.push({ id, rows: inSection });
  }

  const unchecked = sortedForDisplay([...input.unchecked]);

  return {
    sections,
    matchedCount: rows.length,
    unchecked,
    clean: rows.length === 0 && unchecked.length === 0,
  };
}

/**
 * The decisions the import loop acts on, keyed by entry path.
 *
 * ⚠️ **`reimport` rows are deliberately ABSENT rather than present with a
 * flag.** The loop's question is "is there anything to do instead of importing
 * this file", and a row that is imported again is answered by the ordinary
 * path. Carrying it into the map would mean every reader of the map having to
 * remember the exception, and the first one to forget imports nothing for a
 * file the report promised would be imported.
 */
export function preexistingDecisionsByPath(
  verdict: PreexistingVerdict,
): Map<string, PreexistingRow> {
  const out = new Map<string, PreexistingRow>();
  for (const section of verdict.sections) {
    for (const row of section.rows) {
      if (row.outcome === "reimport") continue;
      out.set(row.path, row);
    }
  }
  return out;
}
