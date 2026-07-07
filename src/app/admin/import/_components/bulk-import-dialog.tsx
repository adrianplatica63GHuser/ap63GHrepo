"use client";

/**
 * BulkImportDialog — Slice #21.01.Import
 *
 * Step 3 of the import wizard: imports every FSEntry (file or page-group)
 * as a Document, uploads its file(s) as pages, and tags the document with
 * all ancestor folder names.
 *
 * After import:
 *   - A results table shows every entry with "Open →" links.
 *   - Each row has an "AI Interpret" button that opens an inline AI panel.
 *   - Coordinate text files  → offer "Create Property" + associate siblings.
 *   - ID-card images         → offer "Create Person" from extracted data.
 *   - Other extractable docs → offer "Extract Fields" and update the record.
 *
 * The concurrency limit is 3 in-flight import operations at a time.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  type FSEntry,
  type FSFileEntry,
  type FSPageGroupEntry,
  tagsForEntry,
  extOf,
} from "@/lib/import/folder-utils";
import type { ScanResult } from "./scan-table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ImportStatus = "pending" | "importing" | "done" | "error";

export type ImportResult = {
  entry: FSEntry;
  status: ImportStatus;
  errorMsg?: string;
  /** created Document id */
  docId?: string;
  /** principalObjectId for tagging */
  principalObjectId?: string;
};

type AiPhase =
  | "idle"
  | "coordinates"       // text file with Stereo70 content
  | "id-card"           // Romanian ID card image
  | "generic-doc"       // other extractable document
  | "creating"
  | "done"
  | "error";

type AiState = {
  path: string;
  phase: AiPhase;
  nickname: string;
  successMsg?: string;
  errorMsg?: string;
};

type Props = {
  entries: FSEntry[];
  rootFolderName: string;
  scanResults: Map<string, ScanResult>;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Concurrency helpers
// ---------------------------------------------------------------------------

const CONCURRENCY = 3;

async function withConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
  onResult: (index: number, result: T | Error) => void,
): Promise<void> {
  let nextIndex = 0;
  let running = 0;

  return new Promise<void>((resolve) => {
    function launch() {
      while (running < limit && nextIndex < tasks.length) {
        const i = nextIndex++;
        running++;
        tasks[i]()
          .then((r) => {
            onResult(i, r);
          })
          .catch((e: unknown) => {
            onResult(i, e instanceof Error ? e : new Error(String(e)));
          })
          .finally(() => {
            running--;
            if (nextIndex < tasks.length) {
              launch();
            } else if (running === 0) {
              resolve();
            }
          });
      }
      if (tasks.length === 0) resolve();
    }
    launch();
  });
}

// ---------------------------------------------------------------------------
// File-type helpers (no circular import from folder-utils needed)
// ---------------------------------------------------------------------------

const IMAGE_EXTS_SET = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"]);
const TEXT_EXTS_SET = new Set([".txt", ".csv", ".dat", ".asc"]);
const PDF_EXT = ".pdf";

function isImageFile(name: string) { return IMAGE_EXTS_SET.has(extOf(name)); }
function isPdfFile(name: string)   { return extOf(name) === PDF_EXT; }
function isTextFile(name: string)  { return TEXT_EXTS_SET.has(extOf(name)); }
function isScannable(name: string) { return isImageFile(name) || isPdfFile(name); }

// ---------------------------------------------------------------------------
// PDF.js (lazy-loaded for page-group rasterisation — only page 1)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;

async function ensurePdfJs(): Promise<void> {
  if (pdfjsLib) return;
  pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

async function pdfFirstPageBlob(file: File): Promise<Blob> {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");
  await page.render({ canvasContext: ctx, viewport }).promise;
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("canvas.toBlob null"))), "image/png"),
  );
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/** Minimal document-type lookup — we use a well-known "ALTUL" fallback key */
async function fetchFallbackDocTypeId(): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/value-lists/document-types");
    if (!res.ok) return null;
    const body = (await res.json()) as { items?: { id: string; key: string }[] };
    // Prefer ALTUL / OTHER, fall back to first available
    const items = body.items ?? [];
    const fallback =
      items.find((x) => x.key === "ALTUL") ??
      items.find((x) => x.key === "OTHER") ??
      items[0] ??
      null;
    return fallback?.id ?? null;
  } catch {
    return null;
  }
}

async function createDocument(payload: {
  documentTypeId?: string | null;
  title?: string | null;
}): Promise<{ id: string; principalObjectId: string }> {
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentTypeId: payload.documentTypeId ?? null,
      title: payload.title ?? null,
    }),
  });
  if (res.redirected) throw new Error("session-expired");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const row = (await res.json()) as { id?: string; principalObjectId?: string };
  if (!row.id || !row.principalObjectId) throw new Error("Missing id in response");
  return { id: row.id, principalObjectId: row.principalObjectId };
}

async function uploadPage(documentId: string, file: File, pageNumber: number): Promise<void> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("pageNumber", String(pageNumber));
  const res = await fetch(`/api/documents/${documentId}/pages`, { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

async function addTag(principalObjectId: string, tag: string): Promise<void> {
  await fetch(`/api/metadata/${principalObjectId}/tags`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tag }),
  });
}

async function associateDocumentsWithProperty(
  propertyId: string,
  documentIds: string[],
): Promise<void> {
  if (documentIds.length === 0) return;
  await fetch(`/api/properties/${propertyId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  });
}

/** POST /api/properties/parse-text → { corners } */
async function parseTextFileForProperty(
  file: File,
): Promise<{ corners: unknown[] } | null> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch("/api/properties/parse-text", { method: "POST", body: fd });
  if (!res.ok) return null;
  return res.json() as Promise<{ corners: unknown[] }>;
}

/** POST /api/properties → { property: { id } } */
async function createProperty(payload: {
  nickname: string;
  corners: unknown[];
}): Promise<string> {
  const res = await fetch("/api/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nickname: payload.nickname, corners: payload.corners }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { property?: { id?: string }; id?: string };
  const id = body.property?.id ?? body.id;
  if (!id) throw new Error("No property id");
  return id;
}

/** POST /api/admin/import/scan-folder → Classification */
async function scanFileForAI(imageBlob: Blob): Promise<{
  classifiedLabel: string;
  suggestedTypeKey: string | null;
  confidence: "high" | "medium" | "low";
  extractable: boolean;
  notes: string | null;
}> {
  const fd = new FormData();
  const f = imageBlob instanceof File
    ? imageBlob
    : new File([imageBlob], "page.png", { type: "image/png" });
  fd.append("file", f);
  const res = await fetch("/api/admin/import/scan-folder", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Scan HTTP ${res.status}`);
  return res.json();
}

/** POST /api/admin/import/extract-document → { fields } */
async function extractDocumentFields(imageBlob: Blob): Promise<Record<string, string | null>> {
  const fd = new FormData();
  const f = imageBlob instanceof File
    ? imageBlob
    : new File([imageBlob], "page.png", { type: "image/png" });
  fd.append("file", f);
  const res = await fetch("/api/admin/import/extract-document", { method: "POST", body: fd });
  if (!res.ok) throw new Error(`Extract HTTP ${res.status}`);
  const body = (await res.json()) as { fields?: Record<string, string | null> };
  return body.fields ?? {};
}

/** POST /api/people → { person: { id } } using extracted fields */
async function createNaturalPersonFromFields(
  fields: Record<string, string | null>,
): Promise<string> {
  const res = await fetch("/api/people", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "natural",
      firstName: fields.firstName ?? null,
      lastName: fields.lastName ?? null,
      cnp: fields.cnp ?? null,
      idCardSeries: fields.idCardSeries ?? null,
      idCardNumber: fields.idCardNumber ?? null,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { person?: { id?: string }; id?: string };
  const id = body.person?.id ?? body.id;
  if (!id) throw new Error("No person id");
  return id;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BulkImportDialog({
  entries,
  rootFolderName,
  scanResults,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog");
  const router = useRouter();

  const [results, setResults] = useState<ImportResult[]>(() =>
    entries.map((entry) => ({ entry, status: "pending" })),
  );
  const [done, setDone] = useState(false);
  const [aiState, setAiState] = useState<AiState | null>(null);
  const [parsedCorners, setParsedCorners] = useState<unknown[] | null>(null);
  const cancelledRef = useRef(false);

  const updateResult = useCallback(
    (path: string, patch: Partial<ImportResult>) =>
      setResults((prev) =>
        prev.map((r) => (r.entry.path === path ? { ...r, ...patch } : r)),
      ),
    [],
  );

  // ---------------------------------------------------------------------------
  // Run import on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let fallbackDocTypeId: string | null = null;

    async function run() {
      fallbackDocTypeId = await fetchFallbackDocTypeId();

      const tasks = entries.map((entry) => async () => {
        if (cancelledRef.current) return;
        updateResult(entry.path, { status: "importing" });

        try {
          // 1. Determine title
          const title =
            entry.kind === "page-group"
              ? entry.titleHint
              : entry.name;

          // 2. Create the Document record
          const { id: docId, principalObjectId } = await createDocument({
            documentTypeId: fallbackDocTypeId,
            title,
          });

          // 3. Upload file(s) as pages
          if (entry.kind === "page-group") {
            const pg = entry as FSPageGroupEntry;
            for (let i = 0; i < pg.handles.length; i++) {
              if (cancelledRef.current) break;
              const file = await pg.handles[i].getFile();
              await uploadPage(docId, file, i + 1);
            }
          } else {
            const fe = entry as FSFileEntry;
            const file = await fe.handle.getFile();
            await uploadPage(docId, file, 1);
          }

          // 4. Tag with all ancestor folder names
          const tags = tagsForEntry(rootFolderName, entry);
          for (const tag of tags) {
            await addTag(principalObjectId, tag);
          }

          updateResult(entry.path, { status: "done", docId, principalObjectId });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Import failed";
          updateResult(entry.path, { status: "error", errorMsg: msg });
        }
      });

      await withConcurrencyLimit(tasks, CONCURRENCY, () => {});
      if (!cancelledRef.current) setDone(true);
    }

    run();

    return () => { cancelledRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  // ---------------------------------------------------------------------------
  // AI interpretation handler
  // ---------------------------------------------------------------------------

  const handleAiInterpret = useCallback(
    async (result: ImportResult) => {
      if (!result.docId) return;
      const entry = result.entry;
      const scanResult = scanResults.get(entry.path);

      // Determine what AI action to offer
      const name = entry.kind === "page-group" ? entry.name : (entry as FSFileEntry).name;
      const entryName = entry.kind === "file" ? (entry as FSFileEntry).name : name;

      if (isTextFile(entryName)) {
        // Try to parse Stereo70 coordinates
        setAiState({ path: entry.path, phase: "creating", nickname: name, });
        try {
          const file = entry.kind === "file"
            ? await (entry as FSFileEntry).handle.getFile()
            : null;
          if (file) {
            const parsed = await parseTextFileForProperty(file);
            if (parsed && parsed.corners.length > 0) {
              setParsedCorners(parsed.corners);
              setAiState({ path: entry.path, phase: "coordinates", nickname: name });
              return;
            }
          }
        } catch { /* fall through */ }
        setAiState({ path: entry.path, phase: "idle", nickname: name });
        return;
      }

      // Image or PDF — check scan result first
      if (scanResult?.description) {
        const label = scanResult.description.toLowerCase();
        const isIdCard =
          label.includes("carte de identitate") ||
          label.includes("id card") ||
          label.includes("buletin");
        setAiState({
          path: entry.path,
          phase: isIdCard ? "id-card" : "generic-doc",
          nickname: name,
        });
        return;
      }

      // No scan result — offer generic
      setAiState({ path: entry.path, phase: "generic-doc", nickname: name });
    },
    [scanResults],
  );

  // ---------------------------------------------------------------------------
  // AI action handlers
  // ---------------------------------------------------------------------------

  const handleCreateProperty = useCallback(
    async (entryPath: string, nickname: string) => {
      if (!parsedCorners) return;
      setAiState((s) => s ? { ...s, phase: "creating" } : s);
      try {
        const propertyId = await createProperty({ nickname, corners: parsedCorners });

        // Associate siblings from the same top-level folder
        const topFolder = entryPath.split("/")[0];
        const siblingDocIds = results
          .filter(
            (r) =>
              r.status === "done" &&
              r.docId &&
              r.entry.path !== entryPath &&
              r.entry.path.split("/")[0] === topFolder,
          )
          .map((r) => r.docId as string);

        // Also associate the current document
        const currentDocId = results.find((r) => r.entry.path === entryPath)?.docId;
        if (currentDocId) siblingDocIds.push(currentDocId);

        await associateDocumentsWithProperty(propertyId, siblingDocIds);
        setAiState((s) =>
          s
            ? {
                ...s,
                phase: "done",
                successMsg: t("aiPropertyCreated", { count: siblingDocIds.length }),
              }
            : s,
        );
      } catch (err) {
        setAiState((s) =>
          s
            ? {
                ...s,
                phase: "error",
                errorMsg: err instanceof Error ? err.message : t("aiError"),
              }
            : s,
        );
      }
    },
    [parsedCorners, results, t],
  );

  const handleCreatePerson = useCallback(
    async (entryPath: string) => {
      setAiState((s) => s ? { ...s, phase: "creating" } : s);
      try {
        // Get the image blob
        const result = results.find((r) => r.entry.path === entryPath);
        if (!result) throw new Error("Entry not found");
        const entry = result.entry;

        let imageBlob: Blob | null = null;
        if (entry.kind === "file") {
          const file = await (entry as FSFileEntry).handle.getFile();
          if (isPdfFile(file.name)) {
            imageBlob = await pdfFirstPageBlob(file);
          } else if (isImageFile(file.name)) {
            imageBlob = file;
          }
        }

        if (!imageBlob) throw new Error("Not a scannable file");

        const fields = await extractDocumentFields(imageBlob);
        await createNaturalPersonFromFields(fields);
        setAiState((s) => s ? { ...s, phase: "done", successMsg: t("aiPersonCreated") } : s);
      } catch (err) {
        setAiState((s) =>
          s
            ? {
                ...s,
                phase: "error",
                errorMsg: err instanceof Error ? err.message : t("aiError"),
              }
            : s,
        );
      }
    },
    [results, t],
  );

  const handleExtractFields = useCallback(
    async (entryPath: string, docId: string) => {
      setAiState((s) => s ? { ...s, phase: "creating" } : s);
      try {
        const result = results.find((r) => r.entry.path === entryPath);
        if (!result) throw new Error("Entry not found");
        const entry = result.entry;

        let imageBlob: Blob | null = null;
        if (entry.kind === "file") {
          const file = await (entry as FSFileEntry).handle.getFile();
          if (isPdfFile(file.name)) {
            imageBlob = await pdfFirstPageBlob(file);
          } else if (isImageFile(file.name)) {
            imageBlob = file;
          }
        } else if (entry.kind === "page-group") {
          const pg = entry as FSPageGroupEntry;
          if (pg.handles.length > 0) {
            imageBlob = await pg.handles[0].getFile();
          }
        }

        if (!imageBlob) throw new Error("Not scannable");

        const fields = await extractDocumentFields(imageBlob);

        // PATCH the document with extracted fields
        await fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: fields.title ?? undefined,
            nrDocument: fields.nrDocument ?? undefined,
            dateDocument: fields.dateDocument ?? undefined,
            subject: fields.subject ?? undefined,
          }),
        });

        setAiState((s) => s ? { ...s, phase: "done", successMsg: t("aiExtracted") } : s);
      } catch (err) {
        setAiState((s) =>
          s
            ? {
                ...s,
                phase: "error",
                errorMsg: err instanceof Error ? err.message : t("aiError"),
              }
            : s,
        );
      }
    },
    [results, t],
  );

  // ---------------------------------------------------------------------------
  // Counts
  // ---------------------------------------------------------------------------

  const doneCount = results.filter((r) => r.status === "done").length;
  const errorCount = results.filter((r) => r.status === "error").length;
  const totalCount = results.length;
  const progressPct = totalCount > 0 ? ((doneCount + errorCount) / totalCount) * 100 : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div
        className="relative flex w-full max-w-4xl flex-col rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <div>
            <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
              {done
                ? t("doneTitle", { count: doneCount })
                : t("title")}
            </h2>
            {done && (
              <p className="mt-0.5 text-xs text-fade">{t("doneHint")}</p>
            )}
          </div>
          {done && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            >
              {t("closeButton")}
            </button>
          )}
        </div>

        {/* Progress bar (shown while importing) */}
        {!done && (
          <div className="px-5 py-3 border-b border-card-rim dark:border-zinc-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-fade">{t("progressLabel", { done: doneCount + errorCount, total: totalCount })}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
              <div
                className="h-full rounded-full bg-cta transition-all duration-300"
                style={{ width: `${progressPct.toFixed(1)}%` }}
                role="progressbar"
                aria-valuenow={Math.round(progressPct)}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        )}

        {/* Results table */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {/* AI panel (inline, above results) */}
          {aiState && (
            <AiPanel
              state={aiState}
              results={results}
              t={t}
              onCreateProperty={handleCreateProperty}
              onCreatePerson={handleCreatePerson}
              onExtractFields={handleExtractFields}
              onClose={() => { setAiState(null); setParsedCorners(null); }}
            />
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400">
            {t("resultsTitle")}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-crease text-left text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700">
                <th className="pb-2 pr-3">{t("colDocument")}</th>
                <th className="w-28 pb-2 pr-3">{t("colStatus")}</th>
                <th className="w-28 pb-2">{t("colAi")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <ResultRow
                  key={r.entry.path}
                  result={r}
                  aiActive={aiState?.path === r.entry.path}
                  t={t}
                  onAiClick={() => handleAiInterpret(r)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ResultRow
// ---------------------------------------------------------------------------

type ResultRowProps = {
  result: ImportResult;
  aiActive: boolean;
  t: ReturnType<typeof useTranslations<"adminImport.wizard.importDialog">>;
  onAiClick: () => void;
};

function ResultRow({ result, aiActive, t, onAiClick }: ResultRowProps) {
  const { entry, status, errorMsg, docId } = result;
  const displayName = entry.kind === "page-group" ? entry.titleHint : (entry as FSFileEntry).name;

  return (
    <tr className={["border-b border-crease dark:border-zinc-800", aiActive ? "bg-blue-50 dark:bg-blue-950/30" : ""].join(" ")}>
      <td className="py-2 pr-3 min-w-0">
        <span
          className="block truncate font-mono text-xs text-ink dark:text-zinc-200"
          title={entry.path}
        >
          {displayName}
        </span>
        <span className="text-[10px] text-fade">{entry.path}</span>
      </td>

      <td className="py-2 pr-3">
        {status === "pending" && <span className="text-xs text-fade">—</span>}
        {status === "importing" && (
          <span className="text-xs text-cta animate-pulse">Se importă…</span>
        )}
        {status === "error" && (
          <span className="text-xs text-red-600 dark:text-red-400" title={errorMsg}>
            {t("errorShort")}
          </span>
        )}
        {status === "done" && docId && (
          <a
            href={`/documents/${docId}`}
            className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            {t("viewLink")}
          </a>
        )}
      </td>

      <td className="py-2">
        {status === "done" && docId && (
          <button
            type="button"
            onClick={onAiClick}
            className="rounded border border-wire px-2 py-0.5 text-xs font-medium text-ink hover:bg-canvas dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t("aiButton")}
          </button>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// AiPanel — inline interpretation panel
// ---------------------------------------------------------------------------

type AiPanelProps = {
  state: AiState;
  results: ImportResult[];
  t: ReturnType<typeof useTranslations<"adminImport.wizard.importDialog">>;
  onCreateProperty: (path: string, nickname: string) => void;
  onCreatePerson: (path: string) => void;
  onExtractFields: (path: string, docId: string) => void;
  onClose: () => void;
};

function AiPanel({
  state,
  results,
  t,
  onCreateProperty,
  onCreatePerson,
  onExtractFields,
  onClose,
}: AiPanelProps) {
  const [nickname, setNickname] = useState(state.nickname);
  const docId = results.find((r) => r.entry.path === state.path)?.docId ?? "";

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="flex items-start justify-between mb-2">
        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
          {t("aiPanelTitle", { name: state.nickname })}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("aiCancel")}
          className="ml-2 rounded p-0.5 text-blue-500 hover:text-blue-700 dark:text-blue-400"
        >
          ✕
        </button>
      </div>

      {state.phase === "coordinates" && (
        <div className="space-y-2">
          <p className="text-sm text-blue-700 dark:text-blue-300">{t("aiCoordinatesOffer")}</p>
          <label className="block text-xs text-fade dark:text-zinc-400">
            {t("aiNicknameLabel")}
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="mt-1 block w-full rounded border border-wire px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onCreateProperty(state.path, nickname)}
              className="rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d"
            >
              {t("aiCreatePropertyButton")}
            </button>
            <button type="button" onClick={onClose} className="text-xs text-fade hover:text-ink">
              {t("aiCancel")}
            </button>
          </div>
        </div>
      )}

      {state.phase === "id-card" && (
        <div className="space-y-2">
          <p className="text-sm text-blue-700 dark:text-blue-300">{t("aiIdCardOffer")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onCreatePerson(state.path)}
              className="rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d"
            >
              {t("aiCreatePersonButton")}
            </button>
            <button type="button" onClick={onClose} className="text-xs text-fade hover:text-ink">
              {t("aiCancel")}
            </button>
          </div>
        </div>
      )}

      {state.phase === "generic-doc" && (
        <div className="space-y-2">
          <p className="text-sm text-blue-700 dark:text-blue-300">{t("aiDocumentOffer")}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onExtractFields(state.path, docId)}
              className="rounded-md bg-cta px-3 py-1.5 text-xs font-medium text-white hover:bg-cta-d"
            >
              {t("aiExtractButton")}
            </button>
            <button type="button" onClick={onClose} className="text-xs text-fade hover:text-ink">
              {t("aiCancel")}
            </button>
          </div>
        </div>
      )}

      {state.phase === "creating" && (
        <p className="text-sm text-blue-700 animate-pulse dark:text-blue-300">
          {t("aiCreating")}
        </p>
      )}

      {state.phase === "done" && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300">
          ✓ {state.successMsg}
        </p>
      )}

      {state.phase === "error" && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {state.errorMsg ?? t("aiError")}
        </p>
      )}

      {state.phase === "idle" && (
        <p className="text-sm text-fade">{t("aiNoAction")}</p>
      )}
    </div>
  );
}
