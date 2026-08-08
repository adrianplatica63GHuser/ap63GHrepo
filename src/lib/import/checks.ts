/**
 * src/lib/import/checks.ts — the pre-import report engine.   (Slice #24.02b)
 *
 * Pure. No I/O, no React, no server. It is handed what the walk saw and it
 * returns findings; everything that can fail has already happened by the time
 * this module runs.
 *
 * WHAT THIS IS FOR
 * ────────────────
 *
 * #24.02a stopped the import between the walk and the AI pass and showed four
 * numbers. This fills that gap with the answer to "and will it do what I
 * meant?" — which is a different question from "will it succeed". Almost every
 * rule here describes an import that reports success and produces data the
 * user did not intend. Forty scans of one contract becoming forty separate
 * documents is not an error at any layer: the walk is working exactly as
 * designed, every row goes green, and the archive is wrong.
 *
 * ADVISORY, ALWAYS — AND SINCE #26.05 THAT IS THE WHOLE OF WHAT IS LEFT HERE
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Nothing here blocks. Continuă stays enabled no matter what this returns.
 * That is a decision, not an omission: a checker that blocks needs an override,
 * an override needs a rule for when to use it, and the first false positive
 * teaches the user to reach for it every time. So the report informs and the
 * user decides — which also means every message has to earn its place, because
 * a wall of warnings nobody reads is the same as no warnings at all.
 *
 * ⚠️ WHAT #26.02 TOOK OUT OF THIS FILE, AND WHY IT IS NOT COMING BACK
 * ──────────────────────────────────────────────────────────────────
 *
 * Seven rules left in one commit, every one of them a question
 * `structure-check.ts` now answers from the catalogue in `structure-rules.ts`:
 *
 *   S-16 duplicateArchiveCopies  → a nested copy is a plain STR-04 / STR-10 /
 *                                  STR-12 violation with one instruction
 *   S-03 nearMissSubfolder       → STR-10
 *   S-04 nearMissStrayFile       → STR-12 inside a page folder; and LEGAL in a
 *                                  property folder, where the user declared
 *                                  separate documents by not making a subfolder
 *   S-05 nearMissNaming          → STR-12
 *   S-07 rootIsScanFolder        → STR-01
 *   S-09 pageOrderAmbiguous      → STR-13
 *   S-10 pageNumbersIrregular    → STR-14
 *
 * They were not merely redundant, they were the opposite KIND of answer. Each
 * one inferred what the user probably meant from a folder shape nobody had
 * agreed on, and said so advisorily; an STR rule states what the folder must be
 * and blocks until it is. Two systems answering one question is how they drift,
 * and these two would have drifted in opposite directions — S-04 urging a user
 * to merge exactly the files the new rules say they deliberately kept apart.
 *
 * ⚠️ AND WHAT #26.06 TOOK OUT, ONE STAGE LATER AGAIN
 * ─────────────────────────────────────────────────
 *
 * One rule, F-15 (`duplicateBasenames`), to the Duplication stage's catalogue
 * in `duplication-rules.ts`. Its brief said to absorb it rather than run both,
 * and absorbing it meant changing the test: DUP-01 matches on name AND size,
 * because under #26.01's structure rules every page folder holds a `1.jpg` and
 * a name-only rule would be broken by every compliant archive. The reasoning is
 * written out where the replacement lives.
 *
 * ⚠️ **Nothing replaces it HERE, and that is the point rather than an
 * omission.** Duplication blocks, and it sits before the Evaluation screen this
 * module feeds — so a folder that reaches this report has already been found to
 * hold no copies, and a finding about copies would be dead code with a Romanian
 * sentence attached.
 *
 * ⚠️ AND WHAT #26.05 TOOK OUT, FOR THE SAME REASON ONE STAGE EARLIER
 * ───────────────────────────────────────────────────────────────
 *
 * Five more, this time to the Constraints stage's catalogue in
 * `constraint-rules.ts`, which states them BEFORE the check and blocks until
 * the folder complies:
 *
 *   F-05 gateFiles         → CON-03
 *   F-07 heicFiles         → CON-02
 *   F-08 oversizedFiles    → CON-05
 *   F-09 emptyFiles        → CON-04
 *   F-02 largeFolderJpg    → CON-06
 *
 * Every one of them named a file the import would lose, mangle or halt on, and
 * every one of them said so on the Evaluation screen — i.e. after the folder
 * had been walked, sized and accepted, at the point where acting on the advice
 * meant abandoning the screen the user had finally arrived at.
 *
 * ⚠️ **F-11 was drafted into that list and taken back out**, by the slice's own
 * adversarial review, and the reason is the criterion rather than the rule: a
 * constraint blocks, so it may only name a file the import would genuinely lose
 * or mangle. A file with no reported type uploads, is stored and serves
 * correctly; all that is lost is automatic extraction — which is F-17's
 * situation exactly, and F-17 is why the criterion exists. It also had no
 * remedy that could change the answer, since `File.type` is derived from the
 * name and not from the bytes. So it stays here, and it is quiet now rather
 * than loud: a rule that cannot be acted on must not shout.
 *
 * WHAT SURVIVES, AND WHY EACH ONE IS STILL HERE
 * ─────────────────────────────────────────────
 *
 *  - **S-01** — one picked folder still becomes exactly ONE Property. #26.07
 *    creates one per property folder and will retire this.
 *  - **S-17** — a folder shortcut is possible inside a perfectly compliant
 *    folder. (In today's flow the Structure stage refuses a truncated walk
 *    outright, so this cannot reach the Evaluation screen; it is kept because
 *    the refusal is #26.04's, not this module's, and a report that silently
 *    depended on another stage's behaviour would be wrong the moment that
 *    stage changed.)
 *  - **F-03** — an OS directory is about a FOLDER, not a file, and no
 *    constraint states it.
 *  - **F-11** — see the note above: an unreadable type costs automatic
 *    extraction and nothing else, and there is nothing the user can do about
 *    it, so it informs rather than blocks.
 *  - **F-17** — Office files, and this one is a decision rather than an
 *    omission. An Office file imports faithfully: it is stored, it is
 *    downloadable, and the only thing missing is that nothing in this codebase
 *    reads text out of it. A blocking constraint would tell a business user to
 *    delete or convert every Word document in their archive before importing
 *    anything, which is the shape of the worst near-miss this repo records. It
 *    is advisory because it describes an inconvenience, not a loss, and
 *    advisory findings live here.
 *
 * LOUD AND QUIET
 * ──────────────
 *
 * Findings carry a loudness, and it still earns the disclosure in the panel —
 * but it no longer discriminates much, and saying so is the honest version. The
 * measured near-misses that justified the split (48 folders on Adrian's
 * archive, 20 of them loud) were S-03, S-04 and S-05, and they are gone. Two
 * quiet rules remain: F-17, because an Office file imports faithfully and is
 * merely never read, and F-11, for F-17's reason and because the user cannot
 * act on it at all. (#26.05 made that three by adding F-11 and #26.06 took it
 * back to two by deleting F-15.) Everything else here is loud, because
 * everything else here loses or corrupts something.
 *
 * ⚠️ That is a claim about the current rule set, not a policy. It was measured
 * once, drifted, and had to be rewritten; if a rule is added, measure it rather
 * than assuming, and rewrite this paragraph again.
 *
 * SCOPE (settled with Adrian)
 * ───────────────────────────
 *
 * Cost tiers T0 (the listing) and T1 (`File` metadata), as before — but #26.05
 * moved four of the five T1 rules to the Constraints stage, so what is left of
 * T1 here is F-11 and the `uploadBytes` total. Deliberately NOT here, each for
 * a reason rather than for lack of time:
 *
 *  - **T2 byte-reading** (coordinate-file encodings, PDF headers) — belongs
 *    with the coordinate path that #24.03/#24.04 already own.
 *  - **F-14 duplicate import** — compares the folder against a Property's
 *    existing documents, and the Property is not resolved until the wizard's
 *    property step, which runs AFTER this report. There is nothing to compare
 *    against at this point in the flow.
 *  - **S-12 symlink cycles** — a cycle makes `walkFolder` never return, so the
 *    wizard hangs before any report exists. That is a walk-level fix.
 */

import {
  MAX_WALK_DIRECTORIES,
  MAX_WALK_ENTRIES,
  type DirectoryObservation,
  type FSEntry,
  type IgnoredReason,
} from "./folder-utils";
import { isFileKind, fileKindsOf } from "@/lib/files/file-kinds";

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export type Loudness = "loud" | "quiet";

/**
 * A stable key per finding type. The user-facing sentence lives in
 * `messages/*.json` under `adminImport.wizard.report.finding.<kind>`; nothing
 * here holds display text, so the rules and their wording stay separable.
 */
export type FindingKind =
  | "multipleProperties"      // S-01
  | "osDirectories"           // F-03
  | "walkLoopedOnShortcut"    // S-17 — a shortcut makes the folder endless
  | "walkTooManyFolders"      // S-17 — more subfolders than can be read at once
  | "walkTooManyFiles"        // S-17 — more files than can be read at once
  | "unknownMimeFiles"        // F-11 — T1
  | "officeFiles";            // F-17

export type Finding = {
  /** The catalogue ID, shown to Adrian and Ciprian so a report maps to the spec. */
  ruleId: string;
  kind: FindingKind;
  loudness: Loudness;
  /**
   * Every path this finding covers — the COMPLETE list, never a sample.
   *
   * Each rule used to cap its own paths with a `.slice(0, 5)`, which quietly
   * made this a sample and made the downloadable report a truncated copy
   * advertising itself as exhaustive: the since-deleted F-15 rendered "86 names
   * appear more than once" above exactly five of them. Truncation is a
   * RENDERING decision and
   * belongs to whoever renders — `report-sections.tsx` shows four and says how
   * many it hid; the document shows all of them, which is its whole reason to
   * exist.
   */
  paths: string[];
  /** Interpolated into the message. Keys are per-kind and match the i18n string. */
  counts: Record<string, number>;
};

/** One `File` worth of metadata, keyed by full path from the picked root. */
export type FileMeta = { size: number; type: string };

export type SkippedGroup = {
  reason: IgnoredReason;
  paths: string[];
};

export type ImportReport = {
  findings: Finding[];
  skipped: SkippedGroup[];
  /** Total bytes the run will upload — the parked forecast line, now answerable. */
  uploadBytes: number | null;
  /** Files the walk dropped, across every reason. */
  droppedCount: number;
};

// ---------------------------------------------------------------------------
// Thresholds — named, because a bare number in a condition is a claim nobody
// can check
// ---------------------------------------------------------------------------

/** Directory names that are never content, whatever the walk does with them (F-03). */
const OS_DIRECTORY_NAMES_LC = new Set([
  "$recycle.bin",
  "__macosx",
  "system volume information",
  ".git",
  ".svn",
  ".thumbnails",
  "found.000",
]);

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function checkFolder(input: {
  entries: readonly FSEntry[];
  observations: readonly DirectoryObservation[];
  /**
   * T1. Absent until the metadata pass has run — which, since #26.05, is the
   * Constraints stage's job rather than this report's. Two things read it now:
   * F-11, and the `uploadBytes` total. Both are simply absent without it rather
   * than wrong.
   */
  metadata?: ReadonlyMap<string, FileMeta>;
}): ImportReport {
  const { entries, observations, metadata } = input;

  const findings: Finding[] = [
    ...structureFindings(observations),
    ...fileFindings(entries),
    ...truncationFindings(observations),
    ...(metadata ? metadataFindings(entries, metadata) : []),
  ];

  // Loud first. Within a loudness the catalogue order already encodes
  // severity, so a stable sort is enough — findings must not reshuffle
  // between renders of the same folder.
  const order: Record<Loudness, number> = { loud: 0, quiet: 1 };
  findings.sort((a, b) => order[a.loudness] - order[b.loudness]);

  return {
    findings,
    skipped: groupSkipped(observations),
    uploadBytes: metadata ? sumBytes(entries, metadata) : null,
    droppedCount: observations.reduce((n, o) => n + o.dropped.length, 0),
  };
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

function structureFindings(observations: readonly DirectoryObservation[]): Finding[] {
  const out: Finding[] = [];
  const root = observations.find((o) => o.depth === 0);

  // S-01 — one picked folder becomes exactly ONE Property, silently. Several
  // property-shaped subfolders at the top level means several properties are
  // about to be merged into whichever one the user names in the next step,
  // and nothing downstream ever mentions it again.
  if (root) {
    const propertyShaped = root.dirNames.filter(looksLikePropertyFolder);
    if (propertyShaped.length >= 2) {
      out.push({
        ruleId: "S-01",
        kind: "multipleProperties",
        loudness: "loud",
        paths: propertyShaped,
        counts: { folders: propertyShaped.length },
      });
    }
  }

  // F-03 — the system-file filter applies to FILES only. An OS directory is
  // walked like any other: its contents import, its name becomes a tag on
  // every document beneath it, and its mere presence breaks its parent's
  // page group.
  const osDirs = observations
    .filter((o) => o.depth > 0 && isOsDirectoryName(o.pathParts[o.pathParts.length - 1]))
    .map((o) => o.path);
  if (osDirs.length > 0) {
    out.push({
      ruleId: "F-03",
      kind: "osDirectories",
      loudness: "loud",
      paths: osDirs,
      counts: { folders: osDirs.length },
    });
  }

  return out;
}

/** `^\d` or a `<tarla>-<parcela>` shape — the two ways a property folder is named here. */
function looksLikePropertyFolder(name: string): boolean {
  return /^\d/.test(name.trim());
}

function isOsDirectoryName(name: string | undefined): boolean {
  if (!name) return false;
  return OS_DIRECTORY_NAMES_LC.has(name.toLowerCase()) || name.startsWith(".");
}

// ---------------------------------------------------------------------------
// Files (T0)
// ---------------------------------------------------------------------------

function fileFindings(entries: readonly FSEntry[]): Finding[] {
  const out: Finding[] = [];
  const fileNames: { name: string; path: string }[] = [];
  for (const e of entries) {
    if (e.kind === "file") fileNames.push({ name: e.name, path: e.path });
  }

  // F-17 — there is no text-extraction layer in the codebase at all. Office
  // files are stored faithfully and understood by nothing.
  //
  // ⚠️ It stays ADVISORY, and #26.05 is where that was decided rather than
  // assumed: it was the one file rule not promoted to a blocking constraint,
  // because the file arrives intact and a rule that blocks would be telling a
  // business user to delete their own documents. See the module header.
  const office = fileNames.filter((f) => isFileKind(f.name, "document") && !isFileKind(f.name, "pdf"));
  const officeNonText = office.filter((f) => !/\.(txt|md)$/i.test(f.name));
  if (officeNonText.length > 0) {
    out.push({
      ruleId: "F-17",
      kind: "officeFiles",
      loudness: "quiet",
      paths: officeNonText.map((f) => f.path),
      counts: { files: officeNonText.length },
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// S-17 — the walk stopped early
// ---------------------------------------------------------------------------

/**
 * S-17 — the walk stopped early, and what that means depends on WHY.
 *
 * ⚠️ **The first version of this rule told the user the opposite of the truth.**
 * It said the report was "incomplete" and that every number in it was
 * understated. For the shortcut-loop case — the one it was written for — the
 * numbers are *overstated*, often severalfold: a shortcut pointing at a parent
 * folder makes the walk read the same files again under
 * `Backup/Arhiva/Backup/Arhiva/…`, so a measured five-file archive reported as
 * thirty-one documents, six page groups and twenty-four classification calls
 * instead of four. A user who proceeded would have created twenty-six
 * duplicate Documents and paid six times the AI cost. "Incomplete" invited
 * exactly that. The truth is "do not import this until the shortcut is gone".
 *
 * The three reasons are three separate findings rather than one shared
 * sentence, because their remedies have nothing in common: delete a shortcut,
 * split a folder with too many subfolders, split a folder with too many files.
 * One message covering all three told a user with six thousand legitimate
 * property folders to go and find a shortcut that did not exist.
 */
function truncationFindings(observations: readonly DirectoryObservation[]): Finding[] {
  const BY_REASON = {
    depth: { kind: "walkLoopedOnShortcut", limit: 0 },
    budget: { kind: "walkTooManyFolders", limit: MAX_WALK_DIRECTORIES },
    breadth: { kind: "walkTooManyFiles", limit: MAX_WALK_ENTRIES },
  } as const;

  const out: Finding[] = [];
  for (const reason of ["depth", "budget", "breadth"] as const) {
    const hits = observations.filter((o) => o.truncated === reason);
    if (hits.length === 0) continue;
    const { kind, limit } = BY_REASON[reason];
    // ONE example path, not all of them — the single exception to the "list
    // every affected path" contract the rest of the report follows. A
    // branching loop truncates in thousands of places whose paths are the same
    // folder names in thousands of orders; listing them is noise, not
    // completeness, and `places` still carries the true total.
    //
    // For a loop the example is useful despite its length: the repetition IS
    // the evidence, and `Scurtatura/Acte/Scurtatura/Acte/…` shows the user
    // their own loop. (An earlier version claimed to pick the "shallowest"
    // path. It could not: a depth stop only ever happens at one exact depth,
    // so every candidate tied and the reduce was a no-op dressed as a choice.)
    out.push({
      ruleId: "S-17",
      kind,
      loudness: "loud",
      paths: [hits[0].path],
      counts: { places: hits.length, limit },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Metadata (T1) — what is left of it
// ---------------------------------------------------------------------------

/**
 * F-11 — Windows reported no type for a file something would otherwise read.
 *
 * The MIME is frozen at upload and never re-sniffed, so an empty one disables
 * automatic extraction for that page permanently — not for this run, for ever.
 * Restricted to the files anything WOULD have read, because a missing type on a
 * file nothing was going to open is not worth a sentence.
 *
 * ⚠️ **QUIET, and it must stay quiet.** #26.05 drafted this as a blocking
 * constraint and its adversarial review took it back out: `File.type` comes
 * from the extension by way of the OS registry, not from the bytes, so the rule
 * fires on a `.tif` or a `.bmp` on a machine whose registry has no entry for it
 * — a perfectly good archival scan — and never on the corrupt `.jpg` the draft
 * example described. The file uploads, is stored, and serves correctly. There
 * is also no remedy: re-saving the file does not change what the registry says,
 * so a blocking version would have been a violation the user could work at for
 * ever. It informs; it does not shout, and it must never block.
 *
 * ⚠️ Restricted to the UPLOAD set, not the whole metadata map. The map covers
 * dropped files too, because CON-06 needs a dropped `folder.jpg`'s size, and a
 * report that argued about files the walk had already removed would be telling
 * the user about an import that is not going to happen.
 */
function metadataFindings(
  entries: readonly FSEntry[],
  metadata: ReadonlyMap<string, FileMeta>,
): Finding[] {
  const unknownMime: string[] = [];
  for (const path of uploadKeysOf(entries)) {
    const meta = metadata.get(path);
    if (meta === undefined) continue;
    if (meta.type === "" && isReadableByAi(path)) unknownMime.push(path);
  }
  if (unknownMime.length === 0) return [];
  return [
    {
      ruleId: "F-11",
      kind: "unknownMimeFiles",
      loudness: "quiet",
      paths: unknownMime,
      counts: { files: unknownMime.length },
    },
  ];
}

/** Would anything ever try to read this file's pixels or text? */
function isReadableByAi(path: string): boolean {
  const kinds = fileKindsOf(path);
  return kinds.includes("image") || kinds.includes("pdf");
}

// ---------------------------------------------------------------------------
// Skipped
// ---------------------------------------------------------------------------

function groupSkipped(observations: readonly DirectoryObservation[]): SkippedGroup[] {
  const byReason = new Map<IgnoredReason, string[]>();
  for (const obs of observations) {
    for (const d of obs.dropped) {
      byReason.set(d.reason, [...(byReason.get(d.reason) ?? []), d.path]);
    }
  }
  // Stable, most-surprising first: an extension the user chose to put there
  // beats a hidden file they never see.
  const order: IgnoredReason[] = ["ignored-extension", "system-file", "hidden"];
  return order
    .filter((r) => byReason.has(r))
    .map((reason) => ({ reason, paths: byReason.get(reason)! }));
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/**
 * Every metadata key the import will actually upload — page-group pages
 * included, dropped files excluded.
 *
 * ⚠️ Exported since #26.05, and it is the reason `constraint-check.ts` does not
 * decide for itself what "the files being imported" means. The metadata map
 * deliberately covers DROPPED files too, because CON-06 needs a dropped
 * `folder.jpg`'s size — so any consumer that iterated the map instead would be
 * measuring files the walk has already removed, and would tell the user a 25 MB
 * `.zip` is too big to upload when nothing was ever going to upload it.
 * Measured on Adrian's archive: 27 of 759 sized files are drops.
 */
export function uploadKeysOf(entries: readonly FSEntry[]): string[] {
  const keys: string[] = [];
  for (const entry of entries) {
    if (entry.kind === "file") {
      keys.push(metadataKeyFor(entry.path));
    } else {
      for (const handle of entry.handles) keys.push(metadataKeyFor(entry.path, handle.name));
    }
  }
  return keys;
}

function sumBytes(entries: readonly FSEntry[], metadata: ReadonlyMap<string, FileMeta>): number {
  let total = 0;
  for (const key of uploadKeysOf(entries)) total += metadata.get(key)?.size ?? 0;
  return total;
}

/** Exported for the metadata pass, so the key convention has exactly one definition. */
export function metadataKeyFor(entryPath: string, pageFileName?: string): string {
  return pageFileName === undefined ? entryPath : `${entryPath}/${pageFileName}`;
}
