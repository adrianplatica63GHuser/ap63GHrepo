"use client";

/**
 * BulkImportDialog — Slice #21.01.Import
 *
 * Step 3 of the import wizard: imports every FSEntry (file or page-group)
 * as a Document, uploads its file(s) as pages, links it to the run's Property
 * and tags it with all ancestor folder names.
 *
 * After import, the results table offers up to three per-row follow-ups, each
 * on a row that finished cleanly:
 *
 *   - "Interpretează AI"  (Slice #23.02.Import) — any row with an image or PDF
 *     page. Extracts fields per the document's own type template and, when the
 *     type has person roles configured, walks the extracted parties through the
 *     shared confirm-or-create stepper.
 *   - "Creează persoană din CI"  (Slice #23.01.Import) — rows the scan
 *     classified as an identity card.
 *   - "Aplică pe proprietate"  (Slice #23.02.Import) — rows that are coordinate
 *     files, offering their corners to the run's Property.
 *
 * All three run AFTER the import, deliberately: by then the Document exists, its
 * pages are uploaded and it is already attached to the Property, so each action
 * only has to add one thing. Offering any of them beforehand would mean the
 * wizard creating a second Document for the same file, since it imports every
 * entry unconditionally and has no skip mechanism.
 *
 * The concurrency limit is 3 in-flight import operations at a time. The
 * follow-up actions are one-at-a-time: each opens a modal.
 *
 * Provenance (Slice #21.07.Import): each entry's provenance is inferred from
 * its own file extension(s) - a page-group of scans and a single .jpg are IMAGE,
 * a .pdf/.doc/.txt is DOC_FILE. A folder can hold anything, though, so entries
 * whose extension is unrecognised (or a page-group mixing kinds) cannot be
 * inferred; those hold the import at a gate that asks once, up front, rather
 * than importing them with a guessed or empty provenance. When every entry is
 * inferable - the normal case - the gate never appears and the import starts on
 * mount exactly as before.
 *
 * Slice #23.02.Import removed the dead AI scaffolding this file used to carry:
 * the AiPhase state machine, the callerless _handleAiInterpret that fed it, the
 * AiPanel it was meant to drive, and the three handlers behind that panel
 * (handleCreateProperty / handleCreatePerson / handleExtractFields). Two of
 * those offers now exist for real, above; the third (ID card) shipped in
 * #23.01. Nothing is left running both versions.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  type FSEntry,
  type FSFileEntry,
  type FSPageGroupEntry,
  tagsForEntry,
  extOf,
} from "@/lib/import/folder-utils";
import {
  IMPORT_SESSION_KEY,
  type SavedImportEntry,
  type SavedImportSession,
} from "@/lib/import/session";
import type { ScanResult } from "./scan-table";
import { inferProvenanceForFiles } from "@/lib/metadata/provenance-rules";
import type { ProvenanceCode } from "@/lib/metadata/provenance";
import { ProvenanceField } from "./provenance-field";
import { isIdCardEntry } from "@/lib/import/id-card";
import { isCoordinateFileName } from "@/lib/import/coordinate-file";
import {
  IdCardPersonDialog,
  type IdCardPersonOutcome,
} from "./id-card-person-dialog";
import {
  CoordinatePropertyDialog,
  type CoordinateOutcome,
} from "./coordinate-property-dialog";
import {
  DocumentAiInterpretDialog,
  type AiInterpretOutcome,
} from "./document-ai-interpret-dialog";

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
  /** Slice #23.02.Import: how many document fields that run filled in. */
  aiFieldCount?: number;
  /** Slice #23.02.Import: party stepper tally, null when the type has no roles. */
  aiParties?: { linked: number; created: number; skipped: number } | null;
  /**
   * Slice #23.01.Import: set once a Person has been confirmed or created from
   * this entry's ID card and linked to the run's Property and this Document.
   * Its only job is to stop the row offering the action a second time — the
   * second run would resolve to the same person and the link calls are
   * idempotent, but re-offering it reads as "that didn't work".
   */
  personId?: string;
  /**
   * Slice #23.02.Import: set once this coordinate file has been offered to the
   * Property — whether its corners were written, kept, or found already
   * applied. Same job as personId: stop re-offering a settled question.
   */
  coordinateSettled?: boolean;
  /** Corner count the Property ended up with, for the row's summary. */
  cornerCount?: number;
};

type Props = {
  entries: FSEntry[];
  rootFolderName: string;
  scanResults: Map<string, ScanResult>;
  /**
   * Slice #23.00.Import: the single Property this whole run belongs to,
   * resolved by PropertyStepDialog before the import starts. Every document
   * created here is linked to it directly. Required — the wizard cannot reach
   * this dialog without one.
   */
  propertyId: string;
  /**
   * Slice #23.02.Import: fired when a coordinate row rewrites the Property's
   * corners, so the wizard's toolbar chip stops advertising the count it had at
   * the property step.
   */
  onPropertyCornersChanged?: (cornerCount: number) => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Concurrency helpers
// ---------------------------------------------------------------------------

const CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Provenance helpers  (Slice #21.07.Import)
// ---------------------------------------------------------------------------

/**
 * The file name(s) an entry will be built from — a page-group carries one per
 * image handle, a plain file carries its own. Used only to read extensions.
 */
function entryFileNames(entry: FSEntry): string[] {
  return entry.kind === "page-group"
    ? (entry as FSPageGroupEntry).handles.map((h) => h.name)
    : [(entry as FSFileEntry).name];
}

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
//
// Slice #23.02.Import removed the local TEXT_EXTS_SET / isTextFile pair: the
// coordinate-file extension list now has exactly one home, the pure
// isCoordinateFileName in src/lib/import/coordinate-file.ts, which the property
// step already uses. Two copies of "which extensions might hold corners" is one
// copy too many.

const IMAGE_EXTS_SET = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"]);
const PDF_EXT = ".pdf";

function isImageFile(name: string) { return IMAGE_EXTS_SET.has(extOf(name)); }
function isPdfFile(name: string)   { return extOf(name) === PDF_EXT; }

/**
 * True when at least one of this entry's files is something the AI-interpret
 * route can actually send to the model. A text-only document comes back 422
 * with "fișierele text ... nu pot fi interpretate cu AI", so offering the
 * button there would only ever produce that error.
 */
function hasReadablePage(entry: FSEntry): boolean {
  return entryFileNames(entry).some((n) => isImageFile(n) || isPdfFile(n));
}

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
  provenance: ProvenanceCode;
}): Promise<{ id: string; principalObjectId: string }> {
  const res = await fetch("/api/documents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      documentTypeId: payload.documentTypeId ?? null,
      title: payload.title ?? null,
      provenance: payload.provenance,
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

/**
 * Link documents to the run's Property.
 *
 * Slice #23.00.Import made this load-bearing: it is now THE mechanism that
 * attaches an imported document to its property, on the main import path, for
 * every single document. It used to be a fire-and-forget call on a dead AI
 * branch, so its failure was ignored — a silently dropped link is exactly the
 * outcome this slice exists to prevent, so it now throws and the entry is
 * marked as an error.
 */
async function associateDocumentsWithProperty(
  propertyId: string,
  documentIds: string[],
): Promise<void> {
  if (documentIds.length === 0) return;
  const res = await fetch(`/api/properties/${propertyId}/documents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ documentIds }),
  });
  // Same expired-session tell as createDocument/uploadPage: the middleware
  // redirects to /sign-in and fetch follows it into a 200 of HTML.
  if (res.redirected) throw new Error("session-expired");
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function BulkImportDialog({
  entries,
  rootFolderName,
  scanResults,
  propertyId,
  onPropertyCornersChanged,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog");
  const tprov = useTranslations("adminImport.provenance");
  const router = useRouter();

  const [results, setResults] = useState<ImportResult[]>(() =>
    entries.map((entry) => ({ entry, status: "pending" })),
  );
  const [done, setDone] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // fix 7.6 — session-expiry detection during bulk import
  const [sessionExpired, setSessionExpired] = useState(false);
  const abortRef = useRef(false);

  // Slice #23.01.Import — the row whose ID card is being turned into a Person.
  // The File is resolved up front (the FSEntry handle is only readable while
  // this dialog is mounted) and held here so the child gets a plain File.
  const [idCardTarget, setIdCardTarget] = useState<
    { path: string; docId: string; label: string; file: File } | null
  >(null);
  const [idCardError, setIdCardError] = useState<string | null>(null);

  // Slice #23.02.Import — the two new row actions, one at a time.
  const [coordinateTarget, setCoordinateTarget] = useState<
    { path: string; entry: FSFileEntry } | null
  >(null);
  const [aiTarget, setAiTarget] = useState<
    { path: string; docId: string; label: string } | null
  >(null);

  // ── Provenance (Slice #21.07.Import) ──────────────────────────────────────
  //
  // Inference is a pure function of the entry list, which is stable for this
  // dialog's lifetime, so it is computed once with useMemo rather than held in
  // state. Entries that come back null are the ones the gate asks about.
  const inferredProvenance = useMemo(() => {
    const map = new Map<string, ProvenanceCode | null>();
    for (const entry of entries) {
      map.set(entry.path, inferProvenanceForFiles(entryFileNames(entry)));
    }
    return map;
    // `entries` is stable for the lifetime of this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ambiguousEntries = useMemo(
    () => entries.filter((e) => inferredProvenance.get(e.path) == null),
    // as above — both inputs are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inferredProvenance],
  );

  /** User's answers for the ambiguous entries, keyed by entry path. */
  const [pickedProvenance, setPickedProvenance] = useState<Record<string, ProvenanceCode | "">>({});

  // The gate is open only while at least one ambiguous entry is unanswered.
  // With nothing ambiguous it starts closed and the import runs on mount,
  // exactly as it did before this slice.
  const [gatePassed, setGatePassed] = useState(ambiguousEntries.length === 0);

  const allAmbiguousAnswered = ambiguousEntries.every(
    (e) => (pickedProvenance[e.path] ?? "") !== "",
  );

  /**
   * Final provenance for an entry: the inferred value, or the user's answer.
   * Never returns null once the gate has been passed — the gate is exactly the
   * guarantee that every ambiguous entry has been answered.
   */
  const provenanceForEntry = useCallback(
    (entry: FSEntry): ProvenanceCode | null =>
      inferredProvenance.get(entry.path) ?? (pickedProvenance[entry.path] || null),
    [inferredProvenance, pickedProvenance],
  );

  // Read by the import effect, which must not re-run when the picks change.
  const provenanceRef = useRef(provenanceForEntry);
  useEffect(() => {
    provenanceRef.current = provenanceForEntry;
  }, [provenanceForEntry]);

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
    // Slice #21.07.Import: hold everything until every ambiguous entry has a
    // provenance. Returning early (rather than never mounting the effect) keeps
    // the existing StrictMode-safe `mounted` pattern intact.
    if (!gatePassed) return;

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

          // 3. Create the Document record.
          //    Provenance is inferred from the entry's own file extension(s);
          //    the gate above guarantees a value exists by the time we get
          //    here, so the fallback branch is defensive only.
          const entryProvenance = provenanceRef.current(entry);
          if (!entryProvenance) {
            throw new Error(tprov("required"));
          }
          const { id: docId, principalObjectId } = await createDocument({
            documentTypeId: resolvedTypeId,
            title,
            provenance: entryProvenance,
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

          // 5. Link the document to the run's Property.
          //
          // Slice #23.00.Import: DIRECT, and before the tags — this is the
          // real relationship, so if anything below fails the document is
          // still attached to the right property. The old flow had no step
          // like this at all: the property was inferred later from a shared
          // tag string via findEntitiesByTag, which matched every document
          // anywhere in the system carrying that tag, not just this run's.
          await associateDocumentsWithProperty(propertyId, [docId]);

          // 6. Tag with all ancestor folder names.
          //
          // Tags are now DESCRIPTIVE ONLY — a browsing aid. They no longer
          // link the document to anything; step 5 did that.
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
    // updateResult is a stable useCallback reference; the per-entry provenance
    // is read through provenanceRef so answering the gate does not restart an
    // import that is already running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatePassed]);

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
  // Slice #23.01.Import — "Creează persoană din CI"
  // ---------------------------------------------------------------------------
  //
  // Offered on a row that finished importing AND that the scan classified as an
  // identity card. It runs AFTER the import, deliberately: by then the Document
  // and its page already exist and are already linked to the run's Property, so
  // the person flow only has to resolve an identity and attach it. Offering it
  // before the import would mean creating a second Document for the same image.
  //
  // The image is resolved here rather than in the child because the FSEntry
  // handle is only readable while this dialog is mounted, and because a PDF has
  // to be rasterised to its first page before a vision model can read it.
  const handleOpenIdCard = useCallback(
    async (result: ImportResult) => {
      if (!result.docId) return;
      setIdCardError(null);
      try {
        const entry = result.entry;
        // A page-group is several scans of one document; the card's data side
        // is page 1. (The orphaned handleCreatePerson handled only plain files
        // and threw "Not a scannable file" on a two-page scan.)
        const handle =
          entry.kind === "page-group"
            ? (entry as FSPageGroupEntry).handles[0]
            : (entry as FSFileEntry).handle;
        if (!handle) throw new Error(t("idCardNoFile"));

        const file = await handle.getFile();
        let image: File;
        if (isPdfFile(file.name)) {
          const blob = await pdfFirstPageBlob(file);
          image = new File([blob], `${file.name}.png`, { type: blob.type || "image/png" });
        } else if (isImageFile(file.name)) {
          image = file;
        } else {
          throw new Error(t("idCardNoFile"));
        }

        const label =
          entry.kind === "page-group"
            ? (entry as FSPageGroupEntry).titleHint
            : (entry as FSFileEntry).name;

        setIdCardTarget({ path: entry.path, docId: result.docId, label, file: image });
      } catch (err) {
        setIdCardError(err instanceof Error ? err.message : t("idCardNoFile"));
      }
    },
    [t],
  );

  const handleIdCardDone = useCallback((outcome: IdCardPersonOutcome) => {
    setIdCardTarget((target) => {
      if (target) updateResult(target.path, { personId: outcome.personId });
      return null;
    });
    // updateResult is a stable useCallback reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Slice #23.02.Import — the two ported actions
  // ---------------------------------------------------------------------------

  /**
   * "Aplică pe proprietate" — offer this coordinate file's corners to the run's
   * Property. Only ever on a plain file entry: a page-group is by definition a
   * folder of sequentially-numbered images and can never hold a text export.
   */
  const handleOpenCoordinate = useCallback((result: ImportResult) => {
    if (result.entry.kind !== "file") return;
    setCoordinateTarget({
      path: result.entry.path,
      entry: result.entry as FSFileEntry,
    });
  }, []);

  const handleCoordinateDone = useCallback(
    (outcome: CoordinateOutcome) => {
      setCoordinateTarget((target) => {
        if (target) {
          updateResult(target.path, {
            coordinateSettled: true,
            cornerCount: outcome.cornerCount,
          });
        }
        return target;
      });
      // Only a real write invalidates the wizard's chip; keeping the existing
      // corners changed nothing to report.
      if (outcome.changed) onPropertyCornersChanged?.(outcome.cornerCount);
    },
    [onPropertyCornersChanged, updateResult],
  );

  /** "Interpretează AI" — extract fields, then walk any parties. */
  const handleOpenAi = useCallback((result: ImportResult) => {
    if (!result.docId) return;
    const entry = result.entry;
    const label =
      entry.kind === "page-group"
        ? (entry as FSPageGroupEntry).titleHint
        : (entry as FSFileEntry).name;
    setAiTarget({ path: entry.path, docId: result.docId, label });
  }, []);

  const handleAiDone = useCallback(
    (outcome: AiInterpretOutcome) => {
      setAiTarget((target) => {
        if (target) {
          updateResult(target.path, {
            aiProcessed: true,
            aiFieldCount: outcome.fieldCount,
            aiParties: outcome.parties,
          });
        }
        return target;
      });
    },
    [updateResult],
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

        {/* Provenance gate (Slice #21.07.Import) — shown only when at least one
            entry's provenance could not be inferred from its file extension.
            Nothing is imported until every listed entry has an answer. */}
        {!gatePassed && (
          <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
            <h3 className="text-sm font-semibold text-ink dark:text-zinc-100">
              {tprov("gateTitle")}
            </h3>
            <p className="mt-1 text-xs text-fade dark:text-zinc-400">{tprov("gateIntro")}</p>

            <table className="mt-3 w-full text-sm">
              <tbody>
                {ambiguousEntries.map((entry) => (
                  <tr key={entry.path} className="border-b border-crease dark:border-zinc-700">
                    <td className="py-1.5 pr-3">
                      <span className="block truncate" title={entry.path}>
                        {entry.kind === "page-group"
                          ? entry.titleHint
                          : (entry as FSFileEntry).name}
                      </span>
                    </td>
                    <td className="w-56 py-1.5">
                      <ProvenanceField
                        inferred={null}
                        value={pickedProvenance[entry.path] ?? ""}
                        onChange={(value) =>
                          setPickedProvenance((prev) => ({ ...prev, [entry.path]: value }))
                        }
                        compact
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  // "Apply to all" copies the first answered value down the
                  // list — the common case is a folder of one odd file type.
                  const first = ambiguousEntries
                    .map((e) => pickedProvenance[e.path])
                    .find((v): v is ProvenanceCode => !!v);
                  if (!first) return;
                  setPickedProvenance(
                    Object.fromEntries(ambiguousEntries.map((e) => [e.path, first])),
                  );
                }}
                className="rounded-md border border-wire bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              >
                {tprov("gateApplyAll")}
              </button>
              <button
                type="button"
                onClick={() => setGatePassed(true)}
                disabled={!allAmbiguousAnswered}
                className="rounded-md bg-cta px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-cta-d disabled:cursor-not-allowed disabled:opacity-50"
              >
                {tprov("gateContinue")}
              </button>
            </div>
          </div>
        )}

        {/* Progress bar (shown while importing) */}
        {gatePassed && !done && (
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
        {gatePassed && (
        <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
          {/* Slice #23.01.Import — ID-card person flow for one row at a time. */}
          {idCardTarget && (
            <IdCardPersonDialog
              file={idCardTarget.file}
              entryLabel={idCardTarget.label}
              propertyId={propertyId}
              documentId={idCardTarget.docId}
              // Slice #23.03.Import — the scan's own confidence, read here
              // rather than stored on the target: scanResults is keyed by the
              // same path and never changes after the scan, so there is no
              // second copy to keep in step.
              scanConfidence={scanResults.get(idCardTarget.path)?.confidence}
              onDone={handleIdCardDone}
              onClose={() => setIdCardTarget(null)}
            />
          )}

          {/* Slice #23.02.Import — coordinate file → the run's Property. */}
          {coordinateTarget && (
            <CoordinatePropertyDialog
              propertyId={propertyId}
              entry={coordinateTarget.entry}
              onDone={handleCoordinateDone}
              onClose={() => setCoordinateTarget(null)}
            />
          )}

          {/* Slice #23.02.Import — per-type AI extraction + party linking. */}
          {aiTarget && (
            <DocumentAiInterpretDialog
              documentId={aiTarget.docId}
              entryLabel={aiTarget.label}
              // Slice #23.03.Import — see the note on the ID-card dialog above.
              scanConfidence={scanResults.get(aiTarget.path)?.confidence}
              onDone={handleAiDone}
              onClose={() => setAiTarget(null)}
            />
          )}

          {idCardError && (
            <div
              role="alert"
              className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {idCardError}
            </div>
          )}

          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400">
            {t("resultsTitle")}
          </h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-crease text-left text-xs font-semibold uppercase tracking-wide text-fade dark:border-zinc-700">
                <th className="pb-2 pr-3">{t("colDocument")}</th>
                <th className="w-28 pb-2">{t("colStatus")}</th>
                <th className="w-64 pb-2">{t("colAction")}</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <ResultRow
                  key={r.entry.path}
                  result={r}
                  t={t}
                  isIdCard={isIdCardEntry(scanResults.get(r.entry.path))}
                  isCoordinate={
                    r.entry.kind === "file" &&
                    isCoordinateFileName((r.entry as FSFileEntry).name)
                  }
                  canInterpret={hasReadablePage(r.entry)}
                  onCreatePerson={() => void handleOpenIdCard(r)}
                  onApplyCoordinates={() => handleOpenCoordinate(r)}
                  onInterpret={() => handleOpenAi(r)}
                />
              ))}
            </tbody>
          </table>
        </div>
        )}
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
  /** Slice #23.01.Import: the scan says this entry is an identity card. */
  isIdCard: boolean;
  /** Slice #23.02.Import: this entry's extension could hold Stereo 70 corners. */
  isCoordinate: boolean;
  /** Slice #23.02.Import: at least one page is an image or PDF. */
  canInterpret: boolean;
  onCreatePerson: () => void;
  onApplyCoordinates: () => void;
  onInterpret: () => void;
};

function ResultRow({
  result,
  t,
  isIdCard,
  isCoordinate,
  canInterpret,
  onCreatePerson,
  onApplyCoordinates,
  onInterpret,
}: ResultRowProps) {
  const {
    entry,
    status,
    errorMsg,
    docId,
    personId,
    aiProcessed,
    aiFieldCount,
    aiParties,
    coordinateSettled,
    cornerCount,
  } = result;
  const displayName = entry.kind === "page-group" ? entry.titleHint : (entry as FSFileEntry).name;

  // Every follow-up action needs a cleanly imported row: without a docId there
  // is nothing to attach to, and an errored row most often failed because the
  // session expired, in which case these calls would fail too.
  const settled = status === "done" && !!docId;

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

      <td className="py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Slice #23.02.Import — AI extraction. Offered on any readable row,
              ID cards included: reading a card's fields into the Document and
              turning it into a Person are independent jobs. */}
          {settled && canInterpret && !aiProcessed && (
            <button
              type="button"
              onClick={onInterpret}
              className="rounded-md border border-cta/40 bg-cta-pale px-2 py-1 text-xs font-medium text-cta hover:bg-cta/15"
            >
              {t("interpretButton")}
            </button>
          )}
          {aiProcessed && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {t("interpretDone", { count: aiFieldCount ?? 0 })}
              {aiParties
                ? ` · ${t("interpretParties", {
                    count: aiParties.linked + aiParties.created,
                  })}`
                : ""}
            </span>
          )}

          {/* Slice #23.01.Import — the ID-card action. */}
          {settled && isIdCard && !personId && (
            <button
              type="button"
              onClick={onCreatePerson}
              className="rounded-md border border-cta/40 bg-cta-pale px-2 py-1 text-xs font-medium text-cta hover:bg-cta/15"
            >
              {t("createPersonButton")}
            </button>
          )}
          {personId && (
            <a
              href={`/natural-persons/${personId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
            >
              ✓ {t("personLinked")}
            </a>
          )}

          {/* Slice #23.02.Import — coordinate file → the run's Property. */}
          {settled && isCoordinate && !coordinateSettled && (
            <button
              type="button"
              onClick={onApplyCoordinates}
              className="rounded-md border border-cta/40 bg-cta-pale px-2 py-1 text-xs font-medium text-cta hover:bg-cta/15"
            >
              {t("coordinatesButton")}
            </button>
          )}
          {coordinateSettled && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {t("coordinatesDone", { count: cornerCount ?? 0 })}
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
