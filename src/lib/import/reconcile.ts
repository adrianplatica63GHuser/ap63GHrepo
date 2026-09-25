/**
 * Import reconciliation — what became of every file in a source folder.
 *                                                        (Slice #36.22, FU-012)
 *
 * After an import, one question: for each file in the folder that was picked,
 * did it land (which document, which page), was it set aside by a rule (which
 * rule), or is it missing? Missing is the only answer that is a defect.
 *
 * ⚠️ **EVERY RULE HERE IS THE WIZARD'S OWN, IMPORTED — NONE IS RESTATED.**
 * "Set aside" must mean what the wizard means, so the expectations are built by
 * running the wizard's own walk (`walkFolder`, whose observer reports every file
 * `classifyIgnoredFileName` dropped and every directory a walk limit refused),
 * the wizard's own grouping (`groupByPropertyFolder`: property folder, `comune`,
 * `flotante`, or neither), the wizard's own coordinate-file choice
 * (`PropertyFolderGroup.coordinateFile`), its own title (`titleForEntry`) and
 * its own tags (`tagsForEntry`). The precedent and the reason are in
 * `scripts/testing/measure-title-loss.ts`: a re-implementation drifts, and is
 * believed. The one thing this module decides for itself is how a file is
 * FOUND again, below.
 *
 * ⚠️ **HOW A FILE IS FOUND: `(file_name, file_size)`, then the title, then the
 * tags.** The relative path is stored nowhere (FU-012's evidence), so a page is
 * matched to a source file the way `Check-ImportHealth.ps1` settled on after
 * titles proved useless — by its original file name and byte size. That pair
 * alone is not enough: the archive often already holds the same file under an
 * earlier import, and two folders of one import can hold the same scan. So a
 * candidate page is this import's only when its document's `import_title` is
 * the title the wizard derives for the entry, and the document carries every
 * tag the wizard writes for it (root folder, property folder, page folder,
 * lower-cased as `addEntityTag` stores them). Where two candidates still
 * qualify, the verdict says so — `ambiguous` — rather than guessing.
 *
 * Tags are only written when the person answers „Da, pregătește etichetele" in
 * the wizard's tag dialog. A document with the right title and none of the tags
 * still counts as landed, with a note saying the tags are absent, when it is
 * the only such document; two of them are `ambiguous`. The other way round too:
 * a document imported before #32.06 has no `import_title` at all, and one that
 * carries every tag counts as landed, with a note — measured on the first run,
 * where `01.smoke.one.property`'s August documents have tags and no import
 * title, and a later import of the same folder has the title and no tags.
 *
 * PURE MODULE — no fs, no database, no React. The Node walk adapter and the
 * read-only query live in `scripts/testing/reconcile-import.ts`; the rules and
 * the query text live here so jest can pin them.
 */

import {
  entryFileNames,
  tagsForEntry,
  walkFolder,
  type DirectoryObservation,
  type FSDirectoryHandle,
  type FSEntry,
  type FSFileHandle,
  type IgnoredReason,
  type WalkLimit,
} from "./folder-utils";
import { groupByPropertyFolder } from "./property-folders";
import { titleForEntry } from "./preexisting-check";
import { checkStructureStage } from "./structure-check";

// ---------------------------------------------------------------------------
// What the source folder says should be in the database
// ---------------------------------------------------------------------------

/** Where the wizard files an entry — `groupByPropertyFolder`'s four buckets. */
export type Bucket = "property" | "comune" | "flotante" | "unassigned";

export type SourceFile = {
  /** Path from the picked folder, forward slashes, file name included. */
  path: string;
  name: string;
  size: number;
};

export type PageExpectation = {
  kind: "page";
  file: SourceFile;
  /** The entry the file belongs to: itself, or its page folder. */
  entryPath: string;
  entryKind: FSEntry["kind"];
  /** The document title the wizard stores as `import_title`. */
  title: string;
  /** 1-based, in the wizard's page order (sorted numeric names for a page group). */
  pageNumber: number;
  pageCount: number;
  /** The tags the wizard writes, as `addEntityTag` stores them. */
  tags: string[];
  bucket: Bucket;
  /** The property folder the entry sits under, when the bucket is "property". */
  propertyFolder: string | null;
  /** Set when this is the coordinate file the wizard reads that folder's corners from. */
  coordinateFor: string | null;
};

export type SetAsideExpectation = {
  kind: "set-aside";
  file: SourceFile;
  reason: IgnoredReason;
};

export type NotReadExpectation = {
  kind: "not-read";
  /** The directory the walk refused, from the picked folder. */
  path: string;
  limit: WalkLimit;
};

export type Expectation = PageExpectation | SetAsideExpectation | NotReadExpectation;

export type SourcePlan = {
  rootName: string;
  expectations: Expectation[];
  /** The wizard's own Structure verdict on the folder: the rules it would enforce. */
  structure: { clean: boolean; problems: string[] };
};

/** `addEntityTag` stores `tag.trim().toLowerCase()`; compare in that form. */
export function normaliseTag(tag: string): string {
  return tag.normalize("NFC").trim().toLowerCase();
}

function nfc(s: string): string {
  return s.normalize("NFC");
}

async function sizeOf(handle: FSFileHandle): Promise<number> {
  return (await handle.getFile()).size;
}

/**
 * Walk the source folder exactly as the wizard does, and say what each file
 * should have become.
 */
export async function planSourceFolder(root: FSDirectoryHandle): Promise<SourcePlan> {
  const observations: DirectoryObservation[] = [];
  const entries = await walkFolder(root, [], (o) => observations.push(o));

  const verdict = checkStructureStage(observations);
  const problems = [
    ...verdict.violations.map((v) => `${v.ruleId} ${v.culprit === "" ? root.name : v.culprit}`),
    ...verdict.truncations.map((t) => `walk limit "${t.limit}" at ${t.paths.join(", ")}`),
  ];

  const topDirNames = observations.find((o) => o.depth === 0)?.dirNames ?? [];
  const grouping = groupByPropertyFolder(entries, topDirNames);
  const bucketOf = new Map<string, { bucket: Bucket; propertyFolder: string | null }>();
  const coordinateOf = new Map<string, string>();
  for (const g of grouping.properties) {
    for (const e of g.entries) bucketOf.set(e.path, { bucket: "property", propertyFolder: g.folderName });
    if (g.coordinateFile) coordinateOf.set(g.coordinateFile.path, g.folderName);
  }
  for (const e of grouping.common) bucketOf.set(e.path, { bucket: "comune", propertyFolder: null });
  for (const e of grouping.floating) bucketOf.set(e.path, { bucket: "flotante", propertyFolder: null });
  for (const e of grouping.unassigned) bucketOf.set(e.path, { bucket: "unassigned", propertyFolder: null });

  const expectations: Expectation[] = [];

  for (const entry of entries) {
    const handles = entry.kind === "page-group" ? entry.handles : [entry.handle];
    const names = entryFileNames(entry);
    const tags = [...new Set(tagsForEntry(root.name, entry).map(normaliseTag).filter((t) => t !== ""))];
    const where = bucketOf.get(entry.path) ?? { bucket: "unassigned" as const, propertyFolder: null };
    for (let i = 0; i < handles.length; i++) {
      const name = names[i];
      expectations.push({
        kind: "page",
        file: {
          path: entry.kind === "page-group" ? `${entry.path}/${name}` : entry.path,
          name,
          size: await sizeOf(handles[i]),
        },
        entryPath: entry.path,
        entryKind: entry.kind,
        title: titleForEntry(entry),
        // bulk-import-dialog uploads a group's sorted handles as pages i + 1.
        pageNumber: i + 1,
        pageCount: handles.length,
        tags,
        bucket: where.bucket,
        propertyFolder: where.propertyFolder,
        coordinateFor: entry.kind === "file" ? (coordinateOf.get(entry.path) ?? null) : null,
      });
    }
  }

  for (const o of observations) {
    for (const d of o.dropped) {
      expectations.push({
        kind: "set-aside",
        file: { path: d.path, name: d.name, size: await sizeOf(d.handle) },
        reason: d.reason,
      });
    }
    if (o.truncated !== undefined) {
      expectations.push({ kind: "not-read", path: o.path, limit: o.truncated });
    }
  }

  return { rootName: root.name, expectations, structure: { clean: verdict.clean, problems } };
}

// ---------------------------------------------------------------------------
// What the database holds — the read-only query
// ---------------------------------------------------------------------------

/** One page row, with its document and everything the verdict reads about it. */
export type ArchivePage = {
  documentId: string;
  code: string;
  importTitle: string | null;
  title: string | null;
  pageNumber: number;
  fileName: string;
  fileSize: number | null;
  tags: string[];
  properties: { code: string; nickname: string | null }[];
  /** The property whose corners this document is the claimed source of, if any. */
  cornerProperty: string | null;
};

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * The query the check runs. ⚠️ **SELECT ONLY** — `reconcile.test.ts` pins that
 * no writing keyword appears in it, and the script also runs it inside a
 * session whose `default_transaction_read_only` is on, so a mistake here fails
 * instead of writing.
 *
 * It reads every page whose byte size is one a source file has (the matching
 * on name is done afterwards, in `reconcile`, where Unicode normalisation can
 * be applied), plus every page of every document carrying the root folder's
 * tag — the second half is how pages that match NO source file are found
 * ("extra": usually an earlier run of the same folder, not cleaned up).
 */
export function buildArchiveQuery(sizes: readonly number[], rootTag: string): string {
  const safe = [...new Set(sizes)].filter((n) => Number.isSafeInteger(n) && n >= 0).sort((a, b) => a - b);
  const sizeTest = safe.length > 0 ? `p.file_size IN (${safe.join(", ")})` : "false";
  return `
WITH candidate AS (
  SELECT p.document_id, p.page_number, p.file_name, p.file_size
  FROM document_page p
  WHERE ${sizeTest}
     OR p.document_id IN (
          SELECT d.id FROM document d
          JOIN entity_tag t ON t.principal_object_id = d.principal_object_id
          WHERE lower(t.tag) = ${sqlString(normaliseTag(rootTag))})
)
SELECT coalesce(json_agg(json_build_object(
  'documentId',     d.id,
  'code',           d.code,
  'importTitle',    d.import_title,
  'title',          d.title,
  'pageNumber',     c.page_number,
  'fileName',       c.file_name,
  'fileSize',       c.file_size,
  'tags',           (SELECT coalesce(json_agg(lower(t.tag) ORDER BY lower(t.tag)), '[]'::json)
                     FROM entity_tag t WHERE t.principal_object_id = d.principal_object_id),
  'properties',     (SELECT coalesce(json_agg(json_build_object('code', pr.code, 'nickname', pr.nickname) ORDER BY pr.code), '[]'::json)
                     FROM property_document pd JOIN property pr ON pr.id = pd.property_id
                     WHERE pd.document_id = d.id),
  'cornerProperty', (SELECT pr.code FROM property_corner_source cs JOIN property pr ON pr.id = cs.property_id
                     WHERE cs.document_id = d.id LIMIT 1)
) ORDER BY d.code, c.page_number), '[]'::json)
FROM candidate c
JOIN document d ON d.id = c.document_id;
`.trim();
}

// ---------------------------------------------------------------------------
// The verdict
// ---------------------------------------------------------------------------

export type FileStatus = "landed" | "in-archive" | "ambiguous" | "missing" | "set-aside" | "not-read";

export type FileVerdict =
  | { status: "landed"; expectation: PageExpectation; page: ArchivePage; notes: string[] }
  | { status: "in-archive"; expectation: PageExpectation; pages: ArchivePage[] }
  | { status: "ambiguous"; expectation: PageExpectation; pages: ArchivePage[] }
  | { status: "missing"; expectation: PageExpectation }
  | { status: "set-aside"; expectation: SetAsideExpectation }
  | { status: "not-read"; expectation: NotReadExpectation };

export type ReconcileReport = {
  rootName: string;
  structure: SourcePlan["structure"];
  verdicts: FileVerdict[];
  /** Pages of documents tagged with the root folder that no source file accounts for. */
  extras: ArchivePage[];
  counts: Record<FileStatus, number>;
  /** 0 nothing wrong · 1 some of the folder landed and some is missing (the defect). */
  exitCode: 0 | 1;
};

const STATUSES: readonly FileStatus[] = ["landed", "set-aside", "in-archive", "ambiguous", "missing", "not-read"];

function hasTags(page: ArchivePage, tags: readonly string[]): boolean {
  const have = new Set(page.tags.map(normaliseTag));
  return tags.every((t) => have.has(t));
}

function landedNotes(e: PageExpectation, page: ArchivePage, tagged: boolean): string[] {
  const notes: string[] = [];
  if (!tagged) notes.push("the document carries none of this folder's tags (the tag dialog was declined?)");
  if (page.pageNumber !== e.pageNumber) notes.push(`stored as page ${page.pageNumber}, expected page ${e.pageNumber}`);
  if (e.bucket === "property" && page.properties.length === 0) notes.push("linked to no property");
  if (e.bucket === "flotante" && page.properties.length > 0) {
    notes.push(`a floating document linked to ${page.properties.map((p) => p.code).join(", ")}`);
  }
  if (e.coordinateFor !== null) {
    notes.push(
      page.cornerProperty !== null
        ? `the coordinate file: corners read into ${page.cornerProperty}`
        : "the coordinate file, but no property claims it as its corner source",
    );
  }
  return notes;
}

/** Match every expectation against the pages the query returned. */
export function reconcile(plan: SourcePlan, pages: readonly ArchivePage[]): ReconcileReport {
  const used = new Set<string>();
  const key = (p: ArchivePage): string => `${p.documentId}#${p.pageNumber}`;
  const verdicts: FileVerdict[] = [];

  for (const e of plan.expectations) {
    if (e.kind === "set-aside") {
      verdicts.push({ status: "set-aside", expectation: e });
      continue;
    }
    if (e.kind === "not-read") {
      verdicts.push({ status: "not-read", expectation: e });
      continue;
    }
    const candidates = pages.filter((p) => p.fileSize === e.file.size && nfc(p.fileName) === nfc(e.file.name));
    const titleOk = (p: ArchivePage): boolean => p.importTitle !== null && nfc(p.importTitle) === nfc(e.title);
    // Both: this import's title AND its tags. Failing that, one of the two — the
    // title when the tag dialog was declined, the tags on a document imported
    // before #32.06 recorded `import_title` at all (NULL there, never "wrong").
    const full = candidates.filter((p) => titleOk(p) && hasTags(p, e.tags));
    const partial = candidates.filter((p) => titleOk(p) || (p.importTitle === null && hasTags(p, e.tags)));
    const pick = full.length > 0 ? full : partial;
    if (pick.length === 1) {
      const page = pick[0];
      used.add(key(page));
      const notes = landedNotes(e, page, full.length > 0 || !titleOk(page));
      if (full.length === 0 && !titleOk(page)) {
        notes.unshift("the document has no recorded import title (imported before #32.06); matched on its tags");
      }
      verdicts.push({ status: "landed", expectation: e, page, notes });
    } else if (pick.length > 1) {
      for (const p of pick) used.add(key(p));
      verdicts.push({ status: "ambiguous", expectation: e, pages: pick });
    } else if (candidates.length > 0) {
      verdicts.push({ status: "in-archive", expectation: e, pages: candidates });
    } else {
      verdicts.push({ status: "missing", expectation: e });
    }
  }

  // A page group is ONE document: flag a group whose pages landed in several.
  const docsByEntry = new Map<string, Set<string>>();
  for (const v of verdicts) {
    if (v.status !== "landed" || v.expectation.entryKind !== "page-group") continue;
    const set = docsByEntry.get(v.expectation.entryPath) ?? new Set<string>();
    set.add(v.page.code);
    docsByEntry.set(v.expectation.entryPath, set);
  }
  for (const v of verdicts) {
    if (v.status !== "landed") continue;
    const docs = docsByEntry.get(v.expectation.entryPath);
    if (docs && docs.size > 1) v.notes.push(`its page folder landed in ${docs.size} documents: ${[...docs].sort().join(", ")}`);
  }

  const rootTag = normaliseTag(plan.rootName);
  const extras = pages.filter((p) => !used.has(key(p)) && p.tags.map(normaliseTag).includes(rootTag));

  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<FileStatus, number>;
  for (const v of verdicts) counts[v.status] += 1;
  const exitCode: 0 | 1 = counts.missing > 0 && counts.landed + counts.ambiguous > 0 ? 1 : 0;

  return { rootName: plan.rootName, structure: plan.structure, verdicts, extras, counts, exitCode };
}

// ---------------------------------------------------------------------------
// The report, as text
// ---------------------------------------------------------------------------

const REASON_TEXT: Record<IgnoredReason, string> = {
  hidden: "a hidden file",
  "system-file": "a system file",
  "ignored-extension": "an extension the import ignores",
};

function describe(v: FileVerdict): string {
  switch (v.status) {
    case "landed": {
      const e = v.expectation;
      const where = e.entryKind === "page-group" ? `page ${v.page.pageNumber} of ${e.pageCount}` : "its only page";
      const props = v.page.properties.map((p) => p.code).join(", ") || "no property";
      const notes = v.notes.length > 0 ? ` — ${v.notes.join("; ")}` : "";
      return `LANDED     ${e.file.path} → ${v.page.code} ${where} (${props})${notes}`;
    }
    case "in-archive":
      return `IN ARCHIVE ${v.expectation.file.path} → only in ${v.pages.map((p) => p.code).join(", ")}, not a document this import made („Deja în sistem" or an earlier run)`;
    case "ambiguous":
      return `AMBIGUOUS  ${v.expectation.file.path} → ${v.pages.map((p) => `${p.code} p${p.pageNumber}`).join(", ")} all qualify; not guessing`;
    case "missing":
      return `MISSING    ${v.expectation.file.path} (${v.expectation.file.size} bytes) — no page holds it`;
    case "set-aside":
      return `SET ASIDE  ${v.expectation.file.path} — ${REASON_TEXT[v.expectation.reason]} (${v.expectation.reason})`;
    case "not-read":
      return `NOT READ   ${v.expectation.path} — the walk stopped at its "${v.expectation.limit}" limit`;
  }
}

/** The one line the test runner shows as the step's summary. */
export function summaryLine(r: ReconcileReport): string {
  const total = r.verdicts.length;
  const parts = [
    `${r.counts.landed} landed`,
    `${r.counts["set-aside"]} set aside`,
    `${r.counts["in-archive"]} in archive`,
    `${r.counts.ambiguous} ambiguous`,
    `${r.counts.missing} missing`,
  ];
  if (r.counts["not-read"] > 0) parts.push(`${r.counts["not-read"]} not read`);
  const nothing = r.counts.landed + r.counts.ambiguous === 0 ? "; nothing from this folder is in the database" : "";
  return (
    `RECONCILE: ${r.rootName} — ${total} file${total === 1 ? "" : "s"}: ${parts.join(", ")}; ` +
    `${r.extras.length} extra page${r.extras.length === 1 ? "" : "s"}; ` +
    `structure ${r.structure.clean ? "clean" : `NOT clean (${r.structure.problems.length})`}${nothing}`
  );
}

export function formatReport(r: ReconcileReport): string {
  const lines: string[] = [];
  lines.push(`Import reconciliation — ${r.rootName}`);
  lines.push("");
  lines.push(`Structure (the wizard's own check): ${r.structure.clean ? "clean" : "NOT clean"}`);
  for (const p of r.structure.problems) lines.push(`  ${p}`);
  lines.push("");
  const order: FileStatus[] = ["missing", "ambiguous", "in-archive", "not-read", "landed", "set-aside"];
  const sorted = [...r.verdicts].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status));
  for (const v of sorted) lines.push(describe(v));
  if (r.extras.length > 0) {
    lines.push("");
    lines.push("Pages of documents tagged with this folder that no source file accounts for:");
    for (const p of r.extras) lines.push(`  EXTRA ${p.code} p${p.pageNumber} ${p.fileName} (${p.fileSize ?? "?"} bytes)`);
  }
  lines.push("");
  lines.push(summaryLine(r));
  return lines.join("\n");
}
