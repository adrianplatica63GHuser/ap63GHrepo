"use client";

/**
 * BulkImportDialog — Slice #21.01.Import
 *
 * Step 3 of the import wizard: imports every FSEntry (file or page-group)
 * as a Document, uploads its file(s) as pages, links it to the run's Property
 * and tags it with all ancestor folder names.
 *
 * THE AI READ IS PART OF THE RUN NOW  (Slice #26.09)
 * ──────────────────────────────────────────────────
 * "Interpretează AI" used to be a button on each finished row. It is gone: the
 * per-entry task reads the document with the model itself, as its last step,
 * and `runAiInterpret` in `src/lib/import/ai-interpret-run.ts` is the same three
 * calls the button's dialog made. The brief's sentence is the whole change —
 * *all* AI interpretation now happens automatically during this run, so the
 * button disappears rather than becoming optional.
 *
 * ⚠️ **A row is not `done` until its AI read has settled**, which is why the
 * step sits inside the task rather than after the loop. `doneCount` drives the
 * progress bar; marking a row finished while a billed call it started is still
 * in flight would put the bar at 100% over a run with work left in it.
 *
 * ⚠️ **A FAILED READ IS NOT A FAILED ROW.** The Document exists, its pages are
 * uploaded and it is linked; what the read would have added is fields. The row
 * says so and the import carries on — with one exception, an expired session,
 * which aborts the rest exactly as it does from `createDocument`.
 *
 * ⚠️ **PEOPLE ARE NOT WRITTEN AUTOMATICALLY.** The read returns the parties it
 * found and nothing links them; once every row has settled, the queued
 * documents are walked through the shared confirm-or-create stepper one at a
 * time, in the folder's own order. A run that created people on its own is the
 * failure the whole 26.xx redesign was opened to prevent.
 *
 * After import, the results table still offers two per-row follow-ups, each on
 * a row that finished cleanly:
 *
 *   - "Creează persoană din CI"  (Slice #23.01.Import) — rows the scan
 *     classified as an identity card.
 *   - "Aplică pe proprietate"  (Slice #23.02.Import) — rows that are coordinate
 *     files, offering their corners to the run's Property.
 *
 * Both run AFTER the import, deliberately: by then the Document exists, its
 * pages are uploaded and it is already attached to the Property, so each action
 * only has to add one thing. Offering either beforehand would mean the wizard
 * creating a second Document for the same file, since it imports every entry
 * unconditionally and has no skip mechanism.
 *
 * The concurrency limit is 3 in-flight import operations at a time — which,
 * since #26.09, means up to 3 concurrent AI reads as well. The follow-up
 * actions are one-at-a-time: each opens a modal.
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
import { claimCornerSource } from "@/lib/import/corner-source-client";
import { useRouter } from "next/navigation";
import {
  entryFileNames,
  type FSEntry,
  type FSFileEntry,
  type FSPageGroupEntry,
  tagsForEntry,
} from "@/lib/import/folder-utils";
import { isFileKind } from "@/lib/files/file-kinds";
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
import type { EntryAssignment } from "@/lib/import/property-folders";
import { titleForEntry, type PreexistingRow } from "@/lib/import/preexisting-check";
import { ProgressBar } from "@/components/progress-bar";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  IdCardPersonDialog,
  type IdCardPersonOutcome,
} from "./id-card-person-dialog";
import {
  CoordinatePropertyDialog,
  type CoordinateOutcome,
} from "./coordinate-property-dialog";
import {
  AiPartyLinkerDialog,
  type AiExtractedParty,
  type AiPartyLinkerSummary,
} from "@/app/documents/_components/ai-party-linker-dialog";
import {
  canRetryReads,
  inFolderOrder,
  runAiInterpret,
  shouldInterpretEntry,
  type AiInterpretRunResult,
} from "@/lib/import/ai-interpret-run";

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
  /**
   * Slice #21.02.Import: true once AI interpretation has succeeded on this
   * entry. Written by the run itself since #26.09 rather than by a button, and
   * still the fact the saved session carries.
   */
  aiProcessed?: boolean;
  /** Slice #23.02.Import: how many document fields that run filled in. */
  aiFieldCount?: number;
  /**
   * Slice #23.02.Import: party stepper tally, null when the type has no roles.
   *
   * ⚠️ Since #26.09 this is `undefined` until the stepper for THIS document has
   * been closed, which happens after every row has settled. `aiPartiesPending`
   * is what the row shows in between — see it.
   */
  aiParties?: { linked: number; created: number; skipped: number } | null;
  /**
   * How this row's automatic AI read went.   (Slice #26.09)
   *
   * A field of its own rather than a fourth `ImportStatus`, because it answers
   * a different question: `status` is about the DOCUMENT — was it created, with
   * its pages and its links — and this is about what was read out of it
   * afterwards. Collapsing them would make a document whose fields could not be
   * filled indistinguishable from a file that never made it into the archive.
   *
   *   - `running` — the call is in flight. The row is still `importing`.
   *   - `done`    — fields were written; see `aiFieldCount`.
   *   - `failed`  — the read did not happen. The Document is fine.
   *   - `skipped` — the run deliberately did not read this one: it has no page
   *     a model can see, or it is an identity card whose person action extracts
   *     strictly more (the #23.08 argument, which outlived its button).
   */
  aiStatus?: "running" | "done" | "failed" | "skipped";
  /** The route's own sentence about a failed read, plus the pages it skipped. */
  aiErrorDetail?: string;
  /**
   * The read succeeded but part of what it found was not written, because the
   * document's current state could not be read.   (Slice #26.09)
   *
   * A flag rather than a `failed` status: the baseline fields WERE written, and
   * calling that a failure would send the user to re-do work that is done. It
   * DOES make the row retryable, though — the loss is recoverable and the row
   * is the only place it is visible. See `AiInterpretRunResult.partialWrite`.
   */
  aiPartialWrite?: boolean;
  /**
   * People this document's read found and nobody has confirmed yet.
   * (Slice #26.09)
   *
   * Cleared to `undefined` when this document's stepper closes, at which point
   * `aiParties` carries what actually happened. The two are never both set, and
   * the row reads whichever is.
   */
  aiPartiesPending?: number;
  /**
   * Slice #23.01.Import: set once a Person has been confirmed or created from
   * this entry's ID card and linked to the run's Property and this Document.
   * Its only job is to stop the row offering the action a second time — the
   * second run would resolve to the same person and the link calls are
   * idempotent, but re-offering it reads as "that didn't work".
   */
  personId?: string;
  /**
   * Slice #23.08.Import: how many of the Document's own fields the ID-card
   * action filled in on the same click. Zero is legitimate — the card gave
   * nothing mappable, or every target was already filled.
   */
  idCardDocFields?: number;
  /**
   * Slice #23.08.Import: the person was created and linked, but the document
   * field write that follows it failed. Kept distinct from an outright error
   * because the row's main outcome DID happen; hiding the difference would
   * misreport what is in the database.
   */
  idCardDocFieldsFailed?: boolean;
  /**
   * Slice #23.02.Import: set once this coordinate file has been offered to the
   * Property — whether its corners were written, kept, or found already
   * applied. Same job as personId: stop re-offering a settled question.
   */
  coordinateSettled?: boolean;
  /** Corner count the Property ended up with, for the row's summary. */
  cornerCount?: number;
  /**
   * Slice #26.08: the archive already held this document, so the loop did not
   * create one. `linked` means the existing Document was attached to this run's
   * Property (or Properties); `skipped` means there was nothing to attach it
   * to and the row is a statement that nothing happened.
   *
   * ⚠️ **A row carrying this has a `docId` it did not create**, and every
   * follow-up action is suppressed on it for exactly that reason — see
   * `ResultRow`. The id is here so the row can still LINK to the document,
   * which is the one thing the user will want from it.
   */
  preexisting?: "linked" | "skipped";
};

/**
 * One document's unconfirmed people.   (Slice #26.09)
 *
 * Nothing here has been written. `parties` is exactly what the route read out
 * of the document, handed to the same stepper the deleted button used to open,
 * which links or creates only what the user confirms one at a time.
 */
type PartyStep = {
  path: string;
  docId: string;
  parties: AiExtractedParty[];
};

/**
 * Everything a failed read can tell the user, in one string.   (Slice #26.09)
 *
 * The route names the pages it could not send — a `.txt` inside a page folder,
 * an octet-stream — and the old dialog listed them, deliberately, "rather than
 * flattened into extraction failed". A table cell cannot hold a list, so they
 * ride along on the row's tooltip instead of being dropped: a returned value
 * nobody reads is a capability the product quietly stopped having.
 */
function failureDetail(result: Extract<AiInterpretRunResult, { ok: false }>): string | undefined {
  const pages = result.skipped.map((p) => `${p.fileName} — ${p.reason}`);
  const parts = [result.detail, ...pages].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join("\n") : undefined;
}

type Props = {
  entries: FSEntry[];
  rootFolderName: string;
  scanResults: Map<string, ScanResult>;
  /**
   * Which Property (or Properties) each entry's Document is linked to, by entry
   * path.   (Slice #23.00.Import as one id for the run; a map since #26.07.)
   *
   * Built once by `assignEntryProperties` at the property step, from rules that
   * live in `src/lib/import/property-folders.ts` and nowhere else: a property
   * folder's entries link to its own Property, `common` links to every Property
   * the run resolved, `floating` and anything the structure rules forbid link
   * to none.
   *
   * ⚠️ **An empty list and a missing key are different, and this dialog trusts
   * the difference.** Every entry has a key, including the ones linked to
   * nothing — so a `get` that returns `undefined` means the map was built from a
   * different entry list than the one being imported, which is a bug rather
   * than a floating document. Both are treated as "link nothing", because
   * writing a link on a guess is the worse of the two failures, and the run's
   * result still names the file.
   */
  propertyIdsByPath: ReadonlyMap<string, EntryAssignment>;
  /**
   * The documents the archive already holds, and what the Pre-existing stage
   * promised the import would do about each.   (Slice #26.08)
   *
   * ⚠️ **THIS MAP IS A PROMISE THAT HAS ALREADY BEEN SHOWN TO THE USER.** They
   * read it on the Pre-existing screen, ticked, and pressed Continuă; this loop
   * is where it either comes true or quietly does not. That is why the branch
   * it drives sits at the very top of the per-entry task rather than being
   * folded into one of the steps below — there is nothing to do "as well",
   * there is a different thing to do.
   *
   * An ABSENT path means "import it normally", and it covers two states that
   * are the same instruction: the archive does not hold this document, and the
   * archive holds it but the stage decided to import it again anyway (an
   * identity card, a coordinate file). `preexistingDecisionsByPath` leaves the
   * second out on purpose, so no reader here has to remember the exception.
   *
   * Optional, and defaulting to nothing, because a run that reached this dialog
   * without the stage having answered — a failed lookup the user chose to carry
   * on past — must import everything, which is precisely what an absent map
   * does.
   */
  preexistingByPath?: ReadonlyMap<string, PreexistingRow>;
  /**
   * The coordinate files whose corners actually LANDED on a Property, and which
   * one.   (Slice #23.06.Import, per-folder since #26.07.)
   *
   * The loop uses it to claim `property_corner_source` the moment it creates
   * that file's Document — closing the hole that produced the duplicate
   * Property #23.06 existed to fix.
   *
   * A coordinate file is ABSENT in three cases, all correct: its folder's
   * Property already had corners, so the file was read and its corners were not
   * adopted; the file parsed to zero corners; or the folder had none. In each
   * of those it is not the origin of any geometry and must stay free for a
   * Property it really did build.
   */
  cornerSourceByPath?: ReadonlyMap<string, string>;
  /**
   * Slice #23.02.Import: fired when a coordinate row rewrites a Property's
   * corners, so the wizard's toolbar chip stops advertising the count it had at
   * the property step. Carries the Property id since #26.07 — the wizard now
   * holds several, and a bare count could only be applied to a guess.
   */
  onPropertyCornersChanged?: (propertyId: string, cornerCount: number) => void;
  /**
   * Slice #26.03: fired once, the moment the FIRST Document of the run has
   * actually been created.
   *
   * The shell's Cancel has to tell the user what is left behind, and "documents
   * already imported stay in the archive" must not be said on a run that failed
   * before it wrote anything — that sends a business user hunting a documents
   * list for rows that do not exist. The wizard cannot know this from the
   * outside: opening this dialog is not the same event as writing a row.
   */
  onFirstDocumentCreated?: () => void;
  onClose: () => void;
};

// ---------------------------------------------------------------------------
// Concurrency helpers
// ---------------------------------------------------------------------------

const CONCURRENCY = 3;

// ---------------------------------------------------------------------------
// Provenance helpers  (Slice #21.07.Import)
// ---------------------------------------------------------------------------

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
// File-type helpers (thin readable names over the file-kind registry)
// ---------------------------------------------------------------------------
//
// Slice #23.02.Import removed the local TEXT_EXTS_SET / isTextFile pair: the
// coordinate-file extension list got exactly one home, the pure
// isCoordinateFileName in src/lib/import/coordinate-file.ts, which this row
// still asks. Slice #26.07 narrowed it to STR-08's `coord…` rule for one
// adversarial round and put it back; the reasoning is at the call site, and
// the short version is that a folder rule and a row action are two different
// questions and only the first is allowed to be strict.
//
// Slice #24.03 finished the job: the local IMAGE_EXTS_SET and PDF_EXT are gone
// too, and both questions are asked of the file-kind registry in
// src/lib/files/file-kinds.ts. These two names survive only because they read
// better at the call sites below than a kind query does.

const isImageFile = (name: string) => isFileKind(name, "image");
const isPdfFile   = (name: string) => isFileKind(name, "pdf");

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
  propertyIdsByPath,
  preexistingByPath,
  cornerSourceByPath,
  onPropertyCornersChanged,
  onFirstDocumentCreated,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog");
  /**
   * The wizard's own namespace, for ONE thing: the scan's confidence.
   * (Slice #26.09)
   *
   * ⚠️ **The caveat the deleted dialog carried, put back where it still
   * applies.** `ScanConfidenceWarning` was rendered in every phase of that
   * dialog because the route builds its extraction prompt from the document
   * TYPE's template — so a mis-classified document is asked for the wrong
   * fields entirely and comes back looking just as complete as a correct one.
   * That argument did not weaken when the human left the loop; it is the only
   * argument that got stronger. The strings are the scan table's own, so no
   * wording is invented and no key is added.
   */
  const tw = useTranslations("adminImport.wizard");

  /**
   * ⚠️ The scanConfidence SENTENCES, not the pill labels beside them.
   *
   * A first version reached for `confidence_low`, which is the one-word badge
   * `ScanTable` draws in a column headed "Încredere" — rendered on a result row
   * it read "⚠ Încredere scăzută" with nothing saying why that matters here.
   * `scanConfidence.titleLow` / `bodyLow` are the copy written for exactly this
   * moment, and they are what `ScanConfidenceWarning` still shows on the ID-card
   * path: the type may be wrong, the type chose the template, the template chose
   * the fields. Title on the row, body on the tooltip — a cell cannot hold four
   * lines and the argument is four lines long.
   */
  const confidenceNoteFor = (
    confidence?: "high" | "medium" | "low",
  ): { title: string; body: string } | null =>
    confidence === "low"
      ? { title: tw("scanConfidence.titleLow"), body: tw("scanConfidence.bodyLow") }
      : confidence === "medium"
        ? { title: tw("scanConfidence.titleMedium"), body: tw("scanConfidence.bodyMedium") }
        : null;
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

  // Slice #26.03 — held in a ref for the same reason `provenanceRef` is: the
  // import effect depends only on `gatePassed`, so a caller passing a fresh
  // arrow every render must not be able to restart an import already running.
  const firstDocumentRef = useRef(onFirstDocumentCreated);
  useEffect(() => {
    firstDocumentRef.current = onFirstDocumentCreated;
  }, [onFirstDocumentCreated]);

  // Slice #23.01.Import — the row whose ID card is being turned into a Person.
  // The File is resolved up front (the FSEntry handle is only readable while
  // this dialog is mounted) and held here so the child gets a plain File.
  const [idCardTarget, setIdCardTarget] = useState<
    { path: string; docId: string; label: string; file: File; propertyId: string } | null
  >(null);
  const [idCardError, setIdCardError] = useState<string | null>(null);

  // Slice #23.02.Import — the two new row actions, one at a time.
  // Slice #23.06.Import added `docId`: the dialog now claims the
  // coordinate-source link, and a claim is about a DOCUMENT, not a file
  // handle. Same shape as idCardTarget/aiTarget, which have always carried it.
  const [coordinateTarget, setCoordinateTarget] = useState<
    { path: string; docId: string; entry: FSFileEntry; propertyId: string } | null
  >(null);
  /**
   * The documents whose automatic read found people, waiting to be confirmed.
   * (Slice #26.09)
   *
   * ⚠️ **Collected in a REF during the run and published as state once**, and
   * the reason is the loop's shape: three tasks finish in whatever order their
   * files and their calls allow, so appending to state would put the queue in
   * completion order — a user confirming people for document 7, then 2, then 9,
   * with no way to tell where they are. The ref is drained through `entries`,
   * so the queue is the folder's own order.
   *
   * ⚠️ **And it is a ref rather than state for a second reason:** a `setState`
   * per finished task inside the effect would re-render the table mid-import
   * for a queue nothing is reading yet.
   */
  const partyStepsRef = useRef<Map<string, PartyStep>>(new Map());
  /**
   * Is this dialog still on screen?   (Slice #26.09)
   *
   * A ref rather than the effect's local `mounted`, because the retry handler
   * is a `useCallback` outside that effect and its await is a model call.
   */
  const mountedRef = useRef(true);
  const [partySteps, setPartySteps] = useState<PartyStep[]>([]);
  const [partyIndex, setPartyIndex] = useState(0);

  /**
   * The Property the LAST coordinate row action was opened against.
   *
   * `handleCoordinateDone` has always read its target through a
   * `setCoordinateTarget` updater rather than depending on the state, so that a
   * new target does not give the child dialog a new `onDone` identity. Since
   * #26.07 it also needs to say WHICH Property's corner count changed, and a
   * value read inside a state updater is only available inside it — on the next
   * render, after the report would have happened.
   *
   * ⚠️ **Written when the action OPENS, and never cleared.** A first attempt
   * mirrored `coordinateTarget` itself and read `?.propertyId`, which is null
   * the moment the child closes — and the `if (target)` guard three lines below
   * exists precisely because that ordering happens, so the report was
   * conditional on a state the surrounding code already expects to be gone. The
   * wizard's chip then kept advertising the count from the property step for
   * the rest of the run, where before #26.07 it was corrected. A plain id that
   * only ever moves forward has no such window.
   */
  const coordinatePropertyRef = useRef<string | null>(null);

  /**
   * The Property ids this entry's Document must be linked to.   (Slice #26.07)
   *
   * One reader, used by the import loop AND by the two row actions, so that a
   * document written into Property X can never be offered a dialog that acts on
   * Property Y. `?? []` covers the map-and-entries-disagree bug described on the
   * prop: link nothing rather than link a guess.
   *
   * A plain function over a prop rather than a memo — it is a `Map.get`, and a
   * `useMemo` over a map the parent owns would only add a second thing that can
   * be stale.
   */
  const propertiesForEntry = useCallback(
    (path: string): string[] => propertyIdsByPath.get(path)?.propertyIds ?? [],
    [propertyIdsByPath],
  );

  /**
   * The ONE Property a row action may act on, or null.
   *
   * The ID-card and coordinate dialogs each write to a single Property, and
   * both are offered per row. An entry under `common` concerns EVERY property
   * in the chosen folder, so there is no single answer and the action is not
   * offered; an entry under `floating` has none at all.
   *
   * ⚠️ **Keyed on the BUCKET, not on the list length**, which is the same rule
   * stated correctly. Length alone was wrong in the commonest shape of all —
   * one property subfolder plus `common` — where a `common` document has
   * exactly one id, so both actions were offered on it and the coordinate one
   * could replace that Property's corners from a file the property step had
   * refused. See `EntryAssignment`.
   */
  /**
   * What the Pre-existing stage decided about this entry, or null.
   * (Slice #26.08)
   *
   * A plain function over a prop for the reason `propertiesForEntry` is one: it
   * is a `Map.get`, and a `useMemo` over a map the parent owns would only add a
   * second thing that can be stale.
   */
  const preexistingForEntry = useCallback(
    (path: string): PreexistingRow | null => preexistingByPath?.get(path) ?? null,
    [preexistingByPath],
  );

  /**
   * Held in a ref for the same reason `provenanceRef` is: the import effect
   * depends only on `gatePassed`, and this map arrives from a `useMemo` in the
   * wizard whose identity changes whenever the archive is asked again. Reading
   * the prop directly inside the effect would put it in the dependency list —
   * or, worse, leave it out of one and read a stale closure.
   */
  const preexistingRef = useRef(preexistingForEntry);
  useEffect(() => {
    preexistingRef.current = preexistingForEntry;
  }, [preexistingForEntry]);

  const soleProperty = useCallback(
    (path: string): string | null => {
      const assignment = propertyIdsByPath.get(path);
      if (assignment === undefined || assignment.bucket !== "property") return null;
      return assignment.propertyIds.length === 1 ? assignment.propertyIds[0] : null;
    },
    [propertyIdsByPath],
  );

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

  /**
   * The entries the provenance gate has to ask about.
   *
   * ⚠️ **A pre-existing entry is NOT one of them, and leaving it in held the
   * whole import.**   (Slice #26.08)
   *
   * The gate exists because a Document cannot be created without a provenance,
   * and it blocks until every entry whose extension cannot be read has an
   * answer. A `link` or `skip` row never reaches `createDocument` — the branch
   * at the top of the task returns before it — so the gate was demanding the
   * origin of a file the very next instruction refuses to touch, on a screen
   * the user cannot get past by any other means.
   *
   * `preexistingByPath` rather than a ref: this runs during render, where the
   * prop is the current value by definition.
   */
  const ambiguousEntries = useMemo(
    () =>
      entries.filter(
        (e) => inferredProvenance.get(e.path) == null && !preexistingByPath?.has(e.path),
      ),
    // `entries` and `inferredProvenance` are stable for this dialog's lifetime;
    // `preexistingByPath` is built once by the wizard and held in state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inferredProvenance, preexistingByPath],
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
    // Slice #26.09 — a fresh queue for THIS invocation. StrictMode runs the
    // effect twice in development, and a Map that survived the first would hand
    // the second run's stepper a document the first had already queued.
    partyStepsRef.current = new Map();
    // Slice #26.03 — see the `onFirstDocumentCreated` prop. Local to this run,
    // so a StrictMode re-mount re-announces for its own first document rather
    // than staying silent because a discarded run had already spoken.
    let announcedFirstDocument = false;
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
          // 0. The archive already holds this document.  (Slice #26.08)
          //
          // The FIRST thing the task does, and it returns rather than falling
          // through: this is not an extra step on the way to creating a
          // Document, it is the decision not to create one. Everything below —
          // the type lookup, the create, the corner-source claim, the page
          // uploads, the tags — is what "import this file" means, and none of
          // it applies to a file that is not being imported.
          //
          // ⚠️ **The rows that are imported ANYWAY are absent from this map**,
          // not present with a flag. An identity card or a coordinate file the
          // stage decided to re-import reaches the ordinary path below without
          // this branch having to remember an exception. See
          // `preexistingDecisionsByPath`.
          //
          // WHAT IT WRITES, AND WHAT IT DELIBERATELY DOES NOT
          //   It writes property links and nothing else. It does not upload the
          //   file again (the pages are already there), does not add this run's
          //   folder tags to a document somebody else's import titled (a tag is
          //   a mutation nobody asked for, on a record this run did not make),
          //   and does not announce `onFirstDocumentCreated` — because no
          //   document was created, and that callback is what tells the Cancel
          //   confirmation that records would be left behind. The links it does
          //   write hang off Properties this run created, which the Cancel
          //   already reports through `propertyResolved`.
          //
          // A `skip` row writes nothing at all: `propertiesForEntry` answers
          // with an empty list for `floating`, for anything the structure rules
          // forbid, and for a `common` document in a run that resolved no
          // Property — which is exactly the set `checkPreexistingStage` calls
          // `skip`. The loop is written to survive the two disagreeing anyway:
          // it links whatever the assignment names, so a `skip` that somehow
          // carried a Property would be attached rather than silently dropped.
          const already = preexistingRef.current(entry.path);
          if (already !== null) {
            for (const linkedPropertyId of propertiesForEntry(entry.path)) {
              await associateDocumentsWithProperty(linkedPropertyId, [already.documentId]);
            }
            if (mounted) {
              updateResult(entry.path, {
                status: "done",
                docId: already.documentId,
                preexisting: already.outcome === "link" ? "linked" : "skipped",
              });
            }
            return;
          }

          // 1. Determine title
          //
          // ⚠️ **`titleForEntry`, not the two-line expression it replaced, and
          // the difference is not cosmetic.** #26.08 keys the archive on the
          // title this line writes, so the two must be ONE expression — and
          // they had already diverged: `titleForEntry` falls back to the folder
          // name when `folderNameToTitleHint` trims to nothing, while this
          // wrote the empty string. Such a document is stored untitled, the
          // lookup refuses untitled documents, and the folder is reported "not
          // in the system" and duplicated on every future run, in silence.
          const title = titleForEntry(entry);

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

          // Slice #26.03 — the run has now written something. Announced through
          // a ref so answering it cannot re-run this effect, and guarded by a
          // local flag so it fires exactly once however many documents follow.
          if (!announcedFirstDocument) {
            announcedFirstDocument = true;
            firstDocumentRef.current?.();
          }

          // 3.5 Claim the coordinate-source link  (Slice #23.06.Import)
          //
          // If THIS entry is the coordinate file whose corners the property
          // step wrote to the run's Property, record that fact now — the first
          // thing after the Document exists, before its pages, its property
          // link or its tags.
          //
          // WHY HERE AND NOT AT THE PROPERTY STEP
          //   PropertyStepDialog resolves the Property before the import runs,
          //   when the coordinate file is still a local file handle with no
          //   `document` row to point at. property_corner_source.document_id is
          //   NOT NULL, so the link genuinely cannot be written until this
          //   moment. Every instruction later in this loop widens the window in
          //   which the Document exists unclaimed — and an unclaimed coordinate
          //   document is exactly what let the Process panel build a second
          //   Property on top of this run's.
          //
          // WHY A CONFLICT IS FATAL TO THE ROW
          //   It means this file already produced a DIFFERENT Property. Nothing
          //   good follows from continuing: the run would attach a document to
          //   a Property whose corners came from a file that belongs somewhere
          //   else, silently. Fail loudly, name the winner, let Adrian decide.
          const cornerOwner = cornerSourceByPath?.get(entry.path);
          if (cornerOwner !== undefined) {
            const claim = await claimCornerSource(docId, cornerOwner, "session-expired");
            if (claim.kind === "conflict") {
              throw new Error(
                t("cornerSourceConflict", {
                  code: claim.link?.propertyCode ?? "?",
                }),
              );
            }
          }

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

          // 5. Link the document to its folder's Property — or Properties.
          //
          // Slice #23.00.Import: DIRECT, and before the tags — this is the
          // real relationship, so if anything below fails the document is
          // still attached to the right property. The old flow had no step
          // like this at all: the property was inferred later from a shared
          // tag string via findEntitiesByTag, which matched every document
          // anywhere in the system carrying that tag, not just this run's.
          //
          // Slice #26.07: a LIST, because the answer is no longer one id.
          // Usually exactly one (the entry's own property folder); several for
          // a `common` document, which concerns every property in the chosen
          // folder; none for a `floating` one, which is stored and linked to
          // nothing. An empty list writes nothing and is not an error — see
          // `propertyIdsByPath`.
          for (const linkedPropertyId of propertiesForEntry(entry.path)) {
            await associateDocumentsWithProperty(linkedPropertyId, [docId]);
          }

          // 6. Tag with all ancestor folder names.
          //
          // Tags are now DESCRIPTIVE ONLY — a browsing aid. They no longer
          // link the document to anything; step 5 did that.
          const tags = tagsForEntry(rootFolderName, entry);
          for (const tag of tags) {
            await addTag(principalObjectId, tag);
          }

          // 7. Read the document with the model.   (Slice #26.09)
          //
          // The last step of the task, and the row stays `importing` until it
          // settles — see the two warnings in this file's header for why that
          // matters to the progress bar and why a failure here is not a failed
          // row.
          //
          // The rule lives in `ai-interpret-run.ts` and is stated there once,
          // because the Import screen counts the same predicate to price the
          // click before it happens — see `shouldInterpretEntry`.
          const willInterpret = shouldInterpretEntry(entry, {
            isIdCard: isIdCardEntry(sr),
            canCreatePerson: soleProperty(entry.path) !== null,
          });

          if (!willInterpret) {
            if (mounted) {
              updateResult(entry.path, {
                status: "done",
                docId,
                principalObjectId,
                aiStatus: "skipped",
              });
            }
            return;
          }

          // Published before the await so the row can say what it is doing for
          // the seconds the call takes, and so the document is already linkable
          // from the table while it runs.
          if (mounted) {
            updateResult(entry.path, { docId, principalObjectId, aiStatus: "running" });
          }

          const interpreted = await runAiInterpret(docId, new Date().toISOString());
          if (!mounted) return;

          if (interpreted.ok) {
            // Queued, not walked: the stepper opens once every row has settled,
            // so a user is not interrupted three times over while files are
            // still uploading behind the dialog.
            if (interpreted.parties.length > 0) {
              partyStepsRef.current.set(entry.path, {
                path: entry.path,
                docId,
                parties: interpreted.parties,
              });
            }
            updateResult(entry.path, {
              status: "done",
              docId,
              principalObjectId,
              aiStatus: "done",
              aiProcessed: true,
              aiFieldCount: interpreted.fieldCount,
              aiPartiesPending: interpreted.parties.length,
              aiPartialWrite: interpreted.partialWrite,
            });
            return;
          }

          // An expired session is the one failure that is not about this
          // document: every row after it would fail the same way, so it aborts
          // the rest exactly as `createDocument` does. The row itself is still
          // `done` — its Document was written before the session went.
          if (interpreted.reason === "session") {
            abortRef.current = true;
            setSessionExpired(true);
          }
          updateResult(entry.path, {
            status: "done",
            docId,
            principalObjectId,
            aiStatus: "failed",
            aiErrorDetail: failureDetail(interpreted),
          });
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

      // Slice #26.09 — the queue, in the folder's order rather than in the
      // order three concurrent tasks happened to finish. See `partyStepsRef`.
      //
      // ⚠️ **Not published at all after a session expiry.** Every write the
      // stepper makes is a POST, so opening it over the "your session has
      // expired" banner would walk the user through confirming people into six
      // consecutive 401s. The parties are lost either way; the difference is
      // whether the user spends five minutes discovering that.
      const steps = abortRef.current
        ? []
        : inFolderOrder(entries, partyStepsRef.current);

      if (mounted) {
        setPartySteps(steps);
        setDone(true);
      }
    }

    run().catch((err) => {
      if (mounted) {
        const msg = err instanceof Error ? err.message : "Import failed unexpectedly";
        setImportError(msg);
      }
    });

    return () => { mounted = false; };
    // entries and rootFolderName are stable for the lifetime of this dialog,
    // and so are `propertyIdsByPath` and `cornerSourceByPath` — the property
    // step builds both once and the wizard holds them in state, so a re-render
    // caused by a corner count changing hands the same Map back. updateResult
    // is a stable useCallback reference; the per-entry provenance is read
    // through provenanceRef so answering the gate does not restart an import
    // that is already running.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gatePassed]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (done) router.refresh();
  }, [done, router]);

  // Persist the completed session to localStorage so the user can "Resume"
  // it after navigating away (e.g. to inspect an individual document).
  // File System Access API handles cannot be serialised, so the resumed view is
  // read-only: the document links work and nothing else does. Since #26.09 that
  // costs less than it did — the AI read happens during the run rather than
  // being a button somebody might come back for.
  useEffect(() => {
    if (!done) return;
    const sessionEntries: SavedImportEntry[] = results.map((r) => {
      // `titleForEntry`, so the saved report names a document the same way the
      // Document itself is titled — a page folder whose hint trims to nothing
      // showed a blank row here while its Document had a name.
      const displayName = titleForEntry(r.entry);
      const sr = scanResults.get(r.entry.path);
      return {
        path:             r.entry.path,
        displayName,
        kind:             r.entry.kind,
        status:           r.status,
        // Slice #26.08 — carried, because the saved report is the only durable
        // artefact of a run and it was calling these rows "imported". See
        // `SavedImportEntry.preexisting`.
        preexisting:      r.preexisting,
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

        const label = titleForEntry(entry);

        // Slice #26.07 — the Property this row's Document actually went into.
        // Re-read here rather than captured when the row was imported: it comes
        // from the same one reader the loop used, so the two cannot disagree.
        const rowProperty = soleProperty(entry.path);
        if (rowProperty === null) return;

        setIdCardTarget({
          path: entry.path,
          docId: result.docId,
          label,
          file: image,
          propertyId: rowProperty,
        });
      } catch (err) {
        setIdCardError(err instanceof Error ? err.message : t("idCardNoFile"));
      }
    },
    [t, soleProperty],
  );

  const handleIdCardDone = useCallback((outcome: IdCardPersonOutcome) => {
    setIdCardTarget((target) => {
      if (target) {
        updateResult(target.path, {
          personId: outcome.personId,
          // Slice #23.08.Import — the same click also wrote the card's fields
          // onto the Document; the row reports both halves separately because
          // the second can fail while the first succeeded.
          idCardDocFields: outcome.documentFieldsWritten,
          idCardDocFieldsFailed: outcome.documentFieldsFailed,
        });
      }
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
    // No docId means the row never finished importing, so there is no Document
    // to claim and nothing sensible to do. The row action is already gated on
    // `settled` (status === "done" && !!docId); this is the belt to that
    // braces, and it keeps the prop non-optional in the dialog.
    if (!result.docId) return;
    // Slice #26.07 — as above. `null` cannot happen from the UI (the row's
    // button is not rendered without a sole Property), and returning here is
    // the belt to those braces rather than a second rule.
    const rowProperty = soleProperty(result.entry.path);
    if (rowProperty === null) return;
    coordinatePropertyRef.current = rowProperty;
    setCoordinateTarget({
      path: result.entry.path,
      docId: result.docId,
      entry: result.entry as FSFileEntry,
      propertyId: rowProperty,
    });
  }, [soleProperty]);

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
      // corners changed nothing to report. Slice #26.07 — named, because the
      // wizard now shows one chip per Property and an unnamed count could only
      // be applied to whichever it guessed.
      if (outcome.changed && coordinatePropertyRef.current !== null) {
        onPropertyCornersChanged?.(coordinatePropertyRef.current, outcome.cornerCount);
      }
    },
    [onPropertyCornersChanged, updateResult],
  );

  /**
   * One document's people are settled — record the tally and move on.
   * (Slice #26.09)
   *
   * `aiPartiesPending` goes to `undefined` in the same patch that sets
   * `aiParties`, so the row never shows both "3 people to confirm" and the
   * tally of what happened to them.
   *
   * The index advances whatever the summary says, including when the user
   * closed the stepper without answering: `AiPartyLinkerDialog` counts those as
   * `skipped` and there is nothing further to ask about this document. Re-
   * offering it would be a queue with no end.
   *
   * ⚠️ Read straight from state and NOT through a `setPartyIndex` updater, the
   * way the two row actions read their target. An updater is a reducer — React
   * may call it twice for one dispatch — and `updateResult` inside one is a
   * second dispatch riding on that. The dialog is keyed by path, so the extra
   * dependency costs nothing: a new identity per step is exactly right.
   */
  /**
   * Open the people nobody was asked about.   (Slice #26.09)
   *
   * ⚠️ **Free, and that is the point.** `partyStepsRef` already holds them,
   * fully extracted, in memory — the only thing a session expiry took away was
   * the `setPartySteps` that would have surfaced them. Until this button
   * existed the only way to execute those two lines was to pay for a fresh
   * model call on some OTHER row, and in the shape where the session dies
   * during an upload rather than during a read there is no such row: every
   * document either succeeded or never reached the read, so no amber block and
   * no retry button is drawn anywhere in the table.
   */
  const handleConfirmPending = useCallback(() => {
    setPartySteps(inFolderOrder(entries, partyStepsRef.current));
    setPartyIndex(0);
    // `entries` is stable for this dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePartyStepClosed = useCallback(
    (summary: AiPartyLinkerSummary) => {
      const step = partySteps[partyIndex];
      /**
       * ⚠️ **SETTLED means somebody was linked or created — not merely that the
       * question was put**, and the whole safety of the backlog turns on it.
       *
       * `AiPartyLinkerDialog` reports a dismissal as `skipped`, and it reports
       * a link that failed the same way. So a stepper walked into a dead
       * session — every POST a 401 — comes back all-skipped, and an
       * unconditional delete would erase the ref entry for every document in
       * the queue: the extracted people destroyed by the control that exists to
       * rescue them, silently, in the one state where nothing else can reach
       * them. The same is true of an accidental Escape.
       *
       * Not settled therefore means: leave the ref entry, leave
       * `aiPartiesPending`, write no tally. The row goes on saying the people
       * are unconfirmed, which is what they are, and the backlog survives to be
       * offered again. The cost is that a user who deliberately skips everyone
       * sees the offer once more — after their own click, not on a loop.
       */
      if (step && summary.linked + summary.created > 0) {
        partyStepsRef.current.delete(step.path);
        updateResult(step.path, { aiParties: summary, aiPartiesPending: undefined });
      }
      setPartyIndex(partyIndex + 1);
    },
    [partySteps, partyIndex, updateResult],
  );

  /**
   * Read this document again, because the first attempt failed.
   * (Slice #26.09)
   *
   * ⚠️ **THIS IS NOT THE BUTTON THE SLICE DELETED, and the difference is the
   * whole justification for it existing.** "Interpretează AI" was offered on
   * every finished row, so a user chose whether a document was read at all;
   * this appears on a row that says the read FAILED, and all it offers is the
   * automatic step again. The brief's sentence — all AI interpretation happens
   * automatically during this run — stays true: nothing here is a second way to
   * do the work, it is the only way to finish the work the run began.
   *
   * Without it the slice created a dead end it had also removed every exit
   * from. Both manual entry points to extract mode go in this commit, so a rate
   * limit at document twelve of forty — the failure mode three concurrent reads
   * on one bucket actually produces — left twenty-eight documents permanently
   * field-less, with re-importing the folder refused by the Pre-existing stage.
   *
   * ⚠️ **A retry REPLACES the queue with its one document rather than editing
   * it, and two adversarial rounds went into that one line.** `partyIndex` is a
   * positional cursor. A bare append could put two entries with the same `path`
   * in the queue, defeating the `key` that forces each step to remount; and
   * filter-then-append fixed that while leaving the cursor behind — removing
   * one element and adding one keeps the LENGTH unchanged, so
   * `partySteps[partyIndex]` stayed `undefined` and the stepper never opened.
   * The people were extracted, counted on the row, and unreachable.
   *
   * Resetting is unambiguous, and safe because `canRetry` already requires the
   * queue exhausted — there is nothing left in it to answer.
   */
  const handleRetryInterpret = useCallback(
    async (result: ImportResult) => {
      const docId = result.docId;
      const path = result.entry.path;
      if (!docId) return;

      // ⚠️ **`aiPartialWrite` is cleared too, and forgetting it re-opened a
      // double-fire.** The amber block that carries this button is drawn on
      // `aiStatus === "failed" || aiPartialWrite`; on a `failed` row the first
      // click flips `aiStatus` and the button goes with it, but on a partial
      // row the second half stayed true, so the button sat live through its own
      // call. Two clicks are two PATCHes and two `document_version` rows on a
      // versioned entity — against this module's own one-patch rule — and two
      // appends of the same document to the party queue.
      const wasPartial = result.aiPartialWrite === true;
      updateResult(path, {
        aiStatus: "running",
        aiErrorDetail: undefined,
        aiPartialWrite: undefined,
      });
      const interpreted = await runAiInterpret(docId, new Date().toISOString());
      // ⚠️ The one `runAiInterpret` call site outside the effect, so it needs
      // its own liveness test — the effect's per-invocation `mounted` boolean
      // is not in scope here. Without it a retry that outlives the dialog
      // writes into an unmounted tree: silently in React 18, and taking the
      // people it found with it.
      if (!mountedRef.current) return;

      if (interpreted.ok) {
        // The session is demonstrably back — this call went through it. Nothing
        // else clears the banner, and leaving it up over a working dialog is
        // the state that made an expiry a one-way door.
        setSessionExpired(false);
        /**
         * ⚠️ **NOT re-queued if this document's people are already settled.**
         * A retry is about the half of the read that failed — usually the notes
         * and the type-specific fields — and the model returns the parties again
         * regardless, because they come from the extract call. Queueing them a
         * second time asks the user to confirm people they have already linked,
         * with nothing on screen saying so; answer "create" rather than "link"
         * on that second pass and the run makes the duplicate person this whole
         * redesign exists to prevent. `aiParties` is the record that the
         * question was answered.
         */
        /**
         * ⚠️ **`aiParties` records that the question was PUT, not that anyone
         * answered it.** `AiPartyLinkerDialog` reports a dismissal as `skipped`
         * and `handlePartyStepClosed` writes that summary like any other, so a
         * stepper closed by an accidental Escape leaves a row that looks
         * settled. Treating it as settled made the retry — the only control
         * that could find those people again — quietly decline to re-queue
         * them. A summary in which nobody was linked or created settled
         * nothing.
         */
        const settled =
          result.aiParties != null && result.aiParties.linked + result.aiParties.created > 0;
        const queued = interpreted.parties.length > 0 && !settled;
        if (queued) {
          partyStepsRef.current.set(path, { path, docId, parties: interpreted.parties });
        }
        updateResult(path, {
          aiStatus: "done",
          aiProcessed: true,
          aiFieldCount: interpreted.fieldCount,
          aiPartialWrite: interpreted.partialWrite,
          aiErrorDetail: undefined,
          // Only when this retry actually queued something. Setting both would
          // make the row claim a tally AND a pending count, which the render
          // resolves by showing the stale tally — see `aiPartiesPending`.
          ...(queued ? { aiPartiesPending: interpreted.parties.length, aiParties: undefined } : {}),
        });
        return;
      }

      if (interpreted.reason === "session") {
        abortRef.current = true;
        setSessionExpired(true);
      }
      // ⚠️ A failed retry on a row that had already written its baseline fields
      // is still a PARTIAL write, not a failed one. `interpretFailed` says the
      // document's fields "au rămas necompletate", and on such a row that is
      // flatly untrue — the first pass wrote them and the row says so two spans
      // along. The state goes back to what it was, with the new reason on the
      // tooltip.
      // ⚠️ The tooltip says WHICH attempt failed. On a partial row the visible
      // sentence describes the first read's missing half, and hanging the
      // retry's own `HTTP 429` off it unlabelled answered a question the user
      // had not asked, about a different event.
      const reason = failureDetail(interpreted);
      updateResult(path, {
        aiStatus: wasPartial ? undefined : "failed",
        aiPartialWrite: wasPartial ? true : undefined,
        // A route that gave no message at all — a timeout, a thrown TypeError —
        // gets its own sentence rather than a colon followed by a dash.
        aiErrorDetail: reason
          ? t("interpretRetryFailed", { reason })
          : t("interpretRetryFailedUnknown"),
      });
    },
    // `t` is captured for the two sentences above; next-intl's translator is
    // stable per namespace, so listing it costs no re-renders and keeps this in
    // step with `handleOpenIdCard` thirty lines up. `entries` went when the
    // retry stopped republishing the queue — `handleConfirmPending` owns that
    // now, and a dependency the body no longer reads is a lint warning that
    // teaches the next reader to ignore the rule.
    [t, updateResult],
  );

  // ---------------------------------------------------------------------------
  // Counts
  // ---------------------------------------------------------------------------

  /**
   * The document whose people are being confirmed, or null.   (Slice #26.09)
   *
   * `partySteps` is empty until the loop has finished, so this is null for the
   * whole import and the stepper cannot open over a run still in flight.
   */
  const currentPartyStep = partySteps[partyIndex] ?? null;

  /**
   * Rows that finished, split by whether this run actually made anything.
   * (Slice #26.08)
   *
   * ⚠️ **`doneCount` covers both and must not be the number in the heading.**
   * A `link` or `skip` row is `status: "done"` — correctly, it finished — but
   * "6 documente importate" over a run that created three is the same lie the
   * saved session carried until this slice, one screen earlier. The progress
   * bar still counts settled rows, because that is what it measures.
   */
  const doneCount = results.filter((r) => r.status === "done").length;
  const createdCount = results.filter(
    (r) => r.status === "done" && r.preexisting === undefined,
  ).length;
  const preexistingCount = results.filter((r) => r.preexisting !== undefined).length;
  const errorCount = results.filter((r) => r.status === "error").length;
  /**
   * Rows whose AI read did not finish the job.   (Slice #26.09)
   *
   * Said in the header, beside Close, because Close is the end of the retry
   * window: `handleRetryInterpret` lives in this dialog and the wizard cannot
   * re-open it. A user who closes without noticing has no way back short of
   * re-picking the folder, which re-walks and re-scans it at full price.
   */
  const unreadCount = results.filter(
    (r) => r.aiStatus === "failed" || r.aiPartialWrite,
  ).length;
  /**
   * Documents whose people nobody has been asked about yet.   (Slice #26.09)
   *
   * ⚠️ **A SEPARATE COUNT FROM `unreadCount`, and folding the two together was
   * wrong in both directions.** A row here has been read completely and
   * successfully — it shows a green tick — so counting it under a sentence that
   * begins "n documents were not fully read by the AI" contradicts twelve green
   * ticks on the ordinary successful run; and the retry that sentence offers is
   * not the remedy, because the amber block that carries the retry button is
   * not drawn on such a row at all.
   *
   * Normally zero by the time anyone reads it: the queue opens in the same
   * commit that sets `done` and each answer clears its row. It is non-zero when
   * the queue was SUPPRESSED — a session expiry aborts the run and publishing a
   * stepper into it would walk the user through 401s — and that is the case
   * this count and its own button exist for.
   */
  const pendingPeopleCount = results.filter((r) => (r.aiPartiesPending ?? 0) > 0).length;
  /** A retry is in flight, so the dialog must not be pulled out from under it. */
  const retryRunning = results.some((r) => r.aiStatus === "running" && r.status === "done");
  /**
   * May any row be retried at all?   (Slice #26.09)
   *
   * ⚠️ **The header sentence and the buttons must never disagree about whether
   * a retry is possible**, and three adversarial rounds went into that. The
   * count had no session term and the button did, so after an expiry the header
   * said "try the read again here" over a table with no such button anywhere;
   * moving the header onto `sessionExpired` alone reintroduced the same
   * mismatch with the branches swapped. The header now has THREE branches —
   * expired, retryable, and neither — and this expression is the middle one.
   *
   * ⚠️ **`sessionExpired` is NOT a term, and three rounds went into that.**
   * With it, an expiry was a one-way door: the flag never clears, so signing in
   * again — in a new tab, which is what the banner's link now opens — brought
   * no button back for the life of the dialog, while the copy written for that
   * moment told the user to press one. The button stays. What switches on the
   * session is the SENTENCE beside it: a press into a still-dead session
   * re-raises the banner and costs one 401, and a press that succeeds clears it
   * for every row at once.
   *
   * The rule lives in `canRetryReads` — a boolean that has been wrong in four
   * consecutive rounds, and gained a term in the fourth, is exactly the kind
   * that belongs where a test can reach every combination of its inputs.
   */
  const canRetry = canRetryReads({
    done,
    stepperOpen: currentPartyStep !== null,
    retryRunning,
  });
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
                ? t("doneTitle", { count: createdCount })
                : t("title")}
            </h2>
            {/* Slice #26.08 — said whenever any row was already here, error or
                no error: it is the difference between the count in the heading
                and the number of rows in the table, and without it that gap
                reads as files that went missing. */}
            {/* Slice #26.09 — said before Close, because Close is what makes
                it permanent. The saved report records that a row finished, not
                that its read failed, so after this dialog goes there is nothing
                left that can name these rows. */}
            {done && unreadCount > 0 && (
              <p className="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                {/* THREE branches, because `canRetry` goes false for two
                    unrelated reasons and the header has to name the right one.
                    A two-way switch on `sessionExpired` told a user mid-party-
                    queue to "try the read again here" over rows with no button;
                    a two-way switch on `canRetry` told a perfectly signed-in
                    user to sign in again. The scrim over this line is
                    `bg-black/40`, not `display:none` — it is dimmed, legible,
                    and read out in full by a screen reader walking the dialog. */}
                {sessionExpired
                  ? t("doneUnreadLocked", { count: unreadCount })
                  : canRetry
                    ? t("doneUnread", { count: unreadCount })
                    : t("doneUnreadWaiting", { count: unreadCount })}
              </p>
            )}
            {/* Its own line and its own control, because it is a different
                problem with a different remedy: these documents were read
                perfectly and what is outstanding is a human answer. Shown only
                when nothing is going to open by itself — on the ordinary run
                the queue is already walking them. */}
            {/* ⚠️ **The SENTENCE is not gated on the session and the BUTTON is
                not gated on it either — but they say different things, and an
                earlier draft hid both.** This state is reachable only through an
                abort, and an abort always sets `sessionExpired`, so a
                `!sessionExpired` wrapper hid the count in the only case it
                occurs in: five documents' extracted people, named by nothing,
                beside an enabled Close. In the shape where the session dies
                during an UPLOAD it was worse than silent — no row is `failed`
                or partial, so no retry button exists anywhere to prove the
                session and bring the line back, and the people were
                unreachable for the life of the dialog.

                What made hiding it look necessary was the delete in
                `handlePartyStepClosed`, which is now conditional: a walk into a
                dead session links nobody, so it deletes nothing and the backlog
                survives the attempt. Pressing this while signed out costs a few
                dialogs and loses nothing, and the copy says to sign in first.

                `!retryRunning` stays, for the reason `canRetryReads` carries
                it: a retry captured its row's state before its model call, and
                a confirmation completing inside that window would be
                overwritten by the answer when it lands. */}
            {done && pendingPeopleCount > 0 && currentPartyStep === null && (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-xs font-medium text-sky-700 dark:text-sky-400">
                <span>
                  {sessionExpired
                    ? t("donePendingPeopleLocked", { count: pendingPeopleCount })
                    : t("donePendingPeople", { count: pendingPeopleCount })}
                </span>
                {!retryRunning && (
                  <button
                    type="button"
                    onClick={handleConfirmPending}
                    className={buttonClass({ variant: "ghost", size: "xs" })}
                  >
                    {t("confirmPendingButton")}
                  </button>
                )}
              </p>
            )}
            {done && preexistingCount > 0 && (
              <p className="mt-0.5 text-xs text-sky-700 dark:text-sky-400">
                {t("donePreexisting", { count: preexistingCount })}
              </p>
            )}
            {/* `doneHint` says every file was saved as a document and tagged,
                which is false of a row the archive already held — so it is now
                the all-created case only. */}
            {done && errorCount === 0 && preexistingCount === 0 && (
              <p className="mt-0.5 text-xs text-fade">{t("doneHint")}</p>
            )}
            {done && errorCount > 0 && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                {/* Fixed in passing (#26.08): this line was hardcoded Romanian
                    in the component, which is the two-track-i18n rule
                    backwards — the same defect #23.09 fixed two lines below for
                    `importingShort`. Noticed because the slice had to change
                    the count in it. */}
                {t("doneWithErrors", { created: createdCount, errors: errorCount })}
              </p>
            )}
          </div>
          {(done || importError !== null) && (
            <button
              type="button"
              onClick={onClose}
              // ⚠️ Inert while a party stepper is open, and it is the same
              // argument `ImportStageBar` records for the Cancel: none of this
              // app's dialogs traps focus or sets `inert`, so from the stepper
              // a Shift+Tab reaches this button — and pressing it unmounts the
              // whole queue. The remaining documents' extracted people exist
              // nowhere else (the saved session records `aiProcessed` and not
              // what is still unanswered), so that click is silent data loss
              // rather than a cancel. A `disabled` button is not focusable,
              // which is the only thing that actually closes the route; no
              // explanatory note, because the stepper is `fixed inset-0` over a
              // scrim and copy nobody can read is not an explanation.
              // …and while a retry is in flight, for the same reason: the
              // PATCH may already have landed, and unmounting mid-call
              // discards the people that read found with no record anywhere.
              disabled={currentPartyStep !== null || retryRunning}
              // ⚠️ `buttonClass`, not the hand-written classes this button
              // carried since #21.01, and the change is forced rather than
              // cosmetic: giving it a `disabled` state meant hand-writing the
              // greyed-out utility, and `button-styles-single-source.test.ts`
              // forbids that outside its allowlist — the helper owns the
              // disabled look so a dozen buttons cannot drift into a dozen
              // versions of it. `secondary`/`lg` is what the sibling dialog's
              // Close already uses (`coordinate-property-dialog.tsx`), so this
              // brings the two into line rather than inventing a third.
              //
              // ⚠️ **Do not name the utility in prose here.** That guard scans
              // raw lines, so a comment quoting the class is an offender: this
              // exact sentence failed the suite once already.
              className={buttonClass({ variant: "secondary", size: "lg" })}
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
              // ⚠️ A NEW TAB, and the retry window is why. This anchor sits
              // inside a `fixed inset-0` dialog whose state is the only place a
              // failed read can be retried from and the only record of which
              // rows need it; a same-tab navigation unmounts all of it. The
              // screen was offering, as its remedy, the one click that made the
              // loss permanent.
              target="_blank"
              rel="noopener noreferrer"
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
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                {tprov("gateApplyAll")}
              </button>
              <button
                type="button"
                onClick={() => setGatePassed(true)}
                disabled={!allAmbiguousAnswered}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {tprov("gateContinue")}
              </button>
            </div>
          </div>
        )}

        {/* Progress bar (shown while importing) */}
        {gatePassed && !done && (
          <div className="px-5 py-3 border-b border-card-rim dark:border-zinc-700">
            {/*
              Slice #23.09.UX — this bar is the real determinate one (the
              import loop knows exactly how many entries remain), and it is
              now the SAME component as the indeterminate variant the single-
              call dialogs use, in a different mode. It names itself from the
              visible "{done} / {total}" label rather than carrying its own.
            */}
            <div className="flex items-center justify-between mb-1">
              <span id="ga-import-progress-label" className="text-xs text-fade">
                {t("progressLabel", { done: doneCount + errorCount, total: totalCount })}
              </span>
            </div>
            <ProgressBar
              value={progressPct}
              smooth
              labelledBy="ga-import-progress-label"
            />
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
              propertyId={idCardTarget.propertyId}
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
              propertyId={coordinateTarget.propertyId}
              documentId={coordinateTarget.docId}
              entry={coordinateTarget.entry}
              onDone={handleCoordinateDone}
              onClose={() => setCoordinateTarget(null)}
            />
          )}

          {/* Slice #26.09 — the people the automatic reads found, confirmed
              one document at a time now that every row has settled. The same
              stepper the deleted "Interpretează AI" dialog opened; nothing is
              linked or created until the user answers each one. */}
          {currentPartyStep && (
            <AiPartyLinkerDialog
              key={currentPartyStep.path}
              documentId={currentPartyStep.docId}
              parties={currentPartyStep.parties}
              onClose={handlePartyStepClosed}
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
                  // ⚠️ `isIdCard` is a FACT about the file and must stay one.
                  // #26.07 briefly ANDed the sole-property guard into it, which
                  // was wrong because the same fact answers a second question:
                  // #23.08's rule that a card is not worth a generic extraction
                  // call. Since #26.09 that second reader is the import loop
                  // rather than this row — `shouldInterpretEntry` — and it
                  // takes the two apart explicitly. The guard still belongs on
                  // the person button alone; that is `canCreatePerson`.
                  isIdCard={isIdCardEntry(scanResults.get(r.entry.path))}
                  canCreatePerson={soleProperty(r.entry.path) !== null}
                  isCoordinate={
                    r.entry.kind === "file" &&
                    // ⚠️ The EXTENSION shortlist, deliberately — and this was
                    // narrowed to STR-08's `coord…` rule for one round before
                    // being put back, so the reasoning matters.
                    //
                    // The two rules answer different questions and both answers
                    // are right. STR-08 decides which file a FOLDER's corners
                    // are read from, and it is strict because the user was told
                    // to name it: a `.txt` of notes must not become geometry
                    // behind their back. This row is the opposite situation —
                    // the user is looking at one document and pressing a button
                    // — and narrowing it left a correctly-formed export named
                    // `corners.txt` with NO path to its property at all: skipped
                    // by the folder rule, silent (STR-08 only fires on a second
                    // strong-named file), and then not offered here either.
                    // `coordinate-file.ts`'s standing promise is that the name
                    // ranks and warns and never filters; this is the half of it
                    // that survives. A file that holds no corners parses to
                    // none and the dialog does nothing.
                    isCoordinateFileName((r.entry as FSFileEntry).name) &&
                    // Slice #26.07 — the action writes corners to ONE Property.
                    // A `common` document belongs to several and a `floating`
                    // one to none, so there is nothing for the button to act on
                    // and it is not drawn. See `soleProperty`.
                    soleProperty(r.entry.path) !== null
                  }
                  // Slice #26.09 — the scan's own confidence, translated here
                  // because the row already takes its translator as a prop and
                  // a second one inside it would be a namespace per cell. Only
                  // when it is NOT high: a caveat printed on every row is a
                  // caveat nobody reads.
                  confidenceNote={confidenceNoteFor(scanResults.get(r.entry.path)?.confidence)}
                  // ⚠️ Only once the whole run has settled, and it is a race
                  // rather than tidiness. The table is on screen while rows are
                  // still importing, so a row that failed its read early would
                  // offer the retry mid-run — and a retry that found people
                  // appends to `partySteps`, which the effect ASSIGNS when the
                  // loop ends. The append would open a stepper over a running
                  // import and then be overwritten by the assignment, losing
                  // the very people the retry went to fetch.
                  // See `canRetry`: `done`, and not while a party stepper is
                  // open — the latter for the reason the Close beside it is
                  // disabled, that nothing in this app traps focus, so a
                  // Shift+Tab from the stepper would reach these buttons.
                  canRetryInterpret={canRetry}
                  // Every row action, not just the retry: a Shift+Tab from the
                  // open stepper reaches these too, and each mounts a SECOND
                  // `fixed inset-0` dialog on top of the first.
                  canAct={currentPartyStep === null}
                  onCreatePerson={() => void handleOpenIdCard(r)}
                  onApplyCoordinates={() => handleOpenCoordinate(r)}
                  onRetryInterpret={() => void handleRetryInterpret(r)}
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
  /**
   * May the person action act at all?   (Slice #26.07)
   *
   * The dialog it opens writes a Person and links it to ONE Property. A
   * `common` document concerns every property in the run and a `floating` one
   * none, so there is nothing for it to act on — and without this the button
   * was drawn, the click read the file, and nothing happened. Separate from
   * `isIdCard` because that one also suppresses the AI action; see the call site.
   */
  canCreatePerson: boolean;
  /** Slice #23.02.Import: this entry's extension could hold Stereo 70 corners. */
  isCoordinate: boolean;
  /**
   * Already-translated caveat about the SCAN, or null when it was confident.
   * (Slice #26.09) — see the call site for why it is here at all.
   */
  confidenceNote: { title: string; body: string } | null;
  /** A retry can neither race the run nor be pointless — see the call site. */
  canRetryInterpret: boolean;
  /** No modal of this dialog's own is open over the row — see the call site. */
  canAct: boolean;
  onCreatePerson: () => void;
  onApplyCoordinates: () => void;
  onRetryInterpret: () => void;
};

function ResultRow({
  result,
  t,
  isIdCard,
  canCreatePerson,
  isCoordinate,
  confidenceNote,
  canRetryInterpret,
  canAct,
  onCreatePerson,
  onApplyCoordinates,
  onRetryInterpret,
}: ResultRowProps) {
  const {
    entry,
    status,
    errorMsg,
    docId,
    personId,
    idCardDocFields,
    idCardDocFieldsFailed,
    aiProcessed,
    aiFieldCount,
    aiParties,
    aiStatus,
    aiErrorDetail,
    aiPartiesPending,
    aiPartialWrite,
    coordinateSettled,
    cornerCount,
    preexisting,
  } = result;
  const displayName = titleForEntry(entry);

  // Every follow-up action needs a cleanly imported row: without a docId there
  // is nothing to attach to, and an errored row most often failed because the
  // session expired, in which case these calls would fail too.
  //
  // ⚠️ **`preexisting === undefined` is the third condition, added by #26.08,
  // and it is the one that is not obvious.** A pre-existing row DOES have a
  // docId — the archive's own — so without this every follow-up would be
  // offered on it and each would write to a document this run did not create:
  // "Creează persoană" would read a file whose Document is not the one on
  // screen. The row is a statement about what happened, which is exactly what
  // 26.10 turns every row into.
  //
  // Since #26.09 the automatic AI read is kept off these rows one layer
  // earlier — the task returns at step 0 and never reaches step 7 — so a billed
  // call rewriting fields somebody already curated is not merely un-offered, it
  // is unreachable.
  const settled = status === "done" && !!docId && preexisting === undefined;

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
        {/*
          Slice #23.09.UX — the blink, and the string finally goes through
          next-intl: it was hardcoded Romanian in the component, which is the
          two-track-i18n rule backwards (dev-authored UI copy belongs in
          messages/*.json). New key, no rename, so no e2e locator moves.
          No role="status" here on purpose: one live region per table row
          would announce every row of a whole folder. The determinate bar
          above the table is what announces this run's progress.
        */}
        {status === "importing" && (
          <span className="ga-cue-blink text-xs font-medium text-cta">
            {/* Slice #26.09 — two sentences, and which one is true says where
                the row is. The document is written well before its task ends
                now, and a row blinking "Se importă…" through a Claude call
                nobody mentioned is the kind of silence #24.02a exists to
                remove. */}
            {aiStatus === "running" ? t("interpretingShort") : t("importingShort")}
          </span>
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
          {/* Slice #26.08 — the archive already held this document, so the row
              describes what was done instead of offering something to do. The
              first row in this table to read that way; 26.10 makes every row
              read that way. */}
          {preexisting !== undefined && (
            <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
              {preexisting === "linked" ? t("preexistingLinked") : t("preexistingSkipped")}
            </span>
          )}
          {/* Slice #26.09 — the row DESCRIBES the AI read instead of offering
              it. The button that used to stand here is gone: the run does the
              read itself, so there is nothing left to press. (26.10 turns every
              row in this table into a description; this is the second of them,
              after the pre-existing note above.)

              A failure is amber and not red on purpose. Red in this table means
              the file did not make it into the archive; this file did, and what
              is missing is its fields. The route's own sentence — which names
              the reason, down to the octet-stream case — is on the title
              attribute rather than in the row, because it is a paragraph and
              this is a cell. */}
          {/* A retry that is running: the status cell says "Se importă…" only
              while the row is `importing`, and a retry happens on a row that is
              already `done`. Without this the button vanished and nothing took
              its place for the length of a model call. */}
          {aiStatus === "running" && status === "done" && (
            <span className="ga-cue-blink text-xs font-medium text-cta">
              {t("interpretingShort")}
            </span>
          )}
          {(aiStatus === "failed" || aiPartialWrite) && (
            <>
              <span
                className="text-xs font-medium text-amber-700 dark:text-amber-400"
                title={aiErrorDetail}
              >
                {aiStatus === "failed" ? t("interpretFailed") : t("interpretPartial")}
              </span>
              {/* ⚠️ NOT the button this slice deleted — see
                  `handleRetryInterpret`. It is offered only on a row that says
                  the automatic read failed, and all it does is that read again;
                  without it the slice removed every exit from a dead end it had
                  just introduced. */}
              {canRetryInterpret && (
                <button
                  type="button"
                  onClick={onRetryInterpret}
                  // The click is one billed model call, and the count the user
                  // approved before the run did not include retries.
                  title={t("interpretRetryHint")}
                  className={buttonClass({ variant: "ghost", size: "xs" })}
                >
                  {t("interpretRetry")}
                </button>
              )}
            </>
          )}
          {aiProcessed && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {t("interpretDone", { count: aiFieldCount ?? 0 })}
              {/* Three states, not two: the read found nobody, the read found
                  people and they are still queued, or their stepper has been
                  through. `aiParties` is set exactly when the third is true and
                  `aiPartiesPending` is cleared in the same patch, so the row can
                  never claim both. */}
              {aiParties
                ? ` · ${t("interpretParties", {
                    count: aiParties.linked + aiParties.created,
                  })}`
                : (aiPartiesPending ?? 0) > 0
                  ? ` · ${t("interpretPartiesPending", { count: aiPartiesPending ?? 0 })}`
                  : ""}
            </span>
          )}
          {/* ⚠️ Drawn only on a row the model actually read, and that is the
              whole point: the extraction prompt is built from the document
              TYPE's template, so a scan that was unsure which type this is
              produced a form that looks just as complete as a correct one. On a
              row nobody read, the caveat has nothing to caveat. */}
          {aiProcessed && confidenceNote !== null && (
            <span
              className="text-xs font-medium text-amber-700 dark:text-amber-400"
              title={confidenceNote.body}
            >
              ⚠ {confidenceNote.title}
            </span>
          )}

          {/* Slice #23.01.Import — the ID-card action. */}
          {settled && canAct && isIdCard && canCreatePerson && !personId && (
            <button
              type="button"
              onClick={onCreatePerson}
              className={buttonClass({ variant: "ghost", size: "xs" })}
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
          {/* Slice #23.08.Import — the document half of the same click. Amber,
              not red: the person was created and linked either way, so this is
              an incomplete success rather than a failed row. */}
          {personId && idCardDocFieldsFailed && (
            <span
              role="status"
              className="text-xs font-medium text-amber-600 dark:text-amber-400"
            >
              ⚠ {t("personDocFieldsFailed")}
            </span>
          )}
          {personId && !idCardDocFieldsFailed && (idCardDocFields ?? 0) > 0 && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              · {t("personDocFields", { count: idCardDocFields ?? 0 })}
            </span>
          )}

          {/* Slice #23.02.Import — coordinate file → the run's Property. */}
          {settled && canAct && isCoordinate && !coordinateSettled && (
            <button
              type="button"
              onClick={onApplyCoordinates}
              className={buttonClass({ variant: "ghost", size: "xs" })}
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
