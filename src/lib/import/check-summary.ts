/**
 * check-summary.ts — what a clean check actually looked at.   (Slice #29.11)
 *
 * WHY THIS EXISTS
 * ───────────────
 * Three stages do a real body of work and, when they find nothing wrong, say so
 * in four words. Every structure rule is evaluated, every file is measured
 * against every constraint, both copy rules run over every page — and the
 * user's whole account of it was one clause at the top of the NEXT stage's
 * screen ("Structura folderului este în regulă."). #29.01's F9 is that loss.
 *
 * ⚠️ **HOW MANY RULES THERE ARE IS COUNTED, NEVER WRITTEN DOWN.** The report
 * this slice answers says "fifteen rules"; `STRUCTURE_RULE_IDS` holds fourteen,
 * because STR-06 was retired and STR-15 added. A number in prose is a number
 * that goes stale while the list stays right, so the summaries below read
 * `.length` and no sentence anywhere states a total.
 *
 * ⚠️ **EVERY NUMBER HERE IS DERIVED FROM THE SAME INPUTS THE CHECK ITSELF READ,
 * and none of it re-decides anything.** `summariseStructure` does not ask
 * whether the folder is clean; the caller has the verdict and renders this only
 * for a clean one. That split is deliberate: a summary that could disagree with
 * the verdict beside it is worse than no summary, because it is believed. The
 * rule counts come from the same frozen ID lists the listings on screen are
 * built from, so "toate cele 14 reguli" can never drift from the fourteen rules
 * the user just read.
 *
 * ⚠️ **AND NOTHING HERE NAMES A CHECK THAT DID NOT RUN.** There is one function
 * per stage rather than one function returning everything, so a caller that
 * holds no Duplication verdict cannot accidentally render a Duplication line.
 * `phaseAfterFileChecks` returns `duplicationRan`/`preexistingRan` for the same
 * reason one layer up — see `workflow-stages.ts`.
 *
 * Pure. No React, no translation, no formatting: the numbers come from here and
 * the sentences from `messages/*.json`, which is the split every other module
 * in this folder keeps.
 */

import { uploadKeysOf } from "./checks";
import { perToSlash, type DirectoryObservation, type FSEntry } from "./folder-utils";
import { groupByPropertyFolder } from "./property-folders";
import { CONSTRAINT_RULE_IDS } from "./constraint-rules";
import { DUPLICATION_RULE_IDS } from "./duplication-rules";
import {
  SHARED_FOLDER_NAMES,
  STRUCTURE_RULE_IDS,
  sharedFolderName,
  type SharedFolderName,
} from "./structure-rules";

// ---------------------------------------------------------------------------
// How one property folder's name was read
// ---------------------------------------------------------------------------

/**
 * One property folder's name, split the way the import splits it.
 *
 * ⚠️ **THIS IS THE SINGLE MOST VALUABLE THING THE STRUCTURE STAGE KNOWS AND HAS
 * NEVER SAID.** `parsePropertyFolderName` is positional: everything before the
 * first hyphen is the tarla/sola, everything between the first and the second is
 * the parcela, and everything after the second is free text that is never
 * interpreted and never part of the property's identity. For the folder
 * `47per2-225per3per24-2000 Hascu` that means tarla 47/2, parcela 225/3/24 and
 * "2000 Hascu" discarded — where a human reading the name would have taken 2000
 * for an area and Hascu for a locality.
 *
 * Until this slice the first place that reading appeared was the property
 * dialog, five stages and one paid classification later. It is produced here so
 * that it can be shown at the stage that performed it.
 *
 * ⚠️ **BOTH FORMS OF EACH IDENTIFIER, and the pair is the point.** `written` is
 * what is on disk and what the user has to search for in File Explorer;
 * `stored` is what reaches the database once `perToSlash` has read `per` as the
 * fraction bar. Showing only one of them would either hide the transformation
 * or hide the folder. They are equal whenever the name carries no `per` between
 * two digits, and the renderer is expected to say so once rather than printing
 * an arrow between two identical strings.
 */
export type PropertyNameReading = {
  /** Exactly as it is on disk. */
  folderName: string;
  tarlaWritten: string;
  /** `perToSlash` applied — what the database will hold. */
  tarlaStored: string;
  parcelaWritten: string;
  parcelaStored: string;
  /** Free text after the second hyphen. `null` when the name carries none. */
  description: string | null;
};

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export type StructureCheckSummary = {
  /** How many structure rules were evaluated — the frozen list's own length. */
  rulesChecked: number;
  /** Directories the walk opened, the chosen folder included. */
  directoriesWalked: number;
  /** Top-level property folders found. */
  propertyFolders: number;
  /** Which of the two shared folders hold anything at all. */
  sharedFolders: SharedFolderName[];
  /** Documents the folder will produce — one per walked entry. */
  documents: number;
  /** How many of those are a folder of scanned pages rather than one file. */
  pageGroups: number;
  /** Files the walk kept, page-group pages counted one by one. */
  filesKept: number;
  /** Files the walk dropped before any rule was applied. */
  filesIgnored: number;
  /** One per property folder, in the order the stage lists them. */
  readings: PropertyNameReading[];
};

/**
 * What the structure walk looked at.
 *
 * `observations` and `entries` are the two halves the walk publishes together
 * (`import-wizard.tsx` says why), and both are needed: the directory count and
 * the drops are only in the observations, and the entries are what became
 * documents.
 *
 * ⚠️ **`groupByPropertyFolder`, not a second parse.** The folder list and the
 * name readings come from the same function the property step is built on, fed
 * the same top-level directory listing, so the count shown here and the cards
 * shown five stages later can never disagree about how many properties there
 * are. Seeding from `dirNames` is what makes an EMPTY property folder count —
 * see that function's own note, which was written for exactly this failure.
 */
export function summariseStructure(input: {
  entries: readonly FSEntry[];
  observations: readonly DirectoryObservation[];
}): StructureCheckSummary {
  const { entries, observations } = input;

  const topLevelDirNames =
    observations.find((o) => o.depth === 0)?.dirNames ?? [];
  const grouping = groupByPropertyFolder(entries, topLevelDirNames);

  /**
   * Which shared folders EXIST, not which of them hold anything.
   *
   * ⚠️ **READ FROM THE DIRECTORY LISTING, and an adversarial round is why.**
   * The first version tested `grouping.common.length > 0`, i.e. whether any
   * entry survived the walk under that folder — so a `comune` folder holding
   * only a `.dwg`, a `Thumbs.db` or nothing at all was reported as "niciunul"
   * while the user could see it in File Explorer. Nothing objects to such a
   * folder either: STR-11 is about depth, so the verdict stays clean and the
   * card renders. It is the same bug `groupByPropertyFolder` records for
   * property folders — five on the Structure stage, four here — and it is
   * answered the same way, from `topLevelDirNames`.
   */
  const present = new Set<SharedFolderName>();
  for (const name of topLevelDirNames) {
    const id = sharedFolderName(name);
    if (id !== null) present.add(id);
  }
  // Iterated over the canonical list rather than over the disk listing, so the
  // pair always reads in the same order. `dirNames` is enumeration order — on a
  // FAT-formatted stick that is creation order — and a label that reads
  // "flotante, comune" on one machine and the other way round on the next is
  // the instability every list in this folder is sorted to avoid.
  const sharedFolders: SharedFolderName[] = SHARED_FOLDER_NAMES.filter((id) =>
    present.has(id),
  );

  let pageGroups = 0;
  for (const entry of entries) if (entry.kind === "page-group") pageGroups++;

  let filesIgnored = 0;
  for (const obs of observations) filesIgnored += obs.dropped.length;

  return {
    rulesChecked: STRUCTURE_RULE_IDS.length,
    directoriesWalked: observations.length,
    propertyFolders: grouping.properties.length,
    sharedFolders,
    documents: entries.length,
    pageGroups,
    filesKept: uploadKeysOf(entries).length,
    filesIgnored,
    readings: grouping.properties.map((group) => ({
      folderName: group.folderName,
      tarlaWritten: group.tarlaSola,
      tarlaStored: perToSlash(group.tarlaSola),
      parcelaWritten: group.parcela,
      parcelaStored: perToSlash(group.parcela),
      description: group.description,
    })),
  };
}

// ---------------------------------------------------------------------------
// Constraints
// ---------------------------------------------------------------------------

export type ConstraintsCheckSummary = {
  rulesChecked: number;
  /** Files measured — page-group pages one by one, dropped files excluded. */
  filesMeasured: number;
  /** Documents those files belong to. */
  documents: number;
};

/**
 * What the constraints check measured.
 *
 * ⚠️ **`uploadKeysOf`, which is the checker's own definition of "the files
 * being imported".** Counting the metadata map instead would count the dropped
 * files it deliberately also holds — 27 of 759 on Adrian's archive — and this
 * screen would then report more files measured than the check looked at. That
 * is the mistake `uploadKeysOf` was exported to prevent; see its note.
 *
 * Called only for a clean verdict, where `unreadable` is empty by construction,
 * so every key counted here really was read.
 */
export function summariseConstraints(
  entries: readonly FSEntry[],
): ConstraintsCheckSummary {
  return {
    rulesChecked: CONSTRAINT_RULE_IDS.length,
    filesMeasured: uploadKeysOf(entries).length,
    documents: entries.length,
  };
}

// ---------------------------------------------------------------------------
// Duplication
// ---------------------------------------------------------------------------

export type DuplicationCheckSummary = {
  rulesChecked: number;
  /** Files compared against each other — page-group pages one by one. */
  filesCompared: number;
  /** Documents those files belong to; DUP-02 compares these. */
  documents: number;
};

/** What the duplicate match compared. Same `uploadKeysOf` argument as above. */
export function summariseDuplication(
  entries: readonly FSEntry[],
): DuplicationCheckSummary {
  return {
    rulesChecked: DUPLICATION_RULE_IDS.length,
    filesCompared: uploadKeysOf(entries).length,
    documents: entries.length,
  };
}
