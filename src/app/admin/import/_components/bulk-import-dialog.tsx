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
  perToSlash,
} from "@/lib/import/folder-utils";
import {
  IMPORT_SESSION_KEY,
  type SavedImportEntry,
  type SavedImportSession,
} from "@/lib/import/session";
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
  /** Slice #21.02.Import: true once AI-interpret has been successfully run on this entry. */
  aiProcessed?: boolean;
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
  path:        string;
  phase:       AiPhase;
  nickname:    string;
  /** AI scan confidence (7.8 — shown as warning in the panel) */
  confidence?: "high" | "medium" | "low";
  successMsg?: string;
  errorMsg?:   string;
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

// ---------------------------------------------------------------------------
// PDF rasterization via Web Worker  (fix 7.7 — off-main-thread rendering)
// ---------------------------------------------------------------------------
//
// A singleton Worker instance is reused across calls; concurrent calls are
// demultiplexed by a random `id` that is echoed back by the worker.
// The Worker uses OffscreenCanvas so no DOM canvas is needed on the main thread.

let _pdfWorker: Worker | null = null;

function getPdfWorker(): Worker {
  if (!_pdfWorker) {
    _pdfWorker = new Worker(
      // Webpack bundles the worker as a separate entry point when this URL
      // pattern is used — standard Next.js / webpack 5 Web Worker support.
      new URL("../_workers/pdf-rasterizer.worker.ts", import.meta.url),
    );
  }
  return _pdfWorker;
}

async function pdfFirstPageBlob(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const worker = getPdfWorker();
  const id     = Math.random().toString(36).slice(2);

  return new Promise<Blob>((resolve, reject) => {
    function handleMessage(
      e: MessageEvent<{ id: string; buffer?: ArrayBuffer; error?: string }>,
    ) {
      if (e.data.id !== id) return; // belongs to a different concurrent call
      worker.removeEventListener("message", handleMessage);
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else if (e.data.buffer) {
        resolve(new Blob([e.data.buffer], { type: "image/png" }));
      } else {
        reject(new Error("PDF worker returned no buffer"));
      }
    }
    worker.addEventListener("message", handleMessage);
    // Transfer the ArrayBuffer to avoid a copy across the thread boundary.
    worker.postMessage({ id, buffer, scale: 1.5 }, [buffer]);
  });
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all active document types.
 * Returns:
 *   - `fallbackId`: ALTUL → OTHER → first row alphabetically (used when no type can be resolved)
 *   - `typeMap`: key → id (slug match)
 *   - `nameMap`: lowercased name → id (label match, used for auto-create dedup)
 */
async function fetchDocTypes(): Promise<{
  fallbackId: string;
  typeMap: Record<string, string>;
  nameMap: Record<string, string>;
}> {
  const res = await fetch("/api/admin/value-lists/document-types");
  if (!res.ok) throw new Error("Nu s-au putut încărca tipurile de documente (HTTP " + res.status + ").");
  const body = (await res.json()) as { items?: { id: string; key: string; name: string }[] };
  const items = body.items ?? [];
  if (items.length === 0) {
    throw new Error(
      "Nu există niciun tip de document definit în Date de Referință. " +
      "Adăugați cel puțin un tip înainte de a importa fișiere.",
    );
  }
  const fallback =
    items.find((x) => x.key === "ALTUL") ??
    items.find((x) => x.key === "OTHER") ??
    items[0];
  const typeMap: Record<string, string> = {};
  const nameMap: Record<string, string> = {};
  for (const item of items) {
    typeMap[item.key] = item.id;
    nameMap[item.name.toLowerCase().trim()] = item.id;
  }
  return { fallbackId: fallback.id, typeMap, nameMap };
}

// Session-scoped cache for auto-created types so the same label is not
// created more than once during a single import run.
const autoCreatedTypeCache = new Map<string, string>();

/**
 * Resolve a document type ID for an entry:
 * 1. Exact key match in typeMap (seeded types)
 * 2. Label name match in nameMap (previously created types)
 * 3. Auto-create via Reference Data API and cache the new ID
 * 4. Fall back to fallbackId if label is empty or API fails
 */
async function ensureDocType(
  typeKey:     string | null | undefined,
  label:       string | null | undefined,
  typeMap:     Record<string, string>,
  nameMap:     Record<string, string>,
  fallbackId:  string,
): Promise<string> {
  // 1. Exact key match (any non-null, non-UNCLASSIFIED typeKey)
  if (typeKey && typeKey !== "UNCLASSIFIED") {
    const id = typeMap[typeKey];
    if (id) return id;
  }

  // 2. Resolve by label
  const trimmedLabel = label?.trim();
  if (!trimmedLabel || trimmedLabel === "Document necunoscut") return fallbackId;

  // 2a. Name match in existing types
  const nameKey = trimmedLabel.toLowerCase();
  const existingByName = nameMap[nameKey];
  if (existingByName) return existingByName;

  // 2b. Session cache (already auto-created this run)
  const cached = autoCreatedTypeCache.get(nameKey);
  if (cached) return cached;

  // 3. Auto-create new document type
  try {
    const res = await fetch("/api/admin/value-lists/document-types", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: trimmedLabel }),
    });
    if (res.ok) {
      const row = (await res.json()) as { id?: string };
      if (row.id) {
        autoCreatedTypeCache.set(nameKey, row.id);
        nameMap[nameKey] = row.id; // update for subsequent rows
        return row.id;
      }
    }
  } catch { /* ignore — fall through to fallback */ }

  return fallbackId;
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
  if (res.redirected) throw new Error("session-expired");
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
  nickname:   string;
  corners:    unknown[];
  tarlaSola?: string | null;
  parcela?:   string | null;
}): Promise<string> {
  const res = await fetch("/api/properties", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nickname:  payload.nickname,
      corners:   payload.corners,
      tarlaSola: payload.tarlaSola ?? null,
      parcela:   payload.parcela   ?? null,
    }),
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
  const [importError, setImportError] = useState<string | null>(null);
  // fix 7.6 — session-expiry detection during bulk import
  const [sessionExpired, setSessionExpired] = useState(false);
  const abortRef = useRef(false);
  const [aiState, setAiState] = useState<AiState | null>(null);
  const [parsedCorners, setParsedCorners] = useState<unknown[] | null>(null);

  const updateResult = useCallback(
    (path: string, patch: Partial<ImportResult>) =>
      setResults((prev) =>
        prev.map((r) => (r.entry.path === path ? { ...r, ...patch } : r)),
      ),
    [],
  );

  // ---------------------------------------------------------------------------
  // Run import on mount.
  //
  // IMPORTANT: use a per-invocation `mounted` boolean, NOT a shared ref.
  // React Strict Mode (dev) double-invokes effects: the cleanup of the first
  // invocation would set a shared ref to false and the second invocation would
  // see it already false — but a new closure-local `mounted` starts as `true`
  // on each invocation and is set to `false` only by *its own* cleanup.
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let mounted = true;
    let fallbackDocTypeId: string;
    let docTypeMap: Record<string, string> = {};
    let docNameMap: Record<string, string> = {};

    async function run() {
      // fetchDocTypes throws with a Romanian error if no types exist.
      const { fallbackId, typeMap, nameMap } = await fetchDocTypes();
      fallbackDocTypeId = fallbackId;
      docTypeMap = typeMap;
      docNameMap = nameMap;
      if (!mounted) return;

      const tasks = entries.map((entry) => async () => {
        // fix 7.6: if a previous task detected session expiry, skip all
        // remaining pending tasks rather than hammering a dead session.
        if (!mounted) return;
        if (abortRef.current) {
          updateResult(entry.path, {
            status: "error",
            errorMsg: t("sessionExpiredShort"),
          });
          return;
        }

        updateResult(entry.path, { status: "importing" });

        try {
          // 1. Determine title
          const title =
            entry.kind === "page-group"
              ? entry.titleHint
              : entry.name;

          // 2. Resolve document type.
          //    Slice #21.02.Import: use the scan's typeKey/label to look up or
          //    auto-create the matching document type; falls back to fallbackId
          //    only when no meaningful classification is available.
          const sr = scanResults.get(entry.path);
          const resolvedTypeId = await ensureDocType(
            sr?.typeKey,
            sr?.description,
            docTypeMap,
            docNameMap,
            fallbackDocTypeId,
          );

          // 3. Create the Document record
          const { id: docId, principalObjectId } = await createDocument({
            documentTypeId: resolvedTypeId,
            title,
          });

          // 4. Upload file(s) as pages
          if (entry.kind === "page-group") {
            const pg = entry as FSPageGroupEntry;
            for (let i = 0; i < pg.handles.length; i++) {
              if (!mounted) break;
              const file = await pg.handles[i].getFile();
              await uploadPage(docId, file, i + 1);
            }
          } else {
            const fe = entry as FSFileEntry;
            const file = await fe.handle.getFile();
            await uploadPage(docId, file, 1);
          }

          // 5. Tag with all ancestor folder names
          const tags = tagsForEntry(rootFolderName, entry);
          for (const tag of tags) {
            await addTag(principalObjectId, tag);
          }

          if (mounted) {
            updateResult(entry.path, { status: "done", docId, principalObjectId });
          }
        } catch (err) {
          if (!mounted) return;
          const msg = err instanceof Error ? err.message : "Import failed";

          // fix 7.6: session-expired thrown by createDocument or uploadPage
          // when the server redirects to /sign-in instead of returning JSON.
          // Abort remaining tasks and show a dedicated banner; preserve the
          // error rows so the user knows which files to re-import after login.
          if (msg === "session-expired") {
            abortRef.current = true;
            setSessionExpired(true);
            updateResult(entry.path, { status: "error", errorMsg: t("sessionExpiredShort") });
          } else {
            updateResult(entry.path, { status: "error", errorMsg: msg });
          }
        }
      });

      await withConcurrencyLimit(tasks, CONCURRENCY, () => {});
      if (mounted) setDone(true);
    }

    run().catch((err) => {
      if (mounted) {
        const msg = err instanceof Error ? err.message : "Import failed unexpectedly";
        setImportError(msg);
      }
    });

    return () => { mounted = false; };
    // entries and rootFolderName are stable for the lifetime of this dialog;
    // updateResult is a stable useCallback reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  // Persist the completed session to localStorage so the user can "Resume"
  // it after navigating away (e.g. to inspect an individual document).
  // File System Access API handles cannot be serialised, so the resumed view
  // is read-only: doc links work, but AI Interpret requires the actual files.
  useEffect(() => {
    if (!done) return;
    const sessionEntries: SavedImportEntry[] = results.map((r) => {
      const displayName =
        r.entry.kind === "page-group"
          ? r.entry.titleHint
          : (r.entry as FSFileEntry).name;
      const sr = scanResults.get(r.entry.path);
      return {
        path:             r.entry.path,
        displayName,
        kind:             r.entry.kind,
        status:           r.status,
        docId:            r.docId,
        errorMsg:         r.errorMsg,
        scanDescription:  sr?.description,
        confidence:       sr?.confidence,
        aiProcessed:      r.aiProcessed,
      };
    });
    const session: SavedImportSession = {
      rootFolderName,
      savedAt: new Date().toISOString(),
      entries:  sessionEntries,
    };
    try {
      localStorage.setItem(IMPORT_SESSION_KEY, JSON.stringify(session));
    } catch {
      // localStorage quota exceeded — ignore; links still work for this session.
    }
  }, [done, results, rootFolderName, scanResults]);

  // ---------------------------------------------------------------------------
  // AI interpretation handler
  // ---------------------------------------------------------------------------
  //
  // Pre-existing orphaned code (no remaining call site) found while fixing
  // lint for Slice #21.03.Import — not part of this slice, so left in place
  // rather than deleted blind. Prefixed per this repo's eslint convention
  // ("Allowed unused vars must match /^_/u") instead of removing what might
  // be mid-refactor scaffolding; isTextFile/parseTextFileForProperty below
  // stay alive as its only remaining callers.

  const _handleAiInterpret = useCallback(
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
          path:       entry.path,
          phase:      isIdCard ? "id-card" : "generic-doc",
          nickname:   name,
          confidence: scanResult.confidence, // 7.8: pass through for warning display
        });
        return;
      }

      // No scan result — offer generic (confidence unknown)
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
        // Derive tarla/parcela from the entry's property-folder info.
        // "per" is the Romanian separator meaning "/" in cadastral notation
        // (e.g. "64per2" → "64/2", "234per7per8" → "234/7/8").
        const entryResult = results.find((r) => r.entry.path === entryPath);
        const folderInfo = entryResult?.entry.folderInfo;
        const tarlaSola = folderInfo?.tarlaSola ? perToSlash(folderInfo.tarlaSola) : null;
        const parcela   = folderInfo?.parcela   ? perToSlash(folderInfo.parcela)   : null;

        const propertyId = await createProperty({ nickname, corners: parsedCorners, tarlaSola, parcela });

        // Associate siblings from the same containing folder.
        // Use pathParts.join("/") (the folder path, e.g. "64per2-234" or ""
        // for flat root entries) rather than path.split("/")[0], which for
        // flat entries returns the filename itself and matches nothing.
        const entryFolder = (entryResult?.entry.pathParts ?? []).join("/");
        const siblingDocIds = results
          .filter(
            (r) =>
              r.status === "done" &&
              r.docId &&
              r.entry.path !== entryPath &&
              r.entry.pathParts.join("/") === entryFolder,
          )
          .map((r) => r.docId as string);

        // Also associate the current document (the text file itself is saved
        // as a document so it can appear in the property's Documents tab).
        const currentDocId = entryResult?.docId;
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
            title:        fields.title        ?? undefined,
            nrDocument:   fields.nrDocument   ?? undefined,
            dateDocument: fields.dateDocument ?? undefined,
            subject:      fields.subject      ?? undefined,
          }),
        });

        // Slice #21.02.Import: stamp ai_interpreted_at on the document record
        // and mark the result row as AI-processed so the badge renders.
        await fetch(`/api/documents/${docId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aiInterpretedAt: new Date().toISOString() }),
        });
        updateResult(entryPath, { aiProcessed: true });

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
    [results, updateResult, t],
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
            {done && errorCount === 0 && (
              <p className="mt-0.5 text-xs text-fade">{t("doneHint")}</p>
            )}
            {done && errorCount > 0 && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                {doneCount} importate cu succes · {errorCount} erori (verificați coloana Status)
              </p>
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

        {/* Fatal error banner (e.g. session expired before import started) */}
        {importError && (
          <div className="mx-5 mt-3 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {importError}
          </div>
        )}

        {/* Session-expired banner (fix 7.6): shown when the Supabase session
            expired mid-import.  Lists which rows failed so the user can
            re-import them after signing in again. */}
        {sessionExpired && (
          <div className="mx-5 mt-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {t("sessionExpiredBanner")}{" "}
            <a
              href="/sign-in"
              className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-200"
            >
              {t("signInAgain")}
            </a>
          </div>
        )}

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
                <th className="w-28 pb-2">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <ResultRow
                  key={r.entry.path}
                  result={r}
                  t={t}
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
  t: ReturnType<typeof useTranslations<"adminImport.wizard.importDialog">>;
};

function ResultRow({ result, t }: ResultRowProps) {
  const { entry, status, errorMsg, docId } = result;
  const displayName = entry.kind === "page-group" ? entry.titleHint : (entry as FSFileEntry).name;

  return (
    <tr className="border-b border-crease dark:border-zinc-800">
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
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
          >
            {t("viewLink")}
          </a>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// AiPanel — inline interpretation panel
// ---------------------------------------------------------------------------

type AiPanelProps = {
  state:            AiState;
  results:          ImportResult[];
  t:                ReturnType<typeof useTranslations<"adminImport.wizard.importDialog">>;
  onCreateProperty: (path: string, nickname: string) => void;
  onCreatePerson:   (path: string) => void;
  onExtractFields:  (path: string, docId: string) => void;
  onClose:          () => void;
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

      {/* 7.8 — confidence warning: shown when AI classified with low/medium confidence
           and an action (id-card, generic-doc, coordinates) is about to be taken.
           Coordinates use a different signal (coordinate-range check, not AI confidence)
           so we only warn on the AI-driven phases. */}
      {(state.phase === "id-card" || state.phase === "generic-doc") &&
        (state.confidence === "low" || state.confidence === "medium") && (
          <div className="mb-2 flex items-center gap-1.5 rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
            <span aria-hidden="true">⚠</span>
            {t("aiConfidenceWarning", { level: t(`aiConfidence_${state.confidence}`) })}
          </div>
        )}

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
