"use client";

/**
 * FolderScanDialog — Slice #19.06
 *
 * Two-phase AI scan over all files in the currently-open import folder.
 *
 * Phase 1 (Scan):
 *   For each file in the folder:
 *   - Images → sent directly to /api/admin/import/scan-folder (Haiku 4.5).
 *   - PDFs   → page 1 is rasterised to PNG in-browser via PDF.js (loaded
 *              from cdnjs CDN, no new npm dep), then sent to the same route.
 *   - Other  → skipped with status "skip".
 *   Results appear row-by-row as they come in; the user can override the
 *   suggested document-type key per row via a dropdown.
 *
 * Phase 2 (Extract & Create):
 *   For each row the user checked (must be extractable):
 *   - Sends the image to /api/admin/import/extract-document (Sonnet 4.6).
 *   - Uses extracted fields + selected type key to POST /api/documents.
 *   - Uploads the original file as page 1 via POST /api/documents/[id]/pages.
 *   - Shows a "View" link to the new document's detail page.
 *
 * Props:
 *   entries    — all FSFileHandle entries from ImportBrowser's folder
 *   onClose    — called when the user dismisses the dialog
 *   onCreated  — called with created document ids so the browser can mark files
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FSFileHandle } from "./file-system-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DocumentTypeOption = { id: string; key: string; name: string };

type Classification = {
  classifiedLabel: string;
  suggestedTypeKey: string | null;
  confidence: "high" | "medium" | "low";
  extractable: boolean;
  notes: string | null;
};

type ScanEntry = {
  name: string;
  handle: FSFileHandle;
  /** resolved once when scanning starts */
  originalFile?: File;
  /** PNG sent to AI (might be a PDF rasterised to PNG) */
  imageBlob?: Blob;
  status: "pending" | "converting" | "scanning" | "done" | "error" | "skip";
  errorMsg?: string;
  classification?: Classification;
  /** user-overridable copy of suggestedTypeKey */
  selectedTypeKey: string | null;
  checked: boolean;
  extractStatus: "idle" | "extracting" | "creating" | "done" | "error";
  extractError?: string;
  createdDocId?: string;
};

// ---------------------------------------------------------------------------
// PDF.js rasteriser — uses the locally-installed pdfjs-dist package.
// The worker file is copied to public/pdf.worker.min.js by the postinstall
// script (scripts/copy-pdfjs-worker.mjs), so it is always served locally
// with no CDN dependency.
// ---------------------------------------------------------------------------

// Lazy-loaded on first PDF — keeps the initial bundle small.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pdfjsLib: any = null;

async function ensurePdfJs(): Promise<void> {
  if (pdfjsLib) return;
  pdfjsLib = await import("pdfjs-dist");
  // Worker is copied to /public by scripts/copy-pdfjs-worker.mjs
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
}

async function pdfToImageBlob(file: File): Promise<Blob> {
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
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("canvas.toBlob returned null"))),
      "image/png",
    ),
  );
}

// ---------------------------------------------------------------------------
// File-type helpers (mirrors import-browser.tsx — no circular import needed)
// ---------------------------------------------------------------------------

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i).toLowerCase();
}

function fileIsPdf(file: File): boolean {
  return (
    file.type === "application/pdf" ||
    extOf(file.name) === ".pdf"
  );
}

const EXT_TO_MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function imageMimeType(file: File): string {
  // file.type can be "" when the OS didn't set it (common with File System
  // Access API on Windows). Fall back to extension-based detection.
  if (file.type.startsWith("image/")) return file.type;
  return EXT_TO_MIME[extOf(file.name)] ?? "image/png";
}

function fileIsImage(file: File): boolean {
  return file.type.startsWith("image/") || extOf(file.name) in EXT_TO_MIME;
}

function isScannable(file: File): boolean {
  return fileIsImage(file) || fileIsPdf(file);
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchDocumentTypes(): Promise<DocumentTypeOption[]> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (!res.ok) return [];
  const body = (await res.json()) as { items?: DocumentTypeOption[] };
  return body.items ?? [];
}

function blobToFile(blob: Blob, fallbackName: string): File {
  // If blob is already a File (original image), preserve its name and type.
  // Otherwise it's a canvas-rendered PNG from a PDF page.
  if (blob instanceof File) {
    const mime = imageMimeType(blob);
    return mime === blob.type ? blob : new File([blob], blob.name, { type: mime });
  }
  return new File([blob], fallbackName, { type: "image/png" });
}

async function callScanFolder(imageBlob: Blob): Promise<Classification> {
  const fd = new FormData();
  fd.append("file", blobToFile(imageBlob, "page.png"));
  const res = await fetch("/api/admin/import/scan-folder", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<Classification>;
}

async function callExtractDocument(
  imageBlob: Blob,
  typeKey: string | null,
): Promise<{
  fields: Record<string, string | null>;
  lowConfidenceFields: string[];
  unmappedRaw: Record<string, string>;
}> {
  const fd = new FormData();
  fd.append("file", blobToFile(imageBlob, "page.png"));
  if (typeKey) fd.append("typeKey", typeKey);
  const res = await fetch("/api/admin/import/extract-document", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

async function callCreateDocument(
  documentTypeId: string,
  fields: Record<string, string | null>,
): Promise<string> {
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentTypeId,
      title: fields.title ?? null,
      nrDocument: fields.nrDocument ?? null,
      dateDocument: fields.dateDocument ?? null,
      subject: fields.subject ?? null,
      notes: fields.notes ?? null,
    }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const row = (await res.json()) as { id?: string };
  if (!row.id) throw new Error("No id returned");
  return row.id;
}

async function callUploadPage(documentId: string, file: File): Promise<void> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  fd.append("pageNumber", "1");
  const res = await fetch(`/api/documents/${documentId}/pages`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Props = {
  entries: { name: string; handle: FSFileHandle }[];
  onClose: () => void;
  onCreated: (names: string[]) => void;
};

export function FolderScanDialog({ entries, onClose, onCreated }: Props) {
  const t = useTranslations("adminImport.scan");
  const router = useRouter();

  const [docTypes, setDocTypes] = useState<DocumentTypeOption[]>([]);
  const [rows, setRows] = useState<ScanEntry[]>(() =>
    entries.map((e) => ({
      name: e.name,
      handle: e.handle,
      status: "pending",
      selectedTypeKey: null,
      checked: false,
      extractStatus: "idle",
    })),
  );

  const [scanning, setScanning] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  // Load document types once
  useEffect(() => {
    fetchDocumentTypes()
      .then(setDocTypes)
      .catch(() => setDocTypes([]));
  }, []);

  // ESC to close (only if not busy)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !scanning && !extracting) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scanning, extracting, onClose]);

  // Cancel on unmount
  useEffect(() => () => { cancelledRef.current = true; }, []);

  const updateRow = useCallback(
    (name: string, patch: Partial<ScanEntry>) =>
      setRows((prev) =>
        prev.map((r) => (r.name === name ? { ...r, ...patch } : r)),
      ),
    [],
  );

  // Phase 1: scan all files
  const handleScanAll = useCallback(async () => {
    setScanning(true);
    setGlobalError(null);
    cancelledRef.current = false;

    for (const row of rows) {
      if (cancelledRef.current) break;

      // Resolve original file
      let file: File;
      try {
        file = await row.handle.getFile();
      } catch {
        updateRow(row.name, { status: "error", errorMsg: "Cannot read file" });
        continue;
      }

      if (!isScannable(file)) {
        updateRow(row.name, { status: "skip", originalFile: file });
        continue;
      }

      // Rasterise PDF if needed
      let imageBlob: Blob;
      if (fileIsPdf(file)) {
        updateRow(row.name, { status: "converting", originalFile: file });
        try {
          imageBlob = await pdfToImageBlob(file);
        } catch (err) {
          updateRow(row.name, {
            status: "error",
            originalFile: file,
            errorMsg: err instanceof Error ? err.message : "PDF rasterisation failed",
          });
          continue;
        }
      } else {
        imageBlob = file;
      }

      updateRow(row.name, { status: "scanning", originalFile: file, imageBlob });

      try {
        const classification = await callScanFolder(imageBlob);
        if (cancelledRef.current) break;
        updateRow(row.name, {
          status: "done",
          classification,
          selectedTypeKey: classification.suggestedTypeKey,
          // Auto-check extractable docs with high/medium confidence
          checked: classification.extractable && classification.confidence !== "low",
        });
      } catch (err) {
        if (cancelledRef.current) break;
        updateRow(row.name, {
          status: "error",
          errorMsg: err instanceof Error ? err.message : "Scan failed",
        });
      }
    }

    if (!cancelledRef.current) setScanning(false);
  }, [rows, updateRow]);

  // Phase 2: extract & create for checked rows
  const handleExtractSelected = useCallback(async () => {
    const checked = rows.filter(
      (r) => r.checked && r.classification?.extractable && r.imageBlob,
    );
    if (checked.length === 0) return;

    setExtracting(true);
    setGlobalError(null);
    cancelledRef.current = false;
    const createdNames: string[] = [];

    for (const row of checked) {
      if (cancelledRef.current) break;
      if (!row.imageBlob || !row.originalFile) continue;

      // Find documentTypeId
      const typeKey = row.selectedTypeKey;
      const typeOption = typeKey ? docTypes.find((dt) => dt.key === typeKey) : null;
      if (!typeOption) {
        updateRow(row.name, {
          extractStatus: "error",
          extractError: "No document type selected — choose a type before extracting.",
        });
        continue;
      }

      updateRow(row.name, { extractStatus: "extracting" });

      let fields: Record<string, string | null> = {};
      try {
        const result = await callExtractDocument(row.imageBlob, typeKey);
        if (cancelledRef.current) break;
        fields = result.fields as Record<string, string | null>;
      } catch (err) {
        if (cancelledRef.current) break;
        updateRow(row.name, {
          extractStatus: "error",
          extractError: err instanceof Error ? err.message : "Extraction failed",
        });
        continue;
      }

      updateRow(row.name, { extractStatus: "creating" });

      let docId: string;
      try {
        docId = await callCreateDocument(typeOption.id, fields);
        if (cancelledRef.current) break;
      } catch (err) {
        if (cancelledRef.current) break;
        updateRow(row.name, {
          extractStatus: "error",
          extractError: err instanceof Error ? err.message : "Document creation failed",
        });
        continue;
      }

      try {
        await callUploadPage(docId, row.originalFile);
      } catch {
        // Non-fatal: document was created, page upload failed
      }

      if (cancelledRef.current) break;
      updateRow(row.name, { extractStatus: "done", createdDocId: docId });
      createdNames.push(row.name);
    }

    if (!cancelledRef.current) {
      setExtracting(false);
      if (createdNames.length > 0) {
        onCreated(createdNames);
        router.refresh();
      }
    }
  }, [rows, docTypes, updateRow, onCreated, router]);

  const checkedCount = rows.filter(
    (r) => r.checked && r.classification?.extractable,
  ).length;
  const scanDoneCount = rows.filter((r) => r.status === "done" || r.status === "error" || r.status === "skip").length;
  const allScanned = scanDoneCount === rows.length && rows.length > 0;

  const toggleCheck = useCallback(
    (name: string) =>
      setRows((prev) =>
        prev.map((r) => (r.name === name ? { ...r, checked: !r.checked } : r)),
      ),
    [],
  );

  const setTypeKey = useCallback(
    (name: string, key: string | null) =>
      setRows((prev) =>
        prev.map((r) => (r.name === name ? { ...r, selectedTypeKey: key } : r)),
      ),
    [],
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="relative flex w-full max-w-5xl flex-col rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <div>
            <h2 className="text-base font-semibold">{t("title")}</h2>
            <p className="mt-0.5 text-xs text-fade">{t("hint")}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={scanning || extracting}
            aria-label={t("close")}
            className="rounded p-1 text-fade hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
          >
            ✕
          </button>
        </div>

        {/* Global error */}
        {globalError && (
          <div className="mx-5 mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {globalError}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {rows.length === 0 ? (
            <p className="text-sm text-fade">{t("noFiles")}</p>
          ) : (
            <table className="w-full text-sm" aria-label={t("title")}>
              <thead>
                <tr className="border-b border-crease text-left text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700">
                  <th className="w-8 pb-2 pr-2">
                    {/* check all / uncheck all */}
                    <input
                      type="checkbox"
                      aria-label={t("selectAll")}
                      checked={rows.filter((r) => r.classification?.extractable).length > 0 &&
                        rows.filter((r) => r.classification?.extractable).every((r) => r.checked)}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) =>
                            r.classification?.extractable
                              ? { ...r, checked: e.target.checked }
                              : r,
                          ),
                        )
                      }
                      className="accent-cta"
                    />
                  </th>
                  <th className="pb-2 pr-3">{t("colFile")}</th>
                  <th className="w-56 pb-2 pr-3">{t("colType")}</th>
                  <th className="w-24 pb-2 pr-2">{t("colConfidence")}</th>
                  <th className="w-28 pb-2">{t("colStatus")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ScanRow
                    key={row.name}
                    row={row}
                    docTypes={docTypes}
                    onToggleCheck={() => toggleCheck(row.name)}
                    onTypeKeyChange={(k) => setTypeKey(row.name, k)}
                    t={t}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-card-rim px-5 py-3 dark:border-zinc-700">
          <p className="text-xs text-fade">{t("costNote")}</p>
          <div className="flex items-center gap-3">
            {!allScanned && (
              <button
                type="button"
                onClick={handleScanAll}
                disabled={scanning || extracting || rows.length === 0}
                className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
              >
                {scanning ? t("scanning") : t("scanAllButton", { count: rows.length })}
              </button>
            )}
            {allScanned && (
              <button
                type="button"
                onClick={handleExtractSelected}
                disabled={extracting || checkedCount === 0}
                className="inline-flex items-center rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
              >
                {extracting
                  ? t("extracting")
                  : t("extractSelectedButton", { count: checkedCount })}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={scanning || extracting}
              className="rounded-md border border-wire bg-white px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScanRow — one file row in the scan results table
// ---------------------------------------------------------------------------

type RowProps = {
  row: ScanEntry;
  docTypes: DocumentTypeOption[];
  onToggleCheck: () => void;
  onTypeKeyChange: (key: string | null) => void;
  t: ReturnType<typeof useTranslations<"adminImport.scan">>;
};

function ScanRow({ row, docTypes, onToggleCheck, onTypeKeyChange, t }: RowProps) {
  const canCheck = row.status === "done" && row.classification?.extractable;

  const statusCell = (() => {
    switch (row.status) {
      case "pending":
        return <span className="text-fade">—</span>;
      case "converting":
        return <span className="text-fade text-xs animate-pulse">{t("convertingPdf")}</span>;
      case "scanning":
        return <span className="text-cta text-xs animate-pulse">{t("scanningFile")}</span>;
      case "skip":
        return <span className="text-fade text-xs">{t("skipped")}</span>;
      case "error":
        return (
          <span className="text-red-600 text-xs dark:text-red-400" title={row.errorMsg}>
            {t("errorShort")}
          </span>
        );
      case "done":
        if (row.extractStatus === "extracting")
          return <span className="text-cta text-xs animate-pulse">{t("extractingFile")}</span>;
        if (row.extractStatus === "creating")
          return <span className="text-cta text-xs animate-pulse">{t("creatingDoc")}</span>;
        if (row.extractStatus === "error")
          return (
            <span className="text-red-600 text-xs dark:text-red-400" title={row.extractError}>
              {t("errorShort")}
            </span>
          );
        if (row.extractStatus === "done" && row.createdDocId)
          return (
            <a
              href={`/documents/${row.createdDocId}`}
              className="text-emerald-600 text-xs font-medium hover:underline dark:text-emerald-400"
              onClick={(e) => e.stopPropagation()}
            >
              {t("viewDocument")}
            </a>
          );
        if (!row.classification?.extractable)
          return <span className="text-fade text-xs">{t("notExtractable")}</span>;
        return <span className="text-fade text-xs">{t("ready")}</span>;
    }
  })();

  const confidenceBadge = row.classification
    ? confidencePill(row.classification.confidence, t)
    : null;

  return (
    <tr
      className={[
        "border-b border-crease dark:border-zinc-800",
        row.status === "skip" ? "opacity-40" : "",
      ].join(" ")}
    >
      {/* Checkbox */}
      <td className="py-2 pr-2">
        {canCheck && (
          <input
            type="checkbox"
            checked={row.checked}
            onChange={onToggleCheck}
            aria-label={row.name}
            className="accent-cta"
          />
        )}
      </td>

      {/* Filename */}
      <td className="py-2 pr-3 min-w-0">
        <span className="truncate block max-w-xs text-ink dark:text-zinc-200" title={row.name}>
          {row.name}
        </span>
        {row.classification?.notes && (
          <span className="block text-xs text-fade truncate" title={row.classification.notes}>
            {row.classification.notes}
          </span>
        )}
        {row.errorMsg && (
          <span className="block text-xs text-red-600 dark:text-red-400 truncate" title={row.errorMsg}>
            {row.errorMsg}
          </span>
        )}
        {row.extractError && (
          <span className="block text-xs text-red-600 dark:text-red-400 truncate" title={row.extractError}>
            {row.extractError}
          </span>
        )}
      </td>

      {/* Type dropdown (only when scan is done + has a type list) */}
      <td className="py-2 pr-3">
        {row.status === "done" && docTypes.length > 0 ? (
          <select
            value={row.selectedTypeKey ?? ""}
            onChange={(e) => onTypeKeyChange(e.target.value || null)}
            className="w-full rounded border border-wire bg-white px-1.5 py-1 text-xs text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label={t("colType")}
          >
            <option value="">— {t("noType")} —</option>
            {docTypes.map((dt) => (
              <option key={dt.id} value={dt.key}>
                {dt.name}
              </option>
            ))}
          </select>
        ) : row.classification ? (
          <span className="text-xs text-ink dark:text-zinc-200">
            {row.classification.classifiedLabel}
          </span>
        ) : null}
      </td>

      {/* Confidence */}
      <td className="py-2 pr-2">{confidenceBadge}</td>

      {/* Status */}
      <td className="py-2">{statusCell}</td>
    </tr>
  );
}

function confidencePill(
  confidence: "high" | "medium" | "low",
  t: ReturnType<typeof useTranslations<"adminImport.scan">>,
) {
  const cls =
    confidence === "high"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : confidence === "medium"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
  const label =
    confidence === "high"
      ? t("confidence.high")
      : confidence === "medium"
        ? t("confidence.medium")
        : t("confidence.low");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
