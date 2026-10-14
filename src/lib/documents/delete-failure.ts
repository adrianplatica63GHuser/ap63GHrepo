/**
 * What the Document's screen says when „Șterge" fails.          (Slice #39.32)
 *
 * The DELETE route answers in English („Not found", or the unexpected-error
 * body), and the screen used to show that text as it came. The screen speaks
 * Romanian, so the reason is chosen here, from the status, as a message key in
 * the `document` namespace — never the server's own string.
 *
 *   404      the document is no longer in the archive (deleted from another
 *            tab, or by someone else)            → `deleteNotFound`
 *   anything else, or no answer at all           → `deleteError`, with the
 *            HTTP status beside it when there was one, so a report can name it
 *
 * PURE — no React, no fetch; `document-delete.test.ts` covers it.
 */
export type DeleteFailureKey = "deleteNotFound" | "deleteError";

export function deleteFailureKey(status: number | null): DeleteFailureKey {
  return status === 404 ? "deleteNotFound" : "deleteError";
}

/** The line under the form: the sentence, and `(HTTP <status>)` for the general failure. */
export function deleteFailureMessage(status: number | null, t: (key: DeleteFailureKey) => string): string {
  const key = deleteFailureKey(status);
  return key === "deleteError" && status !== null ? `${t(key)} (HTTP ${status})` : t(key);
}
