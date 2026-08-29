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
 * THE RESULT TABLE DESCRIBES, IT DOES NOT OFFER   (Slice #26.10)
 * ────────────────────────────────────────────────────────────
 * The actions column carried two buttons until this slice — "Creează persoană
 * din CI" (#23.01) and "Aplică pe proprietate" (#23.02) — and the source
 * document asks for the opposite: "instead of 'apply to property' button it will
 * be a note 'was applied to property' and for ID card it will be 'a person was
 * created from ID card'". A screen that describes cannot be built on work that
 * has not happened, so each button became a fact:
 *
 *   - The CORNERS were already written by the property step, which since #26.07
 *     creates the Property from the coordinate file BEFORE any document exists.
 *     `cornerSourceByPath` already records which file built which Property, so
 *     the row had the fact all along and was offering to do it again.
 *   - The PERSON is queued by the run and walked automatically once every row
 *     has settled — the same shape #26.09 gave the extracted parties, and the
 *     same guarantee: the user still confirms or creates each one, nothing is
 *     written behind their back. What moved is who opens the dialog, not who
 *     answers it.
 *
 * The identity cards are walked BEFORE the party queue, deliberately. A card
 * puts the property's own owner in the system; every party step afterwards
 * resolves against an archive that already holds them, so the confirm branch is
 * offered where a create branch would otherwise have made the duplicate this
 * redesign exists to prevent.
 *
 * A FORM FILLS IN THE DOCUMENTS THAT CAME BEFORE IT   (Slice #27.06)
 * ─────────────────────────────────────────────────────────────
 * #27.05 gave a brand-new type its form during the run. The documents of that
 * type the run had ALREADY read were read against a type that had no columns,
 * so their type-specific values went to Notes — and the first documents of a
 * new type were the only ones left that way. This slice reads them again.
 *
 * ⚠️ **IT NEEDS NO NEW EXTRACTION PATH.** `runAiInterpret` builds nothing
 * itself: the route reads the type's template on every call, so a second call
 * picks up the fields that were just accepted with no code change, and that
 * function's merge-not-replace rule is what makes a second pass safe on a
 * document somebody touched in between.
 *
 * ⚠️ **THAT RULE COVERS TWO COLUMNS, NOT SEVEN, and an adversarial round was
 * right to refuse the loose version of this sentence.** `customFields` is merged
 * and `notes` are appended. The four baseline fields — `title`, `nrDocument`,
 * `dateDocument`, `subject` — are written WHOLE whenever the model returns a
 * non-empty value, with no comparison against what is stored, even though the
 * GET that would allow one is already in hand. So a correction a human typed
 * into one of those four between the run's read and this click is overwritten on
 * the live record, surviving only in `document_version` history, which no screen
 * in this wizard shows. And on the branch where the second read RE-TYPES the
 * document, `customFields` is replaced rather than merged — deliberately, since
 * the column holds the OLD type's values and carrying them over orphans them on
 * a form that renders none of them.
 *
 * None of that is #27.06's to change: it is `runAiInterpret`'s behaviour on
 * every call site, including the run's own read and the retry, and narrowing it
 * belongs with whoever next opens that file. What this slice owes is not to
 * claim a safety it does not have. The window is real but narrow — it needs the
 * user to have opened and edited one of these documents in another tab while the
 * result screen was still up — and the retyped case is now recorded on the row
 * rather than drawn as a tick; see `RefillState`.
 *
 * ⚠️ **IT IS A CONFIRMED CLICK, NOT AN AUTOMATIC CONSEQUENCE OF ACCEPTING.**
 * Every other write in the 26.xx redesign takes that shape, and this is the one
 * place in the slice where spending money is the thing being decided: the click
 * is priced in the sentence above it — how many billed reads, and how many
 * document versions — because a cost discovered after the click is a cost
 * nobody agreed to. Accepting a form and paying to re-read forty documents are
 * two decisions, and the review dialog only ever asked the first.
 *
 * ⚠️ **THE RE-READ RE-STAMPS `ai_interpreted_at`, AND THAT IS THE WHOLE
 * BOOKKEEPING.** No second stamp, no re-read counter: #26.12 derives the
 * document's status from that column and the type's form together, and the
 * import is still the only writer of it. (Worth saying precisely, because it is
 * easy to over-claim: what moves a document from "Importat" to "Procesat cu AI"
 * is the TYPE gaining its form — `status.ts` reads the type live — so the
 * re-stamp is not what flips the status. What it does is keep the column
 * honest about when the read that filled these columns actually happened.)
 *
 * ⚠️ **TWO CONSEQUENCES THE SENTENCE ABOVE THE BUTTON DOES NOT PRICE, because
 * they are `runAiInterpret`'s and not this slice's** — but a reader deciding
 * whether to widen this later should meet them here rather than discover them.
 * The route may auto-create a `lookup_document_type` row when it re-classifies,
 * so a re-read can add reference data; and the notes are APPENDED, so the
 * "[AI] Text neasociat unui câmp" block the first read wrote — the very values
 * this slice moves into columns — is still in Notes afterwards, with the second
 * read's block under it. Neither is new to #27.06 (the run's own read and the
 * retry both do it), and neither is fixable from this file. Deduplicating that
 * superseded block belongs with whoever next opens `runAiInterpret`.
 *
 * The concurrency limit is 3 in-flight import operations at a time — which,
 * since #26.09, means up to 3 concurrent AI reads as well. The follow-up
 * steps are one-at-a-time: each opens a modal, and #27.06's re-reads are
 * serial for the same reason — one billed call at a time, with the screen
 * saying which one.
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
import { useLocale, useTranslations } from "next-intl";
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
import { ID_CARD_TYPE_KEYS, isIdCardEntry, isIdCardTypeName } from "@/lib/import/id-card";
import { isDeclaredCoordinateFile } from "@/lib/import/structure-rules";
import type { EntryAssignment } from "@/lib/import/property-folders";
import { titleForEntry, type PreexistingRow } from "@/lib/import/preexisting-check";
import { ProgressBar } from "@/components/progress-bar";
import { buttonClass } from "@/lib/ui/button-styles";
import {
  IdCardPersonDialog,
  type IdCardPersonOutcome,
} from "./id-card-person-dialog";
import {
  AiPartyLinkerDialog,
  type AiExtractedParty,
  type AiPartyLinkerSummary,
} from "@/app/documents/_components/ai-party-linker-dialog";
// Slice #27.05 — the SAME review surface the Descoperire AI button opens, not a
// second one. What #27.05 automates is the noticing and the running; the tick
// boxes are the product, so the screen that carries them must be the screen
// that has already been argued about for two slices.
import {
  DiscoverReviewDialog,
  type DiscoverReviewPair,
  type NewTypeProgress,
} from "@/app/documents/_components/discover-review-dialog";
import { discoverForType, shouldDiscoverType, typeAwaitsForm } from "@/lib/import/discover-run";
import { documentTypeHasForm } from "@/lib/documents/status";
import {
  fetchDocumentTypeCatalogue,
  type DocumentTypeCatalogueRow,
} from "@/lib/import/document-type-catalogue";
import {
  catchAllType,
  resolveAgainstTypes,
  type ClassifierAnswer,
} from "@/lib/documents/document-type-match";
import {
  parseTemplateFields,
  type DocumentTemplateField,
} from "@/lib/documents/template-fields";
import { proposeTemplateFields } from "@/lib/documents/discover-to-template";
import { useQueryClient } from "@tanstack/react-query";
import {
  canRetryReads,
  // ⚠️ `fetchWithTimeout` left this import list in #29.08 with the catalogue
  // fetch that was its only caller here. It is still exported and still used —
  // by `src/lib/import/document-type-catalogue.ts`, and by `runAiInterpret`
  // itself — so this is not a dead helper, only one this file no longer calls.
  inFolderOrder,
  interpretSkipReason,
  isSessionLoss,
  runAiInterpret,
  servesHtml,
  type AiInterpretRunResult,
} from "@/lib/import/ai-interpret-run";
import {
  awaitsRefill,
  inResultOrder,
  outcomeNotes,
  runLandedSomething,
  runTypeNotes,
  summariseImportRun,
  summaryLines,
  typesCreatedWithNoDocuments,
  typesThatGainedForm,
  type ImportRunSummary,
  type OutcomeNote,
  type OutcomeNoteId,
  type RefillState,
  type RunTypeFormChange,
  type RunTypeNoteId,
  type SummaryRow,
} from "@/lib/import/import-outcome";
import { buildResultReportHtml, reportFileName } from "@/lib/import/report-html";
import { downloadHtmlFile, fileNameStamp } from "@/lib/ui/download-html";
import type { ResolvedProperty } from "./property-step-dialog";

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
   * How many of this entry's pages actually landed, and how many there were.
   *                                                            (Slice #32.05)
   *
   * ⚠️ **WRITTEN ONLY WHEN THEY DISAGREE**, so `pagesUploaded === undefined` is
   * the ordinary run rather than "we did not count". A row that carries them is
   * a Document in the archive whose scan is INCOMPLETE — some pages of a page
   * group uploaded, the rest did not — and that is a state nothing on this
   * screen could say before: the per-task catch marks the row an error and
   * nothing says how far it got, so a user looking at the document afterwards
   * finds three pages of a five-page deed with no record that two are missing.
   *
   * ⚠️ **A DOCUMENT WITH ZERO PAGES NEVER CARRIES THEM, because it is not left
   * behind.** The task that created it deletes it — see the upload block — so
   * "0 of 5" is not a state a row can be in.
   */
  pagesUploaded?: number;
  /** The pages this entry holds. Written with `pagesUploaded`, never alone. */
  pagesExpected?: number;
  /**
   * What happened to a Document whose first page never landed. (Slice #32.05)
   *
   * `"removed"` — the task deleted it, so the archive holds nothing for this
   * file and the user can simply import the folder again once the error above
   * is dealt with. `"left"` — the delete itself was refused, which is what a
   * dead session does to it, and a Document with no scan at all is sitting in
   * the archive under the title this row names.
   *
   * ⚠️ **BOTH ARE SAID OUT LOUD, and reporting only the failure would be the
   * worse of the two choices.** "The document was removed" is the sentence that
   * lets a user stop looking for it; without it the fix is invisible and the
   * archive appears to have swallowed a file.
   */
  emptyDocument?: "removed" | "left";
  /**
   * The removed Document was this run's coordinate-file source. (Slice #32.05)
   *
   * `property_corner_source` hangs off `document.id` with `ON DELETE CASCADE`,
   * so removing an empty Document releases the claim — while the Property it
   * pointed at, written by the property step before the run, survives with its
   * corners and no recorded source. That is the recoverable direction (a second
   * import re-creates the document and re-claims) and it is not a state the
   * user can guess at, so the row says it.
   */
  cornerClaimLost?: boolean;
  /**
   * Slice #21.02.Import: true once AI interpretation has succeeded on this
   * entry. Written by the run itself since #26.09 rather than by a button, and
   * still the fact the saved session carries.
   */
  aiProcessed?: boolean;
  /** Slice #23.02.Import: how many document fields that run filled in. */
  aiFieldCount?: number;
  /**
   * Slice #29.12: the entry's own name had already named this document, so its
   * title was KEPT and the model's reading of the printed heading went to
   * Enhanced Notes.
   *
   * ⚠️ **It is a separate flag because `aiFieldCount` cannot say it.** A kept
   * title is not a field written, so the count is honestly zero — and a row
   * reading `✓ niciun câmp completat` over a document that was read correctly
   * and whose title was protected on purpose says the opposite of what
   * happened. `undefined` rather than `false` when it did not, which is this
   * file's convention for a flag only ever interesting when true — a `false` on
   * every other row is a fact nobody asked for. (`SavedImportEntry` carries
   * neither this nor `aiFieldCount`, so a resumed session loses the sentence
   * along with the count; that is the saved session's existing shape, not
   * something this flag changes.)
   */
  aiTitleKept?: boolean;
  /**
   * Slice #29.12: …and whether that reading is actually in the document's
   * Enhanced Notes, which is a different question — the reading is not recorded
   * when it IS the title we kept, nor when a line carrying the marker is
   * already there. A row keyed on `aiTitleKept` alone told the user to go and
   * look at a field that had nothing in it.
   */
  aiPrintedHeadingNoted?: boolean;
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
  /**
   * WHY the run did not read it, on a row whose `aiStatus` is `skipped`.
   * (Slice #26.10)
   *
   * `interpretSkipReason` is the one expression that decides it — the loop does
   * not get to have a second opinion. Until this slice a skipped row drew
   * nothing at all in the actions column, which on a screen whose whole subject
   * is what happened reads as a row nobody looked at.
   */
  aiSkipReason?: "no-page" | "id-card";
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
   * …and whether that Person was NEW.   (Slice #26.10)
   *
   * `IdCardPersonOutcome` has carried it since #23.01 and the row discarded it,
   * because a button's job was done either way. A row that DESCRIBES cannot
   * discard it: "o persoană a fost creată din cartea de identitate" and "a fost
   * regăsită în sistem" are the two different things that happen, and the source
   * document names the first one specifically.
   */
  personCreated?: boolean;
  /**
   * The card's question was put and closed without a person.   (Slice #26.10)
   *
   * Not a failure — a dismissal is a legitimate answer — but not "waiting"
   * either, and the two have different sentences. The backlog entry survives,
   * exactly as a dismissed party stepper's does, so the header's own control can
   * offer it again; see `handleIdCardClosed`.
   */
  personDeclined?: boolean;
  /**
   * The card's image could not be prepared, so nobody was ever asked.
   * (Slice #26.10)
   *
   * A PDF that would not rasterise, or a file whose extension is neither image
   * nor PDF. The Document is fine and the file is in the archive; what did not
   * happen is the person step, and the row has to say which of the two it is.
   */
  personFileUnreadable?: boolean;
  /**
   * The card's dialog was opened and gave up.   (Slice #26.10)
   *
   * A rate limit, a 5xx, an expired session, or its own timeout — everything
   * `IdCardPersonDialog` reports through `onFailed`. Kept apart from
   * `personFileUnreadable` because the image is fine, the step is still in the
   * queue, and the remedy is to try again rather than to go and re-scan a good
   * file. See `OutcomeRow.personStepUnfinished`.
   */
  personStepUnfinished?: boolean;
  /**
   * This card is in the follow-up queue.   (Slice #26.10)
   *
   * Written when the run queues it, never cleared. Read together with
   * `personId` it is what makes "still unanswered" a fact the HEADER can count
   * without reaching into a ref that no render subscribes to.
   */
  idCardQueued?: boolean;
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
  /**
   * The document type this row's Document ended up on.   (Slice #27.05)
   *
   * ⚠️ **The LATEST type known for this row, and its presence means the
   * Document exists.**   (reworded in Slice #29.06, second review round)
   * It is written the instant `createDocument` returns, and overwritten by the
   * type the AI read settles on — `runAiInterpret` may re-classify the
   * document, which is two documents' worth of difference on an ordinary run.
   * So on a settled row it is the type AFTER the read, which is what #27.05
   * keys everything on: which type gets one discovery read, which rows stop
   * saying "no form" when a form is accepted, and how many TYPES the summary
   * reports rather than how many rows.
   *
   * The earlier wording said "the type AFTER the read, NOT the one the loop
   * resolved" — true when only settled rows carried it, and false since #29.06
   * writes it at creation time so that a row whose upload or tag failed still
   * says which type its Document is on. `typesCreatedWithNoDocuments` is the
   * reader that needs the earlier write. The readers that must NOT see a
   * pre-read value gate on `typeFormMissing`, which is only ever written on a
   * row the run actually read; the rest — `documentTypeName`, the two filing
   * flags, `forgetTypeFormMissing` — want the latest type known and get it. (A
   * sixth review round trimmed a version of this sentence that claimed every
   * reader gated.)
   */
  documentTypeId?: string;
  /**
   * How that type was arrived at, when it is worth a sentence. (Slice #29.06)
   *
   * ⚠️ **Absent on the ordinary row.** `ensureDocType` returns `matched` for a
   * document whose type was already in the list, and the loop writes nothing —
   * see `TypeResolution` for why `failed` and `unclassified` are two answers
   * and not one, and `outcomeRowOf` for why the row's note is decided from this
   * TOGETHER WITH the type the document finally sits on rather than from this
   * alone.
   */
  typeResolution?: TypeResolution;
  /**
   * …and that type has no custom form, so what the read found that was
   * type-specific went to Notes.   (Slice #27.05)
   *
   * The rule is `typeAwaitsForm` in `src/lib/import/discover-run.ts` and is not
   * restated here — see `OutcomeRow.typeFormMissing` for which documents it is
   * deliberately silent about.
   */
  typeFormMissing?: boolean;
  /** …and the user gave that type a form during this run.   (Slice #27.05) */
  typeFormAdded?: boolean;
  /**
   * Where this document is in the run's re-read queue.        (Slice #27.06)
   *
   * ⚠️ **Set ONLY on a row that carried `typeFormMissing` and has a `docId`**,
   * which is the invariant `awaitsRefill` is allowed to assume — see the set
   * site in `handleDiscoverSaved`. Not persisted anywhere: the saved session
   * records `aiProcessed` and this is a question about a click that has not
   * happened yet.
   */
  refill?: RefillState;
  /**
   * Why the second read did not happen, for the row's tooltip. (Slice #27.06)
   *
   * ⚠️ **Its own field rather than `aiErrorDetail`, and it is not tidiness.**
   * That one is drawn by the amber block, which is gated on `aiStatus ===
   * "failed" || aiPartialWrite` — neither of which is true on a row whose FIRST
   * read succeeded and whose second failed. Writing the second read's `HTTP 429`
   * into it would either be invisible or, on a partial row, hang the wrong
   * event's reason off the first read's sentence — the exact confusion
   * `interpretRetryFailed` was worded to stop.
   */
  refillErrorDetail?: string;
};

/**
 * One document's unconfirmed people.   (Slice #26.09)
 *
 * Nothing here has been written. `parties` is exactly what the route read out
 * of the document, handed to the same stepper the deleted button used to open,
 * which links or creates only what the user confirms one at a time.
 */
type PartyStep = {
  kind: "parties";
  path: string;
  docId: string;
  parties: AiExtractedParty[];
};

/**
 * One identity card's person, waiting to be confirmed or created.
 * (Slice #26.10)
 *
 * ⚠️ **The `File` is resolved during the RUN and carried here**, rather than
 * being read when the step opens. `FSEntry`'s handle is only readable while
 * this dialog is mounted and while the user's permission grant is live, and the
 * loop is already holding the file open to upload it — so resolving it there
 * costs nothing and removes an await from the moment a modal appears. A PDF is
 * rasterised to its first page in the same breath, because a vision model
 * cannot read a PDF.
 */
type IdCardStep = {
  kind: "id-card";
  path: string;
  docId: string;
  /** The row's own label, used as the dialog's heading before a name is read. */
  label: string;
  file: File;
  /** The ONE Property this card's person is linked to. See `soleProperty`. */
  propertyId: string;
};

/**
 * One document TYPE's proposed form, waiting to be reviewed.   (Slice #27.05)
 *
 * ⚠️ **Keyed by TYPE, and queued once per type per run.** The second document
 * of a type has nothing to add to a proposal that is already waiting and costs
 * a billed read to say so — see `shouldDiscoverType`.
 *
 * ⚠️ **Nothing here has been written.** `discoverForType` reads and returns;
 * the type gains its form only when the user ticks boxes in the dialog below,
 * which is the point of the slice rather than the friction in it.
 *
 * `path` is the entry the read was made from, and it is what puts this step in
 * the FOLDER's order alongside the other two queues — see `inFolderOrder`.
 * `docId` is that same document: the review dialog needs it because #27.04's
 * new-type path re-types the document it was read from.
 */
type DiscoverStep = {
  kind: "discover";
  path: string;
  docId: string;
  typeId: string;
  /**
   * The type's name as the SERVER holds it, re-read once the rows have settled.
   *
   * Not the label the scan produced: `ensureDocType` may have matched an
   * existing row by name, and the dialog puts this in its own title over a
   * decision that is about to be permanent.
   */
  typeName: string;
  /**
   * The type's template as it stood when the queue was published — empty, by
   * construction, since a type with a form is never queued. Handed to the
   * dialog anyway because that is what it sends as `knownKeys`, and the route's
   * 409 is what catches a template that moved under the review.
   */
  existing: DocumentTemplateField[];
  pairs: DiscoverReviewPair[];
  documentLabel: string | null;
  partyRoleNames: string[];
  skippedPages: number;
  truncated: boolean;
};

/**
 * Everything the run queues for the user to answer once it has settled.
 *
 * One list and one cursor rather than two of each, and it is not tidiness: the
 * Close button, the Cancel in the stage bar and every row control are disabled
 * on "is a follow-up open", and two independent cursors would give that one
 * question two answers. `kind` is what the render switches on.
 */
type FollowUpStep = IdCardStep | PartyStep | DiscoverStep;

/**
 * Fill in each queued type's NAME and template from the server, and drop the
 * ones that should no longer be reviewed.   (Slice #27.05)
 *
 * ⚠️ **Re-read rather than carried from the loop, and a type invented mid-run is
 * why.** `runAiInterpret`'s route auto-creates `lookup_document_type` rows when
 * it re-classifies a document, so such a type is in no map the tasks hold — its
 * step would name an EMPTY type in the dialog's title, over a decision that is
 * about to be permanent. The same read is what drops a type that gained a form
 * while the run was going on, and what gives #27.04's new-type box the list of
 * names it refuses duplicates against.
 *
 * Mutates the map it is given and returns the type names, or null when the list
 * could not be read at all — in which case the queue is left exactly as it was.
 * `sessionLost` is reported separately from that null, and an adversarial round
 * is why: a bare `.catch(() => null)` here turned a dead session into "the list
 * could not be read", so the run published its full follow-up queue and walked
 * the user through confirming people into consecutive 401s — the one thing the
 * publish site's own comment says must never happen — while the header
 * diagnosed a dead session as a network fault.
 * A stale `existing` is the one thing this does NOT have to get right: the
 * dialog sends it as `knownKeys` and the route answers a template that moved
 * with a 409 carrying the current fields.
 */
type EnrichResult = {
  names: string[] | null;
  sessionLost: boolean;
  /**
   * Types dropped here because the SERVER's name for them reads as an identity
   * card.   (Slice #27.05)
   *
   * ⚠️ **Reported so the ROWS can stop saying a form is due, and a fifth
   * adversarial round is why.** Dropping the step stops the permanent write and
   * nothing else: the loop had already written `typeFormMissing` on every row it
   * read of that type, so the table went on printing "tipul acestui document nu
   * are încă formular" on an identity card, `typesWithoutForm` went on counting
   * it, and the header sent the user off to hand-build a form for the one type
   * `status.ts` calls permanently correct without one — in the saved report too,
   * which outlives the dialog.
   */
  idCardTypeIds: string[];
  /**
   * Every type the SERVER holds — its name, and whether it has a form.
   *                                                              (Slice #27.07)
   *
   * ⚠️ **The only place a type invented MID-RUN can be given a name.** The
   * re-classify route auto-creates `lookup_document_type` rows, so such a type
   * is in no map the tasks hold and the run knows it by uuid alone — which is
   * exactly what a backlog sentence must not print at a business user. Same
   * read, same freshness rules, same null: `null` here means the list could not
   * be read, never that there are no types.
   *
   * ⚠️ **`hasForm` is the WHOLE list's answer and not just the queued types',
   * and an adversarial round is why.** The walk below already dropped a step
   * whose type had gained a form meanwhile — somebody else's session, or the
   * same user in another tab, quite possibly through the Reference Data filter
   * this very slice adds — but a type whose discovery produced nothing
   * proposable has no step to drop, so a set collected inside that loop would
   * absolve one type and say nothing about the other. Deriving it from every
   * row instead is both simpler and complete; `absorbTypeList` is where it is
   * acted on.
   */
  typeRows: { id: string; name: string; hasForm: boolean }[] | null;
};

async function enrichDiscoverSteps(byType: Map<string, DiscoverStep>): Promise<EnrichResult> {
  // ⚠️ **NO EARLY RETURN ON AN EMPTY QUEUE SINCE #27.07, and a third
  // adversarial round is why the GET has to happen anyway.** This function is
  // the only thing in the whole run that re-reads the type list, and since
  // #27.07 it is also what refreshes `docTypeFormRef` and `docTypeIdCardRef`
  // — the two maps `typeAwaitsForm` and `shouldDiscoverType` are decided from.
  // Skipping the read when nothing is queued left those maps frozen at their
  // start-of-run values for the whole of the archive's COMMONEST run: the one
  // where every type already has a form, so nothing is ever queued. A retry
  // pressed after the user had built a type's form in another tab then spent a
  // billed discovery on a finished type and wrote "tipul acestui document nu
  // are încă formular" back onto the row — named, permanently, in the saved
  // report, with no review button left to take it back.
  //
  // The loop below is a no-op on an empty map, so what an empty queue costs is
  // one GET after the tasks with nobody waiting on it — the cost this call site
  // already accepts in writing — and what it buys is the run knowing what the
  // archive currently looks like.
  let sessionLost = false;
  const fresh = await fetchDocumentTypeCatalogue().catch((err: unknown) => {
    // The same sentinel `createDocument` and `uploadPage` throw, read here
    // rather than swallowed — see the header.
    sessionLost = err instanceof Error && err.message === "session-expired";
    return null;
  });
  // ⚠️ **An EMPTY list is treated as a failed read, not as "every type was
  // deleted", and an adversarial round found what the other reading costs.**
  // `fetchDocumentTypeCatalogue` answers `body.items ?? []`, so any 200 whose JSON has no
  // `items` array — a rewritten response, a proxy, a route that changed shape —
  // arrives here as zero rows, and the loop below would then delete every step
  // in the queue. Those pairs exist in no database: they were read at the cost
  // of a model call each and this ref is the only place they are. `fetchDocTypes`
  // refuses the same answer at the start of the run, in Romanian; this is the
  // same refusal, one step quieter because there is a queue to protect rather
  // than a run to stop.
  if (fresh === null || fresh.length === 0) {
    return { names: null, sessionLost, idCardTypeIds: [], typeRows: null };
  }
  const idCardTypeIds: string[] = [];
  const byId = new Map(fresh.map((item) => [item.id, item]));
  for (const [typeId, step] of [...byType]) {
    const row = byId.get(typeId);
    // Gone from the list — deleted, or a type we cannot account for. Dropped
    // rather than shown: the dialog would write to an id the server no longer
    // serves, and its own 404 would arrive after the ticks were made.
    if (row === undefined) {
      byType.delete(typeId);
      continue;
    }
    // It gained a form while the run was going on — somebody else's session, or
    // the same user in another tab. A discovery on a type that HAS a form is a
    // legitimate thing to do by hand and not a thing to put in front of
    // somebody unasked.
    // Slice #27.07 — and the rows' claim that a form is owed is taken back by
    // `absorbTypeList`, off `typeRows` rather than off a set collected here.
    // Dropping the step stops the review and nothing else; before this slice
    // that left the table printing "tipul acestui document nu are încă
    // formular" over a type that has one, and #27.07 would then have NAMED it
    // in a backlog the user cannot empty because it is already empty.
    if (documentTypeHasForm(row.templateFields)) {
      byType.delete(typeId);
      continue;
    }
    // ⚠️ **The identity-card test again, on the name the SERVER holds — and
    // this is the only place that has it.** The loop asks `docTypeIdCardRef`,
    // built from the start-of-run list, so a type created DURING the run is not
    // in it and the loop falls back to the scan's own signal, which is exactly
    // the signal that is false on a mislabelled card. By the time we get here
    // the read has been paid for; the permanent write has not. See
    // `typeIsIdCard` in `discover-run.ts`.
    if ((ID_CARD_TYPE_KEYS as readonly string[]).includes(row.key) || isIdCardTypeName(row.name)) {
      idCardTypeIds.push(typeId);
      byType.delete(typeId);
      continue;
    }
    const existing = parseTemplateFields(row.templateFields);
    // ⚠️ **A step with nothing PROPOSABLE is dropped here**, and an adversarial
    // round found the loop it otherwise makes. The queue gates on
    // `pairs.length > 0`, which is not the same question: a short document
    // whose printed labels are all generic columns (`Nr.`, `Data`, `Titlu`) or
    // the type's own person roles yields six pairs and zero rows anyone can
    // tick — `proposeTemplateFields` marks every one `alreadyInForm`. The
    // dialog then opens saying there is nothing to add, and closing it does not
    // clear the backlog (deliberately — see `handleDiscoverClosed`), so the
    // header goes on offering a review that reopens the same empty screen for
    // the life of the dialog. The same pure module the dialog itself seeds from,
    // so the two cannot disagree about what "nothing to add" means.
    const proposable = proposeTemplateFields(step.pairs, existing, step.partyRoleNames);
    if (!proposable.some((field) => !field.alreadyInForm)) {
      byType.delete(typeId);
      continue;
    }
    byType.set(typeId, { ...step, typeName: row.name, existing });
  }
  return {
    names: fresh.map((item) => item.name),
    sessionLost: false,
    idCardTypeIds,
    // Slice #27.07 — `documentTypeHasForm`, the one function #26.12 wrote for
    // the question, exactly as the start-of-run map is built. A `length > 0` on
    // the raw jsonb here would let a type whose template parses to no usable
    // field read as finished on the one screen that reports the backlog.
    typeRows: fresh.map((item) => ({
      id: item.id,
      name: item.name,
      hasForm: documentTypeHasForm(item.templateFields),
    })),
  };
}

/**
 * The queued steps that can actually be OPENED.   (Slice #27.05)
 *
 * ⚠️ **`typeName === ""` means the enrichment never ran or never came back**,
 * and such a step must not reach the dialog: it puts that name in its own title
 * and in its new-type copy ("mutat de pe „”"), over a decision that is about to
 * be permanent. An adversarial round found both publish sites handing it
 * straight through when the end-of-run type-list read failed.
 *
 * ⚠️ **The step is KEPT in the ref rather than dropped, and `discoverBacklog`
 * counts the REF rather than this** — an adversarial round caught the first
 * version counting only openable steps, which made the whole rescue path
 * unreachable in the state it was written for. A session expiry aborts the run;
 * the end-of-run enrichment then fails with it, so every step keeps
 * `typeName: ""`; a backlog of zero draws no control; and N proposals — one
 * billed model call each, held nowhere but this ref — died on Close after the
 * user had signed in again and come back for them. The button is drawn on what
 * is THERE; the enrichment is retried each time it is pressed; and a press that
 * still cannot open anything says so in words rather than doing nothing.
 */
function openableDiscoverSteps(byType: ReadonlyMap<string, DiscoverStep>): DiscoverStep[] {
  return [...byType.values()].filter((step) => step.typeName !== "");
}

/**
 * The discovery queue in the FOLDER's order.   (Slice #27.05)
 *
 * The steps are held by TYPE — one per type — and walked by document, so the
 * re-key happens here rather than at each of the two call sites. `inFolderOrder`
 * is the same tested reduction the other two queues use, for the same reason:
 * a queue that jumps about is invisible until somebody is halfway through it.
 */
function discoverStepsInFolderOrder(
  entries: readonly FSEntry[],
  byType: ReadonlyMap<string, DiscoverStep>,
): DiscoverStep[] {
  // ⚠️ **A LIST per path, not one step, and an adversarial round is why.** Two
  // types can legitimately be queued from one document: the first read of entry
  // P proposes a form for type T, its retry re-types the document to U and
  // proposes one for U as well. A `Map<path, step>` silently drops one of them —
  // and it drops it from the QUEUE while `discoverBacklog` goes on counting the
  // type map, so the header offers a button that walks past a review nothing
  // else can reach.
  const byPath = new Map<string, DiscoverStep[]>();
  for (const step of openableDiscoverSteps(byType)) {
    const at = byPath.get(step.path);
    if (at === undefined) byPath.set(step.path, [step]);
    else at.push(step);
  }
  return inFolderOrder(entries, byPath).flat();
}

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
   * The user pressed "continue without forms" on the stop screen.
   *                                                            (Slice #32.05)
   *
   * ⚠️ **IT SUPPRESSES THE DISCOVERY READ AND NOTHING ELSE.** A waived run
   * still creates the documents, uploads and links their scans, attaches their
   * properties and tags, and still runs the per-document AI read — the request
   * was "I just want to see the scan uploaded and linked to the document object
   * and I don't care about what fields are filled in", which is permission
   * rather than an instruction to spend less. What it declines is the
   * per-TYPE work: no `discoverForType` call for a type that is waiting for a
   * form, and therefore no proposal in the follow-up queue and no form-review
   * dialog at the end of the run. A user walked through a form-approval dialog
   * per waived type has not continued without forms; they have done the same
   * job in a worse place.
   *
   * ⚠️ **AND IT DOES NOT SILENCE `typeAwaitsForm`.** Every row whose type is
   * waiting still says so, and `summary.typesWithoutForm` still counts them —
   * both true, and both the honest thing to report about an archive that now
   * holds documents on formless types. Only the result header changes, to a
   * variant that does not offer to review fields nobody read.
   *
   * Required rather than optional, for `shouldDiscoverType`'s own reason: a
   * default is a call site that can forget.
   */
  formsWaived: boolean;
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
   * The Properties this run resolved.   (Slice #26.10)
   *
   * Needed because the result screen now NAMES them: a coordinate row says
   * which Property its corners built, and the concluding message counts them.
   * The property step's own output, passed through the wizard unchanged, so
   * there is no second list to drift.
   *
   * ⚠️ **`onPropertyCornersChanged` went with the button that fired it.** The
   * corners can no longer change after the property step — the row describes
   * what that step did rather than offering to redo it — so the wizard's chips
   * cannot go stale and nothing has to tell them so.
   */
  properties: readonly ResolvedProperty[];
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
  /**
   * Fired once, the moment the loop and its follow-up queue are finished and
   * this dialog has become the RESULT screen.   (Slice #26.10)
   *
   * The workflow indicator has read "Import — în curs" over a finished run since
   * #26.03, and `workflow-stages.ts` records it as a known gap for this slice.
   * The wizard cannot see it from outside: opening this dialog and finishing its
   * run are two different events and only one of them has a prop.
   */
  onRunFinished?: () => void;
  /**
   * Closed. The summary is what the concluding message reads out.
   *
   * ⚠️ **Handed over rather than recomputed by the wizard, because the wizard
   * cannot compute it**: every fact in it — which reads failed, which people
   * were created, which cards nobody answered — lives in this dialog's state and
   * nowhere else. A run's statistics computed from what the wizard happens to
   * know would be a second, quieter version of the same screen.
   *
   * ⚠️ **`null` when the run never finished.** This dialog's Close is also the
   * way out of the fatal-error banner — a session that died before the first
   * document — and there is no conclusion to report from there. See the call
   * site for what that screen must not be allowed to say.
   */
  onClose: (summary: ImportRunSummary | null) => void;
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
// isCoordinateFileName in src/lib/import/coordinate-file.ts. Slice #26.07
// narrowed the ROW to STR-08's `coord…` rule for one adversarial round and put
// it back, on the argument that a folder rule and a row action are two
// different questions and only the first is allowed to be strict.
//
// ⚠️ **#26.10 settled it the other way, and the argument above is the reason
// rather than a casualty of it.** The row stopped being an action. A button on
// a stray `notite.txt` was a click that did nothing; the sentence that replaced
// it is a claim, and a claim is exactly the thing that has to be strict. See
// `isCoordinateRow`.
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

/**
 * ⚠️ **NOTHING WAITS FOR EVER, AND THIS ONE USED TO.**   (hardened in #26.10)
 *
 * Until this slice the promise below settled on exactly one event: a `message`
 * whose `id` matched. A worker that failed to load, threw inside pdf.js, or was
 * killed for memory posted nothing at all, and the promise stayed pending.
 * That was survivable while the only caller was a button the user could walk
 * away from. It is not survivable now: #26.10 calls this from inside the import
 * loop, where a pending promise means the entry's task never settles, so
 * `withConcurrencyLimit` never resolves, `done` is never set — no Close, no
 * result table, no report — and the stage bar's Cancel is disabled for the
 * whole `importing` phase. One unreadable PDF would have left a page reload as
 * the only exit, and a reload loses the queue.
 *
 * So: an `error` listener for a worker that dies loudly, and a timeout for one
 * that dies quietly. Both reject, which the caller already handles by marking
 * the row `personFileUnreadable` and carrying on.
 */
const PDF_RASTERIZE_TIMEOUT_MS = 30_000;

async function pdfFirstPageBlob(file: File): Promise<Blob> {
  const buffer = await file.arrayBuffer();
  const worker = getPdfWorker();
  const id     = Math.random().toString(36).slice(2);

  return new Promise<Blob>((resolve, reject) => {
    // The timer is armed FIRST so it can be a `const` — `prefer-const` is right
    // about it, and a `let` assigned exactly once is a reader wondering where
    // the second assignment is. It refers forward to `handleTimeout`, which is
    // a hoisted function declaration and therefore already initialised when
    // this line runs; nothing here can fire before the current turn ends.
    const timer = setTimeout(handleTimeout, PDF_RASTERIZE_TIMEOUT_MS);
    // Every exit runs this, so no listener and no timer outlives the call —
    // and a late message for a timed-out id can no longer resolve a promise
    // whose caller has already been told it failed.
    function done() {
      clearTimeout(timer);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleError);
    }
    function handleTimeout() {
      done();
      reject(new Error("PDF worker timed out"));
    }
    function handleMessage(
      e: MessageEvent<{ id: string; buffer?: ArrayBuffer; error?: string }>,
    ) {
      if (e.data.id !== id) return; // belongs to a different concurrent call
      done();
      if (e.data.error) {
        reject(new Error(e.data.error));
      } else if (e.data.buffer) {
        resolve(new Blob([e.data.buffer], { type: "image/png" }));
      } else {
        reject(new Error("PDF worker returned no buffer"));
      }
    }
    // ⚠️ Not filtered by `id` — a worker-level error carries none, and it
    // takes every in-flight call down with it. Rejecting all of them is
    // correct: none of them is going to be answered.
    function handleError() {
      done();
      // ⚠️ **The singleton goes with it, and leaving it in place cost 30 s per
      // remaining card.** A worker that has fired `error` — a chunk that 404s
      // after a deploy, a script that threw on load — will not fire it again,
      // so every later call registered its listeners on a corpse and could only
      // exit through the timeout. A folder of eight PDF cards spent about
      // eighty seconds of the import loop waiting for nothing.
      _pdfWorker = null;
      worker.terminate();
      reject(new Error("PDF worker failed"));
    }
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleError);
    // Transfer the ArrayBuffer to avoid a copy across the thread boundary.
    worker.postMessage({ id, buffer, scale: 1.5 }, [buffer]);
  });
}

/**
 * The one page of an identity card a vision model can look at.
 * (Moved out of `handleOpenIdCard` in Slice #26.10.)
 *
 * A page-group is several scans of ONE document and the card's data side is
 * page 1 — the orphaned `handleCreatePerson` this replaced handled only plain
 * files and threw "Not a scannable file" on a two-page scan. A PDF is
 * rasterised because the extract route sends an image.
 *
 * Throws rather than returning null, and the message is never shown: this is a
 * module-level function with no translator, and the ONE place Romanian may live
 * is `messages/*.json`. The caller catches it and marks the row
 * `personFileUnreadable`, which is the sentence the user actually reads.
 */
async function idCardImage(entry: FSEntry): Promise<File> {
  const handle =
    entry.kind === "page-group"
      ? (entry as FSPageGroupEntry).handles[0]
      : (entry as FSFileEntry).handle;
  if (!handle) throw new Error("id-card-unreadable");

  const file = await handle.getFile();
  if (isPdfFile(file.name)) {
    const blob = await pdfFirstPageBlob(file);
    return new File([blob], `${file.name}.png`, { type: blob.type || "image/png" });
  }
  if (isImageFile(file.name)) return file;
  throw new Error("id-card-unreadable");
}

/**
 * Is this row THE coordinate file — the one a claim may be made about?
 * (Slice #26.10)
 *
 * ⚠️ **`isDeclaredCoordinateFile`, which is STR-08's rule, and NOT
 * `isCoordinateFileName`'s extension shortlist — the row action used the
 * shortlist and an adversarial round is why this one must not.**
 *
 * The two answer different questions and the difference only started to matter
 * when the row stopped offering and started asserting. A BUTTON on a stray
 * `notite.txt` was a click that did nothing; a SENTENCE on it — "colțurile din
 * acest fișier nu au fost preluate" — is the screen telling a business user
 * that a page of notes failed to become geometry. `property-folders.ts` warns
 * against exactly this substitution, and the source document is explicit that
 * other text files under a property folder "will be interpreted as business
 * content". They would also have been hoisted to the head of their folder's
 * block, above the real `coord….txt`, which destroys the one ordering
 * guarantee this screen makes.
 *
 * ⚠️ **And the name branch is confined to a PROPERTY folder**, which a second
 * adversarial round is why. STR-08's one-per-folder rule constrains property
 * folders only, so a `coord 47per2….txt` the user also keeps under `common`
 * breaks nothing — and the property step never considers `common`, so it has no
 * corner-source entry and the row would have said "colțurile din acest fișier
 * nu au fost preluate", which is false on both of the alternatives that
 * sentence offers. It would have been hoisted above `common`'s real documents
 * too.
 *
 * The second half keeps `coordinate-file.ts`'s standing promise that a name
 * ranks and never filters: a file that ACTUALLY built a Property is the
 * coordinate file whatever it is called, and wherever it sits. That is a fact
 * from `cornerSourceByPath`, not a guess from a name — which is the only ground
 * on which this screen is allowed to make a claim at all.
 */
function isCoordinateRow(
  result: ImportResult,
  cornerSourceByPath: ReadonlyMap<string, string> | undefined,
  inPropertyFolder: boolean,
): boolean {
  if (cornerSourceByPath?.has(result.entry.path) === true) return true;
  return (
    inPropertyFolder &&
    result.entry.kind === "file" &&
    isDeclaredCoordinateFile((result.entry as FSFileEntry).name)
  );
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * ⚠️ **`DocTypeRow` AND `fetchDocTypeRows` MOVED OUT IN SLICE #29.08, and the
 * alias below is what keeps this file's 40-odd references reading as they
 * did.** They live in `src/lib/import/document-type-catalogue.ts` now, because
 * the wizard has to read the same list at the end of the classification pass —
 * `checkTypeForms` decides there whether the run may start at all, and the only
 * way it can promise that the type it names is the type THIS file will file a
 * document on is by looking at the same list, fetched the same way. The three
 * guards on that fetch, and the `session-expired` sentinel it throws, are
 * documented on it.
 */
type DocTypeRow = DocumentTypeCatalogueRow;

/**
 * Fetch all active document types.
 * Returns:
 *   - `fallbackId`: the catch-all row's id (used when no type can be resolved)
 *   - `items`: the rows themselves — what #27.05 asks which types have a form,
 *     and, since #29.06, the list `matchDocumentType` matches against
 *
 * ⚠️ **THE TWO INDEXES ARE GONE, AND THAT IS THE FIX RATHER THAN A TIDY-UP.**
 * This used to build `typeMap` (key → id) and `nameMap` (`toLowerCase().trim()`
 * → id), and that lowercased-name index WAS the app's third opinion about when
 * two names are the same name: it folded case and space and not diacritics, so
 * "Contract de arendă" and "Contract de arenda" indexed apart while the server's
 * key generator folded them together — one key, two names, and a create that
 * died on the UNIQUE constraint (finding F7). Matching against the rows
 * themselves, through the one shared rule, is what removes the disagreement;
 * thirty-odd rows scanned per document is not a cost worth an index that can be
 * wrong.
 */
async function fetchDocTypes(): Promise<{
  fallbackId: string;
  items: DocTypeRow[];
}> {
  const items = await fetchDocumentTypeCatalogue();
  if (items.length === 0) {
    throw new Error(
      "Nu există niciun tip de document definit în Date de Referință. " +
      "Adăugați cel puțin un tip înainte de a importa fișiere.",
    );
  }
  // ⚠️ **THE FALLBACK IS STATED NOW, WHERE IT USED TO BE STUMBLED INTO.**
  // (Slice #29.07.) This was `ALTUL` ?? `OTHER` ?? `items[0]`, and **neither key
  // has ever been seeded as a document type** — the only `OTHER` in any SQL in
  // this repository is a `lookup_judicial_person_type`. So the answer was always
  // `items[0]`, and `items[0]` is not "first alphabetically" either: it is
  // NECLASIFICAT, because `listValues` pins UNCLASSIFIED first with an explicit
  // CASE in its ORDER BY (src/lib/admin/value-lists/queries.ts). The right row,
  // for a reason nobody chose — and if that row were ever deleted the fallback
  // would silently become whichever type sorts first alphabetically, and every
  // unclassifiable document in the archive would be filed under it with nothing
  // said.
  const fallback = catchAllType(items);
  if (fallback === null) {
    // ⚠️ **A refusal rather than a substitute, and the sentence names the ONE
    // way back — which is not the obvious one.** This test is on the KEY, so
    // that it survives the rename migration_043 makes; and Reference Data only
    // takes a NAME, from which `slugifyLookupKey` derives the key. So typing
    // "NECLASIFICAT" there produces the key `NECLASIFICAT` and does NOT restore
    // the catch-all. Typing "Unclassified" does: measured against the real
    // `slugifyLookupKey`, it slugs to exactly `UNCLASSIFIED`, and the row can
    // then be renamed (a rename cannot touch the key). An earlier draft of this
    // message said the type could not be added from that screen at all and told
    // the user to contact the administrator — who, in this project, is the
    // person reading the message.
    throw new Error(
      "Tipul de document implicit (cheia UNCLASSIFIED, de obicei „NECLASIFICAT”) lipsește din Date de " +
      "Referință. Importul îl folosește pentru documentele pe care AI nu le poate clasifica. " +
      "Pentru a-l reface: în Date de Referință → Tipuri de documente adăugați un tip numit " +
      "„Unclassified” — cheia se generează din nume, deci va primi cheia UNCLASSIFIED — apoi " +
      "redenumiți-l „NECLASIFICAT” și ștergeți orice alt tip creat între timp cu acest nume.",
    );
  }
  return { fallbackId: fallback.id, items };
}

/**
 * How a row's document type was decided, when that is worth saying.
 *                                                              (Slice #29.06)
 *
 * ⚠️ **`failed` and `unclassified` are DIFFERENT ANSWERS and the whole slice is
 * about not confusing them.** Both end with the document on the catch-all type;
 * one means the model could not classify the document, the other means it
 * classified it perfectly well and the type row could not be written. Before
 * this slice both were `return fallbackId` out of a bare `catch {}`, so the
 * result screen — and Adrian, reading it — had no way to tell a mis-filed
 * document from an unclassifiable one. That is finding F1.
 *
 * `matched` is deliberately absent from the union: the ordinary ending needs no
 * sentence, and a row carrying no `typeResolution` at all is one where nothing
 * happened worth reporting.
 */
type TypeResolution = "created" | "adopted" | "unclassified" | "failed";

type EnsuredDocType = {
  /** Always a usable id — the resolved type, or the caller's fallback. */
  id: string;
  outcome: "matched" | TypeResolution;
  /**
   * The row this call brought into the run's knowledge — for `created`,
   * `adopted` and a server-side `matched` alike.
   *
   * ⚠️ **It is NOT the test for "this run created it", and a third review round
   * is why that has to be said here.** `adopted` means the resolver lost a race
   * and its next round found the row somebody else had committed — a second
   * tab, an overlapping in-process `ai-interpret`, or (since Slice #29.07) two
   * files OF THIS RUN whose answers carry one canonical key and two different
   * labels, which the resolver's advisory lock does not serialise because it is
   * keyed on the label. Recording an adopted row as this run's creation is how
   * the summary comes to name somebody else's type as
   * "created in this import and left empty" and invite Adrian to delete it,
   * over a delete #29.05 refuses because the other writer's document depends on
   * it. So the caller gates `rememberCreatedType` on the OUTCOME and uses this
   * only for what is true of all three: the name is now known to the run.
   */
  row?: DocTypeRow;
};

/**
 * Resolve a document type id for an entry, through the one writer.
 *                                                    (Slice #21.02, #29.06)
 *
 * 1. Match against the types this run has read, using `matchDocumentType` —
 *    key first, then name, with ONE rule about when two names are one name.
 * 2. No usable label → the caller's fallback, said out loud as `unclassified`.
 * 3. Otherwise ask the server to resolve it: `POST /api/document-types/resolve`
 *    matches again and, if it still finds nothing, creates the row — winning
 *    the race by adopting whatever a concurrent create committed instead.
 * 4. Anything else → the fallback, said out loud as `failed`.
 *
 * ⚠️ **THE MODULE-LEVEL CACHE IS GONE, AND ITS REMOVAL IS THE FIX FOR ITS OWN
 * COMMENT.** `autoCreatedTypeCache` described itself as "session-scoped … so
 * the same label is not created more than once during a single import run" and
 * was a module `const` that nothing ever cleared: it outlived the dialog
 * unmounting, outlived the run, and outlived every run for the life of the
 * page. Since #29.04 made deletes real that stopped being a curiosity — a type
 * deleted between two runs left a stale id in it that the second run would
 * happily file documents under, and the FK would refuse them. What gives the
 * behaviour the scope the comment claimed is not a smaller cache but the list
 * the run already holds: `items` is read once per run, is appended to here, and
 * dies with the run. One structure, with the scope the old comment claimed.
 *
 * ⚠️ **That is a claim about SCOPE, not about freshness, and a fifth review
 * round trimmed the sentence that blurred them.** The list is read once at the
 * start of a run and never re-read, so a type deleted from Reference Data
 * mid-run still matches locally and `createDocument` then fails on the foreign
 * key — the same shape the cache used to produce ACROSS runs, narrowed to
 * within one. Narrowing it is the fix this slice owed; closing it entirely
 * means re-reading the list per document, which is a round trip per file to
 * defend against an administrator deleting a type during his own import.
 *
 * ⚠️ **`session-expired` propagates rather than being swallowed.** It is the
 * sentinel `createDocument` and `uploadPage` throw, and the per-task catch turns
 * it into the amber banner with the sign-in link. The old bare `catch {}` ate
 * it and filed the document under the catch-all, which is a permanent wrong
 * answer produced by a transient and recoverable condition.
 */
async function ensureDocType(
  answer:     ClassifierAnswer,
  items:      DocTypeRow[],
  fallbackId: string,
): Promise<EnsuredDocType> {
  const resolution = resolveAgainstTypes(items, answer);
  // ⚠️ **ONE call, and a third review round is why it is not two.** This used
  // to ask `matchDocumentType` and then `classifiedLabelOf`, and then grew a
  // third test of its own — "a match landing on `fallbackId` is really an
  // unclassified document" — which was measured DEAD (the fallback IS the
  // catch-all row, which `matchDocumentType` already refuses; since #29.07 that
  // holds by construction rather than by there being no ALTUL row) and, in the
  // one archive where it
  // would have fired at all, would have printed "the AI could not tell" over
  // every document the AI classified perfectly. A rule that is three calls is
  // a rule three callers compose differently.
  if (resolution.kind === "match") return { id: resolution.row.id, outcome: "matched" };
  if (resolution.kind === "declined") return { id: fallbackId, outcome: "unclassified" };
  const label = resolution.name;

  let res: Response;
  try {
    res = await fetch("/api/document-types/resolve", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ typeKey: answer.typeKey ?? null, label: answer.label ?? null }),
    });
  } catch {
    // ⚠️ **The browser's own "Failed to fetch" is a FAILED RESOLUTION, not a
    // failed row, and a third review round caught the rewrite losing this.**
    // The code this replaced wrapped its POST in `catch { /* ignore */ }`; the
    // first draft of the rewrite tested the RESPONSE and left the rejection to
    // propagate — so a two-second Wi-Fi drop at file 87 of 200 aborted the task
    // before `createDocument` ran, put no Document in the archive at all, and
    // printed the English string "Failed to fetch" onto a Romanian screen and
    // into the permanent report. A dropped connection is named in
    // `OutcomeRow.typeCreateFailed`'s own docblock as one of the three things
    // that note exists for; it must reach it.
    return { id: fallbackId, outcome: "failed" };
  }
  // ⚠️ **The same two tests `fetchDocumentTypeCatalogue` makes — which is MORE than the
  // loop's other calls make, and a fifth review round corrected a comment that
  // said otherwise.** `createDocument`, `uploadPage` and the property link all
  // test `res.redirected` alone; only the type-list GET also checks for a 401
  // and for a rewritten 200 carrying a sign-in PAGE. This call is a GET's twin
  // in that respect — it is the one that decides where a document is FILED —
  // so it gets the stronger pair, and the same `session-expired` sentinel the
  // per-task catch turns into the amber banner with the sign-in link.
  if (isSessionLoss(res) || (res.ok && servesHtml(res))) throw new Error("session-expired");
  if (!res.ok) return { id: fallbackId, outcome: "failed" };

  const body = (await res.json().catch(() => null)) as
    | { outcome?: unknown; id?: unknown; key?: unknown; name?: unknown }
    | null;
  if (!body || typeof body.id !== "string" || body.id.length === 0) {
    // ⚠️ **A server `unclassified` is UNCLASSIFIED, not failed, and a fourth
    // review round caught the row lying about it.** It is the one legitimate
    // 200 with no id, and it IS reachable even though the local pass ruled it
    // out: the client reads the type list once per run while the resolver
    // re-reads on every call, so renaming the catch-all from Reference Data
    // mid-import puts every later declining document down this path. Reporting
    // it as `failed` printed "AI a stabilit tipul documentului, dar acel tip nu
    // a putut fi creat" over a document about which the AI decided nothing.
    if (body && body.outcome === "unclassified") {
      return { id: fallbackId, outcome: "unclassified" };
    }
    // Anything else here is a 200 this client cannot read — no body, no id, an
    // outcome it does not know. That is a failure and must say so: it is the
    // one shape the old code treated as "fall through to the fallback" with
    // nothing recorded (`if (res.ok)` then `if (row.id)` with no else), which
    // on screen is indistinguishable from a document nobody could classify.
    return { id: fallbackId, outcome: "failed" };
  }

  const row: DocTypeRow = {
    id:   body.id,
    key:  typeof body.key  === "string" ? body.key  : "",
    // ⚠️ **The SERVER's name where it gave one, and OUR label as the floor —
    // never the empty string.** An adopted row carries whichever spelling the
    // racer wrote, and everything downstream that prints a type name must print
    // the one Reference Data holds. But a name of `""` would be worse than
    // wrong: `sameDocumentTypeName` refuses an empty normalised form, so such a
    // row would sit in `items` matching nothing, and every later document of
    // the same label would ask the server again.
    name: typeof body.name === "string" && body.name.trim() !== "" ? body.name : label,
  };
  // Appended so the next entry of the same label matches locally — the job the
  // deleted cache was doing, done by the list that is already per-run. Guarded
  // against a double entry, which the `matched-*` endings below can produce:
  // the server can resolve a type this client's list does not hold, and a
  // retry of the same label would otherwise add it twice.
  if (!items.some((item) => item.id === row.id)) items.push(row);

  // ⚠️ **`matched-key` and `matched-name` are NOT `created`, and collapsing
  // them would make the run claim types it did not make.** The server can match
  // a type this client has never read — one Adrian added in another tab, or one
  // a concurrent run created — and reporting that as `created` would put a type
  // somebody else owns into `createdTypes`, and from there into "created in
  // this import and left empty" on the result screen. `matched` is the honest
  // answer: the id is good, the row is now in the list, and this run created
  // nothing.
  if (body.outcome === "created" || body.outcome === "adopted") {
    return { id: row.id, outcome: body.outcome, row };
  }
  return { id: row.id, outcome: "matched", row };
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

/**
 * Remove a Document whose first page never landed.              (Slice #32.05)
 *
 * ⚠️ **THE DEFECT THIS CLOSES: "Document objects created but without the
 * scanned image uploaded" (Adrian, from his own UAT).** The Document is created
 * at step 3 and its pages are uploaded at step 4, and four things in between
 * can throw — `claimCornerSource` on a conflict, `handle.getFile()` when the
 * file has moved or the folder permission lapsed, `uploadPage` on any non-OK
 * response and on the `session-expired` sentinel, and the unmount that breaks
 * the page loop. The per-task `catch` marks the ROW as an error and nothing
 * removed the Document, so the archive kept a record nobody can ever see the
 * scan of, and no screen in the system says it is empty.
 *
 * ⚠️ **IT SWALLOWS EVERY THROW AND REPORTS EVERY REFUSAL, and an adversarial
 * round is why the two are not the same thing.** It is called from a `catch`
 * that is about to re-throw the real failure, so an error raised here would
 * replace the reason the import failed with the reason the tidy-up failed —
 * the less useful of the two every time. But the first draft ignored the
 * RESPONSE as well, and that hid the commonest case of all: `uploadPage` throws
 * `session-expired` precisely because the POST redirected to sign-in, and the
 * DELETE one line later redirects too. `fetch` resolves, nothing throws, the
 * document stays — and the fix reported success over a run that had left an
 * orphan behind on every file in the folder. A 403, a 404 and a 500 read the
 * same way. So the answer comes back as a boolean and the row says which of the
 * two happened.
 *
 * ⚠️ **IT BURNS A DOC CODE, and that is accepted rather than overlooked.**
 * `DELETE /api/documents/[id]` retires the code the Document held; it is never
 * reused. A folder whose handles have all gone stale therefore creates and
 * deletes N documents and spends N codes. The alternative is N records nobody
 * can see a scan of, which is worse in the direction that matters: a code is a
 * number, and an invisible document is a lie about the archive.
 *
 * ⚠️ **AND IT IS ONLY EVER CALLED FOR A DOCUMENT THIS TASK CREATED SECONDS
 * AGO, WITH NO PAGES.** That is what makes a DELETE safe here and nowhere else
 * in this file: `DELETE /api/documents/[id]` takes the pages, the versions, the
 * junctions and the `principal_object` row with it, and it releases the
 * `property_corner_source` claim by cascade — which is right, because that
 * claim points at a document that is about to stop existing, and the next run
 * must be able to make it again.
 */
async function discardEmptyDocument(documentId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/documents/${documentId}`, { method: "DELETE" });
    // `!res.redirected` as well as `res.ok`: a middleware redirect to /sign-in
    // answers 200 with an HTML page, which `res.ok` alone reads as success.
    return res.ok && !res.redirected;
  } catch {
    // See the header: the caller has a better error than this one.
    return false;
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
  formsWaived,
  cornerSourceByPath,
  properties,
  onFirstDocumentCreated,
  onRunFinished,
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
  /**
   * ⚠️ A `useCallback`, and #26.10 is what forced it. While the only reader was
   * the row's own render this could be a plain arrow; the saved report now reads
   * it too, from inside `handleSaveReport`'s dependency list, and a fresh
   * function identity on every render there rebuilds that callback on every
   * render as well. `tw` is stable per namespace, so this one never changes.
   */
  const confidenceNoteFor = useCallback(
    (confidence?: "high" | "medium" | "low"): { title: string; body: string } | null =>
      confidence === "low"
        ? { title: tw("scanConfidence.titleLow"), body: tw("scanConfidence.bodyLow") }
        : confidence === "medium"
          ? { title: tw("scanConfidence.titleMedium"), body: tw("scanConfidence.bodyMedium") }
          : null,
    [tw],
  );
  const tprov = useTranslations("adminImport.provenance");
  /**
   * The result screen's own namespace: the saved report and the statistics.
   * (Slice #26.10)
   *
   * Separate from `importDialog` because the concluding message the wizard
   * shows after this dialog closes reads the SAME labels, and a summary line
   * whose wording lives under "the dialog that is no longer on screen" is a
   * wording that gets edited in one of the two places.
   */
  const tres = useTranslations("adminImport.result");
  const locale = useLocale();
  const router = useRouter();
  // Slice #27.05 — only so a form accepted here shows up on the screens that
  // cache the type list (the document form, Reference Data). This dialog reads
  // the list itself and does not depend on the cache.
  const queryClient = useQueryClient();

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

  /**
   * The identity cards this run queued, keyed by entry path.   (Slice #26.10)
   *
   * A ref filled during the loop and published once, for both the reasons
   * `partyStepsRef` below carries: three tasks finish in whatever order their
   * files allow, so appending to state would queue them in completion order,
   * and a `setState` per finished task would re-render the table mid-import for
   * a queue nothing is reading yet.
   */
  const idCardStepsRef = useRef<Map<string, IdCardStep>>(new Map());
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
   * The document TYPES this run read a proposed form for.   (Slice #27.05)
   *
   * Keyed by type id rather than by path, because that is what "one discovery
   * per type per run" means and a map keyed the other way could not express it.
   * A ref for both the reasons the two above are: three tasks settle in
   * whatever order their files allow, and nothing reads this until the run
   * ends.
   */
  const discoverStepsRef = useRef<Map<string, DiscoverStep>>(new Map());
  /**
   * The types a task has CLAIMED the run's one discovery read for.
   * (Slice #27.05)
   *
   * ⚠️ **A separate set from `discoverStepsRef`, and it is the whole
   * concurrency guard.** Three tasks are in flight; two documents of the same
   * brand-new type finish within a second of each other; both test the map,
   * both find it empty — because the entry is only written when the read
   * RETURNS, tens of seconds later — and the run pays twice for a proposal it
   * can only show once. The claim is made synchronously, before the await, so
   * the check and the claim cannot be interleaved. It also holds types whose
   * read FAILED, deliberately: a rate limit that killed the first attempt is
   * not a reason to spend three more inside the same run.
   */
  const discoverClaimedRef = useRef<Set<string>>(new Set());
  /**
   * Which document types had a form when the run started, by id.
   * (Slice #27.05)
   *
   * ⚠️ **An ABSENT id means "no form", and that is correct rather than
   * convenient**: the ids this map does not have are the types created during
   * the run — by `ensureDocType`, or by the route re-classifying a document
   * onto a type it invented — and a type created mid-run has no form by
   * construction.
   */
  const docTypeFormRef = useRef<Map<string, boolean>>(new Map());
  /**
   * Which document types ARE the identity-card type, by id.   (Slice #27.05)
   *
   * ⚠️ **A fact about the TYPE, which is the axis the rule actually needs** —
   * see `typeIsIdCard` in `discover-run.ts` for the two ways the scan's own
   * signal comes apart from it. `ID_CARD_TYPE_KEYS` is the seeded key;
   * `isIdCardTypeName` is the NAME test, and it is deliberately NARROWER than
   * the scan's own `isIdCardLabel` — see that function's header for the type
   * names ("Buletin de analiză", "Copie CI") the wider heuristic would have
   * silently cost a form.
   *
   * ⚠️ **An ABSENT id means "not known", not "not a card"**, and it is the hole
   * a fourth adversarial round found: this map is built once, from the
   * start-of-run list, so a type created DURING the run is not in it and the
   * caller falls back to the scan's own signal — which is exactly the signal
   * that is false on a card the scan mislabelled and the route then invented a
   * type for. The read is lost to that; the permanent write is not.
   * `enrichDiscoverSteps` asks the same question again of the name the SERVER
   * holds, which is the only place that name exists, and drops the step.
   */
  const docTypeIdCardRef = useRef<Map<string, boolean>>(new Map());
  /**
   * The fallback document type's id — the catch-all row (`catchAllType`).
   * (Slice #27.05; the rule moved to one place in #29.07)
   *
   * In a ref because the loop's own copy is a local of the effect, and
   * `handleRetryInterpret` — which since #27.05 has to ask the same question
   * about the same type — lives outside it. Null until the list has been read;
   * `typeAwaitsForm` treats that as "the fallback is not known", which is the
   * safe direction (it refuses nothing it would otherwise refuse, and the type
   * still has to have no form).
   */
  const fallbackTypeIdRef = useRef<string | null>(null);
  /**
   * The same id, in state, for the one reader that is a RENDER. (Slice #29.06)
   *
   * `outcomeRowOf` has to know whether a row is still sitting on the catch-all
   * before it will say the type create failed, and it runs inside a `useMemo`.
   * A ref read there is what `react-hooks/refs` forbids and what the two
   * comments above this one already argue about `typeNames` and `runTypes`.
   * Written once, in the same breath as the ref, from the same value.
   */
  const [fallbackTypeId, setFallbackTypeId] = useState<string | null>(null);
  /**
   * Every document type name the server holds, for the review dialog's
   * duplicate-name refusal.   (Slice #27.05, feeding #27.04's new-type path.)
   *
   * ⚠️ **STATE, not a ref, and two adversarial findings put it here.** It is
   * read in the render that mounts the review dialog, and `react-hooks/refs`
   * rightly bans a render depending on a ref's value — the same argument
   * `DiscoverReviewDialog` records for its own `baseline`. And it CHANGES while
   * the queue is being walked: #27.04's path creates a type from inside the
   * dialog, so a second step opened against a list captured before that would
   * refuse nothing and let two `lookup_document_type` rows exist with the same
   * display name — precisely what `sameTypeName` was written to prevent.
   */
  const [typeNames, setTypeNames] = useState<string[]>([]);
  /**
   * A name a review step has just created, folded in without a round trip.
   * (Slice #27.05)
   *
   * Appended rather than re-fetched because the refusal must hold for the VERY
   * NEXT step in the same queue, and a list that is a request behind is a list
   * that agrees with the server about everything except the row it just made.
   * Duplicates in the array are harmless — `sameTypeName` is a search.
   */
  /**
   * These types are identity cards after all — take back the sentence.
   *                                                              (Slice #27.05)
   *
   * See `EnrichResult.idCardTypeIds`. The rows keep their `documentTypeId` and
   * everything else; what goes is the claim that a form is owed, which for this
   * type is the one claim that must never be made.
   */
  const forgetTypeFormMissing = useCallback((typeIds: readonly string[]) => {
    if (typeIds.length === 0) return;
    const ids = new Set(typeIds);
    setResults((prev) =>
      prev.map((r) =>
        r.documentTypeId !== undefined && ids.has(r.documentTypeId)
          ? { ...r, typeFormMissing: undefined }
          : r,
      ),
    );
  }, []);

  const rememberTypeName = useCallback((name: string) => {
    const trimmed = name.trim();
    if (trimmed === "") return;
    setTypeNames((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  }, []);
  /**
   * The document types this RUN brought into existence.        (Slice #29.06)
   *
   * ⚠️ **Recorded so the screen can report a type that ends the run with no
   * documents on it**, which is the narrow half of finding F4 this slice can
   * close. A type is created for a document, the document's own creation then
   * fails — or the AI read re-classifies it onto something more specific — and
   * the `lookup_document_type` row is left behind with no documents, no form
   * and no explanation. Re-typing a document after a fuller read is correct
   * behaviour; leaving the first type behind in silence is not.
   *
   * ⚠️ **STATE rather than a ref, for the reason `typeNames` above records:**
   * the summary block reads it during a render.
   *
   * ⚠️ **This is what the RUN created, not what the archive holds.** A type
   * that already existed and that this run merely matched is nobody's here —
   * an empty type Adrian created himself last month is not this screen's
   * business, and claiming it would be the report inventing work.
   */
  const [createdTypes, setCreatedTypes] = useState<{ id: string; name: string }[]>([]);
  const rememberCreatedType = useCallback((row: { id: string; name: string }) => {
    setCreatedTypes((prev) =>
      prev.some((t) => t.id === row.id) ? prev : [...prev, { id: row.id, name: row.name }],
    );
  }, []);
  /**
   * What this run knows about each document TYPE it has seen: its name, and
   * whether it had a form before and after.                      (Slice #27.07)
   *
   * ⚠️ **STATE, not a ref, for the reason `typeNames` above is** — the header
   * draws sentences out of it, and a render may not depend on a ref's value.
   * `docTypeFormRef` beside it stays a ref because nothing renders it: it is
   * read inside the tasks and the handlers to decide whether to SPEND a billed
   * discovery read, which is a different question from what the screen says.
   *
   * ⚠️ **A `Record`, not a `Map`, and not because Maps are unfashionable.**
   * State is replaced rather than mutated, and a `Map` in state invites exactly
   * the `.set()`-then-`setState(same-reference)` that renders nothing; an object
   * spread cannot be written that way by accident.
   *
   * ⚠️ **`hasForm` is raised by THIS RUN'S acceptance and by nothing else.**
   * `enrichDiscoverSteps` re-reads the whole type list, so it can see a type
   * that gained a form in another tab — and folding that in would put its name
   * under "a primit un formular în acest import" over work nobody did here.
   * `mergeServerTypes` therefore refreshes NAMES for a type already known and
   * only ever ADDS an unknown one, with `hadForm === hasForm` so it claims
   * nothing about a before it never saw. See `RunTypeFormChange`.
   */
  const [runTypes, setRunTypes] = useState<
    Record<string, { name: string; hadForm: boolean; hasForm: boolean }>
  >({});
  /**
   * Fold a fresh server type list into `runTypes`.               (Slice #27.07)
   *
   * Names win from the server every time — it is the only place a type invented
   * mid-run has one, and a rename in Reference Data mid-run should reach the
   * backlog sentence rather than leave it naming something the user can no
   * longer find. The two booleans do not: see the field's own header for which
   * "gained a form" this run is allowed to claim.
   */
  const mergeServerTypes = useCallback(
    (rows: readonly { id: string; name: string; hasForm: boolean }[] | null) => {
      if (rows === null || rows.length === 0) return;
      setRunTypes((prev) => {
        const next = { ...prev };
        for (const row of rows) {
          const known = next[row.id];
          next[row.id] =
            known === undefined
              ? { name: row.name, hadForm: row.hasForm, hasForm: row.hasForm }
              : { ...known, name: row.name };
        }
        return next;
      });
    },
    [],
  );
  /**
   * A type gained a form while this run was going on, but NOT from it.
   *                                                              (Slice #27.07)
   *
   * Somebody else's session, or the same user in another tab — quite possibly
   * through the Reference Data filter this very slice adds.
   *
   * ⚠️ **NOT `forgetTypeFormMissing`, and an adversarial round found exactly
   * what the difference costs.** That one takes back a claim and leaves nothing
   * behind, which is right for an identity card: there is no form coming and
   * nothing to re-read into. Here there IS a form now, and twelve documents
   * whose type-specific values went to Notes while it did not exist. Clearing
   * the flag alone drops them out of the row notes, out of `awaitsRefill`, out
   * of `documentsAwaitingRefill` and out of `refillCount` — so no control is
   * drawn — and the concluding message then describes a fully landed run over
   * twelve documents with empty columns. That is the precise failure
   * `documentsAwaitingRefill` was created in #27.06 to stop.
   *
   * ⚠️ **`typeFormAdded` is NOT set, and it is the term that looks missing.**
   * That flag draws "tipul acestui document a primit un formular în acest
   * import", and this import did no such thing. The row is left saying only
   * what is true — that it has not been read again, so its information is still
   * in Notes — which is `refillPending`'s own sentence.
   *
   * The narrowing is `handleDiscoverSaved`'s, term for term and for its
   * reasons: `typeFormMissing === true` is the set that may be told a form
   * arrived, and `docId` is what `awaitsRefill` is allowed to assume.
   */
  const formArrivedElsewhere = useCallback(
    (rows: readonly { id: string; hasForm: boolean }[] | null) => {
      if (rows === null) return;
      const withForm = new Set(rows.filter((row) => row.hasForm).map((row) => row.id));
      if (withForm.size === 0) return;
      setResults((prev) =>
        prev.map((r) =>
          r.typeFormMissing === true &&
          r.documentTypeId !== undefined &&
          withForm.has(r.documentTypeId)
            ? {
                ...r,
                typeFormMissing: undefined,
                ...(r.docId !== undefined
                  ? { refill: "pending" as const, refillErrorDetail: undefined }
                  : {}),
              }
            : r,
        ),
      );
    },
    [],
  );
  /**
   * Everything a fresh type-list read tells the rest of the screen.
   *                                                              (Slice #27.07)
   *
   * ⚠️ **One function because there are FOUR call sites**, which is the habit
   * this codebase names in as many words: centralise a rule at the third copy
   * site, not the fourth. The end-of-run enrichment, `handleReviewTypes`, and
   * the retry's preflight and its second read all enrich the same queue from
   * the same GET, and all four owe the same follow-ups; before this slice each
   * restated one of them by hand, and #27.07 was about to make that four each.
   *
   * `names` is deliberately NOT folded in here: ONE of the four does something
   * extra in that branch — `handleReviewTypes` clears the session banner off the
   * fact that its GET went through, gated on `sessionLossSeqRef` — and hiding a
   * conditional it would then have to re-test outside would be trading one
   * duplication for the loss of the only thing that stops a signed-in user being
   * told to sign in again.
   */
  const absorbTypeList = useCallback(
    (enriched: EnrichResult) => {
      /**
       * ⚠️ **THE REFS FIRST, AND THIS IS THE HALF THAT WAS MISSING.** Two
       * adversarial rounds landed on the same defect independently: this
       * enrichment is the only thing in the run that reads the SERVER's list,
       * and its findings were being spent on the rows and thrown away. The two
       * refs beside it — the ones `typeAwaitsForm` and `shouldDiscoverType`
       * actually ask — were written once at the start of the run and once on
       * acceptance, and never here.
       *
       * What that cost: the user builds a type's form in another tab (through
       * the Reference Data filter this very slice adds), then presses the retry
       * on a row whose first read was rate-limited. `docTypeFormRef` still says
       * the type has no form, so the retry writes "tipul acestui document nu
       * are încă formular" back onto the row, `typesWithoutForm` counts the
       * type again, and #27.07 NAMES it — permanently, in the saved report —
       * over a type that has a form. The user follows the sentence to Reference
       * Data, ticks the box, and it is not in the list. And because the step was
       * deleted by this same enrichment, nothing can take the claim back.
       *
       * Refreshing the refs closes it on every path at once — including the two
       * where no enrichment runs at all, because `shouldDiscoverType` and
       * `typeAwaitsForm` then read current knowledge — and stops a billed
       * discovery being spent on a type that already has a form.
       *
       * ⚠️ **Raised to `true` and never lowered.** A type that has a form is
       * exactly what these two refs are consulted about, and both already treat
       * an absent id as the negative — see their headers. Writing `false` back
       * for every formless type would be a claim about types this run has never
       * met, made from a list read for another purpose.
       */
      for (const row of enriched.typeRows ?? []) {
        if (row.hasForm) docTypeFormRef.current.set(row.id, true);
      }
      for (const id of enriched.idCardTypeIds) docTypeIdCardRef.current.set(id, true);

      // ⚠️ **The identity cards before the form-arrived queue.** Both are
      // functional `setResults` updaters, so the second is applied to what the
      // first produced whether or not React batches them — the ordering is what
      // stops a type in both lists being queued for a billed re-read of a card
      // the run deliberately did not read. Defensive rather than load-bearing
      // today: `enrichDiscoverSteps` tests the form BEFORE the card, so an id
      // with a form never reaches `idCardTypeIds` and the two sets are disjoint
      // by construction. It is written this way round because the disjointness
      // lives in another function and nothing tests it.
      forgetTypeFormMissing(enriched.idCardTypeIds);
      mergeServerTypes(enriched.typeRows);
      formArrivedElsewhere(enriched.typeRows);
    },
    [forgetTypeFormMissing, formArrivedElsewhere, mergeServerTypes],
  );
  /**
   * How many proposed forms are still waiting to be looked at.
   * (Slice #27.05)
   *
   * State beside the ref, for the reason the header exists at all: a ref no
   * render subscribes to cannot decide whether to draw a control. It is set
   * where the ref is written and nowhere else.
   */
  const [discoverBacklog, setDiscoverBacklog] = useState(0);
  /**
   * What #27.04's new-type path did on the server, recorded while its dialog is
   * still mounted and applied when it closes.   (Slice #27.05)
   *
   * A ref rather than state for the reason `document-form.tsx` gives for its
   * own: this must not repaint anything until the dialog is gone.
   */
  const pendingNewTypeRef = useRef<NewTypeProgress | null>(null);
  /**
   * Part-finished new-type runs, in words.   (Slice #27.05)
   *
   * ⚠️ **A LIST, and an adversarial round is why.** One slot meant a second
   * part-finished step in the same queue silently replaced the first, and each
   * of these describes a DIFFERENT type left in a different state on the
   * server — a type created with no form, a document that may or may not have
   * been moved. None of them is superseded by a later one, and none is undone
   * by a later step succeeding, so none of them is cleared.
   */
  const [typeWarnings, setTypeWarnings] = useState<string[]>([]);
  /** The review-types control is mid-fetch — see `handleReviewTypes`. (#27.05) */
  const [reviewingTypes, setReviewingTypes] = useState(false);
  /**
   * Why the last press of that control could not open anything, or null.
   * (Slice #27.05)
   *
   * Separate from `typeWarnings` because it is the opposite kind of thing: a
   * transient the next press can clear, rather than a permanent state left on
   * the server. Cleared at the start of every press.
   */
  const [reviewTypesError, setReviewTypesError] = useState<string | null>(null);
  /**
   * How far the re-read has got, or null when none is running. (Slice #27.06)
   *
   * ⚠️ **ONE state rather than a `refillRunning` boolean beside a counter**, so
   * "is a billed read in flight" and "how far through" cannot come apart — the
   * pair `canRetryReads` exists because two expressions answering one question
   * disagreed three rounds running. `null` IS the boolean.
   *
   * The walk is serial, so `done` is the number of documents that have settled
   * and `total` is what the click was priced at. `total` is captured at the
   * click and never recomputed: the header sentence promised a number and the
   * progress line has to be counting towards that same one.
   */
  const [refillProgress, setRefillProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  /**
   * A billed read on a settled row has STARTED, whether or not React has
   * re-rendered yet.   (Slice #27.06)
   *
   * ⚠️ **A REF where every sibling guard on this screen is state, and the
   * difference is what a double-fire costs.** `canRetry`, `canRefill` and
   * `reviewingTypes` are all render-time values, so a closure made before the
   * commit still sees the old one: two clicks landing in the SAME FRAME both
   * pass. For `handleReviewTypes` that costs a second GET, which is why #27.05
   * left it at state. Here it costs a billed model call and a
   * `document_version` row per document — and an adversarial round pointed out
   * that the window is open in BOTH directions, because `handleRetryInterpret`
   * has no synchronous guard of its own either: retry row X, then press the
   * re-read before the commit, and two `runAiInterpret` calls race on one
   * `documentId`. Two PATCHes, two version rows, and the later one's
   * `customFields` merge built from a GET taken before the earlier one landed.
   *
   * So it is ONE ref, claimed by whichever handler gets there first and released
   * in that handler's `finally`. `readRunning` below is the render-time view of
   * the same fact and is what actually draws the screen; this is only for the
   * frame that view has not reached yet.
   */
  const readRunningRef = useRef(false);
  /**
   * How many times a call has reported the session GONE.   (Slice #27.06)
   *
   * ⚠️ **A counter rather than a boolean, and it exists to stop a STALE success
   * clearing a FRESH failure.** `handleReviewTypes` clears `sessionExpired` when
   * its GET comes back — the session is demonstrably alive, and #27.05 needed
   * that because in its own failure shape nothing else can ever clear the flag.
   * But that GET can be issued before a walk or a retry starts and return after
   * one of them has hit a 401, and then a two-second-old "it was fine" pulls the
   * banner down over a session that is dead. A third adversarial round showed
   * the obvious guard — "not while a read is running" — is wrong in the other
   * direction: it also suppresses the clear when the concurrent read fails for
   * an ordinary reason like a 429, and the signed-in user is then told to sign
   * in again with nothing left that can take it back.
   *
   * The question either guard was reaching for is "has anything said the session
   * is dead SINCE I asked?", and that is what a sequence number answers exactly.
   * Raised only through `raiseSessionExpired` below, so it cannot fall behind.
   */
  const sessionLossSeqRef = useRef(0);
  /**
   * Say the session has gone, and record that something said so.
   *
   * Every `setSessionExpired(true)` that can run CONCURRENTLY with the review
   * GET goes through here — the walk and the retry. The run loop's own sites do
   * not: they fire before `done`, and the control that reads the counter is not
   * drawn until after it.
   */
  const raiseSessionExpired = useCallback(() => {
    sessionLossSeqRef.current += 1;
    setSessionExpired(true);
  }, []);
  /**
   * Is a follow-up queue open right now?   (Slice #27.05)
   *
   * A mirror of `followUps.length > 0` that an async handler can read AFTER its
   * await. `currentFollowUp` is captured when the closure is made, which is
   * exactly one render too early to answer this question.
   */
  const followUpsOpenRef = useRef(false);
  /**
   * Is this dialog still on screen?   (Slice #26.09)
   *
   * A ref rather than the effect's local `mounted`, because the retry handler
   * is a `useCallback` outside that effect and its await is a model call.
   */
  const mountedRef = useRef(true);
  const [followUps, setFollowUps] = useState<FollowUpStep[]>([]);
  const [followUpIndex, setFollowUpIndex] = useState(0);
  /** Saving the take-away report is a decision the screen remembers. */
  const [reportSaved, setReportSaved] = useState(false);

  /**
   * The Properties this run resolved, by id.   (Slice #26.10)
   *
   * Read by the coordinate note, which names the Property a file's corners
   * built, and by the saved report, which links to each one.
   */
  const propertyById = useMemo(() => {
    const map = new Map<string, ResolvedProperty>();
    for (const property of properties) map.set(property.id, property);
    return map;
  }, [properties]);

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
    idCardStepsRef.current = new Map();
    // Slice #27.05 — fresh for THIS invocation, exactly as the two above are:
    // in development StrictMode runs the effect twice, and a claim that
    // survived the first would make the second run skip every discovery.
    discoverStepsRef.current = new Map();
    discoverClaimedRef.current = new Set();
    // Slice #26.03 — see the `onFirstDocumentCreated` prop. Local to this run,
    // so a StrictMode re-mount re-announces for its own first document rather
    // than staying silent because a discarded run had already spoken.
    let announcedFirstDocument = false;
    /**
     * Tell the wizard this run has put a Document in the archive. (#32.05)
     *
     * ⚠️ **ONE FUNCTION, FOUR CALL SITES, AND IT IS IDEMPOTENT BY THE FLAG
     * ABOVE.** It is called from every place a Document is known to have
     * survived: after the pages landed; from the catch when a partial page
     * group is kept; from the catch when the tidy-up DELETE was refused; and
     * from the unmount path, where the same refusal is possible and there is
     * nobody left on screen to tell. The thing it feeds is the Cancel
     * confirmation's account of what this run would leave behind, so a missed
     * call is a user consenting to something they were not told, and a spurious
     * call is a warning about records that do not exist. Neither is free; four
     * explicit calls are how both are avoided, and a third adversarial round is
     * why the fourth is there.
     *
     * ⚠️ Announced through a ref so answering it cannot re-run this effect.
     */
    const announceFirstDocument = (): void => {
      if (announcedFirstDocument) return;
      announcedFirstDocument = true;
      firstDocumentRef.current?.();
    };
    let fallbackDocTypeId: string;
    /**
     * Every document type this run knows about — read once, appended to by
     * `ensureDocType`, and dead when the run is.               (Slice #29.06)
     *
     * ⚠️ **This is where the deleted `autoCreatedTypeCache` went.** That cache
     * was a module `const` claiming to be session-scoped and cleared by
     * nothing; this array is a local of the effect, so a second run — or a
     * StrictMode re-invocation — starts from what the server actually holds
     * rather than from what a previous run remembered creating. See
     * `ensureDocType`.
     */
    let docTypeItems: DocTypeRow[] = [];

    async function run() {
      // fetchDocTypes throws with a Romanian error if no types exist.
      const { fallbackId, items } = await fetchDocTypes();
      // ⚠️ **The `mounted` test comes FIRST here**, ahead of every ref write
      // below it — the rule this file states twice about the queue refs, and an
      // adversarial round caught these four outside it. In StrictMode a
      // discarded first invocation resolving late would otherwise overwrite the
      // live one's `docTypeFormRef`, `docTypeIdCardRef` and `fallbackTypeIdRef`
      // — the three maps that decide which types get a billed read and which
      // rows say a form is missing.
      if (!mounted) return;
      fallbackDocTypeId = fallbackId;
      fallbackTypeIdRef.current = fallbackId;
      // Slice #29.06 — STATE as well as the ref, because `outcomeRowOf` reads
      // it during a render to decide whether a row is still sitting on the
      // catch-all, and `react-hooks/refs` rightly bans a render depending on a
      // ref's value. The ref stays for the handlers, which is what it is for.
      setFallbackTypeId(fallbackId);
      // ⚠️ **A COPY, because this one gets MUTATED.** `ensureDocType` appends
      // every type it resolves through the server, and `items` is the array
      // `fetchDocTypes` built out of the response body. Nothing else reads it
      // after the block below, so sharing it would be harmless today — and the
      // day something does read it, the bug is a list that grew under it
      // mid-run with nothing in the code saying so.
      docTypeItems = [...items];
      // Slice #27.05 — which types already have a form, decided by the one
      // function #26.12 wrote for it rather than by a `length > 0` here.
      docTypeFormRef.current = new Map(
        items.map((item) => [item.id, documentTypeHasForm(item.templateFields)]),
      );
      docTypeIdCardRef.current = new Map(
        items.map((item) => [
          item.id,
          (ID_CARD_TYPE_KEYS as readonly string[]).includes(item.key) ||
            isIdCardTypeName(item.name),
        ]),
      );
      setTypeNames(items.map((item) => item.name));
      // Slice #27.07 — the BEFORE half of "gained a form during this run",
      // taken once, here, from the same list and the same function the two maps
      // above are built from. Replaced rather than merged: this is a fresh run,
      // and a `hadForm` carried over from a discarded StrictMode invocation is a
      // claim about a run that did not happen.
      setRunTypes(
        Object.fromEntries(
          items.map((item) => {
            const hasForm = documentTypeHasForm(item.templateFields);
            return [item.id, { name: item.name, hadForm: hasForm, hasForm }];
          }),
        ),
      );

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
          //
          //    Slice #29.06 — and it now SAYS which of those two happened. The
          //    call can also throw `session-expired`, which the per-task catch
          //    below already knows what to do with; every other failure comes
          //    back as an outcome rather than as silence.
          const sr = scanResults.get(entry.path);
          const resolvedType = await ensureDocType(
            { typeKey: sr?.typeKey, label: sr?.description },
            docTypeItems,
            fallbackDocTypeId,
          );
          const resolvedTypeId = resolvedType.id;
          // ⚠️ **`sr?.status === "done"` — only an entry the SCAN ACTUALLY
          // ANSWERED FOR gets a resolution recorded, and it took two review
          // rounds to get this term right.** A file with no page a model can
          // see is never classified, and neither is one whose scan errored;
          // recording either as `unclassified` put "scanarea AI nu a putut
          // stabili ce fel de document este" on the row directly under "nu are
          // nicio pagină pe care AI să o poată citi" — two sentences that
          // cannot both be true, permanently, in the saved report.
          //
          // ⚠️ **`sr !== undefined` was the sixth round's term and was a
          // no-op**, which the seventh measured: `startScan` SEEDS the map for
          // every walked entry before any request goes out (`import-wizard.tsx`
          // — `m.set(e.path, { status: … "skip" })`), so an unscannable file is
          // present in it carrying a status and nothing else. The status is the
          // only thing that distinguishes an answer from a placeholder.
          if (mounted && sr?.status === "done" && resolvedType.outcome !== "matched") {
            // ⚠️ **Written HERE and nowhere else.** Three later `updateResult`
            // calls in this task write `documentTypeId`, and putting the
            // resolution on each of them would be three chances to forget one —
            // the failure would then be invisible on exactly the rows that took
            // the least ordinary path. Patches merge, so one write survives all
            // three.
            updateResult(entry.path, { typeResolution: resolvedType.outcome });
          }
          // The types this run is answerable for, so the summary can report one
          // that ends the run with no documents on it. ⚠️ **`created` ONLY** —
          // an `adopted` row is one somebody else's WRITE inserted, so it is not
          // this call's to report on. Since Slice #29.07 that somebody can be a
          // sibling task of this same run; the sibling that WON reports
          // `created` and registers the row here, so nothing is lost by the
          // loser staying quiet — and double-registering it is what would put
          // one type in the summary twice. See `EnsuredDocType.row`.
          if (mounted && resolvedType.row !== undefined) {
            if (resolvedType.outcome === "created") rememberCreatedType(resolvedType.row);
            // ⚠️ **And the NAME, into the list the review dialog refuses
            // duplicates against.** This is the first version of this call site
            // that has the row in hand — the old `ensureDocType` returned an id
            // — and without it a type invented at document 3 is invisible to a
            // review step opened at document 5, which is the window
            // `sameTypeName` exists to close. `enrichDiscoverSteps` re-reads the
            // list before the queue is published, so this only narrows a gap
            // rather than being the only thing holding it shut.
            rememberTypeName(resolvedType.row.name);
          }

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
          // ⚠️ **The type is written on the row the MOMENT the Document exists,
          // and an adversarial round is why.** (Slice #29.06) Three later
          // patches write it on rows that SETTLE, and the per-entry `catch`
          // writes none — so a row whose page upload, property link or tag
          // failed carried no `documentTypeId` at all, while its Document sat
          // in the archive on a type this run had just created. The empty-type
          // sentence then named that type and told the user to delete it, in
          // the saved report, over a type #29.05 would refuse to delete.
          // Overwritten later by the type the AI read settled on, which is what
          // every reader of this field wants.
          if (mounted) updateResult(entry.path, { documentTypeId: resolvedTypeId });

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
          /**
           * Did THIS task's claim actually land?                 (Slice #32.05)
           *
           * ⚠️ **NOT `cornerOwner !== undefined`, and a second adversarial
           * round is why.** `cornerOwner` says only that this entry is a
           * coordinate file the property step read; the claim below can still
           * throw — on a conflict, on a dead session, on any non-2xx — and a
           * throw means no row of this run's was ever written. Reporting
           * "legătura s-a șters odată cu documentul" for a claim that was never
           * made would send the user to re-import a folder to restore a link
           * that never existed.
           */
          let cornerClaimed = false;

          /**
           * 4. Upload file(s) as pages
           *
           * ⚠️ **THE COUNT IS KEPT NOW, AND THE EMPTY DOCUMENT IS TAKEN BACK.**
           *                                                    (Slice #32.05)
           * The loop used to track nothing but `i`, which it spent as the page
           * number — so both of this step's failure modes were silent. A throw
           * left the Document in the archive with no scan, or with part of one,
           * and the per-task `catch` below recorded only "error" and a message.
           * An unmount broke the loop half way and the task carried on to the
           * tags and settled the row `done` over a document missing pages.
           *
           * ⚠️ **ZERO PAGES IS A DELETE; ONE OR MORE IS A SENTENCE.** The line
           * between them is not arbitrary. A Document with no page is a record
           * nobody can ever see the scan of and that no screen in the system
           * reports as empty — the archive is strictly better off without it,
           * and the file is still sitting in the user's folder to be imported
           * again. A Document with SOME of its pages is a different thing: it
           * holds real scans, it may already carry a corner-source claim and
           * property links, and deleting it would throw away work over a
           * failure the user can act on. So it stays, and the row and the saved
           * report say how far it got.
           */
          const pagesExpected =
            entry.kind === "page-group" ? (entry as FSPageGroupEntry).handles.length : 1;
          let pagesUploaded = 0;
          try {
            // ⚠️ **STEP 3.5 IS INSIDE THIS BLOCK, and a second adversarial
            // round moved it here.** `claimCornerSource` throws three ways — a
            // conflict, the `session-expired` sentinel, and any non-2xx — and
            // every one of them lands on a Document that was created two lines
            // ago and has no page. Left above the `try`, those three throws went
            // straight past the tidy-up to the per-task catch, so the commonest
            // coordinate-file failure produced exactly the orphan this slice
            // exists to stop, and `discardEmptyDocument`'s own header claimed
            // otherwise.
            if (cornerOwner !== undefined) {
              const claim = await claimCornerSource(docId, cornerOwner, "session-expired");
              if (claim.kind === "conflict") {
                throw new Error(
                  t("cornerSourceConflict", {
                    code: claim.link?.propertyCode ?? "?",
                  }),
                );
              }
              cornerClaimed = true;
            }

            if (entry.kind === "page-group") {
              const pg = entry as FSPageGroupEntry;
              for (let i = 0; i < pg.handles.length; i++) {
                if (!mounted) break;
                const file = await pg.handles[i].getFile();
                await uploadPage(docId, file, i + 1);
                pagesUploaded += 1;
              }
            } else {
              const fe = entry as FSFileEntry;
              const file = await fe.handle.getFile();
              await uploadPage(docId, file, 1);
              pagesUploaded += 1;
            }
          } catch (err) {
            /**
             * ⚠️ **THE COUNT IS RECORDED HERE, IN THE `catch`, AND AN
             * ADVERSARIAL ROUND IS WHY.** The first draft recorded it after the
             * `try` — where it could never fire. Every route out of the block
             * with a short count is either this throw, which used to rethrow
             * without writing anything, or the `!mounted` break below, and the
             * first draft's surviving test then guarded dead code. The whole
             * defect Adrian reported — a page group holding three of its five
             * pages — arrives down THIS path.
             *
             * ⚠️ **AWAITED BEFORE THE RETHROW.** A fire-and-forget delete on a
             * dialog that is closing is a request nothing keeps alive, and the
             * orphan it was meant to remove is exactly the orphan this fix
             * exists for. `discardEmptyDocument` never throws, so this cannot
             * replace the failure the catch below is about to report.
             */
            if (pagesUploaded === 0) {
              const removed = await discardEmptyDocument(docId);
              // ⚠️ **A REFUSED DELETE IS A DOCUMENT THIS RUN LEFT BEHIND, and
              // the wizard has to be told.** A second adversarial round found
              // the hole the announcement's move opened: both branches of this
              // catch re-throw, so on the two paths that KEEP a Document —
              // `"left"`, and a partial page group — `documentsCreated` stayed
              // false and the Cancel dialog told the user this run had left the
              // archive exactly as it found it, on the same screen whose row
              // says "delete the document from the archive".
              if (!removed) announceFirstDocument();
              if (mounted) {
                updateResult(entry.path, {
                  emptyDocument: removed ? "removed" : "left",
                  // ⚠️ **THE ID, so the sentence telling the user to delete it
                  // names something they can open.** Written on an ERROR row,
                  // which nothing else in this file treats as imported: the
                  // row's own link is gated on `status === "done"`, the summary
                  // skips error rows outright, and the two `refill` maps are
                  // gated on `typeFormMissing`, which an error row never
                  // carries. The saved report picks it up as this row's
                  // `documentUrl`, which is the point. The partial-page branch
                  // below writes it for the same reason and with the same
                  // safety.
                  ...(removed ? {} : { docId }),
                  // Exactly when a real claim went with the delete: the claim
                  // was made by this task AND the document really was removed.
                  // See `cornerClaimed` for why `cornerOwner` alone is wrong.
                  ...(cornerClaimed && removed ? { cornerClaimLost: true } : {}),
                });
              }
            } else {
              // Some pages landed, so a real Document with real scans is in the
              // archive whatever happens to this row. Same reason as above.
              announceFirstDocument();
              if (mounted) updateResult(entry.path, { pagesUploaded, pagesExpected, docId });
            }
            throw err;
          }
          if (!mounted) {
            /**
             * The `!mounted` break — an unmount between the create and the last
             * page, and the only way here.
             *
             * ⚠️ **IT RETURNS NOW RATHER THAN FALLING THROUGH, and a review
             * round found what falling through cost.** The task went on to the
             * property links, the tags and `runAiInterpret` — a BILLED call —
             * on a dialog that was unmounting, and settled the row `done` over
             * a document missing pages that nobody would ever see the row for.
             * Every other await point in this loop returns on `!mounted`; this
             * one was the exception, and it was the exception by omission.
             */
            // ⚠️ **THE BOOLEAN IS HONOURED HERE TOO, and a third adversarial
            // round found it thrown away.** `discardEmptyDocument` returns
            // whether the delete actually happened precisely because it can be
            // refused — a dead session redirects the DELETE exactly as it
            // redirected the upload — and a refusal here leaves the same
            // scanless Document the catch branch above reports. Nothing on
            // screen can say so (the dialog is unmounting), but the WIZARD
            // outlives it, and its Cancel confirmation is read afterwards: an
            // unannounced orphan is a user consenting to "this run left the
            // archive as it found it" over a record it did not.
            // One expression rather than two branches, so this really is the
            // fourth CALL and not a fourth-and-fifth: a Document is left behind
            // either because it kept its pages, or because the tidy-up delete
            // was refused.
            const left =
              pagesUploaded === 0 ? !(await discardEmptyDocument(docId)) : true;
            if (left) announceFirstDocument();
            return;
          }

          // Slice #26.03 — the run has now written something.
          //
          // ⚠️ **CALLED WHEREVER A DOCUMENT SURVIVES, and #32.05 is why it is a
          // function rather than four lines under `createDocument`.** It stood
          // there, which was the safe direction while nothing ever removed a
          // Document: the Cancel confirmation warned about records that might
          // not exist yet. It is the wrong direction now — a run whose only
          // document is discarded because its first page failed left
          // `documentsCreated` true for ever, so the Cancel dialog warned about
          // an archive this run had left exactly as it found it and
          // `setRunCompleted` suppressed the Import button. Moving it below the
          // upload alone opened the mirror hole, which a second adversarial
          // round found: the two catch branches that KEEP a Document re-throw,
          // so they never reached this line either. So it is called from four
          // places and is idempotent by the flag it closes over.
          announceFirstDocument();

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
          // click before it happens — see `interpretSkipReason`, of which
          // `shouldInterpretEntry` is the thinner view that screen reads.
          const rowProperty = soleProperty(entry.path);
          const skipReason = interpretSkipReason(entry, {
            isIdCard: isIdCardEntry(sr),
            canCreatePerson: rowProperty !== null,
          });

          // 7a. The identity card's person — QUEUED, not written.  (#26.10)
          //
          // Until this slice the card was a button on the row; now the run
          // queues it and the queue walks it once every row has settled, so the
          // row can say what happened instead of offering to make it happen.
          //
          // ⚠️ **Nothing is created here.** The step opens the same
          // confirm-or-create dialog the button opened, and the user still
          // answers it. #26.09's rule — a run that creates people on its own is
          // the failure the whole 26.xx redesign exists to prevent — is about
          // WRITING without an answer, not about who opens the question.
          //
          // ⚠️ **Keyed on the FACT that it is a card, NOT on `skipReason ===
          // "id-card"`, and an adversarial round is why.** The two are not the
          // same set: `interpretSkipReason` answers `no-page` FIRST, so a card
          // the model cannot see — a page folder of files the route refuses —
          // never reached this branch, was never queued, and yet drew "cartea
          // de identitate așteaptă să fie confirmată" beside a header that
          // counted nothing and offered no control to answer it. The card path
          // does not need `hasReadablePage`: it needs an IMAGE, and whether
          // there is one is `idCardImage`'s answer, not the AI route's.
          if (isIdCardEntry(sr) && rowProperty !== null) {
            try {
              const image = await idCardImage(entry);
              // ⚠️ The `mounted` test guards the REF write too, not just the
              // state patch beside it. The effect gives each invocation a fresh
              // map, so a task belonging to a discarded StrictMode run that
              // resolved late would otherwise write its own (duplicate,
              // orphaned) `docId` into the LIVE run's queue — and the person
              // the user then confirms would be linked to the document nobody
              // can see.
              if (!mounted) return;
              idCardStepsRef.current.set(entry.path, {
                kind: "id-card",
                path: entry.path,
                docId,
                label: title,
                file: image,
                propertyId: rowProperty,
              });
              updateResult(entry.path, { idCardQueued: true });
            } catch {
              // The Document is written, its pages are uploaded and it is
              // linked; what failed is the preparation of an image. The row
              // says so and the import carries on — the same rule this file's
              // header states for a failed read.
              if (mounted) updateResult(entry.path, { personFileUnreadable: true });
            }
          }

          if (skipReason !== null) {
            if (mounted) {
              updateResult(entry.path, {
                status: "done",
                docId,
                principalObjectId,
                aiStatus: "skipped",
                aiSkipReason: skipReason,
                // ⚠️ **The type is written on EVERY settled row, not only the
                // read ones**, and an adversarial round is why: a row that
                // reaches `handleRetryInterpret` with no type at all cannot be
                // asked whether its type is waiting for a form, and the retry
                // is the run's own commonest failure. `typeFormMissing` stays
                // off — this row was never read, so nothing of its went to
                // Notes.
                documentTypeId: resolvedTypeId,
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

          // ⚠️ **`entry` is the third argument since #29.12 and all three call
          // sites pass it.** It is what lets the read know the folder had
          // already named this document — "CVC Hascu 2005" — so the model's
          // reading of the printed heading does not replace a title that told
          // the user which of thirty contracts this is. Omitted, the call is
          // correct and the title is lost; see `resolveImportedTitle`.
          const interpreted = await runAiInterpret(docId, new Date().toISOString(), entry);
          if (!mounted) return;

          if (interpreted.ok) {
            // Queued, not walked: the stepper opens once every row has settled,
            // so a user is not interrupted three times over while files are
            // still uploading behind the dialog.
            if (interpreted.parties.length > 0) {
              partyStepsRef.current.set(entry.path, {
                kind: "parties",
                path: entry.path,
                docId,
                parties: interpreted.parties,
              });
            }

            // 8. The TYPE's form — one schema-free read per type.  (#27.05)
            //
            // ⚠️ **IT RUNS INSIDE THE ROW'S TASK, so the row stays `importing`
            // and holds one of the three slots while it does.** That is the
            // deliberate half of a trade an adversarial round put plainly: the
            // document's own work is finished by this point, so the row is
            // labelled for work that is not about it, and a folder whose first
            // three entries are three distinct new types holds all three slots
            // for an extra model call each. The alternative is worse in the
            // direction that matters — marking the row `done` first puts the
            // progress bar at 100% over billed calls still in flight, which is
            // the thing this file's header forbids in as many words. Under-
            // reporting progress is the safe side of that line. What bounds the
            // cost is that there is one such call per TYPE, not per document.
            //
            // ⚠️ **The type AFTER the read, not the one resolved at step 2.**
            // The route may re-classify the document, and that is also the path
            // that auto-creates `lookup_document_type` rows — so a discovery
            // keyed on `resolvedTypeId` would open a review screen naming one
            // type over pairs read out of a document that now sits on another,
            // and write the fields onto the wrong one. `runAiInterpret` reports
            // the move because nothing here can work it out.
            const finalTypeId = interpreted.documentTypeId ?? resolvedTypeId;
            const typeHasForm = docTypeFormRef.current.get(finalTypeId) === true;
            // ⚠️ **Answered from the TYPE, with the scan only as the fallback
            // for a type this run invented.** Not `skipReason === "id-card"` —
            // that rule also requires `canCreatePerson`, so a card under
            // `common` or `floating` never reaches it — and not the scan alone,
            // which is false on a card the model re-typed onto CARTE_IDENTITATE
            // and true on a document it correctly re-typed away from one. See
            // `typeIsIdCard`.
            // ⚠️ **`||`, NOT `??`, and a fifth adversarial round is why.** A
            // nullish fallback let a map entry of `false` SUPPRESS the scan's
            // own signal — and the map is only as good as `isIdCardTypeName` is
            // at reading a type NAME, which is a heuristic. Either witness is
            // enough. The two errors are not symmetric: a card wrongly read
            // writes a CNP column onto a type nothing can take it off, and a
            // real type wrongly skipped waits for one press of Descoperire AI.
            const typeIsIdCard =
              docTypeIdCardRef.current.get(finalTypeId) === true || isIdCardEntry(sr);
            const awaitsForm = typeAwaitsForm({
              typeId: finalTypeId,
              fallbackTypeId: fallbackDocTypeId,
              typeHasForm,
              typeIsIdCard,
            });

            // ⚠️ **The claim is made SYNCHRONOUSLY, before the await**, and it
            // is the only thing standing between three in-flight tasks and
            // three billed reads of one brand-new type. See
            // `discoverClaimedRef`.
            if (
              shouldDiscoverType({
                typeId: finalTypeId,
                fallbackTypeId: fallbackDocTypeId,
                typeHasForm,
                typeIsIdCard,
                claimedTypeIds: discoverClaimedRef.current,
                // ⚠️ **Slice #32.05 — and it is passed to THIS and not to
                // `typeAwaitsForm` two dozen lines above.** `awaitsForm` is
                // what the ROW says, and a waived type is still a type waiting
                // for a form; this is what the run SPENDS, and a waived type
                // buys no read. The two questions differ by exactly this term,
                // which is why `shouldDiscoverType` is defined in terms of the
                // other rather than beside it.
                //
                // ⚠️ **`discoverClaimedRef` is NOT pre-seeded with the waived
                // types either.** That set means "this run has already bought a
                // read for this type", and a waived type has not — seeding it
                // would make the claim a lie and would silently survive into
                // `handleRetryInterpret`, where the user pressing a button IS
                // asking for the read.
                formsWaived,
              })
            ) {
              discoverClaimedRef.current.add(finalTypeId);
              const discovered = await discoverForType(docId);
              // ⚠️ The `mounted` test guards the REF write as well as anything
              // else — the same argument the identity-card branch above makes:
              // a task belonging to a discarded StrictMode run must not put its
              // own document into the LIVE run's queue.
              if (!mounted) return;
              if (discovered.ok) {
                // A read that found nothing has nothing to review, and a review
                // dialog opened over zero rows is a puzzle rather than a
                // screen. The row still says the type has no form, which is the
                // true and useful half.
                if (discovered.pairs.length > 0) {
                  discoverStepsRef.current.set(finalTypeId, {
                    kind: "discover",
                    path: entry.path,
                    docId,
                    typeId: finalTypeId,
                    // Both filled in at the end of the run, from a fresh read of
                    // the type list — see the publish below. A type invented by
                    // the route mid-run is not in any map this task holds.
                    typeName: "",
                    existing: [],
                    pairs: discovered.pairs,
                    documentLabel: discovered.documentLabel,
                    partyRoleNames: discovered.partyRoleNames,
                    skippedPages: discovered.skippedPages,
                    truncated: discovered.truncated,
                  });
                }
              } else if (discovered.reason === "session") {
                // The same rule the extract call keeps: every row after this
                // one would fail the same way. The row is still `done` — its
                // Document, its pages and its fields were all written before
                // the session went.
                abortRef.current = true;
                setSessionExpired(true);
              }
            }

            updateResult(entry.path, {
              status: "done",
              docId,
              principalObjectId,
              aiStatus: "done",
              aiProcessed: true,
              aiFieldCount: interpreted.fieldCount,
              // First read of this row, so there is no previous answer to
              // preserve and the three-state flag collapses to two. Both are
              // written from the SAME test: `printedHeadingNoted` is only ever
              // true alongside `titleKept`, and a row that drew the second
              // sentence without the first claimed a #29.12 outcome on a call
              // that had not made one.
              ...(interpreted.titleKept === true
                ? {
                    aiTitleKept: true,
                    aiPrintedHeadingNoted: interpreted.printedHeadingNoted || undefined,
                  }
                : {}),
              aiPartiesPending: interpreted.parties.length,
              aiPartialWrite: interpreted.partialWrite,
              documentTypeId: finalTypeId,
              // ⚠️ `|| undefined`, so a row that does NOT await a form carries
              // no key at all rather than `false`. `summariseImportRun` reads
              // `=== true`, but the saved session and the report both walk what
              // is present, and a false flag is a fact nobody asked for.
              typeFormMissing: awaitsForm || undefined,
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
            // See the skipped branch above. A failed read is exactly the row a
            // retry lands on, and the retry needs to know this type.
            documentTypeId: resolvedTypeId,
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
      // Slice #26.10 — the identity cards first, then the parties, each in the
      // folder's own order. The reason the cards go first is in this file's
      // header: a card puts the property's owner in the system, so every party
      // step after it resolves against an archive that already holds them.
      //
      // Slice #27.05 — and the proposed forms LAST, after the people. Three
      // arguments, in the order they decide it: the two person queues are about
      // documents this run wrote and this one is about a TYPE, which outlives
      // the run; a discovery review is the only step here that spends a
      // permanent decision, so it is put to a user whose run has otherwise
      // settled; and #26.10's own reason for cards-before-parties does not
      // reach it either way.
      //
      // ⚠️ **Enriched even when the run ABORTED**, though nothing is published
      // then. The backlog outlives the abort — `handleReviewTypes` is what
      // rescues it after a fresh sign-in — and under a dead session this GET
      // simply fails and leaves the queue as it was, at the cost of one
      // round trip nobody waits for.
      const enriched = await enrichDiscoverSteps(discoverStepsRef.current);
      if (!mounted) return;
      if (enriched.names !== null) setTypeNames(enriched.names);
      absorbTypeList(enriched);
      // ⚠️ **Before `steps` is computed, because `abortRef` is what suppresses
      // it.** A session that died between the last row and this GET would
      // otherwise publish the whole follow-up queue into it.
      if (enriched.sessionLost) {
        abortRef.current = true;
        setSessionExpired(true);
      }

      const steps: FollowUpStep[] = abortRef.current
        ? []
        : [
            ...inFolderOrder(entries, idCardStepsRef.current),
            ...inFolderOrder(entries, partyStepsRef.current),
            ...discoverStepsInFolderOrder(entries, discoverStepsRef.current),
          ];

      if (mounted) {
        setDiscoverBacklog(discoverStepsRef.current.size);
        setFollowUps(steps);
        setDone(true);
      }
    }

    run().catch((err) => {
      if (!mounted) return;
      const msg = err instanceof Error ? err.message : "Import failed unexpectedly";
      // Slice #27.05 — the same sentinel the per-entry catch maps, mapped here
      // too: `fetchDocTypes` is the first thing the run does, so an expiry
      // before the first file arrives on THIS path and nowhere else. Both are
      // set — the banner carries the sign-in link, and `importError` is what
      // draws the Close button on a run that has no rows to settle.
      if (msg === "session-expired") {
        abortRef.current = true;
        setSessionExpired(true);
        setImportError(t("sessionExpiredShort"));
        // ⚠️ **And every row is MARKED, because the banner's own sentence says
        // they are** — "Fișierele marcate cu erori mai jos nu au fost salvate."
        // This path is the only one that reaches the banner with no task having
        // run, so without this the one concrete claim it makes about the table
        // is false, and its natural reading — that the unmarked rows WERE
        // saved — is false over a run that wrote nothing. It is also simply
        // true: nothing was imported. The same patch the per-entry catch
        // applies to a task skipped after an abort.
        setResults((prev) =>
          prev.map((r) => ({ ...r, status: "error", errorMsg: t("sessionExpiredShort") })),
        );
        return;
      }
      // ⚠️ **Never the raw message unless we wrote it.** `fetchDocTypes` throws
      // two Romanian messages of its own — no document types at all, and no
      // catch-all type — and both are worth showing; the other
      // things that land here are a `DOMException` from this slice's own 30 s
      // timer ("signal is aborted without reason") and a `TypeError: Failed to
      // fetch` — English, on a Romanian screen, which is the leak every other
      // branch in this slice goes out of its way to stop.
      const ours = err instanceof Error && err.name === "Error";
      setImportError(ours ? msg : t("importStartFailed"));
    });

    return () => { mounted = false; };
    // entries and rootFolderName are stable for the lifetime of this dialog,
    // and so are `propertyIdsByPath` and `cornerSourceByPath` — the property
    // step builds both once and the wizard holds them in state, so a re-render
    // caused by a corner count changing hands the same Map back. updateResult
    // is a stable useCallback reference; the per-entry provenance is read
    // through provenanceRef so answering the gate does not restart an import
    // that is already running.
    // `formsWaived` since #32.05, and it belongs on this list for the same
    // reason: the wizard raises the waiver on the stop screen, three phases
    // before this dialog is mounted, and cannot change it while a run is on
    // screen — so the value this effect closes over is the value the whole run
    // has.
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

  // Slice #27.05 — see `followUpsOpenRef`. An effect rather than a write beside
  // each `setFollowUps`, so it cannot fall out of step with the state it
  // mirrors however the queue comes to change.
  useEffect(() => {
    followUpsOpenRef.current = followUps.length > 0;
  }, [followUps]);

  /**
   * The run is over and this dialog is now the RESULT screen.   (Slice #26.10)
   *
   * Held in a ref for the reason `firstDocumentRef` is: a caller passing a
   * fresh arrow every render must not be able to re-announce on every commit.
   * `done` only ever goes false→true, so this fires exactly once.
   */
  const runFinishedRef = useRef(onRunFinished);
  useEffect(() => {
    runFinishedRef.current = onRunFinished;
  }, [onRunFinished]);
  useEffect(() => {
    if (done) runFinishedRef.current?.();
  }, [done]);

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
        // Slice #32.05 — carried for the reason `preexisting` above is: the
        // resumed view is the only artefact of a run that survives a reload,
        // and without these an errored row loses the four sentences the screen
        // and the saved page both carry. See `SavedImportEntry`.
        pagesUploaded:    r.pagesUploaded,
        pagesExpected:    r.pagesExpected,
        emptyDocument:    r.emptyDocument,
        cornerClaimLost:  r.cornerClaimLost,
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
  // The follow-up queue   (Slice #26.10, on #26.09's shape)
  // ---------------------------------------------------------------------------
  //
  // Two questions the run cannot answer by itself: who the person on an
  // identity card is, and who the people a document read named are. Both are
  // queued during the loop and walked here once every row has settled, one
  // modal at a time, so a user is not interrupted three times over while files
  // are still uploading behind the dialog.

  const currentFollowUp: FollowUpStep | null = followUps[followUpIndex] ?? null;

  /**
   * Move to the next question, and RELEASE the queue once there is none.
   * (Slice #26.10)
   *
   * ⚠️ **The release is not tidiness — it is megabytes.** An `IdCardStep` holds
   * a `File`, and for a PDF card that File is a PNG this dialog rasterised at
   * 1.5× (roughly 1240×1754), living in memory rather than on disk. Advancing a
   * cursor past the end leaves every one of them referenced by the state array
   * for as long as the user keeps the result screen open — reading it, saving
   * the report, confirming parties. Eight cards is tens of megabytes held for
   * nothing.
   *
   * Emptying the array is safe because the BACKLOG is the refs, not this: the
   * header's own control rebuilds the queue from them, so nothing that still
   * needs answering is lost by dropping the walked copy.
   */
  const advanceFollowUp = useCallback(
    (from: number) => {
      if (from + 1 >= followUps.length) {
        setFollowUps([]);
        setFollowUpIndex(0);
        return;
      }
      setFollowUpIndex(from + 1);
    },
    [followUps.length],
  );

  /**
   * One card is settled — record who it produced and move on.
   *
   * `personCreated` is carried through rather than discarded: it is the whole
   * difference between the source document's "a person was created from ID
   * card" and the quieter truth that the person was already there.
   */
  const handleIdCardDone = useCallback(
    (outcome: IdCardPersonOutcome) => {
      const step = followUps[followUpIndex];
      if (step !== undefined && step.kind === "id-card") {
        idCardStepsRef.current.delete(step.path);
        updateResult(step.path, {
          personId: outcome.personId,
          personCreated: outcome.created,
          // A previous decline is no longer the answer, and a row carrying both
          // would draw two contradictory sentences.
          personDeclined: undefined,
          // Slice #23.08.Import — the same step also wrote the card's fields
          // onto the Document; the row reports both halves separately because
          // the second can fail while the first succeeded.
          idCardDocFields: outcome.documentFieldsWritten,
          idCardDocFieldsFailed: outcome.documentFieldsFailed,
        });
      }
      advanceFollowUp(followUpIndex);
    },
    [advanceFollowUp, followUps, followUpIndex, updateResult],
  );

  /**
   * The card could not be read, so nobody was ever asked.   (Slice #26.10)
   *
   * ⚠️ **Distinct from a close, and an adversarial round is why.** Both end in
   * `onClose`, so without this a 429 during the queue — the failure three
   * concurrent reads on one bucket actually produce — drew "nicio persoană nu a
   * fost creată din această carte de identitate" on the row and in the saved
   * report: a sentence about a decision the user never took. The backlog entry
   * survives either way, so the header's own control can still offer it.
   *
   * ⚠️ **`personStepUnfinished`, NOT `personFileUnreadable`.** A third round caught
   * the two being merged: this dialog's fatal state is a 429, a 5xx, an expired
   * session or its own timeout, and none of those is an image that would not
   * open. The image opened — the loop rasterised it and it is still in the
   * queue — so the sentence, the count and the remedy are all different. See
   * `OutcomeRow.personStepUnfinished`.
   */
  const handleIdCardFailed = useCallback(() => {
    const step = followUps[followUpIndex];
    if (step !== undefined && step.kind === "id-card") {
      updateResult(step.path, { personStepUnfinished: true });
    }
  }, [followUps, followUpIndex, updateResult]);

  /**
   * The card's dialog was closed without a person.
   *
   * ⚠️ **The backlog entry SURVIVES**, for the reason `handlePartyStepClosed`
   * records about its own: a dismissal, an Escape and a walk into a dead session
   * are indistinguishable from here, and deleting the entry would destroy — in
   * the one state where nothing else can reach them — the very cards the header
   * control exists to rescue. The row says nobody was created, which is what
   * happened, and the offer can be made again by hand.
   */
  const handleIdCardClosed = useCallback(() => {
    const step = followUps[followUpIndex];
    // ⚠️ Only a close that is genuinely the USER's answer writes `declined`.
    // `handleIdCardFailed` has already marked the row unreadable when this
    // close is the error panel's Dismiss, and overwriting that with "the user
    // said no" is the false claim this pair exists to keep apart.
    if (step !== undefined && step.kind === "id-card") {
      setResults((prev) =>
        prev.map((r) =>
          r.entry.path === step.path &&
          r.personFileUnreadable !== true &&
          r.personStepUnfinished !== true
            ? { ...r, personDeclined: true }
            : r,
        ),
      );
    }
    advanceFollowUp(followUpIndex);
  }, [advanceFollowUp, followUps, followUpIndex]);

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
   * ⚠️ Read straight from state and NOT through a `setFollowUpIndex` updater,
   * the way the two row actions used to read their target. An updater is a
   * reducer — React may call it twice for one dispatch — and `updateResult`
   * inside one is a second dispatch riding on that. The dialog is keyed by path,
   * so the extra dependency costs nothing: a new identity per step is exactly
   * right.
   */
  const handlePartyStepClosed = useCallback(
    (summary: AiPartyLinkerSummary) => {
      const step = followUps[followUpIndex];
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
      if (step !== undefined && step.kind === "parties" && summary.linked + summary.created > 0) {
        partyStepsRef.current.delete(step.path);
        updateResult(step.path, { aiParties: summary, aiPartiesPending: undefined });
      }
      advanceFollowUp(followUpIndex);
    },
    [advanceFollowUp, followUps, followUpIndex, updateResult],
  );

  /**
   * Open the questions nobody was asked.   (Slice #26.09, both queues since #26.10)
   *
   * ⚠️ **Free, and that is the point.** Both refs already hold their contents —
   * the extracted people, and the card images the loop rasterised — so the only
   * thing a session expiry took away was the `setFollowUps` that would have
   * surfaced them. Until this button existed the only way to execute those two
   * lines was to pay for a fresh model call on some OTHER row, and in the shape
   * where the session dies during an upload rather than during a read there is
   * no such row: every document either succeeded or never reached the read, so
   * no amber block and no retry button is drawn anywhere in the table.
   */
  const handleConfirmPending = useCallback(() => {
    // ⚠️ **The fourth control gets the same synchronous claim — see
    // `readRunningRef`.**   (Slice #27.06)
    //
    // Its only guard was `{!readRunning && …}` on the button, which is the
    // render-time value that ref exists to distrust: this button and the re-read
    // sit two lines apart in the same header block, so pressing both inside one
    // frame published an identity-card or party stepper — a `fixed inset-0`
    // modal — over N serial billed reads, hiding the progress line the copy had
    // just told the user to watch, with Close and Save disabled and no
    // explanation. The person steps are the ones that write permanent Person
    // records, so this is the worst of the four to open unasked.
    if (readRunningRef.current) return;
    // Slice #27.05 — a part-finished new-type run belongs to the step that
    // produced it; see `handleReviewTypes` for why it must not survive a queue
    // replacement.
    pendingNewTypeRef.current = null;
    const steps = [
      ...inFolderOrder(entries, idCardStepsRef.current),
      ...inFolderOrder(entries, partyStepsRef.current),
    ];
    // ⚠️ **The mirror is set EAGERLY here, not left to its effect.**
    // (Slice #27.06)
    //
    // `followUpsOpenRef` is normally kept in step by a `useEffect` on
    // `followUps`, which is what makes it survive every route the queue can
    // change by. That is one commit too late for the reader that matters now:
    // `handleRefill` tests this ref to refuse starting a walk under an open
    // modal, and this handler is synchronous, so a press here and a press there
    // inside one frame would both pass. A publisher setting the thing it has
    // just made true cannot disagree with the effect that follows it.
    if (steps.length > 0) followUpsOpenRef.current = true;
    setFollowUps(steps);
    setFollowUpIndex(0);
    // `entries` is stable for this dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Open the proposed forms nobody looked at.   (Slice #27.05)
   *
   * ⚠️ **Its own control, and NOT folded into `handleConfirmPending`.** That one
   * says "confirm the people" and rescues two backlogs with one remedy; this is
   * a different question with a different answer — the people are about
   * documents this run wrote, and this is about a type that outlives it. Two
   * counts under one button is how a user comes to press it for the wrong
   * reason and then not press it again.
   *
   * ⚠️ **It re-reads the type list first**, because the case it exists for is
   * the one where the run ABORTED: a session expiry publishes no queue at all,
   * and the enrichment that runs at the end of the loop failed with it. Without
   * this the rescued step would open a dialog whose title names an empty type.
   * It is also the honest read after a sign-in in another tab — a type may have
   * gained a form in the meantime, and such a step is dropped rather than shown.
   */
  const handleReviewTypes = useCallback(async () => {
    // ⚠️ **The in-flight guard is not tidiness, and an adversarial round found
    // what it costs.** This handler awaits a GET and then REPLACES the queue.
    // Pressing it and then "Confirmă persoanele" — both controls are drawn on
    // the same ordinary end state — opened a card or party dialog and pulled it
    // out from under the user a second later, mid-answer, with nothing on
    // screen saying so. A party stepper interrupted that way never reaches
    // `handlePartyStepClosed`, so it is re-offered later with no record that
    // person 1 of 3 was already linked, and answering "create" the second time
    // makes the duplicate person the whole 26.xx redesign exists to prevent.
    if (reviewingTypes) return;
    // ⚠️ **…and the synchronous half of it, added with #27.06's walk.** The
    // state guard above is one commit behind, so this and the re-read button
    // beside it could both be pressed in a single frame. Checked HERE, before
    // anything is mutated, rather than only after the await: the post-await
    // check below cannot un-refresh the backlog it has already published.
    if (readRunningRef.current) return;
    setReviewingTypes(true);
    setReviewTypesError(null);
    // Captured BEFORE the await — see `sessionLossSeqRef`.
    const seenLosses = sessionLossSeqRef.current;
    const enriched = await enrichDiscoverSteps(discoverStepsRef.current);
    if (!mountedRef.current) return;
    setReviewingTypes(false);
    // A press into a still-dead session re-raises the banner rather than
    // reporting a connection problem, and costs one 401 to find out — the same
    // trade `canRetryReads` records for the retry button.
    if (enriched.sessionLost) raiseSessionExpired();
    absorbTypeList(enriched);
    if (enriched.names !== null) {
      setTypeNames(enriched.names);
      // ⚠️ **The session is demonstrably back — this GET went through it.** The
      // same clear `handleRetryInterpret` makes on its own success, and it is
      // needed here for a case that has no retry button at all: a session lost
      // during the DISCOVERY read leaves every row `aiStatus: "done"` (the
      // Document, its pages and its fields were written before the session
      // went), so `unreadCount` is zero, no row is retryable, and nothing else
      // in this dialog can ever clear the flag. Without this, the header went
      // on telling a signed-in user to sign in again, over the control they had
      // just used successfully.
      //
      // ⚠️ **Unless something said the session died while this GET was in
      // flight** — see `sessionLossSeqRef`. A walk or a retry running alongside
      // it can hit a 401 after the GET was issued, and a stale "it was fine"
      // must not pull that banner down. Keyed on the counter rather than on
      // "is a read running", which suppresses the clear for a concurrent read
      // that failed for some ordinary reason and leaves a signed-in user being
      // told to sign in again with nothing able to take it back.
      if (sessionLossSeqRef.current === seenLosses) setSessionExpired(false);
    }
    // ⚠️ **Refreshed BEFORE the guard**, because `enrichDiscoverSteps` has
    // already pruned the ref by this point — a step whose type gained a form
    // elsewhere, or whose proposals are all already captured, is gone. Left
    // after the guard, a press that bailed showed the header a stale count and
    // an offer over an empty queue.
    setDiscoverBacklog(discoverStepsRef.current.size);
    // ⚠️ **A press that cannot open anything says so.** The enrichment is what
    // gives a step the type NAME the dialog puts in its own title over a
    // permanent decision, so an unenriched step is not shown — and silently
    // doing nothing, on the one control the user was told to press, is how a
    // rescue path becomes indistinguishable from a broken button.
    const openable = openableDiscoverSteps(discoverStepsRef.current);
    if (openable.length === 0) {
      // ⚠️ **Its own state, NOT `typeWarnings`, and a fourth round is why.**
      // That list is red, `role="alert"`, append-only and never cleared,
      // because what it holds is #27.04's permanent damage — a type left
      // half-created on the server. This is a transient the very next press can
      // clear, and filing the two together left "the forms cannot be opened" on
      // screen, in the present tense, beside irreversible warnings, after the
      // retry that opened them.
      // ⚠️ **THREE causes, not two, and the third is the likeliest.** An empty
      // `openable` also means the enrichment SUCCEEDED and legitimately pruned
      // every step — a type that gained a form elsewhere, one whose proposals
      // are all already captured, one that turned out to be an identity card.
      // Reported as "the type list could not be read, check your connection"
      // that was a false claim about a 200, told to a business user with a
      // working connection, on the one control this rescue path has; and it
      // could not be cleared afterwards, because the press had already taken
      // the backlog to zero and unmounted the button that clears it. `names`
      // is the fact that answers it: null means the read failed.
      setReviewTypesError(
        enriched.sessionLost
          ? t("sessionExpiredShort")
          : enriched.names === null
            ? t("typeListUnavailable")
            // Nothing went wrong and nothing is left. The header's own
            // "nothing to review here" branch already says so, in a sentence
            // written for it.
            : null,
      );
      return;
    }
    setReviewTypesError(null);
    // ⚠️ The queue is replaced only if there is nothing in it. `followUpsOpen`
    // is a ref rather than `followUps` itself because this closure was made
    // before the await and cannot see a queue that opened during it.
    if (followUpsOpenRef.current) return;
    // ⚠️ **…and not while a billed read is in flight, which #27.06 added and an
    // adversarial round found the same day.** This handler's guard asked whether
    // a QUEUE was open and knew nothing about the re-read walk, whose control is
    // drawn on the same ordinary end state. Press "Vezi câmpurile găsite", then
    // press "Reia citirea" before the GET returns: the walk starts, and a second
    // later this line opens `DiscoverReviewDialog` — a permanent decision about
    // a document type — over N serial billed reads, with the progress line the
    // user was told to watch behind the modal's scrim. Worse, accepting there
    // writes `docTypeFormRef` while the walk is reading it, so a document the
    // walk re-types onto that very type gets "acest tip nu are formular"
    // decided by whichever landed first — on the screen and in the saved report.
    if (readRunningRef.current) return;
    // A part-finished new-type run belongs to the step that produced it. It is
    // dropped rather than carried across a queue replacement — see
    // `applyPendingNewType` for what it is and why it must not outlive its step.
    pendingNewTypeRef.current = null;
    // Eagerly, for the reason `handleConfirmPending` records about the same ref.
    followUpsOpenRef.current = true;
    setFollowUps(discoverStepsInFolderOrder(entries, discoverStepsRef.current));
    setFollowUpIndex(0);
    // `entries` is stable for this dialog's lifetime.
    // `raiseSessionExpired` is a no-dep `useCallback`, so listing it costs no
    // re-renders and keeps this in step with the two handlers below.
    // ⚠️ **The directive below stays immediately above the dependency array,
    // with nothing between them.** It suppresses the NEXT LINE, and
    // `exhaustive-deps` reports on the array node — so a comment slipped in
    // between, as #27.06's first draft did, leaves it covering a comment and the
    // rule firing again on a file that was clean. ⚠️ **And do not write the
    // directive's own name in prose here**: ESLint reads any line containing it
    // as a directive, so this paragraph would become a second, unused one — the
    // same trap the Close button's comment records about naming a utility class.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raiseSessionExpired, reviewingTypes, t]);

  /**
   * What #27.04's new-type path left on the server, in words — and the row
   * changes that go with it.   (Slice #27.05)
   *
   * ⚠️ **Read and CLEARED**, so one part-finished run cannot be reported twice
   * by the two callers below. Returns nothing: everything it has to say, it
   * says by setting state.
   */
  const applyPendingNewType = useCallback(
    (step: DiscoverStep) => {
      const progress = pendingNewTypeRef.current;
      pendingNewTypeRef.current = null;
      if (progress === null) return;

      // ⚠️ **The step is dropped from the backlog whatever happened**, and the
      // reason is that every one of these endings has moved the ground under
      // it: the document it was read from may now be on a different type, and
      // the type it names may already exist twice. Re-offering it would write
      // one document's fields onto whichever of the two the stale id points at.
      discoverStepsRef.current.delete(step.typeId);
      setDiscoverBacklog(discoverStepsRef.current.size);

      // ⚠️ Remembered even on `unresolved`, where the row only MIGHT exist.
      // Refusing a name that turns out not to have been created costs the user
      // one rename; letting a name through that was created costs two types
      // with the same label and half the archive's fields under each.
      rememberTypeName(progress.status === "unresolved" ? progress.name : progress.type.name);

      // The document really did move, so the row's type is the new one — and
      // the rows still on the OLD type are still waiting for a form, which is
      // why only this one is touched.
      if (progress.status === "moved" || progress.status === "movedFieldsUnknown") {
        updateResult(step.path, { documentTypeId: progress.type.id });
      }

      const sentence =
        progress.status === "moved"
          ? t("typeNewTypeNoFields", { type: progress.type.name })
          : progress.status === "created"
            ? t("typeNewTypeNotMoved", { type: progress.type.name })
            : progress.status === "moveUnresolved"
              ? t("typeNewTypeMoveUnknown", { type: progress.type.name })
              : progress.status === "movedFieldsUnknown"
                ? t("typeNewTypeFieldsUnknown", { type: progress.type.name })
                : t("typeNewTypeUnresolved", { type: progress.name });
      setTypeWarnings((prev) => (prev.includes(sentence) ? prev : [...prev, sentence]));
    },
    [rememberTypeName, t, updateResult],
  );

  /**
   * A document type has its form.   (Slice #27.05)
   *
   * ⚠️ **`values` is deliberately ignored, and on this screen that is right.**
   * The dialog hands back the values discovery read so the form the user is
   * standing on can be filled in — there is no such form here, and the document
   * they belong to is one of forty in a table. Filling them in is #27.06's job,
   * which re-reads the documents of the type through `runAiInterpret` against
   * the template that now exists, rather than writing one document's values
   * from a client's memory.
   *
   * ⚠️ **Which rows stop saying "no form" depends on whether a NEW type was
   * created.** On the ordinary path the fields landed on `step.typeId`, so
   * every row of that type gained a form. On #27.04's path they landed on a
   * type this document alone was moved to, and the rows left behind on the old
   * one are exactly as formless as they were.
   */
  const handleDiscoverSaved = useCallback(
    () => {
      const step = followUps[followUpIndex];
      if (step !== undefined && step.kind === "discover") {
        discoverStepsRef.current.delete(step.typeId);
        setDiscoverBacklog(discoverStepsRef.current.size);
        const progress = pendingNewTypeRef.current;
        pendingNewTypeRef.current = null;
        // Slice #27.07 — the TYPE rather than just its id, because the run has
        // to be able to name what it gained a form for and this is the one
        // moment #27.04's brand-new type has a name at all. `movedTo` is
        // unchanged; only what it was read off is.
        const movedType =
          progress !== null &&
          (progress.status === "moved" || progress.status === "movedFieldsUnknown")
            ? progress.type
            : null;
        const movedTo = movedType?.id ?? null;
        // The next step in this same queue must refuse this name — see
        // `rememberTypeName`.
        if (progress !== null) {
          rememberTypeName(progress.status === "unresolved" ? progress.name : progress.type.name);
        }
        // ⚠️ **BOTH of the dialog's arguments are deliberately unread**, which
        // is why this takes none: a zero-argument handler is assignable and
        // says so without a lint suppression. `addedFieldCount` is the server's
        // number and there is nowhere on this screen that counts a TYPE's
        // fields — the row's sentence says a form arrived, and #27.07 is where
        // the run's report grows a place to say how many. `values` is covered
        // in this handler's own header.
        // ⚠️ **`typeFormMissing === true` is the test, NOT `documentTypeId`
        // alone, and an adversarial round is why.** Every settled row carries
        // its type now — including a skipped identity card, a `.txt` with no
        // page a model can see, and a row whose read failed. None of those was
        // ever told its type was waiting for a form, and matching on the id
        // alone printed the POSITIVE twin on all three: "tipul acestui document
        // a primit un formular" on a card whose type must never have one, in
        // the table and, permanently, in the saved report. The set that may be
        // told a form arrived is exactly the set that was told one was missing.
        // ⚠️ **…AND THE SAME SET IS QUEUED FOR A RE-READ.**   (Slice #27.06)
        //
        // Deliberately not a second predicate: the documents that are worth
        // reading again are exactly the documents that were told a form was
        // missing, because `typeFormMissing` is only ever written on a row the
        // run READ (the loop's `ok` branch and the retry's, nowhere else). That
        // rules out, without a single extra term, the three sets that must not
        // be re-read — a row skipped as an identity card or as having no page a
        // model can see, where a second call returns 422 for a billed attempt;
        // a row the archive already held, which belongs to an earlier run and is
        // out of this slice's scope in as many words; and a row whose first read
        // FAILED, whose remedy is the retry button beside it, which does this
        // and the discovery too.
        //
        // ⚠️ `docId` is a term because `awaitsRefill` is allowed to assume it —
        // see that function. Unreachable (a read row has one), and the count and
        // the walk agreeing about which rows exist is not a thing to leave to an
        // invariant nobody restates.
        //
        // ⚠️ **`"pending"` is written even over an earlier `"done"`**, because
        // the state is a queue position and not a history. The one route back
        // into this map is the RETRY: it re-decides `typeFormMissing` against
        // whatever type the document ended up on, so a row whose second read
        // moved it to another formless type can be told a form is missing again
        // and then be re-queued when that type is reviewed. The walk itself
        // cannot produce that state — it makes no claim about a new type's form
        // at all, deliberately; see its re-type branch.
        setResults((prev) =>
          prev.map((r) => {
            if (r.typeFormMissing !== true) return r;
            const queued: Partial<ImportResult> =
              r.docId !== undefined ? { refill: "pending", refillErrorDetail: undefined } : {};
            if (movedTo !== null) {
              return r.entry.path === step.path
                ? {
                    ...r,
                    documentTypeId: movedTo,
                    typeFormMissing: undefined,
                    typeFormAdded: true,
                    ...queued,
                  }
                : r;
            }
            return r.documentTypeId === step.typeId
              ? { ...r, typeFormMissing: undefined, typeFormAdded: true, ...queued }
              : r;
          }),
        );
        // The type now has a form, so nothing may queue a second discovery for
        // it — including a `handleReviewTypes` that runs before the enrichment
        // above would have noticed.
        docTypeFormRef.current.set(movedTo ?? step.typeId, true);
        /**
         * …and the RUN records that this type gained one, by name.
         *                                                       (Slice #27.07)
         *
         * ⚠️ **HERE, and not derived from the rows' `typeFormAdded`.** The
         * re-read walk clears that flag on any row its second read moved onto
         * another type — correctly, because such a row is no longer on the type
         * that gained the form. But this is a fact about the TYPE and it stays
         * true whatever becomes of the documents that caused it: on a run whose
         * one reviewed document was then re-typed, every row carrying the flag
         * loses it, and a names list read off the rows would report that the
         * run achieved nothing — over a `lookup_document_type` row that now has
         * a permanent form the user built two clicks ago.
         *
         * ⚠️ **`hadForm: false` is not a guess.** Both routes here are types
         * that had no form one moment ago: an ordinary step is only queued for
         * a type without one (`shouldDiscoverType`, and `enrichDiscoverSteps`
         * drops a type that gained one meanwhile), and #27.04's is a type
         * created empty seconds earlier. A known entry keeps its own `hadForm`
         * anyway, so the fallback only ever answers for an id this run had not
         * met.
         *
         * ⚠️ **A blank name does not overwrite a known one.** `step.typeName`
         * is empty exactly when the enrichment never came back — the state
         * `openableDiscoverSteps` refuses to open, so it should not be
         * reachable from here at all — and writing it over a name taken from
         * the start-of-run list would turn a nameable type into a silent one.
         */
        const gainedName = (movedType?.name ?? step.typeName).trim();
        setRunTypes((prev) => {
          const id = movedTo ?? step.typeId;
          const known = prev[id];
          return {
            ...prev,
            [id]: {
              name: gainedName === "" ? known?.name ?? "" : gainedName,
              hadForm: known?.hadForm ?? false,
              hasForm: true,
            },
          };
        });
        // The screens that cache the type list — the document form, Reference
        // Data — now hold a type whose form is out of date. Same invalidate
        // `document-form.tsx` runs after its own save.
        queryClient.invalidateQueries({ queryKey: ["document-types"] });
      }
      advanceFollowUp(followUpIndex);
    },
    [advanceFollowUp, followUps, followUpIndex, queryClient, rememberTypeName],
  );

  /**
   * The review was closed without a form.   (Slice #27.05)
   *
   * ⚠️ **The backlog SURVIVES a plain dismissal**, for the reason
   * `handleIdCardClosed` records about its own: an Escape, a dismissal and a
   * walk into a dead session are indistinguishable from here, and the pairs
   * exist nowhere else — they were read at the cost of a model call and are not
   * in any database. The row goes on saying the type has no form, which is
   * true, and the header's own control can offer it again.
   *
   * The one close that does NOT survive is a part-finished new-type run, and
   * `applyPendingNewType` is where that is decided and said.
   */
  const handleDiscoverClosed = useCallback(() => {
    const step = followUps[followUpIndex];
    if (step !== undefined && step.kind === "discover") applyPendingNewType(step);
    advanceFollowUp(followUpIndex);
  }, [advanceFollowUp, applyPendingNewType, followUps, followUpIndex]);

  /**
   * Read again, against the form the type has just been given. (Slice #27.06)
   *
   * ⚠️ **NOTHING HERE IS A NEW EXTRACTION PATH, and that is the slice.** It is
   * `runAiInterpret`, unchanged, called a second time: the route builds its
   * prompt from the type's `template_fields` and re-reads them on every call, so
   * the second call asks for the columns the review has just created. What makes
   * a second pass safe on a document somebody has touched in between is that
   * function's own merge-not-replace rule, which was written for exactly this.
   *
   * ⚠️ **SERIAL, and not because the server minds.** The run itself reads three
   * at a time; this one is walked one at a time because it is a queue the user
   * is watching and has just paid for — the same promise this file's header
   * makes about the follow-up steps. A progress line counting to a number the
   * click was priced at is only possible while the calls are ordered.
   *
   * ⚠️ **DELIBERATELY NOT `handleRetryInterpret` WITH A FLAG.** The two make the
   * same call and mean opposite things, and the failure branch is where that
   * shows: a retry that fails writes `aiStatus: "failed"`, whose sentence says
   * the document's fields "au rămas necompletate" — flatly untrue of a row whose
   * FIRST read succeeded and wrote them. Three more differences follow from the
   * same fact. The parties are left alone (see below). No discovery is queued:
   * that is what the retry adds for a row whose only read failed, and here the
   * type has just been reviewed. And `aiStatus` is never touched at all, so it
   * goes on meaning "how the run's own read went".
   *
   * ⚠️ **THE PARTIES ARE NOT RE-QUEUED, and the asymmetry with the retry is the
   * argument for it.** A retry re-queues because the read it is repeating never
   * queued anything. This row's read succeeded, so its people were queued then —
   * and `handlePartyStepClosed` deletes that ref entry only when somebody was
   * actually linked or created, so a document whose people are still unconfirmed
   * still HAS its entry and is still counted by `pendingPeopleCount`. There is
   * nothing to restore, and re-queueing a document whose people were settled
   * would ask the user to confirm people they have already linked — answer
   * "create" on that second pass and the run makes the duplicate person the
   * whole 26.xx redesign exists to prevent.
   */
  const handleRefill = useCallback(async () => {
    // See `readRunningRef` — the shared claim, so this walk cannot start on top
    // of a retry that began in the same frame, nor be started twice itself.
    if (readRunningRef.current) return;
    // ⚠️ **…and not underneath a follow-up modal, which a third round found the
    // ref alone does not cover.** `handleConfirmPending` is synchronous: it
    // publishes the person queue and returns without ever claiming the ref, so
    // the ordering where IT lands first — both buttons are drawn together on an
    // ordinary end state — left the walk starting under a `fixed inset-0`
    // stepper. `followUpsOpenRef` is the same mirror `handleReviewTypes` reads
    // for its own version of this, and it is up to date synchronously enough for
    // the frame that matters because that handler sets the state that feeds it.
    if (followUpsOpenRef.current) return;
    const targets = results.filter(awaitsRefill);
    if (targets.length === 0) return;
    readRunningRef.current = true;
    setRefillProgress({ done: 0, total: targets.length });
    try {
      for (let i = 0; i < targets.length; i++) {
        const row = targets[i];
        const path = row.entry.path;
        const docId = row.docId;
        // ⚠️ **DROPPED from the queue, not skipped, and a second adversarial
        // round is why.** `awaitsRefill` no longer tests `docId` — it cannot,
        // because `OutcomeRow` has none and the note and the count must ask the
        // same question it does — so the invariant lives at the set site alone.
        // A row that somehow arrived here without one is unreachable; if it were
        // reachable, skipping it would leave it `pending` for ever and the
        // offer's count could never fall to zero. Clearing the state is what
        // makes even the impossible case converge.
        if (docId === undefined) {
          updateResult(path, { refill: undefined });
          if (mountedRef.current) setRefillProgress({ done: i + 1, total: targets.length });
          continue;
        }

        // ⚠️ `aiPartialWrite` is deliberately NOT cleared before the call, where
        // `handleRetryInterpret` clears its own. That clear is there to stop the
        // amber block's retry BUTTON sitting live through its own call — and
        // this walk hides that button everywhere, because `readRunning` is true
        // for the whole of it. Left alone, the row goes on saying the first read
        // was partial, which it was, until the second read replaces the verdict.
        updateResult(path, { refill: "running" });
        // Third argument since #29.12 — and this walk is the call site where
        // omitting it would be worst: it re-reads a document whose folder title
        // the first read protected, so a bare call here would undo that.
        const interpreted = await runAiInterpret(docId, new Date().toISOString(), row.entry);
        // The same liveness test the retry needs and for the same reason: this
        // is outside the run effect, so there is no per-invocation `mounted`
        // boolean in scope, and a walk that outlives the dialog would write into
        // an unmounted tree.
        if (!mountedRef.current) return;

        if (!interpreted.ok) {
          if (interpreted.reason === "session") {
            // Every call after this one would fail the same way, so the walk
            // stops here and costs exactly one 401 to find out.
            //
            // ⚠️ **The row goes back to `pending`, not to `failed`.** It was
            // `running` when the session went, and a row left in that state
            // draws no note and is counted by nothing — the document would fall
            // out of the offer, the count and the progress line at once, which
            // is the shape #27.05's own backlog bugs all had. The documents
            // after it were never touched and are still `pending`, so one press
            // after signing in again picks up exactly where this stopped.
            //
            // ⚠️ **This row may already have been BILLED, and it is counted
            // again anyway.** `runAiInterpret` reports a lost session from the
            // PATCH as well as from the POST, so the extract call may have
            // reached the model and only the write have died. Counting it again
            // is the honest reading of what the offer's number is: reads this
            // screen still has to MAKE, not reads it has never paid for. The
            // document's columns are empty either way, and a row quietly dropped
            // to spare the count would be the information lost to spare the
            // arithmetic.
            abortRef.current = true;
            raiseSessionExpired();
            updateResult(path, { refill: "pending" });
            return;
          }
          updateResult(path, {
            refill: "failed",
            refillErrorDetail: failureDetail(interpreted),
          });
          setRefillProgress({ done: i + 1, total: targets.length });
          continue;
        }

        // The session is demonstrably back — this call went through it. The same
        // pair of clears `handleRetryInterpret` makes on its own success, for
        // the same reason: nothing else in this dialog can take either sentence
        // down, and leaving them up over a control that has just worked is what
        // made an expiry a one-way door.
        setSessionExpired(false);
        setReviewTypesError(null);

        /**
         * ⚠️ **A SECOND READ CAN RE-CLASSIFY THE DOCUMENT, AND WHEN IT DOES,
         * THE READ THE USER PAID FOR DID NOT DO WHAT IT WAS BOUGHT FOR.** Two
         * adversarial rounds arrived at this from opposite directions and it is
         * the hardest thing in the slice.
         *
         * The route builds its prompt from the template of the type the document
         * is on WHEN THE POST IS MADE — here, the type whose form was just
         * accepted. If the same response also moves the document to another
         * type, the one patch writes the new `documentTypeId` AND `customFields`
         * keyed by the OLD type's form, onto a document that now renders a
         * different one. So the values reach no column the user can see, which
         * is the exact thing this walk exists to stop; and `runAiInterpret`
         * REPLACES the column on a re-type rather than merging, so anything
         * curated under a key the new type does declare goes with it unless the
         * model returned it again on this call.
         *
         * ⚠️ **So the row records `retyped`, not `done`.** Folded into `done` it
         * drew an emerald "a fost citit din nou" on the one document the walk
         * achieved nothing for, dropped out of every count, and filed that
         * sentence permanently in the saved report. See `RefillState`.
         *
         * ⚠️ **AND THE ROW MAKES NO CLAIM ABOUT THE NEW TYPE'S FORM, which is
         * the second round's finding and is a refusal rather than an
         * omission.** The obvious move is to re-run `typeAwaitsForm` against the
         * new type — the retry path does exactly that — but the retry has a
         * backstop this walk deliberately does not: it queues a discovery, so
         * `enrichDiscoverSteps` asks the identity-card question again of the name
         * the SERVER holds, and `forgetTypeFormMissing` takes the sentence back.
         * Here `docTypeIdCardRef` is the start-of-run list and a type the route
         * invented on THIS call is not in it, and the scan's own signal is false
         * on a card it mislabelled — so the walk would write "tipul acestui
         * document nu are încă formular" onto an identity card, count it in
         * `typesWithoutForm`, and send the user off to build the one form
         * `status.ts` calls permanently wrong. "I cannot prove it" means do not
         * say it: `typeFormAdded` goes, because this row is demonstrably no
         * longer on the type that gained a form, and nothing takes its place.
         * `refillRetyped` is what tells the user to go and look at the type.
         */
        const movedTo = interpreted.documentTypeId;

        updateResult(path, {
          /**
           * ⚠️ **A PARTIAL SECOND READ IS NOT A DONE ONE, and a sixth
           * adversarial round found it one branch over from where rounds 3 and 4
           * had just closed the same shape.**
           *
           * `ok: true` with `partialWrite` means the extract call succeeded and
           * the GET of the document's current state did not — a 5xx, a 30 s
           * `RECORD_TIMEOUT_MS` abort, a truncated body — so `runAiInterpret`
           * gated `customFields` behind `currentReadable` and did not send them.
           * Those are precisely the columns this walk was bought to fill. Called
           * `done`, the row drew the emerald "a fost citit din nou" over values
           * that are still only in Notes, fell out of `awaitsRefill` so the
           * offer's count dropped, and fell out of `documentsAwaitingRefill` so
           * neither the concluding message nor the saved report listed it. The
           * money was spent and every screen said the job was finished.
           *
           * `failed` is the honest one: the columns did not get written, the
           * cause is transient, and the control offers it again. (The two
           * branches are mutually exclusive — a re-type needs `typeKnown`, which
           * needs the same GET — so the order of the ternary is not a
           * precedence question, but it is written outermost-first anyway.)
           */
          refill: movedTo !== null ? "retyped" : interpreted.partialWrite ? "failed" : "done",
          refillErrorDetail: undefined,
          // ⚠️ **`aiProcessed` and `aiFieldCount` are written ONLY when the read
          // landed on the document's own type, and a fourth adversarial round is
          // why.** The row draws "✓ N câmpuri completate" off these two, in
          // emerald, and on a re-typed row that number is built from the read
          // that missed: `runAiInterpret` counts the re-type itself as a field
          // and then counts every custom field it extracted — which are exactly
          // the values keyed by the OLD type's form that reach no column the new
          // one renders. So the cell said "✓ 11 câmpuri completate" beside
          // "informațiile lui tot nu au ajuns în câmpuri", both from one patch,
          // and `summariseImportRun` summed the 11 into "Câmpuri completate de
          // AI" in the concluding message and the saved report. Removing the
          // emerald tick from `refillDone` and leaving the emerald NUMBER beside
          // it would have been half a fix. The first read's count stays, because
          // it describes fields that are actually on screen.
          // On the `done` branch it IS the second read's number, replacing the
          // first's — the same thing the retry does with the same field, and the
          // honest reading: it is what the read this row's other sentences
          // describe actually wrote, not a running total. It can come out LOWER,
          // because the count is of fields THIS call filled and a model that
          // omits `subject` this time leaves the first read's value on the
          // record while returning one less. That wobble in "Câmpuri completate
          // de AI" is the price of the field meaning one thing rather than two;
          // adding the two would claim the document holds more filled fields
          // than it does.
          //
          // ⚠️ **AND THERE IS EXACTLY ONE WRITE OF IT IN THIS PATCH.** A fifth
          // adversarial round found the fourth round's fix dead on arrival: the
          // conditional spread above was followed, twenty-six lines of comment
          // later, by a plain `aiFieldCount: interpreted.fieldCount`, and a
          // literal property after a spread wins. Nothing warns about it —
          // TypeScript allows spread-then-literal and so does lint — so the
          // guard compiled, read correctly, and did nothing. If a later edit
          // needs this field on both branches, it belongs INSIDE the ternary,
          // not after it.
          ...(movedTo === null
            ? { aiProcessed: true, aiFieldCount: interpreted.fieldCount }
            : {}),
          // ⚠️ **OUTSIDE the `movedTo` ternary, and a fifth round is why.**
          // That ternary's argument is about a COUNT built from a read keyed by
          // the old type's form — a type-dependent value. The title decision is
          // type-independent by construction: `document-title.ts` is a pure
          // function over three strings and cannot reach the type, and this
          // suite asserts it. Placed inside, the flags were swallowed on
          // exactly the row where they matter most — a first read whose GET
          // failed (so it decided nothing), a type that gained a form during
          // the run, and a second read that both re-typed AND kept the title.
          // That document showed `✓ niciun câmp completat` and nothing else,
          // on screen and in the saved report, with its printed heading sitting
          // in Enhanced Notes. `handleRetryInterpret` already writes them
          // outside its own re-type spread; the two paths must not give
          // different copy for identical results.
          //
          // ⚠️ **`null` leaves the row's flag ALONE.** A re-read that returned
          // no title made no decision about it, and writing `undefined` over a
          // protected row cleared the one sentence saying so — `updateResult`
          // spreads the patch, so an explicit `undefined` overwrites.
          ...(interpreted.titleKept === null
            ? {}
            : {
                aiTitleKept: interpreted.titleKept || undefined,
                aiPrintedHeadingNoted: interpreted.printedHeadingNoted || undefined,
              }),
          // ⚠️ **A partial second read must not be drawn as a plain tick** —
          // #27.06's constraint, in as many words. Setting this puts the row
          // back in the amber block with its retry button and back into
          // `unreadCount`, which is exactly right: the state it describes is
          // real again.
          aiPartialWrite: interpreted.partialWrite,
          ...(movedTo !== null
            ? {
                // The id is written because it is where the document actually
                // is, and every later reader of this row — a retry, the report,
                // `summariseImportRun` — is entitled to the true one. It is NOT
                // load-bearing for `handleDiscoverSaved`, which skips this row
                // anyway now that `typeFormMissing` is left unset: that is the
                // silence, not an oversight. `typeFormMissing` stays exactly as
                // it was — see above.
                documentTypeId: movedTo,
                typeFormAdded: undefined,
              }
            : {}),
        });
        setRefillProgress({ done: i + 1, total: targets.length });
      }
    } finally {
      readRunningRef.current = false;
      if (mountedRef.current) setRefillProgress(null);
    }
    // `results` is what the targets are read from, so it belongs here; the walk
    // only ever WRITES to rows afterwards, through the functional `updateResult`,
    // so a list captured at the click is the list the sentence above it priced.
    // `scanResults` went with the identity-card test the re-type branch stopped
    // making — a dependency the body no longer reads is a lint warning that
    // teaches the next reader to ignore the rule.
  }, [raiseSessionExpired, results, updateResult]);

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
   * it, and two adversarial rounds went into that one line.** `followUpIndex` is
   * a positional cursor. A bare append could put two entries with the same
   * `path` in the queue, defeating the `key` that forces each step to remount;
   * and filter-then-append fixed that while leaving the cursor behind — removing
   * one element and adding one keeps the LENGTH unchanged, so
   * `followUps[followUpIndex]` stayed `undefined` and the stepper never opened.
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
      // ⚠️ **The synchronous claim, shared with #27.06's walk — see
      // `readRunningRef`.** Until that slice this handler had no guard but
      // `canRetry`, which is render-time state and so is one commit behind: two
      // clicks in the same frame, on this button and the re-read beside it,
      // both passed and raced two `runAiInterpret` calls on one document.
      if (readRunningRef.current) return;
      // ⚠️ **…and not underneath a follow-up modal either, which a fifth round
      // found the walk had and this did not.** `handleConfirmPending` is
      // synchronous: it publishes the person queue and returns without claiming
      // the ref, so pressing it and a row's retry inside one frame started a
      // billed read under a `fixed inset-0` stepper. That is worse here than in
      // the walk, because this handler's `settled` test reads the row snapshot
      // captured at the CLICK — answer that document's party step while the call
      // is in flight and the patch afterwards writes `aiPartiesPending` back
      // over the answer and re-queues the same people, which is the duplicate
      // person the whole 26.xx redesign exists to prevent.
      if (followUpsOpenRef.current) return;
      readRunningRef.current = true;
      try {

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
      // Third argument since #29.12 — same reason as the run loop and the
      // refill walk: a retry must reach the same title decision they did.
      const interpreted = await runAiInterpret(docId, new Date().toISOString(), result.entry);
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
        // …and so does the review control's own "Sesiune expirată", which is a
        // transient about the same fact and had only one clearer of its own. An
        // adversarial round left it on screen beside "Câmpurile găsite pot fi
        // verificate acum", under a banner that had just gone.
        setReviewTypesError(null);
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
          partyStepsRef.current.set(path, {
            kind: "parties",
            path,
            docId,
            parties: interpreted.parties,
          });
        }
        /**
         * ⚠️ **The retry has to answer #27.05's questions too, and leaving it
         * out was wrong in two directions.** This is the run's own commonest
         * failure — a rate limit at document twelve of forty — so a type whose
         * ONLY document failed its first read is a type the loop never asked
         * about: no discovery, no count, no review, and the slice's headline
         * sentence quietly false. And in the other direction, this call can
         * RE-TYPE the document, so a row left carrying its old type is a row
         * `handleDiscoverSaved` will later mark "gained a form" over a type it
         * is no longer on — a false claim on the screen and in the saved report,
         * which is the one artefact the user keeps.
         */
        const finalTypeId = interpreted.documentTypeId ?? result.documentTypeId ?? null;
        /**
         * Has a type-list read absolved this type since `awaitsForm` was
         * decided?                                               (Slice #27.07)
         *
         * ⚠️ **`awaitsForm` is computed from refs, in this tick, and a type
         * list is the only thing that can contradict it.** Two enrichments run
         * below and NEITHER sees everything, which is why this is a `let`
         * written by both rather than a value:
         *
         *   - the PREFLIGHT sees the archive as it stands, including a type the
         *     user finished in another tab — but it walks the discovery map it
         *     is handed, so it cannot see a type this call is about to queue;
         *   - the SECOND read, after the step is created, is the only thing in
         *     the whole run that ever sees the SERVER's name for a type invented
         *     mid-run, which is the only way a mislabelled identity card is ever
         *     recognised.
         *
         * ⚠️ **Today only the second write can change an outcome, and saying so
         * is the honest version.** `awaitsForm` is computed after
         * `absorbTypeList(preflight)` has refreshed the two refs it reads, so
         * wherever the preflight arm is true `awaitsForm` is already false and
         * `awaitsForm && !typeAbsolved` was settled without it. The first write
         * stays because it is what keeps this correct if `awaitsForm` ever moves
         * back above the preflight — which is where it lived until this round —
         * and because a flag that is right for one reason while silent about the
         * other is how the next reader deletes the wrong half.
         *
         * ⚠️ **`||=` on the second, never `=`.** Writing `awaitsForm` back over
         * `absorbTypeList`'s work — or letting a later read reset this to false
         * — put the claim straight onto the one row that paid for the read: it
         * drew "tipul acestui document nu are încă formular" over a finished
         * type or an identity card, `typesWithoutForm` counted it, and #27.07
         * NAMED it, permanently, in the saved report. Unfixable from the UI
         * too: the enrichment deletes the step, so no review can clear it.
         */
        let typeAbsolved = false;
        /**
         * …and separately, whether `formArrivedElsewhere` QUEUED THIS ROW.
         *                                                       (Slice #27.07)
         *
         * ⚠️ **A second flag rather than a term on the first, and a fourth
         * adversarial round found both directions it was wrong in.**
         * `typeAbsolved` answers "may this row still be told a form is owed",
         * and it is true for TWO causes on the type the document ENDS on. The
         * refill patch is asking something narrower: did the callback a few
         * lines above write `refill: "pending"` onto this row — which it does
         * for one of those causes only, matched on the type the row was on
         * BEFORE this call.
         *
         *   - The identity-card cause queues nothing, deliberately: there is no
         *     form coming and nothing to re-read into. Reusing `typeAbsolved`
         *     drew "citirea din nou nu a completat câmpurile" on a card and had
         *     the header offer a billed re-read of the one type `status.ts`
         *     calls permanently correct without a form.
         *   - A retry that RE-TYPES the document asks about the new type, which
         *     has no form — so `typeAbsolved` was false while the callback had
         *     matched the row on its old one and queued it. The row ended
         *     carrying `refill: "pending"` over a read that had just happened,
         *     with the header pricing another one.
         *
         * So this mirrors `formArrivedElsewhere`'s predicate term for term — as
         * that callback is applied by the PREFLIGHT. ⚠️ **It is deliberately not
         * widened by the second enrichment**, and the reason is the opposite of
         * the one that widens `typeAbsolved` beside it: a form first seen there
         * cannot have existed when `runAiInterpret` POSTed, so that row's queued
         * re-read is correct and must stand. The argument is written out at the
         * site where the widening is refused.
         */
        let refillQueuedByAbsorb = false;
        /**
         * ⚠️ **THE TYPE LIST IS READ FIRST, BEFORE ANYTHING DECIDES ANYTHING.**
         *                                                       (Slice #27.07)
         *
         * A fifth adversarial round found the refresh nested two `if`s deep —
         * inside `shouldDiscoverType`, inside `discovered.ok && pairs.length >
         * 0` — so the three ordinary ways to miss it were all live: the type
         * was already claimed by the main run, the discovery came back a rate
         * limit, or it found nothing proposable. On every one of those,
         * `awaitsForm` below was decided from a `docTypeFormRef` last written
         * at the start of the run, and the row was told a form was owed for a
         * type the user had finished in another tab — named, permanently, in
         * the saved report, with `discoverBacklog` at zero so no control on the
         * screen could take it back.
         *
         * Hoisting it costs one GET on a path that has just paid for a model
         * call, and it buys three things at once: `typeIsIdCard` and
         * `awaitsForm` decide from what the archive currently looks like,
         * `shouldDiscoverType` stops buying a billed discovery for a type that
         * already has a form, and the two flags declared above are read off the same
         * answer the rows were patched from. #27.07 removed
         * `enrichDiscoverSteps`' empty-queue early return precisely so this
         * call is always a real read.
         */
        const preflight = await enrichDiscoverSteps(discoverStepsRef.current);
        if (!mountedRef.current) return;
        if (preflight.names !== null) setTypeNames(preflight.names);
        absorbTypeList(preflight);
        if (preflight.sessionLost) {
          abortRef.current = true;
          raiseSessionExpired();
        }
        setDiscoverBacklog(discoverStepsRef.current.size);
        typeAbsolved =
          finalTypeId !== null &&
          (preflight.idCardTypeIds.includes(finalTypeId) ||
            preflight.typeRows?.some((r) => r.id === finalTypeId && r.hasForm) === true);
        // …and the narrower question, off `result` — the row as it was when the
        // retry was pressed, which is the state `formArrivedElsewhere` matched
        // on. See `refillQueuedByAbsorb`.
        refillQueuedByAbsorb =
          result.typeFormMissing === true &&
          result.docId !== undefined &&
          result.documentTypeId !== undefined &&
          preflight.typeRows?.some(
            (r) => r.id === result.documentTypeId && r.hasForm,
          ) === true;
        const typeIsIdCard =
          finalTypeId !== null &&
          (docTypeIdCardRef.current.get(finalTypeId) === true ||
            isIdCardEntry(scanResults.get(path)));
        const awaitsForm =
          finalTypeId !== null &&
          typeAwaitsForm({
            typeId: finalTypeId,
            fallbackTypeId: fallbackTypeIdRef.current,
            typeHasForm: docTypeFormRef.current.get(finalTypeId) === true,
            typeIsIdCard,
          });
        // …and the discovery the failed read never got to.
        //
        // ⚠️ **BEFORE the row's own patch, so `aiStatus` is still `running`
        // for the whole of it.** That is what keeps Close and Save-report
        // disabled — `readRunning` reads `aiStatus === "running"` — over a
        // billed call in flight. Patching the row first would have left the
        // dialog closeable mid-read, discarding a proposal nobody can pay
        // for twice. Claimed the same way the loop claims it, so a second
        // retry of the same type cannot buy a second read.
        if (
          // ⚠️ **`!preflight.sessionLost` — the FRESH witness, and emphatically
          // NOT `abortRef.current`.** The preflight above can report a dead
          // session one step before this test, and `shouldDiscoverType` does
          // not consult anything: unguarded, the handler spends a billed
          // discovery on a call that is certain to 401. The claim it makes in
          // `discoverClaimedRef` on the way is NOT the harm and must not be
          // released — that ref's own header keeps a failed read claimed on
          // purpose, so one rate limit cannot buy three more attempts inside a
          // single run.
          //
          // ⚠️ **`abortRef` was this guard's first draft and two reviewers
          // rejected it, correctly: it is a one-way latch nothing ever lowers.**
          // `canRetryReads`' own header records three rounds spent making the
          // retry BUTTON survive an expiry — "signing in again … in a new tab …
          // brought no button back for the life of the dialog" — and gating on
          // the latch here would have rebuilt that door one level down, with
          // the button live and the discovery behind it silently gone for the
          // rest of the session. This is the better witness on its own terms
          // too: reaching this line took a model call and a GET that both went
          // through the session moments ago.
          !preflight.sessionLost &&
          finalTypeId !== null &&
          shouldDiscoverType({
            typeId: finalTypeId,
            fallbackTypeId: fallbackTypeIdRef.current,
            typeHasForm: docTypeFormRef.current.get(finalTypeId) === true,
            typeIsIdCard,
            claimedTypeIds: discoverClaimedRef.current,
            // ⚠️ **THE SAME VALUE AT BOTH CALL SITES, and passing `false` here
            // would undo the waiver one button at a time.** (Slice #32.05.) The
            // retry is a press, so it is tempting to read it as the user asking
            // for the read after all — but the press is "read this DOCUMENT
            // again", not "propose a form for its type", and a waived run that
            // spent a discovery on the first row somebody retried would have
            // opened the very dialog the waiver declined.
            formsWaived,
          })
        ) {
          discoverClaimedRef.current.add(finalTypeId);
          const discovered = await discoverForType(docId);
          if (!mountedRef.current) return;
          if (discovered.ok && discovered.pairs.length > 0) {
            discoverStepsRef.current.set(finalTypeId, {
              kind: "discover",
              path,
              docId,
              typeId: finalTypeId,
              typeName: "",
              existing: [],
              pairs: discovered.pairs,
              documentLabel: discovered.documentLabel,
              partyRoleNames: discovered.partyRoleNames,
              skippedPages: discovered.skippedPages,
              truncated: discovered.truncated,
            });
            // ⚠️ **Named here rather than left to the header's own control**, so
            // the backlog this raises is one the button can open immediately.
            // The step is otherwise unenriched — `typeName` empty — and the
            // dialog puts that name in a title over a permanent decision.
            //
            // ⚠️ **A SECOND read, and it is not the preflight repeated.** That
            // one ran before this step existed; this one is what fills in the
            // step's `typeName`, which is the whole reason it is here — and it
            // is also the only read that can see the type this call just
            // queued. Neither can be dropped in favour of the other, and the
            // two flags are WIDENED by it rather than replaced; see below.
            const enriched = await enrichDiscoverSteps(discoverStepsRef.current);
            if (!mountedRef.current) return;
            if (enriched.names !== null) setTypeNames(enriched.names);
            absorbTypeList(enriched);
            /**
             * ⚠️ **`||=`, and a sixth adversarial round is why it can be
             * neither `=` nor omitted.**                         (Slice #27.07)
             *
             * `enrichDiscoverSteps` collects `idCardTypeIds` by walking the map
             * it is HANDED, so the preflight — which ran before this step was
             * added — structurally cannot contain this type. That is exactly
             * the row the identity-card term exists for: a scan mislabels a
             * card, the route invents a `lookup_document_type` row for it
             * mid-run, so the type is in no start-of-run map and the scan's own
             * signal is false. This read is the only place its real name is
             * ever seen.
             *
             * Left out, `updateResult` below wrote `typeFormMissing: true` back
             * over the clear `absorbTypeList` had just made — an explicit value
             * beats a functional updater — and the row drew "tipul acestui
             * document nu are încă formular" on an identity card, named,
             * permanently, in the saved report, with the step already deleted
             * so nothing on the screen could take it back.
             */
            typeAbsolved ||=
              finalTypeId !== null &&
              (enriched.idCardTypeIds.includes(finalTypeId) ||
                enriched.typeRows?.some((r) => r.id === finalTypeId && r.hasForm) === true);
            /**
             * ⚠️ **`refillQueuedByAbsorb` is deliberately NOT widened here, and
             * an eighth adversarial round is why.**              (Slice #27.07)
             *
             * It looks like the same omission the line above fixes, and it is
             * the opposite. That flag exists to say "this row was just re-read,
             * so throw away the `refill: "pending"` the callback wrote on it".
             * A form that only appears at THIS read demonstrably was not there
             * when `runAiInterpret` POSTed — the preflight answered `hasForm:
             * false` for the type AFTER the POST had already come back — so the
             * values this call extracted went to Notes exactly as the first
             * read's did. `formArrivedElsewhere` queuing it is correct, and
             * overwriting that with the read's own verdict wrote "a fost citit
             * din nou" over a document whose columns are empty, dropped it out
             * of `documentsAwaitingRefill` and out of the re-read offer, and
             * filed both in the saved report.
             */
            // The same reading the other two call sites make: a lost session is
            // not "the list could not be read". See `enrichDiscoverSteps`.
            if (enriched.sessionLost) {
              abortRef.current = true;
              raiseSessionExpired();
            }
            setDiscoverBacklog(discoverStepsRef.current.size);
          } else if (!discovered.ok && discovered.reason === "session") {
            abortRef.current = true;
            raiseSessionExpired();
          }
        }

        updateResult(path, {
          aiStatus: "done",
          aiProcessed: true,
          aiFieldCount: interpreted.fieldCount,
          // `null` leaves the previous answer alone — see the refill walk's
          // copy of this for the row it was clearing.
          ...(interpreted.titleKept === null
            ? {}
            : {
                aiTitleKept: interpreted.titleKept || undefined,
                aiPrintedHeadingNoted: interpreted.printedHeadingNoted || undefined,
              }),
          aiPartialWrite: interpreted.partialWrite,
          aiErrorDetail: undefined,
          ...(finalTypeId !== null ? { documentTypeId: finalTypeId } : {}),
          // `&& !typeAbsolved` since #27.07 — see that flag's own header for the
          // permanent, unfixable sentence it stops.
          typeFormMissing: (awaitsForm && !typeAbsolved) || undefined,
          // A type that has since gained a form is no longer waiting for one,
          // and this row has never claimed it gained one — so the flag is
          // cleared rather than left to contradict the sentence beside it.
          // ⚠️ **…and a RE-TYPE clears it too, which #27.06's third adversarial
          // round found missing here.** `awaitsForm` alone only covers the case
          // where the new type ALSO has no form; when it has one, `awaitsForm`
          // is false and the row went on drawing "tipul acestui document a
          // primit un formular în acest import" about a type this very call had
          // just moved it off. The walk clears it unconditionally on a re-type
          // and says why; this is the same rule, said once more where the same
          // patch is written.
          ...(awaitsForm || interpreted.documentTypeId !== null
            ? { typeFormAdded: undefined }
            : {}),
          // Only when this retry actually queued something. Setting both would
          // make the row claim a tally AND a pending count, which the render
          // resolves by showing the stale tally — see `aiPartiesPending`.
          ...(queued ? { aiPartiesPending: interpreted.parties.length, aiParties: undefined } : {}),
          /**
           * ⚠️ **A SUCCESSFUL RETRY IS ALSO A RE-READ, and an adversarial round
           * found what forgetting that costs.**   (Slice #27.06)
           *
           * The two controls are drawn side by side on one ordinary state: a
           * row whose first read came back `partialWrite` AND whose type gained
           * a form during the run carries both the amber retry button and a
           * place in the re-read queue. This call went to the same route, for
           * the same document, against the type's template as it now stands —
           * which is exactly what the walk would have done. Leaving `refill` at
           * `pending` afterwards left the row saying "informațiile specifice
           * tipului au rămas în Note" over columns that had just been filled,
           * kept it in `refillCount` so the offer never reached zero, and made
           * the next press spend a third billed read on it. Same through the
           * `failed` door: the amber "citirea din nou nu a reușit" survived a
           * retry that had just succeeded.
           *
           * `awaitsRefill` and not a hand-written test, so the thing that
           * decides a row is owed a read is the thing that decides it is not.
           *
           * ⚠️ **AND IT LANDS ON THE SAME FOUR-WAY ANSWER THE WALK GIVES, which
           * a third round found it dodging.** A retry that re-classified the
           * document is the case `RefillState.retyped` exists for — the values
           * came back keyed by the old type's form and reach no column the new
           * one renders — and writing `done` there drew the emerald "a fost citit
           * din nou" on the one document nothing was achieved for, dropped it out
           * of `documentsAwaitingRefill`, and filed that sentence in the saved
           * report. Two controls, one route, one verdict.
           */
          // ⚠️ **`|| refillQueuedByAbsorb` since #27.07, and an adversarial
          // round found the row it is for: THIS one.** `result` is the
          // click-time snapshot, so it cannot see what `absorbTypeList` wrote a
          // few lines above — and on a retry whose enrichment discovered the
          // type had gained a form elsewhere, what it wrote was
          // `refill: "pending"` on every row of that type, this one included.
          // Correct for its forty siblings and flatly wrong here: this document
          // has just been re-read, against that very template, by the call
          // whose result is being written. Left alone it drew "nu a fost citit
          // din nou … au rămas în Note" over columns that had just been filled,
          // counted itself in `documentsAwaitingRefill`, and had the header
          // offer another billed read and another document version for it — in
          // the saved report, permanently.
          //
          // ⚠️ **`refillQueuedByAbsorb`, NOT `typeAbsolved`** — see that flag's
          // own header for the two rows the wider one got wrong in opposite
          // directions.
          ...(awaitsRefill(result) || refillQueuedByAbsorb
            ? {
                // The same three-way answer the walk gives, including the
                // partial case it records at length: a read whose columns did
                // not land is not a finished one, whichever control made it.
                refill: (interpreted.documentTypeId !== null
                  ? "retyped"
                  : interpreted.partialWrite
                    ? "failed"
                    : "done") as RefillState,
                refillErrorDetail: undefined,
                // ⚠️ …and the field count goes back to the first read's on a
                // re-type, for the reason the walk's own patch states at length:
                // the number this call produced counts the re-type plus the
                // custom fields it wrote under the OLD type's keys, none of
                // which the new type's form renders. Restored rather than left
                // out, because the patch above has already set it. A refill
                // target always has a first-read count, so this is never
                // `undefined` in practice.
                ...(interpreted.documentTypeId !== null
                  ? { aiFieldCount: result.aiFieldCount }
                  : {}),
              }
            : {}),
        });
        return;
      }

      if (interpreted.reason === "session") {
        abortRef.current = true;
        raiseSessionExpired();
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
        // ⚠️ `refill` is deliberately LEFT as it was. A retry that failed read
        // nothing, so a row that was owed a re-read is still owed one and stays
        // in the offer's count — the mirror of the success branch above.
      });
      } finally {
        // Released whichever way this returned, including the `!mountedRef`
        // path: the ref outlives the render tree and a claim left standing
        // would make every later retry and every re-read a no-op.
        readRunningRef.current = false;
      }
    },
    // `t` is captured for the two sentences above; next-intl's translator is
    // stable per namespace, so listing it costs no re-renders and keeps this in
    // step with the queue handlers above. `entries` went when the retry stopped
    // republishing the queue — `handleConfirmPending` owns that now, and a
    // dependency the body no longer reads is a lint warning that teaches the
    // next reader to ignore the rule.
    // `forgetTypeFormMissing` since #27.05 — the retry enriches its own new
    // step, so it has to be able to take the sentence back off a type that
    // turned out to be an identity card. It is a `useCallback` with no deps, so
    // listing it costs no re-renders. #27.07 folded it into `absorbTypeList`
    // together with two more follow-ups of the same kind; that one is a
    // `useCallback` over no-dep callbacks and is likewise stable for the
    // dialog's life.
    // `formsWaived` since #32.05: a prop, and a stable one for this dialog's
    // life — the wizard cannot change it while a run is on screen — so listing
    // it costs no re-renders and keeps the lint honest about the read below.
    [absorbTypeList, formsWaived, raiseSessionExpired, scanResults, t, updateResult],
  );

  // ---------------------------------------------------------------------------
  // Counts
  // ---------------------------------------------------------------------------

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
  /**
   * ⚠️ **Since #26.10 it also counts an identity card nobody answered**, and
   * the two belong under one sentence because they have one remedy: the control
   * beside it republishes both backlogs. A card whose dialog was dismissed is
   * counted for the same reason a skipped party stepper is — the entry survives
   * in its ref, so the offer can still be made, and a count that ignored it
   * would leave the only control that can reach those cards drawn over a
   * sentence claiming there is nothing left to confirm.
   *
   * `idCardQueued && !personId` is deliberately BOTH states at once: not asked
   * yet, and asked and declined. `personFileUnreadable` rows are absent by
   * construction — they were never queued.
   */
  const pendingPeopleCount = results.filter(
    (r) => (r.aiPartiesPending ?? 0) > 0 || (r.idCardQueued === true && r.personId === undefined),
  ).length;
  /**
   * A billed read on a SETTLED row is in flight, so the dialog must not be
   * pulled out from under it.
   *
   * ⚠️ **Renamed from `retryRunning` in #27.06, because it is no longer only
   * the retry.** Two controls now make a model call on a row that is already
   * `done` — the retry, and the re-read this slice adds — and every consumer of
   * this boolean wants the same thing from both: Close and Save-report inert
   * over a call whose PATCH may already have landed, the retry buttons hidden so
   * two overlapping calls cannot resolve in turn and overwrite each other's row,
   * and the review control hidden so a queue replacement cannot land mid-call. A
   * name that said "retry" over a term that also covers the re-read is exactly
   * the drift this file writes comments to stop. `canRetryReads` keeps its own
   * parameter name; what it means there is unchanged.
   *
   * The re-read half is `refillProgress`, not a per-row test, because the walk
   * holds the screen for its whole length and not merely for the row it is on.
   */
  const readRunning =
    results.some((r) => r.aiStatus === "running" && r.status === "done") ||
    refillProgress !== null;
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
    stepperOpen: currentFollowUp !== null,
    // Since #27.06 this term also covers a re-read walk — see `readRunning`.
    // The rule is unchanged: no second billed call on a settled row while one
    // is already in flight.
    retryRunning: readRunning,
  });
  /**
   * May the queued forms be opened right now?   (Slice #27.05)
   *
   * ⚠️ **ONE expression, read by the sentence AND by the button beside it.**
   * `canRetryReads` exists because those two disagreed three rounds running
   * about the retry; this is the same pair asking the same question about the
   * review, and an adversarial round had already caught them disagreeing once —
   * the header offering "can be reviewed now" while a retry in flight hid the
   * control. The terms are `canRetryReads`'s own, for its own reasons: nothing
   * in this app traps focus, so a control rendered under an open modal is
   * reachable from inside it; and a retry captured its row's state before its
   * model call, so a review completing inside that window would be overwritten
   * when it lands.
   */
  const canReviewTypes =
    discoverBacklog > 0 && currentFollowUp === null && !readRunning;
  /**
   * Documents read before their type had a form, and not yet read again.
   *                                                              (Slice #27.06)
   *
   * ⚠️ **`awaitsRefill` and not an expression here**, for the reason that
   * function's own header gives: this number is what the sentence prices and
   * what the button promises, and `handleRefill` walks the same predicate to
   * decide what it actually reads. Two of them is a control that never takes its
   * own count to zero.
   */
  const refillCount = results.filter(awaitsRefill).length;
  /**
   * May that re-read be started right now?   (Slice #27.06)
   *
   * The terms are `canReviewTypes`'s, one line above, and they are its for the
   * same reasons — nothing in this app traps focus, so a control rendered under
   * an open modal is reachable from inside it; and a walk started while another
   * billed call is in flight would resolve against a row whose state that call
   * captured before it began. The session is deliberately NOT a term: it is
   * `canRetryReads`'s one-way-door argument, and it applies here unchanged —
   * the flag never clears by itself, so gating on it would mean signing in again
   * brought no control back for the life of the dialog. What the session changes
   * is the sentence beside the button.
   */
  /**
   * ⚠️ **`!reviewingTypes` is the term `canReviewTypes` does not need and this
   * one does**, and it is the other half of the collision guarded in
   * `handleReviewTypes`: that control awaits a GET and then REPLACES the queue,
   * and for the length of that await no follow-up is open and no read is
   * running, so without this the re-read button is live underneath it.
   */
  const canRefill =
    refillCount > 0 && currentFollowUp === null && !readRunning && !reviewingTypes;
  const totalCount = results.length;
  const progressPct = totalCount > 0 ? ((doneCount + errorCount) / totalCount) * 100 : 0;

  /**
   * One row, as `import-outcome.ts` needs to see it.   (Slice #26.10)
   *
   * ⚠️ **The three facts that are NOT on `ImportResult` are resolved here and
   * only here**: whether the file is coordinate-named, whether its Property is
   * a single one, and which Property its corners actually built. All three come
   * from the same readers the import loop and the property step used —
   * `isCoordinateRow`, `soleProperty`, `cornerSourceByPath` — so a note and the
   * run that produced it cannot disagree.
   */
  const outcomeRowOf = useCallback(
    (r: ImportResult): SummaryRow => {
      const cornerPropertyId = cornerSourceByPath?.get(r.entry.path);
      const cornerProperty =
        cornerPropertyId === undefined ? undefined : propertyById.get(cornerPropertyId);
      return {
        status: r.status,
        preexisting: r.preexisting,
        isCoordinate: isCoordinateRow(r, cornerSourceByPath, soleProperty(r.entry.path) !== null),
        // The CODE, not the id: a note that named a uuid would be a note nobody
        // can act on. An id with no Property behind it is treated as "not
        // applied" rather than printed raw — see `coordinateNote`.
        cornerPropertyCode: cornerProperty?.code ?? null,
        cornerCount: cornerProperty?.cornerCount ?? 0,
        isIdCard: isIdCardEntry(scanResults.get(r.entry.path)),
        canLinkPerson: soleProperty(r.entry.path) !== null,
        personId: r.personId,
        personCreated: r.personCreated,
        personDeclined: r.personDeclined,
        personFileUnreadable: r.personFileUnreadable,
        personStepUnfinished: r.personStepUnfinished,
        readSkipped: r.aiSkipReason,
        aiProcessed: r.aiProcessed,
        aiFieldCount: r.aiFieldCount,
        aiUnread: r.aiStatus === "failed" || r.aiPartialWrite === true,
        aiPeopleSettled: r.aiParties ? r.aiParties.linked + r.aiParties.created : 0,
        aiPeoplePending: r.aiPartiesPending ?? 0,
        idCardQueued: r.idCardQueued,
        idCardFieldsWritten: r.idCardDocFieldsFailed === true ? 0 : r.idCardDocFields ?? 0,
        // Slice #27.05 — straight through. The rule that decides them is
        // `typeAwaitsForm`, applied once in the loop; nothing here re-derives
        // it, for the reason this callback's own header gives about the three
        // facts it does resolve.
        documentTypeId: r.documentTypeId,
        // Slice #27.07 — the NAME behind that id, looked up rather than carried
        // on the row. ⚠️ **A row is written once per event and a type is
        // renamed independently of it**, so a name copied onto forty rows at
        // import time is forty copies to keep in step; `runTypes` is refreshed
        // by every type-list read the run makes, and this is a read of it.
        // Absent for a type the run never learned a name for — see
        // `SummaryRow.documentTypeName` for why that is counted and not named.
        documentTypeName:
          r.documentTypeId === undefined ? undefined : runTypes[r.documentTypeId]?.name,
        // Slice #29.06 — decided HERE, from the resolution the loop recorded
        // AND the type the document is on when the screen is drawn. Two facts,
        // because one is not enough: a document the scan could not classify, or
        // whose type create failed, may have been re-typed onto something real
        // by the AI read seconds later — and a row still saying "it is on the
        // general type" over a document that is not would be the screen sending
        // a user to fix something already right. `fallbackTypeId` is null until
        // the run has read the type list, and a `=== null` comparison against
        // an absent `documentTypeId` is false, which is the safe direction:
        // says nothing rather than says it wrongly.
        typeUnclassified:
          r.typeResolution === "unclassified" && r.documentTypeId === fallbackTypeId
            ? true
            : undefined,
        typeCreateFailed:
          r.typeResolution === "failed" && r.documentTypeId === fallbackTypeId
            ? true
            : undefined,
        typeFormMissing: r.typeFormMissing,
        typeFormAdded: r.typeFormAdded,
        // Slice #27.06 — straight through, for the same reason the three above
        // are: the rule that decides it is `awaitsRefill` and the set site in
        // `handleDiscoverSaved`, and a second derivation here is how a row comes
        // to describe a queue the walk is not walking.
        refill: r.refill,
      };
    },
    [cornerSourceByPath, fallbackTypeId, propertyById, runTypes, scanResults, soleProperty],
  );

  /**
   * The rows, with each property folder's coordinate file at its head.
   * (Slice #26.10)
   *
   * The source document's reason is that creating the Property from that file
   * is the first thing that happened, so it is the first thing the record of
   * what happened should say. The rule is `inResultOrder`, which is pure and
   * tested; this is only where the two facts it needs are read.
   */
  const orderedResults = useMemo(
    () =>
      inResultOrder(results, (r) => ({
        pathParts: r.entry.pathParts,
        isCoordinate: isCoordinateRow(
          r,
          cornerSourceByPath,
          soleProperty(r.entry.path) !== null,
        ),
      })),
    [results, cornerSourceByPath, soleProperty],
  );

  /**
   * What the concluding message reads out.   (Slice #26.10)
   *
   * Computed here rather than by the wizard because every fact in it lives in
   * this component's state — see the `onClose` prop.
   */
  const summary: ImportRunSummary = useMemo(
    () =>
      summariseImportRun(
        results.map(outcomeRowOf),
        properties.length,
        // The ones the property step actually WROTE. See `ResolvedProperty.created`
        // and `runLandedSomething` for why a matched Property is not one of them.
        properties.filter((property) => property.created).length,
      ),
    [results, outcomeRowOf, properties],
  );

  /**
   * What this run did to the document TYPES it met, in words.    (Slice #27.07)
   *
   * ⚠️ **TWO SOURCES FOR TWO HALVES, AND THAT IS THE DESIGN RATHER THAN AN
   * ACCIDENT.** "Still without a form" is a fact about the ROWS this run read —
   * it is exactly the set `summariseImportRun` already counts, which is what
   * keeps the names and `typesWithoutForm` from describing two different
   * backlogs, and what inherits for free every exclusion #27.05 argued for: an
   * identity card, a file with no page a model can see, the fallback type, and
   * a document the archive already held. "Gained a form" is a fact about the
   * TYPE, recorded where the form is accepted, because a row can stop carrying
   * it while the type keeps it — see `handleDiscoverSaved`.
   *
   * ⚠️ **`typesThatGainedForm` is asked over the WHOLE map rather than over the
   * types the run met**, and it is safe because `hasForm` is raised in exactly
   * one place: this run's own acceptance. A type the run never touched has
   * `hadForm === hasForm` and drops out. See `runTypes`.
   */
  const runTypeSentences = useMemo(() => {
    const changes: RunTypeFormChange[] = Object.entries(runTypes).map(([id, fact]) => ({
      id,
      ...fact,
    }));
    return runTypeNotes({
      gained: typesThatGainedForm(changes),
      withoutForm: summary.typesWithoutFormNames,
      // ⚠️ **The number the header prints two lines above this block**, passed
      // in so the sentence can say when its list is not all of them. An
      // adversarial round found the two counting different things — that one is
      // distinct by type ID, the names are distinct by string and drop the ones
      // the run could not name — so "2 tipuri…" could sit directly above a
      // one-item list that the Romanian reads as exhaustive, on screen and
      // permanently in the report.
      withoutFormTotal: summary.typesWithoutForm,
      // Slice #29.06 — the types this run CREATED and then left with nothing on
      // them.
      //
      // ⚠️ **EVERY row, with no status filter, and an adversarial round took
      // the filter out.** `documentTypeId` is written the instant
      // `createDocument` returns and nowhere earlier, so its presence IS the
      // test "this row has a Document in the archive" — which is the question
      // being asked. Filtering on `status === "done"` looked equivalent and was
      // not: a row whose upload or tag failed ends `error` while its Document,
      // created before any of that, sits on the type perfectly well. The screen
      // then named that type as abandoned and told the user to delete it —
      // permanently, in the saved report, over a delete #29.05 refuses.
      //
      // ⚠️ **`r.documentTypeId` is the LATEST type known for the row** — the
      // one the read settled on where a read happened, and the one the loop
      // resolved where it did not. Both are the right answer to "is anything
      // filed under this type": the first because a re-typed document has left
      // the type it was created on, the second because a row whose upload
      // failed still has a Document sitting on it. See
      // `ImportResult.documentTypeId`.
      createdEmpty: typesCreatedWithNoDocuments(
        createdTypes,
        results.map((r) => r.documentTypeId),
      ),
    });
  }, [createdTypes, results, runTypes, summary]);

  /**
   * The take-away copy of this screen.   (Slice #26.10)
   *
   * ⚠️ **`window.location.origin` in front of every path, and the whole
   * usefulness of the file turns on it.** The saved document is opened from the
   * user's disk, where a root-relative href resolves against the filesystem —
   * so a "working link" is an absolute one or it is not a link at all.
   * `report-html.ts` refuses to build a URL for exactly this reason; this is
   * the one place the origin is knowable.
   *
   * Everything user-facing is translated HERE and passed in as plain strings,
   * the same contract `ReportSections` keeps with the same module.
   */
  const handleSaveReport = useCallback(() => {
    const now = new Date();
    const origin = window.location.origin;
    const rows = orderedResults.map((r) => {
      const row = outcomeRowOf(r);
      const confidence = confidenceNoteFor(scanResults.get(r.entry.path)?.confidence);
      // ⚠️ **THE SAME SENTENCES THE SCREEN DRAWS, IN THE SCREEN'S OWN ORDER,
      // and two adversarial rounds went into this list.**
      //
      // A first version opened every non-errored row with "importat" — which is
      // flatly false of a row the archive already held, printed one line above
      // the note saying it was not imported again. That is the defect #26.08
      // fixed for the saved SESSION, reintroduced in a new exporter. And it
      // dropped the scan-confidence caveat, the party tallies and the ID-card
      // field counts, so the artefact the user keeps and trusts later was
      // strictly MORE reassuring than the screen it came from — the exact
      // inversion this module's header forbids.
      const notes: string[] = [
        ...(r.status === "error"
          ? [tres("reportRowFailed", { reason: r.errorMsg ?? t("errorShort") })]
          : r.preexisting === undefined
            ? [tres("reportRowImported")]
            : [r.preexisting === "linked" ? t("preexistingLinked") : t("preexistingSkipped")]),
        ...outcomeNotes(row).map((note) => t(`note.${note.id}`, note.values)),
        ...(r.personId !== undefined && r.idCardDocFieldsFailed === true
          ? [t("personDocFieldsFailed")]
          : r.personId !== undefined && (r.idCardDocFields ?? 0) > 0
            ? [t("personDocFields", { count: r.idCardDocFields ?? 0 })]
            : []),
        ...(r.aiStatus === "failed" ? [t("interpretFailed")] : []),
        ...(r.aiPartialWrite === true ? [t("interpretPartial")] : []),
        // Slice #32.05 — in the report as well as on the row, and in the same
        // position, because the two artefacts must not disagree about what
        // happened to a file. The saved page is the one a user works from away
        // from the screen, and "three of five pages" is precisely the fact that
        // is worth nothing at the moment it happens and everything a week later.
        ...(r.pagesUploaded !== undefined
          ? [t("pagesPartial", { uploaded: r.pagesUploaded, total: r.pagesExpected ?? 0 })]
          : []),
        ...(r.emptyDocument === undefined
          ? []
          : [r.emptyDocument === "removed" ? t("emptyDocumentRemoved") : t("emptyDocumentLeft")]),
        ...(r.cornerClaimLost === true ? [t("cornerClaimLost")] : []),
        // Slice #27.06 — the REASON a re-read failed, which on the screen lives
        // on the note's tooltip and would otherwise not survive into the one
        // artefact the user keeps. `failureDetail`'s own rule: a returned value
        // nobody reads is a capability the product quietly stopped having, and
        // a tooltip is invisible on a printed page. The note itself is already
        // in the list above, through `outcomeNotes`.
        // ⚠️ **Wrapped in a sentence, not pushed in raw**, which a fourth round
        // caught: the detail is the route's own text and can be a bare
        // `HTTP 429`, and a bullet reading `HTTP 429` between two Romanian
        // sentences is the leak every other branch here goes out of its way to
        // stop. `interpretRetryFailed` does exactly this for the retry's copy of
        // the same value; on screen the note explains itself and the raw string
        // is only a tooltip, so this key exists for the report alone.
        ...(r.refill === "failed" && r.refillErrorDetail
          ? [t("refillFailedDetail", { reason: r.refillErrorDetail })]
          : []),
        ...(r.aiProcessed === true ? [t("interpretDone", { count: r.aiFieldCount ?? 0 })] : []),
        // #29.12 — said in the saved report as well as on the row, because a
        // report whose only number for this document is "no fields filled" is
        // the same lie in a file the user keeps.
        ...(r.aiTitleKept === true ? [t("interpretTitleKept")] : []),
        ...(r.aiPrintedHeadingNoted === true ? [t("interpretPrintedHeadingNoted")] : []),
        ...(r.aiParties
          ? [t("interpretParties", { count: r.aiParties.linked + r.aiParties.created })]
          : (r.aiPartiesPending ?? 0) > 0
            ? [t("interpretPartiesPending", { count: r.aiPartiesPending ?? 0 })]
            : []),
        ...(r.aiProcessed === true && confidence !== null
          ? [`${confidence.title} — ${confidence.body}`]
          : []),
      ];
      return {
        title: titleForEntry(r.entry),
        path: r.entry.path,
        documentUrl: r.docId === undefined ? null : `${origin}/documents/${r.docId}`,
        notes,
      };
    });

    const html = buildResultReportHtml({
      folderName: rootFolderName,
      generatedAt: now.toLocaleString(locale),
      locale,
      // Exactly the lines the concluding message draws, from the same pure
      // rule — so the saved page and the message the user reads on the way out
      // cannot describe two different runs.
      summaryRows: summaryLines(summary).map((line) => ({
        label: tres(`summary.${line.id}`),
        value: String(line.value),
      })),
      // Slice #27.07 — the same two sentences the header draws, from the same
      // memo, so the saved page and the screen it was saved from cannot name
      // two different sets of types. The report is where this matters most: the
      // dialog's backlog dies with the dialog, and this file is what the user
      // still has tomorrow when they open Reference Data to work through it.
      typeNotes: runTypeSentences.map((note) => t(`typeNote.${note.id}`, note.values)),
      properties: properties.map((property) => ({
        code: property.code,
        nickname: property.nickname,
        url: `${origin}/properties/${property.id}`,
        cornersLabel: t("coordinatesDone", { count: property.cornerCount }),
      })),
      rows,
      strings: {
        documentTitle: tres("reportTitle"),
        generatedAt: tres("reportGenerated"),
        folderLabel: tres("reportFolder"),
        summaryTitle: tres("reportSummaryTitle"),
        propertiesTitle: tres("reportPropertiesTitle"),
        noProperties: tres("reportNoProperties"),
        typesTitle: tres("reportTypesTitle"),
        rowsTitle: t("resultsTitle"),
        openLabel: t("viewLink"),
      },
    });

    downloadHtmlFile(
      html,
      reportFileName(tres("reportFilePrefix"), rootFolderName, fileNameStamp(now)),
    );
    setReportSaved(true);
  }, [
    confidenceNoteFor,
    locale,
    orderedResults,
    outcomeRowOf,
    properties,
    rootFolderName,
    runTypeSentences,
    scanResults,
    summary,
    t,
    tres,
  ]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      // ⚠️ Follows the HEADING, and it did not until an adversarial round
      // noticed. A screen-reader user re-entering the finished dialog was told
      // "Se importă fișierele…" over a table of settled rows, a Save button and
      // a Close that leads to the concluding message.
      aria-label={done ? t("doneTitle", { count: createdCount }) : t("title")}
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

                `!readRunning` stays, for the reason `canRetryReads` carries
                it: a retry captured its row's state before its model call, and
                a confirmation completing inside that window would be
                overwritten by the answer when it lands. Since #27.06 the same
                is true of a re-read walk, which is why that term now covers
                both — see `readRunning`. */}
            {done && pendingPeopleCount > 0 && currentFollowUp === null && (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-xs font-medium text-sky-700 dark:text-sky-400">
                <span>
                  {sessionExpired
                    ? t("donePendingPeopleLocked", { count: pendingPeopleCount })
                    : t("donePendingPeople", { count: pendingPeopleCount })}
                </span>
                {!readRunning && (
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
            {/* Slice #27.05 — the types this run met that have nowhere to put
                what was read out of them.

                ⚠️ **SKY, not amber, and #27.02's constraint is the reason.**
                "Has no form" is not an error and must not be drawn as one: it
                is the correct and permanent answer for CARTE_IDENTITATE and for
                a type whose content is the scan itself. What is offered here is
                a review, not a repair.

                ⚠️ **The COUNT comes from `summariseImportRun`, not from a
                second pass over `results`.** It counts distinct TYPES, and the
                one thing a screen must not do is give a different number from
                the report the same screen saves. */}
            {done && summary.typesWithoutForm > 0 && (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-xs font-medium text-sky-700 dark:text-sky-400">
                <span>
                  {/* ⚠️ **FOUR branches, and each one was a lie in an earlier
                      round.** The count and the review BACKLOG diverge in both
                      directions — a type whose one read failed, was rate-
                      limited, timed out or found nothing already captured is
                      counted here with nothing queued — so a single sentence
                      claiming "the fields that were found can be reviewed now"
                      was false over a header with no control and nothing on
                      screen. The empty branch is worded to make no claim about
                      what the model DID: in four of the five states that reach
                      it the answer was never asked for, and telling a user
                      nothing was found is a different sentence from telling
                      them there is nothing here to look at.

                      The order matters. The session goes first because it is
                      the strongest constraint — nothing can be saved at all —
                      and its own copy no longer sends the user back to a review
                      that may not exist. Then "nothing to review", then the
                      offer, and last the wait, which is the same third branch
                      `doneUnreadWaiting` carries three lines above for exactly
                      the same reason: the button is hidden while a follow-up is
                      open or a retry is in flight, and a sentence that offers
                      what the screen does not is how a user learns to distrust
                      it. */}
                  {/* ⚠️ **FIVE BRANCHES SINCE #32.05, AND THE NEW ONE GOES
                      FIRST — AHEAD OF THE SESSION.** On a waived run the other
                      four are all worded for a discovery that RAN.
                      `doneTypesNoFormNothing` — "Aici nu sunt câmpuri de
                      verificat" — is the one that would draw, because
                      `discoverBacklog` is 0 by construction on a waived run
                      (neither call site of `shouldDiscoverType` can queue a
                      step), and it is wrong in a way a user cannot detect: it
                      reports a read that found nothing over a read nobody
                      bought.

                      Ahead of `sessionExpired` because that sentence's job is
                      to explain why the fields that were found cannot be SAVED
                      now, and on a waived run no fields were found by anybody.
                      "Sign in again" over a run with nothing to review is an
                      instruction with no subject; the expired session is
                      reported by its own banner, which is where it belongs. The
                      remaining three are unreachable on a waived run — all
                      three need a backlog — and are untouched. */}
                  {formsWaived
                    ? t("doneTypesNoFormWaived", { count: summary.typesWithoutForm })
                    : sessionExpired
                      ? t("doneTypesNoFormLocked", { count: summary.typesWithoutForm })
                      : discoverBacklog === 0
                        ? t("doneTypesNoFormNothing", { count: summary.typesWithoutForm })
                        : canReviewTypes
                          ? t("doneTypesNoForm", { count: summary.typesWithoutForm })
                          : t("doneTypesNoFormWaiting", { count: summary.typesWithoutForm })}
                </span>
                {reviewTypesError !== null && (
                  <span className="text-amber-700 dark:text-amber-400">{reviewTypesError}</span>
                )}
                {canReviewTypes && (
                  <button
                    type="button"
                    onClick={() => void handleReviewTypes()}
                    // Its own press is an await, and a second one would set the
                    // cursor back to zero under a user who had advanced. See
                    // `handleReviewTypes`, which refuses re-entry as well —
                    // this is the half of that guard the user can see.
                    disabled={reviewingTypes}
                    className={buttonClass({ variant: "ghost", size: "xs" })}
                  >
                    {t("reviewTypesButton")}
                  </button>
                )}
              </p>
            )}
            {/* Slice #27.07 — WHICH types, by name.

                ⚠️ **A second block rather than more words in the one above,
                because the two are not the same claim and do not appear
                together.** That one is a count with an offer attached and is
                drawn only while something is still without a form; this one
                also has to be drawn on a run whose every type was finished,
                which is precisely the run where "one type gained a form in this
                import" is the whole news. Folding them would have made the good
                outcome the one sentence nobody sees.

                ⚠️ **Two tones, because they are two different kinds of fact.**
                A type that gained a form is emerald — done, nobody must act —
                and one still without a form is sky, for the reason the block
                above states at length: "has no form" is not an error and must
                not be drawn as one. `RUN_TYPE_NOTE_TONE` is the same total
                `Record` guard `NOTE_TONE` is, so a third sentence cannot be
                added without a colour being chosen for it.

                ⚠️ **No control here.** The one that acts on this is in the
                block above while a review is possible, and after that the
                remedy is Reference Data, which #27.07 gives its own filter for
                — a button here would be a second, differently-worded offer for
                the same work. */}
            {done && (
              <div
                className="mt-0.5 flex flex-col gap-0.5"
                // ⚠️ **A live region, and unlike the count blocks above it this
                // one is safe to make one.** These sentences appear or change
                // only when a form is actually accepted — which happens inside
                // a dialog drawn OVER this screen, so the change lands behind
                // something the user is looking at and nothing announces it.
                // The blocks above are re-rendered by every unrelated state
                // change in a long-running dialog, which is why they are not
                // live; the re-read line below carries `role="status"` for
                // exactly this reason and its own comment states the rule.
                //
                // ⚠️ **RENDERED EMPTY rather than conditionally, and an
                // adversarial round found why it has to be.** A live region
                // inserted into the DOM in the same commit as its first content
                // is not announced — screen readers announce changes INSIDE a
                // region they were already tracking. On the run this matters
                // most, `runTypeSentences` is empty when the dialog finishes and
                // the block would have been mounted together with the one
                // sentence that is that run's entire news. An empty `div` costs
                // nothing and is what makes the announcement possible.
                role="status"
              >
                {runTypeSentences.map((note) => (
                  <p
                    key={note.id}
                    className={`text-xs font-medium ${RUN_TYPE_NOTE_TONE[note.id]}`}
                  >
                    {t(`typeNote.${note.id}`, note.values)}
                  </p>
                ))}
              </div>
            )}
            {/* Slice #27.06 — the documents that were read before their type
                had anywhere to put what was read.

                ⚠️ **DIRECTLY UNDER the type-form line, because it is the second
                half of that sentence.** The one above says a type has no form
                and offers the review; this one says which documents that review
                arrived too late for, and offers the only thing that fixes them.

                ⚠️ **BOTH COSTS ARE IN THE SENTENCE, BEFORE THE CLICK** — #27.06's
                constraint, in as many words. One billed model call per document,
                and one `document_version` row per document. The version count is
                worded "cel mult" / "at most" on purpose and it is not hedging:
                `updateDocument` skips the version insert when the new snapshot
                equals the latest stored one, and `aiInterpretedAt` is
                deliberately NOT in that snapshot — so a re-read that finds
                nothing new to write appends no version at all. Saying a flat N
                would be over-stating a cost, which is the safe direction to be
                wrong in but is still a number that does not happen.

                ⚠️ **SKY, not amber.** Nothing here failed. These documents were
                read correctly against the type as it stood; what changed is the
                type. Amber would send a business user looking for a fault. */}
            {done && (refillCount > 0 || refillProgress !== null) && (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-2 text-xs font-medium text-sky-700 dark:text-sky-400">
                <span
                  // ⚠️ **A live region only while the walk runs, and a third
                  // adversarial round is why it is here at all.** This is the
                  // one place in the dialog that asks the user to wait minutes
                  // for something they cannot see: the button vanishes, Close
                  // and Save go inert, the determinate `ProgressBar` above the
                  // table is unmounted once `done` is true, and the copy tells
                  // them to watch a line that a screen reader was never told had
                  // changed. `role="status"` is polite, which is right for a
                  // number that ticks N times. Undefined otherwise, because the
                  // other three branches are ordinary prose that is read when
                  // the dialog is walked, and a live region around them would
                  // announce the offer again on every unrelated re-render.
                  role={refillProgress !== null ? "status" : undefined}
                >
                  {/* The progress line comes FIRST, because while the walk is
                      running every one of the three branches below is a lie of
                      the same kind: `refillCount` is falling as rows settle, so
                      the offer would count down under the user and the "wait
                      until you have finished what is open" branch would be
                      telling them to wait for the thing they just started.
                      Ordered otherwise: the session, which is the strongest
                      constraint; then the offer; then the wait, the same third
                      branch `doneUnreadWaiting` and `doneTypesNoFormWaiting`
                      both carry, for the same reason — the button is hidden
                      while a follow-up is open, and a sentence that offers what
                      the screen does not is how a user learns to distrust it. */}
                  {refillProgress !== null
                    ? t("refillProgress", {
                        done: refillProgress.done,
                        total: refillProgress.total,
                      })
                    : sessionExpired
                      ? t("doneRefillLocked", { count: refillCount })
                      : canRefill
                        ? t("doneRefill", { count: refillCount })
                        : t("doneRefillWaiting", { count: refillCount })}
                </span>
                {canRefill && (
                  <button
                    type="button"
                    onClick={() => void handleRefill()}
                    // ⚠️ **No `disabled` here, unlike the review button above,
                    // and a third adversarial round is why the first draft's was
                    // removed rather than kept "for safety".** `canRefill`
                    // contains `!readRunning`, which contains `refillProgress
                    // !== null` — so every render in which the attribute would
                    // be `true` is a render in which this button is not mounted,
                    // and in the frame before that render it is not applied
                    // either. A prop that can never take effect is a guard the
                    // next reader will believe in. What actually holds that
                    // frame is `readRunningRef`, in the handler. (The review
                    // button's `disabled` IS live, because `reviewingTypes` is
                    // not a term of `canReviewTypes`.)
                    className={buttonClass({ variant: "ghost", size: "xs" })}
                  >
                    {t("refillButton", { count: refillCount })}
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
          <div className="flex shrink-0 items-center gap-2">
          {/* The take-away copy.   (Slice #26.10)
              Offered only once the run has settled, because a report of a run
              still in flight would file half a story as the whole one — and
              beside Close rather than under the table, so the two things a user
              can do on this screen are in one place.

              ⚠️ **Nothing is gated on it.** 26.10's constraint, in as many
              words: closing must work whether or not the report was saved. So
              this is a plain button with no state of its own beyond a
              confirmation that it happened, and Close below never reads
              `reportSaved`. */}
          {done && (
            <div className="text-right">
              <button
                type="button"
                onClick={handleSaveReport}
                // ⚠️ `readRunning` as well as the follow-up, and it is the
                // same argument the Close beside it carries. A report saved
                // during a retry records that row as ordinary — `aiStatus` is
                // `running`, `aiPartialWrite` was cleared when the click
                // started and `aiProcessed` is not set yet — so the run's one
                // durable artefact would say nothing at all about a read the
                // screen behind it is visibly still doing. Since #27.06 the
                // same holds for a re-read walk, whose rows say "waiting to be
                // read again" until each one lands.
                disabled={currentFollowUp !== null || readRunning}
                className={buttonClass({ variant: "secondary", size: "md" })}
              >
                {tres("saveButton")}
              </button>
              <p className="mt-1 text-[10px] text-fade dark:text-zinc-400">
                {reportSaved ? tres("saveDone") : tres("saveHint")}
              </p>
            </div>
          )}
          {(done || importError !== null) && (
            <button
              type="button"
              // ⚠️ `runLandedSomething`, not `done`, and a second adversarial
              // round is why: a loop that COMPLETED and produced nothing has no
              // conclusion to report, and the concluding message's one button
              // leaves the page. See the rule, and the `onClose` prop.
              onClick={() => onClose(done && runLandedSomething(summary) ? summary : null)}
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
              // Since #27.06, `readRunning` also covers a re-read walk —
              // closing mid-walk would abandon the documents it has not reached
              // with no record that they are still owed a read.
              disabled={currentFollowUp !== null || readRunning}
              // ⚠️ `buttonClass`, not the hand-written classes this button
              // carried since #21.01, and the change is forced rather than
              // cosmetic: giving it a `disabled` state meant hand-writing the
              // greyed-out utility, and `button-styles-single-source.test.ts`
              // forbids that outside its allowlist — the helper owns the
              // disabled look so a dozen buttons cannot drift into a dozen
              // versions of it. `secondary`/`lg` is what the sibling dialogs'
              // Close already uses, so this brings them into line rather than
              // inventing a third.
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

        {/* Slice #27.05 — a #27.04 new-type run that stopped part way.
            Its own banner rather than a row note, because what it describes is
            a state on the SERVER that no row can express: a type that exists
            with no form, a document that may or may not have been moved onto
            it. Red, because reaching it means the fields the user ticked were
            not saved anywhere. */}
        {typeWarnings.length > 0 && (
          <div
            role="alert"
            className="mx-5 mt-3 space-y-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
          >
            {typeWarnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
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
        {/* ⚠️ `importError === null` since #27.05: a fatal before the first
            task now marks every row `error` — because the session banner's own
            sentence says the rows are marked — and `progressPct` counts errors,
            so the bar sat at 100% and the label read "40 / 40" over a run that
            created nothing. A bar is a claim about progress; there was none. */}
        {gatePassed && !done && importError === null && (
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
          {/* The follow-up queue.   (Slice #26.09 for the parties, #26.10 for
              the cards.)

              One question at a time, opened by the RUN rather than by a button
              on a row, now that the row's job is to say what happened. Both
              dialogs are the shared confirm-or-create ones: nothing is linked
              or created until the user answers.

              ⚠️ **`key` is the entry path on both**, which is what forces a
              remount between steps. Without it React reuses the instance and
              the second card opens showing the first one's extracted fields. */}
          {currentFollowUp?.kind === "id-card" && (
            <IdCardPersonDialog
              key={currentFollowUp.path}
              file={currentFollowUp.file}
              entryLabel={currentFollowUp.label}
              propertyId={currentFollowUp.propertyId}
              documentId={currentFollowUp.docId}
              // Slice #23.03.Import — the scan's own confidence, read here
              // rather than stored on the step: scanResults is keyed by the
              // same path and never changes after the scan, so there is no
              // second copy to keep in step.
              scanConfidence={scanResults.get(currentFollowUp.path)?.confidence}
              onDone={handleIdCardDone}
              onFailed={handleIdCardFailed}
              onClose={handleIdCardClosed}
            />
          )}

          {currentFollowUp?.kind === "parties" && (
            <AiPartyLinkerDialog
              key={currentFollowUp.path}
              documentId={currentFollowUp.docId}
              parties={currentFollowUp.parties}
              onClose={handlePartyStepClosed}
            />
          )}

          {/* The proposed form for one document type.   (Slice #27.05)

              ⚠️ **The SAME dialog the Descoperire AI button opens, unchanged
              and unforked.** What this slice automates is the noticing and the
              running; the tick boxes are the product, and a second copy of the
              screen that carries them would be a second set of rules about what
              may be written to a type.

              ⚠️ **`key` is the TYPE id here, not the entry path.** The queue is
              one step per type, and the dialog's own state — the ticks, the
              renames, the frozen baseline — must be thrown away between them
              for the reason the two dialogs above carry: React would otherwise
              reuse the instance and open the second type showing the first
              one's rows. */}
          {currentFollowUp?.kind === "discover" && (
            <DiscoverReviewDialog
              key={currentFollowUp.typeId}
              pairs={currentFollowUp.pairs}
              documentId={currentFollowUp.docId}
              documentLabel={currentFollowUp.documentLabel}
              typeId={currentFollowUp.typeId}
              typeName={currentFollowUp.typeName}
              existingTypeNames={typeNames}
              existing={currentFollowUp.existing}
              partyRoleNames={currentFollowUp.partyRoleNames}
              skippedPages={currentFollowUp.skippedPages}
              truncated={currentFollowUp.truncated}
              onSaved={handleDiscoverSaved}
              // Recorded, not applied — see `applyPendingNewType`. Writing
              // anything into this component's state while the dialog is
              // mounted would repaint the header behind an open modal, and on a
              // `key` change unmount it mid-save.
              onNewTypeProgress={(progress) => {
                pendingNewTypeRef.current = progress;
              }}
              onTypesChanged={() => {
                queryClient.invalidateQueries({ queryKey: ["document-types"] });
              }}
              onClose={handleDiscoverClosed}
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
                {/* Slice #26.10 — "Ce s-a făcut", not "Acțiuni". The column
                    holds no actions any more, and a heading that says it does
                    is the screen contradicting itself in one word. */}
                <th className="w-64 pb-2">{t("colOutcome")}</th>
              </tr>
            </thead>
            <tbody>
              {/* ⚠️ `orderedResults`, not `results` — each property folder's
                  coordinate file at the head of its own block, because creating
                  the Property from it is the first thing that happened. See
                  `inResultOrder`. */}
              {orderedResults.map((r) => (
                <ResultRow
                  key={r.entry.path}
                  result={r}
                  t={t}
                  // Every sentence this row draws about the corners, the person
                  // and the read it did not do, decided in one tested place.
                  // The row renders; it does not reason. See `outcomeNotes`.
                  notes={outcomeNotes(outcomeRowOf(r))}
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
                  // appends to the backlog, which the effect drains when the
                  // loop ends. The append would open a stepper over a running
                  // import and then be overwritten by the assignment, losing
                  // the very people the retry went to fetch.
                  // See `canRetry`: `done`, and not while a follow-up is open —
                  // the latter for the reason the Close beside it is disabled,
                  // that nothing in this app traps focus, so a Shift+Tab from
                  // the open dialog would reach this button.
                  canRetryInterpret={canRetry}
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

/**
 * How loudly one note is drawn.   (Slice #26.10)
 *
 * ⚠️ **Colour here means what it means everywhere else in this table, and that
 * constrains it more than it looks.** Red says the file did not reach the
 * archive; nothing in this map is red, because every note below is drawn on a
 * row whose Document exists. Amber says something is outstanding and a person
 * has to decide; emerald says a thing was done; sky says a thing was
 * deliberately not done and nobody needs to act.
 *
 * `coordinateNotApplied` is sky rather than amber on purpose: a Property that
 * already had corners keeping them is the property step working exactly as
 * #26.07 built it, and a warning colour there would send a user to fix
 * something that is right.
 *
 * (Statuses and their own colour coding are 26.12 and are a different subject:
 * these are sentences about THIS run, not a status stored on a document.)
 */
const NOTE_TONE: Record<OutcomeNoteId, string> = {
  coordinateApplied: "text-emerald-600 dark:text-emerald-400",
  coordinateNotApplied: "text-sky-700 dark:text-sky-400",
  personCreated: "text-emerald-600 dark:text-emerald-400",
  personConfirmed: "text-emerald-600 dark:text-emerald-400",
  personPending: "text-sky-700 dark:text-sky-400",
  personDeclined: "text-amber-700 dark:text-amber-400",
  personNoProperty: "text-sky-700 dark:text-sky-400",
  personUnreadable: "text-amber-700 dark:text-amber-400",
  personStepUnfinished: "text-amber-700 dark:text-amber-400",
  readSkippedIdCard: "text-sky-700 dark:text-sky-400",
  readSkippedNoPage: "text-sky-700 dark:text-sky-400",
  // Slice #27.05 — sky, deliberately, and #27.02's constraint is the argument:
  // a type with no form is not a fault, so the row must not colour it as one.
  // Amber here would send a user to fix CARTE_IDENTITATE, whose only correct
  // answer is the one it already has.
  typeFormPending: "text-sky-700 dark:text-sky-400",
  typeFormAdded: "text-emerald-600 dark:text-emerald-400",
  // Slice #29.06 — sky and amber, and the pair is the point. A document the
  // model could not classify is a state, not a fault: it is in the archive, it
  // is on the general type, and somebody will choose a better one when they
  // open it — the same reading `typeFormPending` gets two lines up. A type that
  // could not be WRITTEN is amber by this table's own working rule: something is
  // outstanding and a person has to decide. Not red — the document exists and
  // its pages are uploaded, which is what red would deny.
  typeUnclassified: "text-sky-700 dark:text-sky-400",
  typeCreateFailed: "text-amber-700 dark:text-amber-400",
  // Amber, and it is the one refill note that must not be emerald: the read
  // happened, so the instinct is to tick it, and the whole reason the state
  // exists is that the money was spent and the columns are still empty. See
  // `RefillState.retyped`.
  refillRetyped: "text-amber-700 dark:text-amber-400",
  // Slice #27.06 — sky for the wait, and the precedent that settles it is
  // `personPending` three lines up, not the header's one-line gloss on sky. The
  // working distinction in this table is: a thing the run has QUEUED and a
  // control is offering is sky ("cartea de identitate așteaptă să fie
  // confirmată"), and a thing that was OFFERED and did not come to an end is
  // amber (`personDeclined`, `personStepUnfinished`). A pending re-read is the
  // first of those exactly — queued, counted, and one visible button away.
  // Emerald for the second read that happened; amber for the one that did not,
  // which is amber's own meaning here: something is outstanding and a person has
  // to decide. Not red — the document is in the archive and its first read's
  // fields are intact, which is what `refillFailed`'s own sentence says.
  refillPending: "text-sky-700 dark:text-sky-400",
  refillDone: "text-emerald-600 dark:text-emerald-400",
  refillFailed: "text-amber-700 dark:text-amber-400",
};

/**
 * …and the same vocabulary for the run-level type sentences.    (Slice #27.07)
 *
 * A second `Record` rather than two more entries in the one above, for the
 * reason `RUN_TYPE_NOTE_IDS` is its own list: those are drawn once per ROW and
 * these once per RUN. Same guard, though — a total `Record` over the id union,
 * so a third sentence added in `import-outcome.ts` fails the compile here until
 * somebody has decided what colour it is.
 *
 * Emerald and sky, and the pairing is the same one #27.05's header argues: what
 * gained a form is finished and nobody must act, and what has none is a state
 * rather than a fault. Amber would send a business user looking for a problem
 * in a list whose whole purpose is to be worked through calmly.
 */
const RUN_TYPE_NOTE_TONE: Record<RunTypeNoteId, string> = {
  typesGainedForm: "text-emerald-600 dark:text-emerald-400",
  typesStillWithoutForm: "text-sky-700 dark:text-sky-400",
  // Same sky as the complete list: the difference between the two is how much
  // of the backlog the sentence can name, which is not a difference in how
  // worried anybody should be.
  typesStillWithoutFormPartial: "text-sky-700 dark:text-sky-400",
  // Slice #29.06 — amber, and it is the one run-level type sentence that is not
  // sky. The two above describe work the wizard is offering to help with; this
  // one describes a row in Reference Data that nothing points at and that no
  // screen in this run will offer to remove. A decision is owed, which is what
  // amber means everywhere else in this file.
  typesCreatedEmpty: "text-amber-700 dark:text-amber-400",
};

/** The two notes that are about a Person who now exists and can be opened. */
const PERSON_NOTES: ReadonlySet<OutcomeNoteId> = new Set<OutcomeNoteId>([
  "personCreated",
  "personConfirmed",
]);

type ResultRowProps = {
  result: ImportResult;
  t: ReturnType<typeof useTranslations<"adminImport.wizard.importDialog">>;
  /**
   * What this run did to this file, as ids for `note.<id>`.   (Slice #26.10)
   *
   * Decided by `import-outcome.ts` and handed in already, rather than worked
   * out here: a sentence that claims something about the database has to be
   * testable, and a row rendered by nothing in this suite is not.
   */
  notes: OutcomeNote[];
  /**
   * Already-translated caveat about the SCAN, or null when it was confident.
   * (Slice #26.09) — see the call site for why it is here at all.
   */
  confidenceNote: { title: string; body: string } | null;
  /** A retry can neither race the run nor be pointless — see the call site. */
  canRetryInterpret: boolean;
  onRetryInterpret: () => void;
};

function ResultRow({
  result,
  t,
  notes,
  confidenceNote,
  canRetryInterpret,
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
    aiTitleKept,
    aiPrintedHeadingNoted,
    aiParties,
    aiStatus,
    aiErrorDetail,
    // Slice #32.05 — present together, and only when they disagree.
    pagesUploaded,
    pagesExpected,
    emptyDocument,
    cornerClaimLost,
    aiPartiesPending,
    aiPartialWrite,
    preexisting,
    refill,
    refillErrorDetail,
  } = result;
  const displayName = titleForEntry(entry);

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

      {/* ⚠️ **NOT "Acțiuni" any more, and the column heading moved with the
          content.**   (Slice #26.10)

          Every child of this cell is now a sentence about what the run did.
          The two buttons that stood here — "Creează persoană din CI" and
          "Aplică pe proprietate" — are gone: the corners were written by the
          property step before any document existed, and the person is walked by
          the run's own follow-up queue. What remains is one control, the retry,
          and it is the exception this file's header states: it is not a second
          way to do the work, it is the only way to finish work the run began
          and could not complete. */}
      <td className="py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Slice #26.08 — the archive already held this document, so the row
              describes what was done instead of offering something to do. The
              first row in this table to read that way; every row reads that way
              since #26.10. */}
          {preexisting !== undefined && (
            <span className="text-xs font-medium text-sky-700 dark:text-sky-400">
              {preexisting === "linked" ? t("preexistingLinked") : t("preexistingSkipped")}
            </span>
          )}

          {/* The corners, the person, and the read that deliberately did not
              happen.   (Slice #26.10)

              A Person that exists is a link, because the one thing a user wants
              from "o persoană a fost creată" is to go and look at her. The rest
              are plain spans: there is nothing behind them to open. */}
          {notes.map((note) =>
            PERSON_NOTES.has(note.id) && personId !== undefined ? (
              <a
                key={note.id}
                href={`/natural-persons/${personId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`text-xs font-medium hover:underline ${NOTE_TONE[note.id]}`}
              >
                ✓ {t(`note.${note.id}`, note.values)}
              </a>
            ) : (
              <span
                key={note.id}
                className={`text-xs font-medium ${NOTE_TONE[note.id]}`}
                // Slice #27.06 — the one note in this catalogue with a REASON
                // behind it. The route names why a read did not happen, down to
                // the octet-stream case, and #26.09 already decided that belongs
                // on a tooltip rather than in a cell: a cell cannot hold a
                // paragraph, and a returned value nobody reads is a capability
                // the product quietly stopped having. `aiErrorDetail` does this
                // for the amber block; this row's block is not drawn, so the
                // note carries it. `undefined` everywhere else, which renders no
                // attribute at all.
                title={note.id === "refillFailed" ? refillErrorDetail : undefined}
              >
                {t(`note.${note.id}`, note.values)}
              </span>
            ),
          )}

          {/* Slice #23.08.Import — the document half of the same step. Amber,
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

          {/* Slice #26.09 — the row DESCRIBES the AI read instead of offering
              it. The button that used to stand here is gone: the run does the
              read itself, so there is nothing left to press.

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
          {/* …and the same for a re-read.   (Slice #27.06)
              ⚠️ **Its own sentence rather than `interpretingShort`, and its own
              flag rather than borrowing `aiStatus`.** "Se citește cu AI…" over a
              row that already shows a green tick and a field count reads as the
              run having lost its place; "se citește din nou" says which of the
              two reads this is. And `aiStatus` is left alone throughout so it
              goes on meaning how the RUN's own read went — the retry above is
              finishing that read, this is a second one after it succeeded. */}
          {refill === "running" && status === "done" && (
            <span className="ga-cue-blink text-xs font-medium text-cta">
              {t("refillingShort")}
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
              {/* ⚠️ NOT the button #26.09 deleted — see `handleRetryInterpret`.
                  It is offered only on a row that says the automatic read
                  failed, and all it does is that read again; without it the
                  slice removed every exit from a dead end it had just
                  introduced. */}
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

          {/* ⚠️ **THE SCAN IS INCOMPLETE, AND NOTHING SAID SO BEFORE #32.05.**
              A page group whose fourth page failed to upload leaves a Document
              in the archive holding three — real scans, a real document, and
              two pages nobody will ever know are missing unless somebody counts
              them against the folder. Amber by this file's own vocabulary: the
              document exists and something is outstanding.

              `pagesUploaded !== undefined` rather than an arithmetic test, so a
              row that never counted (every row before this slice, and every
              ordinary row after it) draws nothing. The pair is written
              together and only when the two numbers disagree, so this is the
              whole condition. */}
          {pagesUploaded !== undefined && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {t("pagesPartial", { uploaded: pagesUploaded, total: pagesExpected ?? 0 })}
            </span>
          )}

          {/* ⚠️ **TWO SENTENCES, AND THE GOOD NEWS IS THE ONE THAT MATTERS
              MORE.** (Slice #32.05.) "The document was removed" is what lets a
              user stop looking for a record that is not there; without it the
              fix is invisible and the archive looks as though it swallowed a
              file. "It could not be removed" is amber because a decision is
              owed — that is what amber means everywhere else in this file — and
              it is the case a dead session produces, where the DELETE is
              refused exactly as the upload was. */}
          {emptyDocument !== undefined && (
            <span
              className={
                emptyDocument === "removed"
                  ? "text-xs font-medium text-fade dark:text-zinc-400"
                  : "text-xs font-medium text-amber-700 dark:text-amber-400"
              }
            >
              {emptyDocument === "removed"
                ? t("emptyDocumentRemoved")
                : t("emptyDocumentLeft")}
            </span>
          )}
          {/* ⚠️ **ITS OWN ANCHOR, NOT THE ROW'S.** The row's link is gated on
              `status === "done" && docId` and means "this file was imported;
              here it is". This one means the opposite — "this run left a
              record here that should not exist; go and delete it" — and the
              sentence above it is worth nothing without something to open. A
              second round found the first draft telling a user to delete a
              document it gave them no way to find, and a third found the same
              omission on the partial-page row — whose sentence says "verificați
              documentul", which is no more answerable without a link. Those two
              branches are the only places an error row carries a `docId`. */}
          {(emptyDocument === "left" || pagesUploaded !== undefined) &&
            docId !== undefined && (
            <a
              href={`/documents/${docId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-amber-700 underline hover:no-underline dark:text-amber-400"
            >
              {/* ⚠️ **THE LABEL FOLLOWS THE BRANCH, and a fourth round found
                  it not doing so.** "Deschide documentul rămas" is the ORPHAN's
                  wording; over a page group that landed three of five pages it
                  names a document that is not an orphan, and the resumed view —
                  which draws the same two rows from the same two keys — said
                  "Deschide →" for it. The row and the resumed view, one
                  pairing. The saved report is deliberately not a third: it
                  passes ONE `openLabel` for the whole table by contract
                  (`ResultReportRow` has no per-row label), and changing that
                  shipped shape for a cosmetic gain is not worth a slice. */}
              {emptyDocument === "left" ? t("emptyDocumentOpen") : t("viewLink")}
            </a>
          )}
          {cornerClaimLost === true && (
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              {t("cornerClaimLost")}
            </span>
          )}
          {aiProcessed && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {t("interpretDone", { count: aiFieldCount ?? 0 })}
              {/* #29.12 — the one decision this slice makes, said out loud.
                  Without it the row's only sentence about a protected document
                  is "niciun câmp completat", which is true of the columns and
                  false about what happened. */}
              {aiTitleKept === true ? ` · ${t("interpretTitleKept")}` : ""}
              {/* A separate fact, drawn only when true: the reading is not
                  recorded when it IS the title we kept, nor when one is already
                  there. Keyed on the first flag, this sentence sent the user to
                  an empty field. */}
              {aiPrintedHeadingNoted === true
                ? ` · ${t("interpretPrintedHeadingNoted")}`
                : ""}
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
        </div>
      </td>
    </tr>
  );
}
