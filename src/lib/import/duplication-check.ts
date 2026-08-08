/**
 * src/lib/import/duplication-check.ts - the picked folder, measured against
 * itself.   (Slice #26.06)
 *
 * Pure. It is handed what the walk produced and what the metadata pass read,
 * and it returns groups of things that look like copies of each other; no
 * handles, no I/O, no React, and - see `duplication-rules.ts` - no database.
 * `duplication-rules.ts` wrote the contract, this enforces it, and
 * `import-duplication-stage.tsx` puts the result on screen and runs the
 * fix-and-re-check loop.
 *
 * WHAT IT IS HANDED
 * -----------------
 *
 *  - `entries` - the walk's RESULT, for the reason `constraint-check.ts` gives:
 *    this stage is about the final list of things that will be uploaded, not
 *    about the walk's reasoning. `uploadKeysOf` is imported rather than
 *    re-derived, so "what the import will upload" keeps one definition - the
 *    verdict's `unsized` list is over exactly that set, even though the two
 *    rules read `entries` directly.
 *  - `metadata` - sizes, from the pass the Constraints stage already paid for.
 *
 * There are no `observations` here, and their absence is the shape of the
 * stage: a file the walk DROPPED is not going to be imported, so it cannot be
 * imported twice. CON-06 needed the observations because a `folder.jpg` never
 * reaches `entries` and the rule is about a file that would otherwise vanish
 * silently. Nothing here is about a file that will not arrive.
 *
 * THE TWO RULES DO NOT OVERLAP, AND THAT IS BY CONSTRUCTION
 * --------------------------------------------------------
 *
 * DUP-01 reads plain file entries; DUP-02 reads page-group entries. Nothing is
 * examined by both, so there is no precedence to arbitrate and no set of
 * "already claimed" keys to keep in step - an earlier draft of this module had
 * one, and its own reviewer found that it silently deferred a genuine match to
 * the next round of the loop. The split is not tidiness: it is the reason each
 * rule's REMEDY is safe for the things that rule names. See DUP-01's block for
 * the instruction that made this necessary.
 *
 * A GROUP, NOT A LIST - AND THAT IS THE ONE THING THIS STAGE MUST GET RIGHT
 * ------------------------------------------------------------------------
 *
 * `ConstraintViolation` carries a flat `paths`, and it is right to: a
 * constraint's remedy is uniform across every file it names, so the sentence is
 * stated once and the list sits under it. A DUPLICATION remedy is not uniform -
 * it is "keep one of THESE and take the others out", once per set. Handed a
 * flat list of seven paths that is really three pairs and a triple, a user
 * cannot tell which file replaces which, and the reasonable reading of "these
 * seven files appear more than once, keep one" is to keep one of the seven.
 *
 * So a violation carries GROUPS, each group is one decision, and every group
 * carries the whole set. That is also what makes the saved page work: one block
 * per group, the shared name as its culprit line, exactly the shape
 * `RulesPageViolation` already has for Structure.
 *
 * ⚠️ THE ONE AMBIGUITY THIS RULE CANNOT RESOLVE, AND WHERE THE COPY CARRIES IT
 * ---------------------------------------------------------------------------
 *
 * Two files with one name and one size in two DIFFERENT property folders -
 * `48-50D/Plan.tif` and `51A/Plan.tif` - are either one document filed twice or
 * two properties' own plans that happen to be the same number of bytes, which
 * for an uncompressed scan off one machine is guaranteed rather than lucky.
 * Nothing in the metadata separates the two readings, and matching on name and
 * size is the rule the slice was asked for.
 *
 * So the module reports the set and the SENTENCE carries the ambiguity: it asks
 * the user to look, and it offers three endings rather than one - keep the one
 * in the right place, or RENAME one of them if they are different documents, or
 * take them all out if you cannot tell. The rename branch is what makes this
 * safe: it clears the set, leaves both documents in place, and costs nothing.
 * A version of this sentence with only the first ending would be an instruction
 * to delete a real plan, and that is the failure the whole stage is arranged
 * around. If the copy is ever reworded, that branch is the load-bearing one.
 *
 * EVIDENCE, NOT PROOF - SO NOTHING HERE SAYS "DELETE"
 * --------------------------------------------------
 *
 * Same name and same size is very strong evidence of a copy and it is not a
 * comparison of contents. Reading every byte of a ~760-file archive to be sure
 * is a different order of cost from the metadata pass, and it would still be
 * answering a question the user can answer faster by looking. The module's job
 * is therefore to point at the sets; the copy asks the user to check them, and
 * every sentence offers the escape that always works - take it out of the
 * chosen folder - for the user who cannot tell and does not want to guess.
 *
 * "WE COULD NOT SIZE IT" IS NOT "IT IS UNIQUE"
 * -------------------------------------------
 *
 * A file with no size cannot be matched, so it silently becomes unique - the
 * same shape of lie as `ConstraintVerdict.unreadable`, one stage later, and it
 * blocks for the same reason. `unsized` therefore rides alongside the
 * violations and `clean` refuses the folder while it is non-empty.
 *
 * It cannot be reached through today's wizard, and that is not a reason to drop
 * it. Duplication runs in the same pass as Constraints, off the same metadata
 * map, and Constraints refuses the folder outright while any upload file is
 * unreadable - so by the time this function is called, every key has a size.
 * The guard stays because this module must be sound on ITS inputs rather than
 * sound because another module happens to run first: the day Duplication is
 * reached by another route - a resumed session, a re-check that skips ahead -
 * the alternative is a green tick over files nobody could measure.
 */

import { metadataKeyFor, uploadKeysOf, type FileMeta } from "./checks";
import { foldRomanian } from "./id-card";
import {
  compareForDisplay,
  sortedForDisplay,
  type FSEntry,
  type FSPageGroupEntry,
} from "./folder-utils";
import { duplicationViolationCounts, type DuplicationRuleId } from "./duplication-rules";

export type DuplicationCheckInput = {
  entries: readonly FSEntry[];
  /**
   * What the metadata pass read. An EMPTY map is a legitimate input and means
   * "the pass ran and got nothing" - every upload file is then `unsized` and
   * the stage blocks, which is the honest answer. There is no `undefined` case:
   * a caller with no metadata has not run the check yet and must not call this.
   */
  metadata: ReadonlyMap<string, FileMeta>;
};

/**
 * One set of things that look like copies of each other.
 *
 * A discriminated union rather than two nullable fields, because the two rules
 * are held together by different evidence and a group carrying both would have
 * two invalid states for every valid one. The renderer switches on `by` and the
 * compiler checks it covered both.
 */
export type DuplicateGroup =
  | {
      /** Held together by a matching file name and an identical size. DUP-01. */
      by: "name";
      /**
       * The SHORTEST name in the set, which is the one to show.
       *
       * ⚠️ Not "the name they all share" - since this slice matched Windows
       * copy suffixes they often do not share one, and `contract.pdf` sits in a
       * set with `contract - Copie.pdf`. Shortest IS the original in every case
       * this rule matches, and that is a property rather than a guess: the only
       * difference the matching tolerates is a copy marker, which is text ADDED
       * to a name, so the member carrying none is the shortest. A heading
       * naming the COPY would invite the user to keep the copy. Ties go to
       * display order, so the answer does not depend on the order the walk
       * happened to enumerate the folder in.
       *
       * Matching is also case-insensitive - Windows would not let `Contract.pdf`
       * and `contract.pdf` sit in one folder, but it happily lets them sit in
       * two - so there is no canonical spelling either. The paths beneath the
       * heading are the fact.
       */
      name: string;
      /** Every copy. Complete and sorted; never fewer than two. */
      paths: string[];
    }
  | {
      /** Held together by holding the same pages. DUP-02. */
      by: "pages";
      /**
       * How many pages each copy holds. The only thing that tells one set of
       * duplicated folders from another on screen, since their names differ -
       * which is exactly what makes them hard to spot in File Explorer.
       */
      pages: number;
      /** Every copy - page-folder paths, not page paths. Sorted; never fewer than two. */
      paths: string[];
    };

/**
 * One broken rule, and every set of copies that breaks it.
 *
 * Deliberately NOT `ConstraintViolation`'s shape. See the module header: the
 * remedy here is per set, so a flat `paths` would be actively misleading rather
 * than merely less informative.
 */
export type DuplicationViolation = {
  ruleId: DuplicationRuleId;
  /** One entry per decision the user has to make. Never empty. */
  groups: readonly DuplicateGroup[];
  /** Interpolated into the message. Keys match the rule's declared `counts`. */
  counts: Readonly<Record<string, number>>;
};

/**
 * The ending Windows adds when it copies a file inside a folder.
 *
 * ⚠️ **Matching this is the difference between a stage that works and one that
 * is decorative.** The commonest duplicate on a business user's disk is not two
 * files with the same name in two folders - it is `Contract vanzare.pdf` and
 * `Contract vanzare - Copie.pdf` sitting side by side, byte for byte identical,
 * produced by Ctrl+C Ctrl+V in the very folder they were told to tidy. A rule
 * matching names literally misses precisely that.
 *
 * `Copie` as well as `Copy`, because the suffix follows the WINDOWS display
 * language rather than the file: Ciprian's machine is Romanian. The trailing
 * `(2)` is part of THIS pattern - `Contract - Copie (2).pdf` is the third paste
 * - and is deliberately NOT a pattern on its own; the note below is the whole
 * safety of the rule, and it cost three adversarial rounds to arrive at.
 */
const COPY_MARKER = /\s*[-–—]\s*cop(?:y|ie)(?:\s*\(\s*\d+\s*\))?\s*$/i;

/**
 * ⚠️ **A TRAILING `(2)` WITH NO COPY WORD IN FRONT OF IT IS NOT STRIPPED, and
 * the deliberate silence is worth more than the case it gives up.**
 *
 * It is the obvious second pattern - a browser's second download is
 * `contract (1).pdf` - and this slice implemented it twice, first
 * unconditionally and then behind an "anchor" pass that stripped it only when a
 * same-size file with the unsuffixed name existed. Successive adversarial
 * rounds found three separate failures in that mechanism and none of them was
 * the last:
 *
 *  - **Unconditional**, it reports numbered SHEETS as copies. `Plan (1).tif`
 *    and `Plan (2).tif` are sheets one and two of one plan, and scanned
 *    uncompressed on one machine they are the same number of bytes - an
 *    uncompressed image's size is fixed by its dimensions and bit depth alone.
 *  - **Anchored**, the anchor is a file somewhere else. `48-50D/Plan.tif`
 *    beside `51A/Plan (1).tif` and `51A/Plan (2).tif` merged all three and told
 *    the user to keep another property's plan.
 *  - **Anchored and scoped**, the loop contradicts itself. `x.pdf`, `x (1).pdf`
 *    and `x (2).pdf` are reported as three copies; the user removes `x.pdf`;
 *    the next round finds the remaining two unique and prints a green
 *    all-clear over the duplicate the stage itself just named. Evidence that
 *    disappears when the user acts on it is not evidence.
 *
 * Each fix moved the failure rather than removing it, because the premise is
 * wrong: `(n)` is a NUMBER, and this archive numbers things. The copy word is
 * not - nobody names a cadastral document "Copie" by accident - so that is
 * where the line is drawn. The cost is that `contract (1).pdf` beside
 * `contract.pdf` goes unreported, and the user still sees both in Explorer.
 */

/**
 * Remove EVERY trailing copy marker, not just the last one.
 *
 * Windows' real name for a copy of a copy is `Contract - Copie - Copie.pdf`. A
 * single `replace` left it in its own set, so the stage reported the pair it
 * could see, the user removed the copy it named, and the next round of the loop
 * printed a green all-clear over a byte-identical triple - the same
 * "evidence that disappears when the user acts on it" failure this module
 * rejected the `(n)` anchor for.
 *
 * Bounded by the fact that each pass must shorten the string, so it terminates
 * on any input.
 */
function stripCopyMarkers(name: string): string {
  let out = name;
  for (;;) {
    const next = out.replace(COPY_MARKER, "");
    // A name that is ONLY markers - `- Copie.pdf` - would strip to nothing and
    // then group with every other empty name of the same size. Stop before that
    // rather than after it.
    if (next === out || next === "") return out;
    out = next;
  }
}

type NameKey = { stem: string; ext: string };

/**
 * ⚠️ `foldRomanian`, not `toLowerCase`.
 *
 * `Adeverință.pdf` and `Adeverinţă.pdf` are the same word typed on two Romanian
 * keyboard layouts - comma-below `ș` (U+0219) against cedilla `ş` (U+015F) -
 * and `toLowerCase` folds neither into the other, so two copies of one document
 * were compared as two different documents. Every other name comparator in the
 * import path already folds (`structure-rules.ts` does); these two were the
 * only ones that did not. It also normalises NFC against NFD, which is what a
 * file copied between a Mac and a Windows share differs by.
 */
function nameKeyOf(fileName: string): NameKey {
  const dot = fileName.lastIndexOf(".");
  const hasExt = dot > 0;
  const rawStem = hasExt ? fileName.slice(0, dot) : fileName;
  const ext = hasExt ? fileName.slice(dot) : "";

  return { stem: foldRomanian(stripCopyMarkers(rawStem)), ext: foldRomanian(ext) };
}

/**
 * DUP-01's grouping key.
 *
 * ⚠️ `JSON.stringify` rather than a hand-joined string, and the reason is that
 * the hand-joined version needs an ARGUMENT for its injectivity - one about
 * which characters a filename may contain, made in a comment, that the next
 * reader has to re-derive before touching the line. This slice shipped such an
 * argument and its adversarial review showed the argument was wrong (it claimed
 * a collision in `${name}:${size}` that cannot occur). The encoding below needs
 * no argument at all, costs microseconds per file, and cannot be got wrong by
 * someone adding a fourth field to it later.
 */
function groupKeyFor(size: number, ext: string, stem: string): string {
  return JSON.stringify([size, ext, stem]);
}

/**
 * Is this file name a page number?
 *
 * The question DUP-01's exclusion actually asks. `isPageGroupMember` is the
 * neighbouring predicate and the wrong one: it also requires an image kind,
 * because the walk only ever collapses images into a page group - but a scanner
 * emitting `1.pdf … n.pdf` into a plain folder produces exactly the files this
 * rule must not name, and they are not images. So there is no `isFileKind` test
 * here: the remedy DUP-01 offers is wrong for anything a user thinks of as page
 * N of something, whatever it was saved as.
 *
 * ⚠️ **THE COPY MARKER COMES OFF FIRST, and testing the raw name instead was a
 * hole that survived six rounds.** `1 - Copie.tif` did not look numeric, so it
 * escaped the skip - and then `nameKeyOf` stripped the marker and keyed it as
 * `1`, so two properties' pasted first pages matched each other and the user
 * was told to remove one. The skip and the key must read the same string or the
 * exclusion is not an exclusion.
 *
 * ⚠️ **AND NO UPPER BOUND, although one was tried.** A `MAX_PAGE_NUMBER` of 999
 * would let `2019.pdf` - a receipt named by its year, pasted in place as
 * `2019 - Copie.pdf` - be compared, which is a duplicate this rule otherwise
 * misses. It was removed because the premise is false for this archive:
 * `structure-rules.ts` records `5449.jpg` and `31316.jpg` as real page names
 * off a scanner's own counter, so no threshold separates a year from a page and
 * the bound merely moved the failure into the more expensive direction - DUP-01
 * naming a real page and telling the user to remove it.
 *
 * The cost, stated plainly because the requirement sentence states it too: a
 * file named nothing but a number is never compared, so a pasted `2019.pdf` is
 * not reported. The user still sees both in Explorer, and nothing is lost.
 */
function isNumberedScanName(fileName: string): boolean {
  const dot = fileName.lastIndexOf(".");
  const stem = stripCopyMarkers(dot > 0 ? fileName.slice(0, dot) : fileName).trim();
  return /^\d+$/.test(stem);
}

/**
 * A page folder's name with every copy marker removed, folded.
 *
 * The evidence DUP-02 falls back on when the page sizes alone are not enough -
 * see the `weak signature` branch. A folder has no extension, so there is no
 * stem to split off.
 */
function folderKeyOf(folderName: string): string {
  return foldRomanian(stripCopyMarkers(folderName));
}

/** Does this folder's own name say it is a copy? */
function isMarkedCopy(folderName: string): boolean {
  return stripCopyMarkers(folderName) !== folderName;
}

/** One page folder, and whether its page sizes alone are worth anything. */
type SignedFolder = { entry: FSPageGroupEntry; weak: boolean };

/**
 * Split a bucket of weak-signature folders by their copy-stripped names.
 *
 * The second piece of evidence, and it is the SAME evidence DUP-01 uses on
 * files: a name that matches once the copy marker is off. What it buys is the
 * one-page and all-uniform folders that the size multiset cannot speak for -
 * which, before this existed, were invisible to both rules and passed under a
 * green all-clear.
 */
function splitByFolderName(bucket: readonly SignedFolder[]): SignedFolder[][] {
  const byName = new Map<string, SignedFolder[]>();
  for (const held of bucket) {
    // ⚠️ **THE PARENT IS PART OF THE KEY.** Without it one paste dragged every
    // same-named folder in the archive into the set: `48-50D/Contract`,
    // `48-50D/Contract - Copie` and `51A/Contract` came back as one group of
    // three, and the third is another property's real contract. `.some(marked)`
    // alone could not stop that - the marker was present, just not on the
    // folder being accused.
    //
    // Windows produces this suffix by pasting INTO a directory, so the copy is
    // always beside the original; a whole property folder duplicated is a
    // different question and #26.01's STR rules already refuse two folders that
    // parse to one property.
    const key = `${held.entry.pathParts.slice(0, -1).join("/")}\u0000${folderKeyOf(held.entry.name)}`;
    const group = byName.get(key);
    if (group === undefined) byName.set(key, [held]);
    else group.push(held);
  }
  // ⚠️ **A SET NEEDS AN ACTUAL COPY MARKER, not merely a shared name**, and
  // this is the guard the previous draft of this function was missing. Nothing
  // here constrains the two folders to sit under one property, so
  // `48-50D/Buletin` and `51A/Buletin` - two different people's ID cards, one
  // page each, the same byte count because they came off one scanner at one
  // setting - matched, and the user was told to remove a whole real document.
  // The same for `48-50D/Contract` against `51A/Contract`, which is the most
  // ordinary page-folder naming there is.
  //
  // The evidence this branch claims to use is the marker: `Contract` beside
  // `Contract - Copie` is a paste, and a paste is what it exists to catch. Two
  // identically named folders with no marker anywhere are a naming convention.
  //
  return [...byName.values()].filter((set) =>
    set.some((held) => isMarkedCopy(held.entry.name)),
  );
}

/**
 * Every duplicate the chosen folder holds, one violation per rule, in listing
 * order.
 *
 * An empty array means nothing matched among the files that could be sized -
 * which is NOT the same as "this folder may proceed": see
 * `checkDuplicationStage`, which is what the stage asks.
 */
export function checkDuplication(input: DuplicationCheckInput): DuplicationViolation[] {
  const { entries, metadata } = input;

  // -- DUP-02 - the same document ------------------------------------------
  //
  // A page folder copied wholesale is 40 duplicated files, and reporting it
  // that way is the worst version of this stage: 80 paths under one sentence,
  // no indication that they are two folders, and a user who "fixes" it by
  // deleting pages one at a time.
  const byPages = new Map<string, SignedFolder[]>();

  for (const entry of entries) {
    if (entry.kind !== "page-group") continue;
    if (entry.handles.length === 0) continue;

    // SIZES ONLY - the page NAMES are deliberately not part of the signature.
    // A folder copied in File Explorer is very often renumbered by whoever
    // copied it (1.jpg becomes 01.jpg, or the scanner starts at 0), and
    // #26.01's structure rule guarantees only that the names are numbers, not
    // which numbers. Two folders holding the same pages are the same document
    // whatever the pages are called.
    //
    // Sorted, so page ORDER does not distinguish two folders either: the
    // evidence is the set of scans, and a document is not a different document
    // for having been scanned back to front.
    const sizes: number[] = [];
    let sizable = true;
    for (const handle of entry.handles) {
      const size = metadata.get(metadataKeyFor(entry.path, handle.name))?.size;
      // One unsized page sinks the signature: a folder matched on the pages
      // that happened to be readable is a folder matched on less than it holds.
      // The unsized page still lands in `unsized` and blocks the stage.
      if (size === undefined) {
        sizable = false;
        break;
      }
      sizes.push(size);
    }
    if (!sizable) continue;

    // ⚠️ **WHEN EVERY PAGE IS THE SAME SIZE THE MULTISET IS NOT EVIDENCE**, and
    // this is the finding that most nearly shipped as a rule telling a user to
    // throw away three unrelated documents. An uncompressed scan - TIFF or BMP,
    // both legal page formats and both an ordinary office-scanner setting - has
    // a byte size fixed by its dimensions and bit depth ALONE. Every page the
    // machine produces at one setting is byte-identical in size and unrelated
    // in content, so `Contract`, `Carte funciara` and `Proces verbal`, three
    // pages each, all sign as the same three numbers.
    //
    // A one-page folder is the same problem with one number instead of three:
    // it carries exactly DUP-01's evidence and attaches to it the much stronger
    // claim "this is the same DOCUMENT" and the much heavier remedy "take the
    // whole folder out".
    //
    // Neither is DROPPED, which is what an earlier draft did and what left a
    // copied one-page folder invisible to both rules under a green all-clear.
    // They are marked WEAK and answered with a second piece of evidence below:
    // the folder's own name.
    const weak = entry.handles.length < 2 || new Set(sizes).size < 2;

    sizes.sort((a, b) => a - b);
    // The bucket key carries the strength, so a weak folder can never join a
    // strong one's set on the sizes alone.
    const signature = `${weak ? "w" : "s"}:${sizes.join(",")}`;
    const held = byPages.get(signature);
    if (held === undefined) byPages.set(signature, [{ entry, weak }]);
    else held.push({ entry, weak });
  }

  const pageGroups: DuplicateGroup[] = [];
  for (const bucket of byPages.values()) {
    // A strong signature stands on its own: the same several DIFFERENT page
    // sizes, in the same amounts, is not something two unrelated documents do.
    // A weak one is split by folder name first, so `Contract` and `Contract -
    // Copie` are still caught - that pair is the commonest gesture there is -
    // while `Buletin Ionescu` and `Buletin Popescu`, two one-page scans of the
    // same byte count, are two different people's ID cards and stay apart.
    const sets = bucket[0].weak ? splitByFolderName(bucket) : [bucket];
    for (const copies of sets) {
      if (copies.length < 2) continue;
      pageGroups.push({
        by: "pages",
        // Every copy holds the same page count by construction: the signature
        // is the list of sizes, so its length is shared across the set.
        pages: copies[0].entry.handles.length,
        paths: sortedForDisplay(copies.map((c) => c.entry.path)),
      });
    }
  }
  // Stable across re-checks: the user reads this list once before a fix and
  // once after, and a list that reshuffles in between is unusable. Ordered by
  // where the first copy sits, which is where they will start looking.
  pageGroups.sort((a, b) => compareForDisplay(a.paths[0], b.paths[0]));

  // -- DUP-01 - the same file ----------------------------------------------
  //
  // ⚠️ **NO NUMBERED SCANS. A page is never named here**, and that is a safety
  // decision rather than a simplification. #26.01 requires
  // a page folder's files to be numbered 1..n, so every page folder in a
  // compliant archive holds a `1.jpg` - and across an archive of any size, two
  // unrelated first pages eventually share a byte count. What made that
  // dangerous was not the false match but the REMEDY: DUP-01's sentence says
  // keep the one in the right place and take the others out, and for a page
  // there is no other place. A user who followed it would delete page 1 of a
  // real document, be bounced back to the Structure stage by the numbering rule
  // on the next check, and have no way to undo it.
  //
  // So pages are answered at the level a user can act on - the whole folder,
  // by DUP-02 - and a page duplicated inside or across folders is not reported
  // at all. That is a deliberate silence: the fix for a repeated page is to
  // renumber the folder, which is not what "take the copy out" means, and a
  // stage that blocks must not issue an instruction that traps the person who
  // follows it.
  //
  // Pushes in place rather than rebuilding the array - the spread form is
  // quadratic in the size of one group, and this runs synchronously on the UI
  // thread. Measured by #26.05's adversarial review on the same pattern in
  // `constraint-check.ts`: 3.1 s at 20,000 files of one kind.
  const byNameAndSize = new Map<string, { name: string; paths: string[] }>();
  for (const entry of entries) {
    if (entry.kind !== "file") continue;
    // ⚠️ **AND NEVER A NUMBERED SCAN, whichever way the walk delivered it and
    // whatever kind it is.**
    //
    // Testing `kind` alone enforced the safety argument below only for files
    // the walk collapsed into a page group - and a folder becomes one only when
    // ALL its files are numbered. One `contract.pdf` beside `1.tif` and `2.tif`
    // and the folder stays a plain folder, its scans arrive as file entries,
    // and `48-50D/1.tif` was matched against `51A/1.tif` on a byte count two
    // uncompressed scans share by construction.
    //
    // `isPageGroupMember` is NOT the test, although it was for one round: it
    // requires an image kind, and a scanner emitting `1.pdf … n.pdf` into a
    // plain folder is ordinary. The question this asks is "is this file's name
    // a page number", and the answer does not depend on the format.
    if (isNumberedScanName(entry.name)) continue;
    const size = metadata.get(metadataKeyFor(entry.path))?.size;
    if (size === undefined) continue;
    const name = nameKeyOf(entry.name);
    const key = groupKeyFor(size, name.ext, name.stem);
    const held = byNameAndSize.get(key);
    if (held === undefined) {
      byNameAndSize.set(key, { name: entry.name, paths: [entry.path] });
      continue;
    }
    held.paths.push(entry.path);
    // ⚠️ The SHORTEST name in the set is the one the heading shows, and it is
    // not an arbitrary tie-break: a copy is the original plus a suffix, so the
    // shortest member is the original in every case this rule matches. A
    // heading reading `„contract vanzare - Copie.pdf", în 2 locuri` over a pair
    // whose other member is `contract vanzare.pdf` invites the user to keep the
    // copy. Length first, then display order, so the answer does not depend on
    // the order the walk happened to enumerate the folder in.
    if (
      entry.name.length < held.name.length ||
      (entry.name.length === held.name.length && compareForDisplay(entry.name, held.name) < 0)
    ) {
      held.name = entry.name;
    }
  }

  const fileGroups: { name: string; paths: string[] }[] = [];
  for (const group of byNameAndSize.values()) {
    if (group.paths.length < 2) continue;
    fileGroups.push({ name: group.name, paths: sortedForDisplay(group.paths) });
  }
  // By the shared name, which is the heading the user reads, with the first
  // path breaking ties between two spellings of one name.
  fileGroups.sort(
    (a, b) => compareForDisplay(a.name, b.name) || compareForDisplay(a.paths[0], b.paths[0]),
  );

  // Emitted in catalogue order, which is the published reading order.
  const out: DuplicationViolation[] = [];
  if (fileGroups.length > 0) {
    out.push({
      ruleId: "DUP-01",
      groups: fileGroups.map((g) => ({ by: "name" as const, name: g.name, paths: g.paths })),
      counts: duplicationViolationCounts(
        "DUP-01",
        fileGroups.length,
        fileGroups.reduce((n, g) => n + g.paths.length, 0),
      ),
    });
  }
  if (pageGroups.length > 0) {
    out.push({
      ruleId: "DUP-02",
      groups: pageGroups,
      counts: duplicationViolationCounts(
        "DUP-02",
        pageGroups.length,
        pageGroups.reduce((n, g) => n + g.paths.length, 0),
      ),
    });
  }
  return out;
}

/**
 * Everything the Duplication STAGE needs in order to decide.
 *
 * `checkDuplication` answers "what is in here twice". That is not the same
 * question as "may these files go through", and the difference is the unsized
 * case described at length in the module header. `clean` is the conjunction,
 * and it is computed here rather than in the component for the reason
 * `ConstraintVerdict` gives: it is the sentence the whole stage turns on, and a
 * component cannot be tested against the states that produce it.
 */
export type DuplicationVerdict = {
  violations: DuplicationViolation[];
  /**
   * Files the import would upload and whose size could not be read.
   *
   * Complete and sorted, never a sample. Empty in every run that reached this
   * stage through the Constraints stage - see the module header.
   */
  unsized: string[];
  /** May Duplication hand over to the next stage? */
  clean: boolean;
};

export function checkDuplicationStage(input: DuplicationCheckInput): DuplicationVerdict {
  const violations = checkDuplication(input);

  // No exclusion of the paths a violation already names, unlike
  // `checkConstraintsStage`: a file with no size is never matched, so it can
  // never be in a group. Adding the filter anyway would be a guard that cannot
  // fire, which is the kind a later reader deletes the real one instead of.
  const unsized = sortedForDisplay(
    uploadKeysOf(input.entries).filter((key) => !input.metadata.has(key)),
  );

  return {
    violations,
    unsized,
    clean: violations.length === 0 && unsized.length === 0,
  };
}
