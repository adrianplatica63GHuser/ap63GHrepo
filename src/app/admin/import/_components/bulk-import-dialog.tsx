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
 * The concurrency limit is 3 in-flight import operations at a time — which,
 * since #26.09, means up to 3 concurrent AI reads as well. The follow-up
 * steps are one-at-a-time: each opens a modal.
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
  parseTemplateFields,
  type DocumentTemplateField,
} from "@/lib/documents/template-fields";
import { proposeTemplateFields } from "@/lib/documents/discover-to-template";
import { useQueryClient } from "@tanstack/react-query";
import {
  canRetryReads,
  fetchWithTimeout,
  inFolderOrder,
  interpretSkipReason,
  isSessionLoss,
  runAiInterpret,
  servesHtml,
  type AiInterpretRunResult,
} from "@/lib/import/ai-interpret-run";
import {
  inResultOrder,
  outcomeNotes,
  runLandedSomething,
  summariseImportRun,
  summaryLines,
  type ImportRunSummary,
  type OutcomeNote,
  type OutcomeNoteId,
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
   * ⚠️ **The type AFTER the AI read, not the one the loop resolved before
   * creating the row.** `runAiInterpret` may re-classify the document — and
   * that path also auto-creates `lookup_document_type` rows — so the two are
   * different documents' worth of difference on an ordinary run. Everything
   * #27.05 does is keyed on this: which type gets one discovery read, which
   * rows stop saying "no form" when a form is accepted, and how many TYPES the
   * summary reports rather than how many rows.
   */
  documentTypeId?: string;
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
};

async function enrichDiscoverSteps(byType: Map<string, DiscoverStep>): Promise<EnrichResult> {
  if (byType.size === 0) return { names: null, sessionLost: false, idCardTypeIds: [] };
  let sessionLost = false;
  const fresh = await fetchDocTypeRows().catch((err: unknown) => {
    // The same sentinel `createDocument` and `uploadPage` throw, read here
    // rather than swallowed — see the header.
    sessionLost = err instanceof Error && err.message === "session-expired";
    return null;
  });
  // ⚠️ **An EMPTY list is treated as a failed read, not as "every type was
  // deleted", and an adversarial round found what the other reading costs.**
  // `fetchDocTypeRows` answers `body.items ?? []`, so any 200 whose JSON has no
  // `items` array — a rewritten response, a proxy, a route that changed shape —
  // arrives here as zero rows, and the loop below would then delete every step
  // in the queue. Those pairs exist in no database: they were read at the cost
  // of a model call each and this ref is the only place they are. `fetchDocTypes`
  // refuses the same answer at the start of the run, in Romanian; this is the
  // same refusal, one step quieter because there is a queue to protect rather
  // than a run to stop.
  if (fresh === null || fresh.length === 0) {
    return { names: null, sessionLost, idCardTypeIds: [] };
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
  return { names: fresh.map((item) => item.name), sessionLost: false, idCardTypeIds };
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
 * One document type as the value-lists route returns it.   (Slice #27.05)
 *
 * `templateFields` is the raw JSONB column and is deliberately `unknown`: the
 * one thing allowed to interpret it is `parseTemplateFields`, and asking
 * "does this type have a form?" goes through `documentTypeHasForm` in
 * `src/lib/documents/status.ts` — which is where #26.12 put that decision so a
 * label, a colour and a queue can never disagree about it.
 */
type DocTypeRow = { id: string; key: string; name: string; templateFields?: unknown };

/**
 * The list, unindexed. Split out so the end of the run can re-read it. (#27.05)
 *
 * ⚠️ **TIMED, and an adversarial round is why.** Since #27.05 this call sits in
 * front of `setDone(true)` — the run re-reads the type list once the rows have
 * settled, to name the queued types — so a request that never comes back is the
 * state this file's own timeout comment forbids: no Close, no result table, no
 * report, and the stage bar's Cancel disabled for the whole `importing` phase,
 * so a reload is the only way out and a reload loses the queue. `.catch()` does
 * not cover a hang; only a timer does.
 *
 * ⚠️ **It bounds the HEADERS, not the body** — `fetchWithTimeout` says so about
 * itself and this is not an exception to it. And it is not the only unbounded
 * await on the path to `setDone`: the create, upload, tag and link calls in the
 * loop are all bare `fetch`es of much larger bodies. Those are #26.09's to fix
 * and are named in this slice's handover; what is claimed here is only that
 * #27.05 did not add a sixth.
 *
 * ⚠️ **`no-store`, and a 200 is not proof of a live session.** This is the only
 * GET in the run — the model calls are POSTs, which a browser cache cannot
 * serve — and `handleReviewTypes` reads its success as evidence that a signed-in
 * session is back. A cached 200, or a rewritten 200 carrying a sign-in PAGE,
 * would clear that banner over a dead session; `servesHtml` is the same test
 * `runAiInterpret` applies to its own three calls, exported so there is one
 * copy of it.
 */
async function fetchDocTypeRows(): Promise<DocTypeRow[]> {
  const res = await fetchWithTimeout(
    "/api/admin/value-lists/document-types",
    30_000,
    { cache: "no-store" },
  );
  // ⚠️ **The SENTINEL, not a sentence, and an adversarial round is why.**
  // `createDocument` and `uploadPage` signal a lost session by throwing exactly
  // this string, and the per-task catch maps it to the amber banner with the
  // sign-in link. A hand-written Romanian sentence thrown from here reached
  // `run().catch` instead, which only sets `importError` — so an expiry before
  // the first file drew a red box with bare prose in it and no link to sign in
  // anywhere, under a banner whose own comment names that exact case. One
  // protocol, mapped in both places.
  if (isSessionLoss(res) || (res.ok && servesHtml(res))) throw new Error("session-expired");
  if (!res.ok) throw new Error("Nu s-au putut încărca tipurile de documente (HTTP " + res.status + ").");
  const body = (await res.json()) as { items?: DocTypeRow[] };
  return body.items ?? [];
}

/**
 * Fetch all active document types.
 * Returns:
 *   - `fallbackId`: ALTUL → OTHER → first row alphabetically (used when no type can be resolved)
 *   - `typeMap`: key → id (slug match)
 *   - `nameMap`: lowercased name → id (label match, used for auto-create dedup)
 *   - `items`: the rows themselves, so #27.05 can ask which types have a form
 */
async function fetchDocTypes(): Promise<{
  fallbackId: string;
  typeMap: Record<string, string>;
  nameMap: Record<string, string>;
  items: DocTypeRow[];
}> {
  const items = await fetchDocTypeRows();
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
  return { fallbackId: fallback.id, typeMap, nameMap, items };
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
  //
  // Slice #26.12: `origin: "IMPORT"` is the one fact about a document type that
  // cannot be worked out later — this is the only call site in the app that
  // sends it, and it is what makes the new type read "AI scanned" and render
  // blue in Reference Data instead of looking like something Adrian typed. Send
  // nothing and the column defaults to MANUAL, which is silent and wrong.
  //
  // Nothing else about the type's status is sent, because nothing else needs
  // to be: it gains a form (and turns bold green / "AI completed") only through
  // #26.11's discovery review, which writes `template_fields`.
  try {
    const res = await fetch("/api/admin/value-lists/document-types", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: trimmedLabel, origin: "IMPORT" }),
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
   * The fallback document type's id — ALTUL / OTHER / the first row.
   * (Slice #27.05)
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
    let fallbackDocTypeId: string;
    let docTypeMap: Record<string, string> = {};
    let docNameMap: Record<string, string> = {};

    async function run() {
      // fetchDocTypes throws with a Romanian error if no types exist.
      const { fallbackId, typeMap, nameMap, items } = await fetchDocTypes();
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
      docTypeMap = typeMap;
      docNameMap = nameMap;
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

          const interpreted = await runAiInterpret(docId, new Date().toISOString());
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
      forgetTypeFormMissing(enriched.idCardTypeIds);
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
      // two Romanian sentences of its own and they are worth showing; the other
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
    // Slice #27.05 — a part-finished new-type run belongs to the step that
    // produced it; see `handleReviewTypes` for why it must not survive a queue
    // replacement.
    pendingNewTypeRef.current = null;
    setFollowUps([
      ...inFolderOrder(entries, idCardStepsRef.current),
      ...inFolderOrder(entries, partyStepsRef.current),
    ]);
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
    setReviewingTypes(true);
    setReviewTypesError(null);
    const enriched = await enrichDiscoverSteps(discoverStepsRef.current);
    if (!mountedRef.current) return;
    setReviewingTypes(false);
    // A press into a still-dead session re-raises the banner rather than
    // reporting a connection problem, and costs one 401 to find out — the same
    // trade `canRetryReads` records for the retry button.
    if (enriched.sessionLost) setSessionExpired(true);
    forgetTypeFormMissing(enriched.idCardTypeIds);
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
      setSessionExpired(false);
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
    // A part-finished new-type run belongs to the step that produced it. It is
    // dropped rather than carried across a queue replacement — see
    // `applyPendingNewType` for what it is and why it must not outlive its step.
    pendingNewTypeRef.current = null;
    setFollowUps(discoverStepsInFolderOrder(entries, discoverStepsRef.current));
    setFollowUpIndex(0);
    // `entries` is stable for this dialog's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewingTypes, t]);

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
        const movedTo =
          progress !== null &&
          (progress.status === "moved" || progress.status === "movedFieldsUnknown")
            ? progress.type.id
            : null;
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
        setResults((prev) =>
          prev.map((r) => {
            if (r.typeFormMissing !== true) return r;
            if (movedTo !== null) {
              return r.entry.path === step.path
                ? { ...r, documentTypeId: movedTo, typeFormMissing: undefined, typeFormAdded: true }
                : r;
            }
            return r.documentTypeId === step.typeId
              ? { ...r, typeFormMissing: undefined, typeFormAdded: true }
              : r;
          }),
        );
        // The type now has a form, so nothing may queue a second discovery for
        // it — including a `handleReviewTypes` that runs before the enrichment
        // above would have noticed.
        docTypeFormRef.current.set(movedTo ?? step.typeId, true);
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
        // disabled — `retryRunning` reads `aiStatus === "running"` — over a
        // billed call in flight. Patching the row first would have left the
        // dialog closeable mid-read, discarding a proposal nobody can pay
        // for twice. Claimed the same way the loop claims it, so a second
        // retry of the same type cannot buy a second read.
        if (
          finalTypeId !== null &&
          shouldDiscoverType({
            typeId: finalTypeId,
            fallbackTypeId: fallbackTypeIdRef.current,
            typeHasForm: docTypeFormRef.current.get(finalTypeId) === true,
            typeIsIdCard,
            claimedTypeIds: discoverClaimedRef.current,
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
            const enriched = await enrichDiscoverSteps(discoverStepsRef.current);
            if (!mountedRef.current) return;
            if (enriched.names !== null) setTypeNames(enriched.names);
            forgetTypeFormMissing(enriched.idCardTypeIds);
            // The same reading the other two call sites make: a lost session is
            // not "the list could not be read". See `enrichDiscoverSteps`.
            if (enriched.sessionLost) {
              abortRef.current = true;
              setSessionExpired(true);
            }
            setDiscoverBacklog(discoverStepsRef.current.size);
          } else if (!discovered.ok && discovered.reason === "session") {
            abortRef.current = true;
            setSessionExpired(true);
          }
        }

        updateResult(path, {
          aiStatus: "done",
          aiProcessed: true,
          aiFieldCount: interpreted.fieldCount,
          aiPartialWrite: interpreted.partialWrite,
          aiErrorDetail: undefined,
          ...(finalTypeId !== null ? { documentTypeId: finalTypeId } : {}),
          typeFormMissing: awaitsForm || undefined,
          // A type that has since gained a form is no longer waiting for one,
          // and this row has never claimed it gained one — so the flag is
          // cleared rather than left to contradict the sentence beside it.
          ...(awaitsForm ? { typeFormAdded: undefined } : {}),
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
    // step with the queue handlers above. `entries` went when the retry stopped
    // republishing the queue — `handleConfirmPending` owns that now, and a
    // dependency the body no longer reads is a lint warning that teaches the
    // next reader to ignore the rule.
    // `forgetTypeFormMissing` since #27.05 — the retry enriches its own new
    // step, so it has to be able to take the sentence back off a type that
    // turned out to be an identity card. It is a `useCallback` with no deps, so
    // listing it costs no re-renders.
    [forgetTypeFormMissing, scanResults, t, updateResult],
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
    stepperOpen: currentFollowUp !== null,
    retryRunning,
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
    discoverBacklog > 0 && currentFollowUp === null && !retryRunning;
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
        typeFormMissing: r.typeFormMissing,
        typeFormAdded: r.typeFormAdded,
      };
    },
    [cornerSourceByPath, propertyById, scanResults, soleProperty],
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
        ...(r.aiProcessed === true ? [t("interpretDone", { count: r.aiFieldCount ?? 0 })] : []),
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

                `!retryRunning` stays, for the reason `canRetryReads` carries
                it: a retry captured its row's state before its model call, and
                a confirmation completing inside that window would be
                overwritten by the answer when it lands. */}
            {done && pendingPeopleCount > 0 && currentFollowUp === null && (
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
                  {sessionExpired
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
                // ⚠️ `retryRunning` as well as the follow-up, and it is the
                // same argument the Close beside it carries. A report saved
                // during a retry records that row as ordinary — `aiStatus` is
                // `running`, `aiPartialWrite` was cleared when the click
                // started and `aiProcessed` is not set yet — so the run's one
                // durable artefact would say nothing at all about a read the
                // screen behind it is visibly still doing.
                disabled={currentFollowUp !== null || retryRunning}
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
              disabled={currentFollowUp !== null || retryRunning}
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
    aiParties,
    aiStatus,
    aiErrorDetail,
    aiPartiesPending,
    aiPartialWrite,
    preexisting,
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
              <span key={note.id} className={`text-xs font-medium ${NOTE_TONE[note.id]}`}>
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
        </div>
      </td>
    </tr>
  );
}
