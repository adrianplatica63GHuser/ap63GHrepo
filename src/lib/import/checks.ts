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
 * adversarial review, and it then outlived its own premise here. #34.12 deleted
 * it; the record is the next section, because the reason it was never a
 * constraint is not the reason it is gone.
 *
 * ⚠️ AND WHAT #34.12 DELETED, ONCE #34.06 HAD REMOVED ITS PREMISE
 * ──────────────────────────────────────────────────────────────
 *
 * One rule, F-11 (`unknownMimeFiles`), and it went nowhere: no catalogue took
 * it over, because there was nothing left to state.
 *
 * It said an empty `File.type` disabled automatic extraction for that page for
 * ever, the MIME being frozen at upload and never re-sniffed. **#34.06 closed
 * that gap**: the upload route derives the recorded type from the file NAME,
 * the serving route from the stored path, and `ai-interpret` from the name
 * again. From that commit the finding reported a fact with no consequence — a
 * sentence on the Evaluation screen that named files and asked nothing of the
 * user, which is the cost this module's own LOUD AND QUIET section is written
 * to avoid. Its copy was reworded then to stop promising a consequence; the
 * honest end of that is deletion, and #34.12 is it.
 *
 * ⚠️ **AND IT IS ONE SENTENCE FEWER ONLY UNTIL IT IS THE LAST ONE.** For an
 * archive of registry-less `.tif` scans with nothing dropped and a clean
 * pre-existing verdict, F-11 was the finding keeping `reportHasNothingToSay`
 * false. Those folders now take `import-wizard.tsx`'s pruned path
 * (`preexistingResultOnly`), so the whole „De verificat înainte de a continua"
 * section stops being mounted on the Pre-existing screen — and its „Descarcă
 * această listă" goes with it, which is where the saved page and the forecast
 * inside that page go too. (The forecast PANEL is `FolderForecast`, one screen
 * later under `phase === "folder-report"`, and is not affected.) That is the
 * designed behaviour of a predicate this slice did not touch, and it is right —
 * a report with nothing to say should not draw a panel — but it is a bigger
 * change on screen than one quiet sentence, and it is the half a user notices.
 *
 * ⚠️ **`F-11` IS RETIRED, NOT FREE.** `ruleId` is what Adrian and Ciprian map a
 * saved report back to the spec with, so a later rule wearing that identifier
 * would make an old report say something it never said. A report saved to disk
 * before #34.12 keeps its own copy of the sentence — nothing regenerates it and
 * nothing should try. Pick the next unused number instead.
 *
 * ⚠️ **AND IT DID NOT BECOME A CONSTRAINT ON ITS WAY OUT.** The reasoning that
 * kept it advisory is still live and is recorded where a candidate constraint
 * is judged — `constraint-rules.ts`, the admission-test section: `File.type`
 * comes from the extension by way of the OS registry, not from the bytes, so a
 * rule on it fires on a perfectly good archival `.tif` and never on the corrupt
 * `.jpg` its draft example described, and no remedy the user could apply would
 * change the answer. Deleting a quiet rule is not a licence to re-open it loud.
 *
 * ⚠️ AND WHAT #26.07 MADE FALSE, RETIRED HERE AT LAST
 * ───────────────────────────────────────────────────
 *
 * One rule, S-01 (`multipleProperties`), and it is worth recording why it
 * outlived by so long the slice that made it false.
 *
 * It fired when the picked folder held two or more property-shaped subfolders,
 * and it said: the import links ALL documents to a single property, so they
 * will be merged into one. That was true under #23.00, where the chosen folder
 * WAS one Property. #26.07 rebuilt the property step around one Property per
 * property subfolder — `property-step-dialog.tsx` spells the arithmetic out in
 * its header — and from that commit this sentence was false. The bullet below
 * said so ("#26.07 creates one per property folder and will retire this") and
 * then nobody did.
 *
 * ⚠️ **It was not merely stale. It was the most alarming sentence in the
 * stage, in red, and `import-wizard.tsx` draws this report under the
 * Already-in-the-system panel — the screen whose own Continuă is the first
 * click in the run that spends money.** A user who believed it had one
 * reasonable response, which was to stop; and stopping is how they never found
 * out it was wrong. A false warning costs more than a missing one, and this
 * one charged it at the worst moment in the wizard.
 *
 * ⚠️ **Nothing replaces it, and that is the point rather than an omission.**
 * The condition it detected — several property folders under one picked
 * folder — is now the ordinary, intended shape: STR-02 permits up to five of
 * them, and the property step lists every one, with its own confirmation, two
 * screens later. A finding here would be a loud advisory about a folder that
 * is correct, which is exactly what LOUD AND QUIET below exists to prevent.
 *
 * WHAT SURVIVES, AND WHY EACH ONE IS STILL HERE
 * ─────────────────────────────────────────────
 *
 *  - **S-17** — a folder shortcut is possible inside a perfectly compliant
 *    folder. (In today's flow the Structure stage refuses a truncated walk
 *    outright, so this cannot reach the Evaluation screen; it is kept because
 *    the refusal is #26.04's, not this module's, and a report that silently
 *    depended on another stage's behaviour would be wrong the moment that
 *    stage changed.)
 *  - **F-03** — an OS directory is about a FOLDER, not a file, and no
 *    constraint states it.
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
 * archive, 20 of them loud) were S-03, S-04 and S-05, and they are gone. **One
 * quiet rule remains: F-17**, because an Office file imports faithfully and is
 * merely never read. (#26.05 made it three by adding F-11, #26.06 took it back
 * to two by deleting F-15, and #34.12 to one by deleting F-11.) Everything else
 * here is loud, because everything else here loses or corrupts something.
 *
 * ⚠️ That is a claim about the current rule set, not a policy. It was measured
 * once, drifted, and had to be rewritten; if a rule is added, measure it rather
 * than assuming, and rewrite this paragraph again.
 *
 * SCOPE (settled with Adrian)
 * ───────────────────────────
 *
 * Cost tiers T0 (the listing) and T1 (`File` metadata), as before — but #26.05
 * moved three of the four T1 rules to the Constraints stage (F-08, F-09, F-02;
 * the other two it moved, F-05 and F-07, were T0 name rules) and #34.12 deleted
 * the fourth, so **no rule here reads `File` metadata any more**: all that is
 * left of T1 is the `uploadBytes` total. Deliberately NOT here, each for a
 * reason rather than for lack of time:
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
import { isFileKind } from "@/lib/files/file-kinds";

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

export type Loudness = "loud" | "quiet";

/**
 * A stable key per finding type. The user-facing sentence lives in
 * `messages/*.json` under `adminImport.wizard.report.finding.<kind>`; nothing
 * here holds display text, so the rules and their wording stay separable.
 *
 * ⚠️ **A LIST AT RUNTIME, NOT ONLY A UNION AT COMPILE TIME**, and #34.12 is
 * where that changed. `report-sections.tsx` resolves the sentence with
 * ``t(`finding.${kind}`)`` — a key built at run time — so TypeScript cannot see
 * the message file at all: a kind added without its copy, or copy deleted
 * without its kind, is a raw key path rendered at the user under
 * `DEFAULT_LOCALE` (`ro-RO`, which does not fall back to English). Deleting
 * F-11 meant deleting one member and two message keys with nothing tying them
 * together; this array is what lets `import-checks.test.ts` tie them, in both
 * directions and in both locales.
 *
 * ⚠️ **`Object.freeze`, not `as const` alone**, because `as const` is erased at
 * runtime and an unfrozen module-level array is a shared mutable that one
 * caller can `sort()` or `push()` on behalf of the whole process. Today the
 * only runtime reader is `import-checks.test.ts` — the engine below never
 * touches it — so this is the same defensive convention every other catalogue
 * in this folder follows (`constraint-rules.ts`, `structure-rules.ts`,
 * `preflight.ts`), not a fix for a live hazard. **The order below is
 * documentation, not display order** — what reaches the panel is the order
 * `checkFolder` pushes findings in, then the loud/quiet sort. The two agree
 * today within a loudness; if you add a kind here, put it where it reads best
 * and set its position on screen in `checkFolder`.
 */
export const FINDING_KINDS = Object.freeze([
  "osDirectories",           // F-03
  "walkLoopedOnShortcut",    // S-17 — a shortcut makes the folder endless
  "walkTooManyFolders",      // S-17 — more subfolders than can be read at once
  "walkTooManyFiles",        // S-17 — more files than can be read at once
  "officeFiles",             // F-17
] as const);

export type FindingKind = (typeof FINDING_KINDS)[number];

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
   * Constraints stage's job rather than this report's. **Exactly one thing
   * reads it: the `uploadBytes` total**, which is simply absent without it
   * rather than wrong — and `uploadBytes` is itself the WHOLE-folder sum, which
   * since #26.08 no panel shows (both draw `import-wizard.tsx`'s
   * `uploadBytesToImport`, over the entries the run will actually import; the
   * comment there says why the report's own number is not narrowed to match).
   * F-11 was the other reader until #34.12 deleted it, so no FINDING depends on
   * this argument today — but it is still handed in, and an advisory rule that
   * needs `File` metadata is still welcome to read it. Which side of the line a
   * new rule falls on is the admission test in `constraint-rules.ts`, not this
   * parameter: blocks → there, informs → here.
   */
  metadata?: ReadonlyMap<string, FileMeta>;
}): ImportReport {
  const { entries, observations, metadata } = input;

  const findings: Finding[] = [
    ...structureFindings(observations),
    ...fileFindings(entries),
    ...truncationFindings(observations),
  ];

  // Loud first. Within a loudness the PUSH order above already encodes
  // severity, so a stable sort is enough — findings must not reshuffle
  // between renders of the same folder. (Push order, not `FINDING_KINDS`
  // order: since #34.12 there is a runtime array in this file that also calls
  // itself the catalogue, and it is documentation. The two agree today.)
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

// ⚠️ A "Metadata (T1)" section stood here until #34.12 — `metadataFindings`
// and its private helper `isReadableByAi` — and both went with F-11; the
// header records why. One thing is worth keeping at the site, because it is
// how this file came to hold a stale predicate for two slices without anyone
// noticing. `isReadableByAi` was `isImageOrPdf` from `@/lib/files/file-kinds`
// re-typed body-for-body under another name, and **NO GUARD IN THE REPO COULD
// HAVE SEEN IT.** `upload-file-types.test.ts` → "is the predicate the wizard
// and the forecast both ask" reads four hand-written paths, and this file is
// not one of them — but even widened to a walk of `src/`, its test is
// `not.toContain("isImageOrPdf")`, and the clone never contained that string.
// `file-kinds-single-source.test.ts` does walk `src/`, and it looks for
// extension LITERALS, which the clone did not hold either. So: a copy under a
// new name is invisible to every guard this repo has, and the only defence is
// the habit — import the predicate, never re-type its body.

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
