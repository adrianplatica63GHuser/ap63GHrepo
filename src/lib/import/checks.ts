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
 * ADVISORY, ALWAYS
 * ────────────────
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
 * What survives is what the STR catalogue does not ask: S-01, still true of
 * today's wizard, which merges every document into one Property until #26.07
 * creates one per folder; S-17, because a shortcut is possible inside a
 * perfectly compliant folder; F-03; and the F-rules about the files
 * themselves, which move to the Constraints stage in #26.05.
 *
 * LOUD AND QUIET
 * ──────────────
 *
 * Findings carry a loudness, and it still earns the disclosure in the panel —
 * but it no longer discriminates much, and saying so is the honest version. The
 * measured near-misses that justified the split (48 folders on Adrian's
 * archive, 20 of them loud) were S-03, S-04 and S-05, and they are gone. Two
 * quiet rules remain: F-17, because an Office file imports faithfully and is
 * merely never read, and F-15, because duplicate titles are survivable — the
 * folder names are still kept as tags. Everything else here is loud, because
 * everything else here loses or corrupts something.
 *
 * ⚠️ That is a claim about the current rule set, not a policy. It was measured
 * once, drifted, and had to be rewritten; if a rule is added, measure it rather
 * than assuming, and rewrite this paragraph again.
 *
 * SCOPE (settled with Adrian)
 * ───────────────────────────
 *
 * Cost tiers T0 (the listing) and T1 (`File` metadata) only. Deliberately NOT
 * here, each for a reason rather than for lack of time:
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
import { classifyFileSource } from "@/lib/metadata/provenance-rules";

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
  | "gateFiles"               // F-05 — the run halts on a modal per file
  | "osDirectories"           // F-03
  | "duplicateBasenames"      // F-15
  | "walkLoopedOnShortcut"    // S-17 — a shortcut makes the folder endless
  | "walkTooManyFolders"      // S-17 — more subfolders than can be read at once
  | "walkTooManyFiles"        // S-17 — more files than can be read at once
  | "officeFiles"             // F-17
  | "heicFiles"               // F-07
  | "oversizedFiles"          // F-08 — T1
  | "emptyFiles"              // F-09 — T1
  | "unknownMimeFiles"        // F-11 — T1
  | "largeFolderJpg";         // F-02 — T1

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
   * advertising itself as exhaustive: F-15 rendered "86 names appear more than
   * once" above exactly five of them. Truncation is a RENDERING decision and
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

/** `pages/route.ts:24` rejects anything larger with a 413, after creating the Document. */
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

/** A real scan named `folder.jpg` is data loss; a genuine Windows thumbnail is tiny. */
const THUMBNAIL_BYTES = 100 * 1024;

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
  /** T1. Absent until the metadata pass has run; its four rules are then skipped. */
  metadata?: ReadonlyMap<string, FileMeta>;
}): ImportReport {
  const { entries, observations, metadata } = input;

  const findings: Finding[] = [
    ...structureFindings(observations),
    ...fileFindings(entries),
    ...truncationFindings(observations),
    ...(metadata ? metadataFindings(entries, observations, metadata) : []),
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

  // F-05 — THE highest-value warning in the catalogue. An extension in
  // neither provenance list yields null provenance, and the import then stops
  // for the ENTIRE run behind a modal that must be answered once per such
  // file. Thirty of them is thirty dropdowns before anything imports.
  const gate = fileNames.filter((f) => classifyFileSource(f.name) === "UNKNOWN");
  if (gate.length > 0) {
    out.push({
      ruleId: "F-05",
      kind: "gateFiles",
      loudness: "loud",
      paths: gate.map((f) => f.path),
      counts: { files: gate.length, extensions: distinctExtensions(gate.map((f) => f.name)) },
    });
  }

  // F-07 — .heic infers IMAGE provenance, so it sails through the gate, and is
  // then invisible to page grouping, to classification and to AI interpret. It
  // uploads and is never read by anything.
  const heic = fileNames.filter((f) => /\.hei[cf]$/i.test(f.name));
  if (heic.length > 0) {
    out.push({
      ruleId: "F-07",
      kind: "heicFiles",
      loudness: "loud",
      paths: heic.map((f) => f.path),
      counts: { files: heic.length },
    });
  }

  // F-17 — there is no text-extraction layer in the codebase at all. Office
  // files are stored faithfully and understood by nothing.
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

  // F-15 — same basename in two folders produces two Documents with identical
  // titles, indistinguishable in every list in the application.
  //
  // It used to be read alongside S-16: duplicates clustering across top-level
  // folders meant several copies of one archive, and picking a different
  // folder was the real remedy. S-16 is gone (#26.02) because a compliant
  // chosen folder cannot hold a copy of itself — a nested archive is a
  // structure violation with one unambiguous instruction. What is left here is
  // the ordinary case S-16 never covered: two genuinely different documents
  // that happen to share a name. #26.06 absorbs this rule into the Duplication
  // stage, where the comparison is by name AND size.
  const byName = new Map<string, string[]>();
  for (const f of fileNames) {
    const key = f.name.toLowerCase();
    byName.set(key, [...(byName.get(key) ?? []), f.path]);
  }
  const dupes = [...byName.values()].filter((paths) => paths.length > 1);
  if (dupes.length > 0) {
    out.push({
      ruleId: "F-15",
      kind: "duplicateBasenames",
      loudness: "quiet",
      // EVERY path, not one example per group. The sentence says "192 files
      // share only 86 names"; listing 86 paths under it would contradict the
      // number directly above them, which is the exact defect that made the
      // first draft of the downloadable report misleading.
      paths: dupes.flat(),
      counts: { names: dupes.length, documents: dupes.reduce((n, p) => n + p.length, 0) },
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
// Metadata (T1) — one getFile() per file has already been paid for
// ---------------------------------------------------------------------------

function metadataFindings(
  entries: readonly FSEntry[],
  observations: readonly DirectoryObservation[],
  metadata: ReadonlyMap<string, FileMeta>,
): Finding[] {
  const out: Finding[] = [];
  const oversized: string[] = [];
  const empty: string[] = [];
  const unknownMime: string[] = [];

  // ⚠️ The metadata map deliberately covers DROPPED files too, because F-02
  // below is the one rule that needs their size. Every other rule here must
  // ignore them, or the report argues about uploads that will never happen:
  // a 25 MB .zip is not "a file that will fail to upload leaving an empty
  // document behind", it is a file the walk removed before any document
  // existed. Measured on Adrian's archive, 27 of 759 sized files are drops,
  // and counting them overstated the upload total by 11.3 MB.
  const uploadKeys = uploadKeysOf(entries);

  for (const path of uploadKeys) {
    const meta = metadata.get(path);
    if (!meta) continue;
    if (meta.size > MAX_UPLOAD_BYTES) oversized.push(path);
    else if (meta.size === 0) empty.push(path);
    // An empty type is only harmful for something the AI would otherwise read.
    if (meta.type === "" && isReadableByAi(path)) unknownMime.push(path);
  }

  // F-08 — 413 from the upload route, AFTER the Document row exists. The row
  // stays behind with no page.
  if (oversized.length > 0) {
    out.push({
      ruleId: "F-08",
      kind: "oversizedFiles",
      loudness: "loud",
      paths: oversized,
      counts: { files: oversized.length, limitMb: Math.round(MAX_UPLOAD_BYTES / 1024 / 1024) },
    });
  }

  // F-09 — 400 "file is required", which reads as a missing field rather than
  // as an empty file, so the message actively misleads.
  if (empty.length > 0) {
    out.push({
      ruleId: "F-09",
      kind: "emptyFiles",
      loudness: "loud",
      paths: empty,
      counts: { files: empty.length },
    });
  }

  // F-11 — the cheapest high-value check in the catalogue. The MIME is frozen
  // at upload and never re-sniffed, so an empty one disables AI extraction for
  // that page permanently — not for this run, forever.
  if (unknownMime.length > 0) {
    out.push({
      ruleId: "F-11",
      kind: "unknownMimeFiles",
      loudness: "loud",
      paths: unknownMime,
      counts: { files: unknownMime.length },
    });
  }

  // F-02 — `folder.jpg` is dropped by NAME. A Windows thumbnail is tiny; a
  // real scan someone happened to name `folder.jpg` is not, and it vanishes
  // with no row and no warning.
  const bigFolderJpgs = observations
    .flatMap((o) => o.dropped)
    .filter((d) => d.name.toLowerCase() === "folder.jpg")
    .filter((d) => (metadata.get(d.path)?.size ?? 0) > THUMBNAIL_BYTES);
  if (bigFolderJpgs.length > 0) {
    out.push({
      ruleId: "F-02",
      kind: "largeFolderJpg",
      loudness: "loud",
      paths: bigFolderJpgs.map((d) => d.path),
      counts: { files: bigFolderJpgs.length },
    });
  }

  return out;
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

function distinctExtensions(names: string[]): number {
  return new Set(names.map((n) => (n.includes(".") ? n.slice(n.lastIndexOf(".")).toLowerCase() : ""))).size;
}

/**
 * Every metadata key the import will actually upload — page-group pages
 * included, dropped files excluded. The exact set `metadataFindings` and
 * `sumBytes` must restrict themselves to.
 */
function uploadKeysOf(entries: readonly FSEntry[]): string[] {
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

