/**
 * The archive's list of document types, as the import reads it.
 *                                    (Slice #27.05, extracted in Slice #29.08)
 *
 * WHY IT IS ITS OWN MODULE
 * ------------------------
 * Two places in the import now need the same list. `BulkImportDialog` reads it
 * when the run starts, to resolve a type for every document and to know which
 * types already have a form; the wizard reads it at the end of the
 * classification pass, to decide whether the run may start at all
 * (`checkTypeForms`). The gate's whole promise is that the type it names is the
 * type the run will file the document on — so it has to be looking at the same
 * list, fetched the same way, and a second copy of this function is the first
 * step towards it not being.
 *
 * ⚠️ **THE THREE GUARDS ARE THE POINT OF THE FUNCTION, and each of them was
 * added by an adversarial round rather than written first.**
 *
 *  - **TIMED.** A request that never comes back leaves the run with no Close,
 *    no result table and no report, and the stage bar's Cancel disabled for the
 *    whole `importing` phase — so a reload is the only way out and a reload
 *    loses the queue. `.catch()` does not cover a hang; only a timer does. It
 *    bounds the HEADERS, not the body — `fetchWithTimeout` says so about itself
 *    and this is not an exception.
 *  - **`no-store`.** This is the only GET on the run's path, so it is the only
 *    call a browser cache could serve, and `handleReviewTypes` reads its
 *    success as evidence that a signed-in session is back.
 *  - **`isSessionLoss` OR an `ok` response that `servesHtml`.** A rewritten 200
 *    carrying a sign-in PAGE is not a document-type list, and treating it as
 *    one would clear a session banner over a dead session. Same test
 *    `runAiInterpret` applies to its own three calls.
 *
 * ⚠️ **IT THROWS THE SENTINEL `session-expired`, NOT A SENTENCE, and an
 * adversarial round is why.** `createDocument` and `uploadPage` signal a lost
 * session by throwing exactly this string, and the dialog's per-task catch maps
 * it to the amber banner with the sign-in link. A hand-written Romanian
 * sentence thrown from here reached `run().catch` instead, which only sets
 * `importError` — so an expiry before the first file drew a red box with bare
 * prose in it and no link to sign in anywhere. One protocol, mapped in both
 * places. Every caller has to handle it.
 *
 * ⚠️ **The non-OK message is hardcoded Romanian and was already, before the
 * move.** It is carried here verbatim rather than translated, because turning
 * one thrown string into a message key is a change of behaviour in two callers
 * and belongs to whichever slice owns the import's error copy. Named in the
 * #29.08 handover so it is not mistaken for something this move introduced.
 */

import {
  fetchWithTimeout,
  isSessionLoss,
  servesHtml,
} from "@/lib/import/ai-interpret-run";

/**
 * One document type as the value-lists route returns it.
 *
 * `templateFields` is the raw JSONB column and is deliberately `unknown`: the
 * one thing allowed to interpret it is `parseTemplateFields`, and asking "does
 * this type have a form?" goes through `documentTypeHasForm` in
 * `src/lib/documents/status.ts` — which is where #26.12 put that decision so a
 * label, a colour and a queue can never disagree about it.
 *
 * ⚠️ **`origin` is deliberately NOT here.** The route serves it and the
 * Reference Data list reads it, but nothing in the import does: an import cares
 * whether a type has a form, never who created it. Widening the row to carry a
 * column no caller reads is how a "does it have a form?" test grows an "…and
 * was it made by hand?" clause that nobody asked for.
 */
export type DocumentTypeCatalogueRow = {
  id: string;
  key: string;
  name: string;
  templateFields?: unknown;
};

/** The list, unindexed. Callers index it if they must; two of them must not. */
export async function fetchDocumentTypeCatalogue(): Promise<DocumentTypeCatalogueRow[]> {
  const res = await fetchWithTimeout(
    "/api/admin/value-lists/document-types",
    30_000,
    { cache: "no-store" },
  );
  if (isSessionLoss(res) || (res.ok && servesHtml(res))) throw new Error("session-expired");
  if (!res.ok) {
    throw new Error("Nu s-au putut încărca tipurile de documente (HTTP " + res.status + ").");
  }
  const body = (await res.json()) as { items?: DocumentTypeCatalogueRow[] };
  return body.items ?? [];
}
