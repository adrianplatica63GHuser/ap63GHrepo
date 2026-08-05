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
 * LOUD AND QUIET
 * ──────────────
 *
 * Findings carry a loudness, and the split is empirical rather than aesthetic.
 *
 * Measured by running this module over Adrian's archive: 48 folders miss
 * page-group detection, splitting 20 on how the FILES are named (S-05), 11 on
 * numbered scans sharing a folder with other files (S-04), and 17 on the
 * folder having a subdirectory (S-03). Of those 48, exactly 8 are loud —
 * every one a genuine page sequence (`CVC 1 pg 1.jpg`/`CVC 1 pg 2.jpg`,
 * `TP 36034 fata.jpg`/`verso.jpg`) — plus the 11 S-04 folders and one
 * multi-property root, for 20 loud findings across the whole archive.
 *
 * Subfolder misses are quiet because they are overwhelmingly property folders
 * behaving exactly as intended, and because that is also where the biggest
 * folders live: a size threshold would have shouted about the 27-image and
 * 17-image folders that are fine and whispered about the 2-image pairs that
 * are not.
 *
 * These numbers are load-bearing — they are the entire justification for the
 * loudness policy. If a rule changes, re-measure rather than assuming, and
 * update this paragraph. It has already been wrong once.
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
  type DirectoryObservation,
  type FSEntry,
  type IgnoredReason,
} from "./folder-utils";
import { isFileKind, fileKindsOf, isPageGroupMember } from "@/lib/files/file-kinds";
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
  | "rootIsScanFolder"        // S-07
  | "nearMissNaming"          // S-05 — images, none with a plain-number name
  | "nearMissStrayFile"       // S-04 — numbered scans + something else
  | "nearMissSubfolder"       // S-03 — a subdirectory disqualified the folder
  | "pageOrderAmbiguous"      // S-09 — two pages parse to the same number
  | "pageNumbersIrregular"    // S-10 — gaps, or a >10x magnitude spread
  | "multipleProperties"      // S-01
  | "gateFiles"               // F-05 — the run halts on a modal per file
  | "osDirectories"           // F-03
  | "duplicateBasenames"      // F-15
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
  /** What to look at. Capped by the caller when rendering, never here. */
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

/** S-10: scanner counters vs page numbers. `5449.jpg` beside `31316.jpg` is not page 1 and page 2. */
const PAGE_MAGNITUDE_SPREAD = 10;

/** Above this, a trailing number in a filename is a year or a receipt number, not a page. */
const MAX_PAGE_NUMBER = 50;

/** Below this a folder is not "trying" to be a page group, it is just a folder. */
const MIN_IMAGES_FOR_NEAR_MISS = 2;

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
    ...pageGroupFindings(observations),
    ...structureFindings(observations),
    ...fileFindings(entries),
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
// Page groups — the highest-surprise class, and the reason this screen exists
// ---------------------------------------------------------------------------

function pageGroupFindings(observations: readonly DirectoryObservation[]): Finding[] {
  const out: Finding[] = [];

  for (const obs of observations) {
    if (obs.becamePageGroup) {
      out.push(...pageOrderFindings(obs));
      continue;
    }

    const images = obs.keptNames.filter((n) => isFileKind(n, "image"));
    if (images.length < MIN_IMAGES_FOR_NEAR_MISS) continue;

    const numbered = obs.keptNames.filter(isPageGroupMember);

    // S-07 — numbered scans at the PICKED ROOT can never be a page group, no
    // matter how perfect the names, because the rule requires depth > 0. It
    // almost always means the user picked the scan folder itself instead of
    // its parent, and the whole run is one document's worth of pages exploded
    // into one document each. Loud, and first.
    if (obs.depth === 0) {
      if (numbered.length >= MIN_IMAGES_FOR_NEAR_MISS) {
        out.push({
          ruleId: "S-07",
          kind: "rootIsScanFolder",
          loudness: "loud",
          paths: numbered.slice(0, 6),
          counts: { numbered: numbered.length, total: obs.keptNames.length },
        });
      }
      continue;
    }

    // S-03 — quiet. A subdirectory disqualifies the folder outright, and on
    // real archives this is overwhelmingly a property folder doing its job.
    if (obs.dirNames.length > 0) {
      out.push({
        ruleId: "S-03",
        kind: "nearMissSubfolder",
        loudness: "quiet",
        paths: [obs.path, ...obs.dirNames.slice(0, 4)],
        // `documents` is this folder's OWN files only — its subfolders produce
        // their own documents on top. The Romanian says "fișierele sale" for
        // that reason; do not reword it into a subtree total it is not.
        counts: { documents: obs.keptNames.length, subfolders: obs.dirNames.length },
      });
      continue;
    }

    // S-04 — loud. Two or more numbered scans sit here alongside other files,
    // so the numbered ones are a page sequence that will be exploded.
    //
    // Two things had to be right for this to be safe. It needs ≥2 numbered
    // files, or `Donatie 2279 1998` — one scanner-counter name (`5421.jpg`)
    // among four meaningful ones — would be diagnosed here instead of as the
    // naming near-miss it actually is. And the advice must be "move the
    // NUMBERED files into their own folder", never "move the odd files out":
    // the second is destructive whenever the odd files are the majority,
    // which on the real archive they usually are (13 of 26, 12 of 20, 13 of
    // 15). Moving the numbered ones is correct at every ratio.
    if (numbered.length >= MIN_IMAGES_FOR_NEAR_MISS) {
      const strays = obs.keptNames.filter((n) => !isPageGroupMember(n));
      out.push({
        ruleId: "S-04",
        kind: "nearMissStrayFile",
        loudness: "loud",
        paths: [obs.path, ...strays.slice(0, 5)],
        counts: {
          numbered: numbered.length,
          total: obs.keptNames.length,
          strays: strays.length,
          documentsNow: obs.keptNames.length,
        },
      });
      continue;
    }

    // S-05 — nothing is a bare number. Whether that is an accident depends
    // entirely on whether the names look like a SEQUENCE: "CVC 1 pg 1.jpg" and
    // "CVC 1 pg 2.jpg" are two pages of one document about to become two
    // documents, whereas "contract.jpg" and "plan.jpg" are two documents that
    // are meant to be two documents. Firing loudly on both would have meant 17
    // loud findings on Adrian's archive where roughly half are correct
    // behaviour — and a warning list that is half noise is one nobody reads.
    out.push({
      ruleId: "S-05",
      kind: "nearMissNaming",
      loudness: looksLikePageSequence(images) ? "loud" : "quiet",
      paths: [obs.path, ...images.slice(0, 5)],
      counts: { images: images.length, documentsNow: obs.keptNames.length },
    });
  }

  return out;
}

/**
 * Do these filenames read as pages of ONE document rather than as separate
 * documents that happen to share a folder?
 *
 * Two patterns, both taken from Adrian's archive rather than invented:
 *
 *  1. A shared stem plus a varying tail that carries a digit —
 *     `CVC 1 pg 1.jpg` / `CVC 1 pg 2.jpg`, `Donatie pg1.jpg` / `Donatie pg2.jpg`.
 *  2. Romanian recto/verso markers — `TP 36034 fata.jpg` / `TP 36034 verso.jpg`,
 *     which are the two sides of one sheet and are never two documents.
 *
 * Deliberately conservative. A false positive here costs a loud warning about
 * a folder that is fine, which is exactly the currency this screen cannot
 * afford to debase.
 */
function looksLikePageSequence(names: readonly string[]): boolean {
  if (names.length < 2) return false;
  const stems = names.map((n) => baseName(n).toLowerCase().trim());
  if (new Set(stems).size !== stems.length) return false;   // identical stems: not a sequence

  // Pattern 2 — every name carries a side marker.
  //
  // The boundary is a Unicode lookahead, NOT `\b`. `\b` is ASCII-only, so a
  // `\b` after "față" can never match: `ă` is not a word character, so the
  // assertion demands a word char before the position and finds none. The
  // archive happens to spell it "fata", which is exactly why this would have
  // shipped — folder-utils.ts documents the same trap at length for
  // `folderNameToTitleHint` and this rule has to obey it too.
  const SIDE = /(fata|față|fața|verso|recto)(?![\p{L}])/iu;
  if (stems.every((s) => SIDE.test(s))) return true;

  // Pattern 1 — a shared stem, and tails that are PAGE NUMBERS.
  //
  // "contains a digit" is far too weak on Romanian filenames: `contract
  // 2019.jpg` / `contract 2020.jpg` are two contracts, `chit 0813.jpg` /
  // `chit 6601.jpg` are two receipts, and both would read as a page sequence.
  // What actually distinguishes pages is that their numbers are SMALL and
  // CONSECUTIVE — pages run 1, 2, 3, not 2019, 2020. So the tails must parse
  // to distinct small integers forming one contiguous run that starts at the
  // beginning.
  const prefix = commonPrefix(stems);
  if (prefix.length < 3) return false;

  const tails = stems.map((s) => s.slice(prefix.length));
  const numbers = tails.map(trailingInteger);
  if (numbers.some((n) => n === null)) return false;

  const values = numbers as number[];
  if (new Set(values).size !== values.length) return false;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return (
    max <= MAX_PAGE_NUMBER &&
    min <= 2 &&
    max - min + 1 === values.length
  );
}

/** The last run of digits in a string, or null when it holds none. */
function trailingInteger(value: string): number | null {
  const match = value.match(/(\d+)\D*$/);
  return match ? parseInt(match[1], 10) : null;
}

function commonPrefix(values: readonly string[]): string {
  if (values.length === 0) return "";
  let prefix = values[0];
  for (const v of values.slice(1)) {
    let i = 0;
    while (i < prefix.length && i < v.length && prefix[i] === v[i]) i++;
    prefix = prefix.slice(0, i);
    if (prefix === "") break;
  }
  return prefix;
}

/**
 * Hazards inside a folder that DID become one document — where the damage is
 * not the document count but the order of its pages, written to the DB as an
 * authoritative `pageNumber`.
 */
function pageOrderFindings(obs: DirectoryObservation): Finding[] {
  const out: Finding[] = [];
  const numbers = obs.keptNames.map((n) => parseInt(baseName(n), 10)).filter(Number.isFinite);
  if (numbers.length < 2) return out;

  // S-09 — "1.jpg" and "01.jpg" both parse to 1. The comparator returns 0 and
  // the resulting order is whatever the sort happened to do.
  const seen = new Set<number>();
  const collided = new Set<number>();
  for (const n of numbers) {
    if (seen.has(n)) collided.add(n);
    seen.add(n);
  }
  if (collided.size > 0) {
    out.push({
      ruleId: "S-09",
      kind: "pageOrderAmbiguous",
      loudness: "loud",
      paths: [obs.path],
      counts: { collisions: collided.size, pages: numbers.length },
    });
  }

  // S-10 — a scanner counter rather than a page number. `5449.jpg` next to
  // `31316.jpg` is a page group whose order is decided by an arbitrary
  // sequence, and nothing downstream doubts it.
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const contiguous = max - min + 1 === numbers.length;
  const wideSpread = min > 0 && max / min > PAGE_MAGNITUDE_SPREAD;
  if (!contiguous || wideSpread) {
    out.push({
      ruleId: "S-10",
      kind: "pageNumbersIrregular",
      loudness: "quiet",
      paths: [obs.path],
      counts: { pages: numbers.length, lowest: min, highest: max },
    });
  }

  return out;
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
        paths: propertyShaped.slice(0, 8),
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
      paths: osDirs.slice(0, 6),
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
      paths: gate.slice(0, 8).map((f) => f.path),
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
      paths: heic.slice(0, 6).map((f) => f.path),
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
      paths: officeNonText.slice(0, 6).map((f) => f.path),
      counts: { files: officeNonText.length },
    });
  }

  // F-15 — same basename in two folders produces two Documents with identical
  // titles, indistinguishable in every list in the application.
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
      paths: dupes.slice(0, 5).map((paths) => paths[0]),
      counts: { names: dupes.length, documents: dupes.reduce((n, p) => n + p.length, 0) },
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
      paths: oversized.slice(0, 6),
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
      paths: empty.slice(0, 6),
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
      paths: unknownMime.slice(0, 6),
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
      paths: bigFolderJpgs.slice(0, 5).map((d) => d.path),
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

function baseName(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? name : name.slice(0, dot);
}

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

