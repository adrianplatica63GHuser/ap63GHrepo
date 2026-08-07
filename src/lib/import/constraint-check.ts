/**
 * src/lib/import/constraint-check.ts — the picked folder's FILES, measured
 * against the constraints.   (Slice #26.05)
 *
 * Pure. It is handed what the walk produced and what the metadata pass read,
 * and it returns violations; no handles, no I/O, no React. `constraint-rules.ts`
 * wrote the contract, this enforces it, and `import-constraints-stage.tsx` puts
 * the result on the screen and runs the fix-and-re-check loop.
 *
 * WHAT IT IS HANDED, AND WHY EACH PIECE
 * ─────────────────────────────────────
 *
 *  - `entries` — the walk's RESULT, which is the right input here for exactly
 *    the reason it was the wrong one for `structure-check.ts`. That module
 *    needed the walk's reasoning (which folder failed to become a page group,
 *    and why), and `entries` has thrown it away. This module needs the
 *    opposite: the final list of things that will be uploaded. `uploadKeysOf`
 *    is imported from `checks.ts` rather than re-derived, so "what the import
 *    will upload" has one definition — a page group is one Document and many
 *    uploads, and the size limit is per FILE.
 *  - `observations` — for CON-06 alone. A `folder.jpg` never reaches `entries`,
 *    because the walk drops it by name; the observation is the only record
 *    that it was ever there.
 *  - `metadata` — sizes and reported types, from the pass that runs once
 *    Structure is clean.
 *
 * ⚠️ "WE COULD NOT LOOK" IS NOT "IT IS FINE"
 * ──────────────────────────────────────────
 *
 * `readFileMetadata` omits a file it could not open rather than guessing at it,
 * which is right — inventing a size of 0 would manufacture a CON-04 out of a
 * permissions error. For an ADVISORY report that omission is harmless: the
 * rules simply do not fire and the user decides anyway. For a stage that
 * BLOCKS it is the whole ballgame, because silence reads as a green tick.
 *
 * So the verdict carries `unreadable` alongside the violations and refuses to
 * call the folder clean while it is non-empty. It is deliberately NOT dressed
 * up as a violation — it has no rule ID, no constraint was broken, and the
 * remedy is of a different kind (the folder moved, a drive went away, a file
 * is locked by another program) — which is the same shape, and the same
 * argument, as `StructureVerdict.truncations`.
 *
 * ⚠️ **BUT A NAME IS STILL A NAME.** The first draft did `continue` on a file
 * with no metadata, which threw away the three rules that need only the name.
 * A `.csv` locked by Excel was then reported as "we could not open this — close
 * the program using it", the user closed Excel, and the answer became "this is
 * a table, take it out" — a whole round of the loop spent on a diagnosis that
 * was never the problem, and an unbounded number of them if the lock never
 * cleared. So the name rules run whatever the metadata pass managed, and only
 * the size rules wait for a size.
 *
 * A DROPPED FILE THAT COULD NOT BE SIZED IS **NOT** UNREADABLE
 * ────────────────────────────────────────────────────────────
 *
 * CON-06 needs a dropped `folder.jpg`'s size to tell a real scan from a Windows
 * thumbnail. When that read failed there is nothing to report: the file is not
 * being imported either way, and blocking on it would stop an import over a
 * genuine 4 KB folder icon the user cannot even see in Explorer. `unreadable`
 * therefore covers the UPLOAD set only — the files whose fate the stage is
 * actually deciding.
 */

import { baseNameOf } from "@/lib/files/file-kinds";
import { uploadKeysOf, type FileMeta } from "./checks";
import { sortedForDisplay, type DirectoryObservation, type FSEntry } from "./folder-utils";
import {
  CONSTRAINT_RULE_IDS,
  FOLDER_THUMBNAIL_NAME,
  THUMBNAIL_BYTES,
  constraintViolationCounts,
  firstBrokenNameRule,
  firstBrokenRule,
  type ConstraintRuleId,
  type ConstraintViolation,
} from "./constraint-rules";

export type ConstraintCheckInput = {
  entries: readonly FSEntry[];
  observations: readonly DirectoryObservation[];
  /**
   * What the metadata pass read. An EMPTY map is a legitimate input and means
   * "the pass ran and got nothing" — every upload file is then `unreadable` and
   * the stage blocks, which is the honest answer. There is no `undefined` case:
   * a caller with no metadata has not run the check yet and must not call this.
   */
  metadata: ReadonlyMap<string, FileMeta>;
};

/**
 * Every constraint the chosen folder breaks, one violation per rule, in fixing
 * order.
 *
 * The list the stage shows. An empty array means no constraint was broken among
 * the files whose details could be read — which is NOT the same as "these files
 * may proceed": see `checkConstraintsStage`, which is what the stage asks.
 */
export function checkConstraints(input: ConstraintCheckInput): ConstraintViolation[] {
  const { entries, observations, metadata } = input;

  const byRule = new Map<ConstraintRuleId, string[]>();
  // ⚠️ Pushes in place. The first draft rebuilt the array — `[...(get() ?? []),
  // path]` — which is quadratic in the number of files breaking ONE rule, and
  // this runs synchronously on the UI thread with no progress cue left moving.
  // Measured by the slice's adversarial review at the walk's own advertised
  // ceiling: 3.1 s at 20,000 files of one kind, 21 s at `MAX_WALK_ENTRIES`.
  const add = (id: ConstraintRuleId, path: string) => {
    const held = byRule.get(id);
    if (held === undefined) byRule.set(id, [path]);
    else held.push(path);
  };

  for (const key of uploadKeysOf(entries)) {
    const meta = metadata.get(key);
    // `baseNameOf` and not the entry's own `name`: a page-group key is
    // `<group path>/<page file>`, and the page file is what the rules are about.
    const name = baseNameOf(key);
    // See "BUT A NAME IS STILL A NAME" in the module header. A file with no
    // metadata is still answered by every rule that reads only its name; only
    // the size rules need the read that failed, and only those files fall
    // through to `unreadable`.
    const broken = meta === undefined ? firstBrokenNameRule(name) : firstBrokenRule(name, meta);
    if (broken !== null) add(broken, key);
  }

  // CON-06 — the one rule about a file the walk has already removed. Its
  // evidence lives in the observations and its size in the metadata map, which
  // covers dropped files precisely so this question can be asked.
  for (const obs of observations) {
    for (const drop of obs.dropped) {
      if (drop.name.toLowerCase() !== FOLDER_THUMBNAIL_NAME) continue;
      const size = metadata.get(drop.path)?.size;
      // `undefined` is not "small" — see the module header on why an unsized
      // drop is passed over in silence rather than reported either way.
      if (size !== undefined && size > THUMBNAIL_BYTES) add("CON-06", drop.path);
    }
  }

  // Emitted in catalogue order, which is the published fixing order — and each
  // list sorted, because the user reads it once before a fix and once after,
  // and a list that reshuffles in between is unusable.
  return CONSTRAINT_RULE_IDS.flatMap((id) => {
    const paths = byRule.get(id);
    if (paths === undefined || paths.length === 0) return [];
    return [
      {
        ruleId: id,
        paths: sortedForDisplay(paths),
        counts: constraintViolationCounts(id, paths.length),
      },
    ];
  });
}

/**
 * Everything the Constraints STAGE needs in order to decide.
 *
 * `checkConstraints` answers "which constraints are broken". That is not the
 * same question as "may these files go through", and the difference is the
 * unreadable case described at length in the module header. A stage that blocks
 * must not print an all-clear when it means "nothing was found in the part that
 * could be read".
 *
 * `clean` is the conjunction, and it is computed here rather than in the
 * component for the usual reason: it is the sentence the whole stage turns on,
 * and a component cannot be tested against the states that produce it.
 */
export type ConstraintVerdict = {
  violations: ConstraintViolation[];
  /**
   * Files the import would upload and whose details could not be read.
   *
   * Complete and sorted, never a sample — every path here is a thing to look
   * at, unlike `StructureTruncationGroup.paths`, where a global budget produces
   * thousands of downstream folders that are all the same problem. Empty in
   * every normal run.
   */
  unreadable: string[];
  /** May Constraints hand over to the next stage? */
  clean: boolean;
};

export function checkConstraintsStage(input: ConstraintCheckInput): ConstraintVerdict {
  const violations = checkConstraints(input);

  // ⚠️ Excludes anything a violation already names. A file that could not be
  // read AND is a `.csv` gets the instruction that resolves it — listing it in
  // both places would hand the user two contradictory sentences about one file,
  // and the "close the program using it" one can never be satisfied for a file
  // whose real problem is its kind.
  const named = new Set(violations.flatMap((v) => v.paths));
  const unreadable = sortedForDisplay(
    uploadKeysOf(input.entries).filter(
      (key) => !input.metadata.has(key) && !named.has(key),
    ),
  );

  return {
    violations,
    unreadable,
    clean: violations.length === 0 && unreadable.length === 0,
  };
}
