/**
 * The two refusals `POST /api/documents/[id]/pages` names, and the route each
 * takes to a sentence a Romanian user can read.                 (Slice #34.20)
 *
 * ⚠️ **WHY THIS IS A MODULE AND NOT A CONST INSIDE THE DIALOG.** In
 * `bulk-import-dialog.tsx` the throw and the catch are in different scopes:
 * `uploadPage` is a module-level function with no translator — the same reason
 * `idCardImage` throws a sentinel — and the per-task `catch` is inside the
 * component, where `t` is. The string passed between them is the ONLY thing
 * joining the two, and written out twice it is a typo away from a row that
 * reports the raw sentinel as its failure, in a table cell and in the saved
 * HTML report, with nothing failing anywhere to say so. Here it is written
 * once, read at both ends, and — because it is importable — actually tested
 * rather than grepped for.
 *
 * ⚠️ **WHAT CHANGED, AND WHY "UNREACHABLE" WAS NOT A REASON TO LEAVE IT.**
 * Slice #34.06 put the `code` beside the route's ENGLISH `error`; the bulk
 * import deliberately did not read it, because neither refusal is reachable
 * from a run — CON-01/02/03 stop every extension outside the registry and
 * CON-05 every oversize file before a file is opened. So the English was
 * unreachable too. That is one constraint change away from being the sentence a
 * Romanian user reads, permanently, in a report nobody can edit.
 *
 * ⚠️ **`code` IS THE ROUTE'S WORD AND IS NOT INVENTED HERE.**
 * `page-upload-refusals.test.ts` reads the route's own source and fails when
 * these two strings stop appearing in it, and reads `pages-panel.tsx` — the
 * other client that maps the same two codes, into its own namespace — for the
 * same reason. Neither file imports this one: the route must not depend on a
 * client module, and #34.20 left the dialog alone. The test is what keeps three
 * copies of two words honest; if a fourth appears, that is the slice that
 * should make them one.
 *
 * ⚠️ **`messageKey` IS A KEY UNDER `adminImport.wizard.importDialog`, AND THE
 * SENTENCES ARE SHORT ON PURPOSE.** `errorMsg` has three readers and an
 * adversarial round corrected an earlier draft of this paragraph that named
 * only the flattering one: the results row shows the CONSTANT „Eroare" and
 * carries `errorMsg` as the cell's `title`, the saved session keeps it, and the
 * saved HTML report prints it verbatim. So on the screen itself the refusal is
 * a hover, not a sentence — a limitation this slice did NOT lift, because the
 * cell is shared by every failure the run can have, including the English ones
 * the fallback still produces, and changing what it shows is a display contract
 * for rows #34.20 never touched. It is in #34.20's handover.
 *
 * They are short anyway, and for the reader that is left: the report is a
 * permanent document and a `title` is a tooltip, both of which want the
 * register of `sessionExpiredShort` — two words — rather than a paragraph.
 * `document.pages.dialog.fileTypeNotAllowed` — the one of the two that has to
 * explain what a page MAY be — is a paragraph, correctly, because it sits
 * beside a control the user can act on; here the run is over and there is no
 * control. (Its `fileTooLarge` twin is short in both places, having only a
 * number to give.)
 */

export type PageRefusal = {
  /** The route's `code`, verbatim. */
  readonly code: string;
  /**
   * What `uploadPage` throws as the `Error`'s message.
   *
   * Prefixed `page-` so it can never collide with `session-expired`, the other
   * sentinel travelling the same `catch`, nor read as a sentence if one ever
   * escaped to a screen.
   */
  readonly sentinel: string;
  /** The key under `adminImport.wizard.importDialog` the catch translates with. */
  readonly messageKey: string;
};

export const PAGE_REFUSALS: readonly PageRefusal[] = Object.freeze([
  Object.freeze({
    code: "file_type_not_allowed",
    sentinel: "page-file-type-refused",
    messageKey: "pageFileTypeRefused",
  }),
  Object.freeze({
    code: "file_too_large",
    sentinel: "page-file-too-large",
    messageKey: "pageFileTooLarge",
  }),
]);

/**
 * The refusal a response body names, or `null` for every other failure.
 *
 * `null` is not a gap: a 500, a proxy, a `code` added to the route after this
 * list was written are all shapes this client cannot name, and the caller's
 * fallback — the route's own English — is a worse answer than Romanian and a
 * better one than `HTTP 500`.
 */
export function pageRefusalOfCode(code: unknown): PageRefusal | null {
  if (typeof code !== "string" || code === "") return null;
  return PAGE_REFUSALS.find((refusal) => refusal.code === code) ?? null;
}

/**
 * The refusal a caught `Error`'s message names, or `null`.
 *
 * Takes the message rather than the `Error` because the catch has already
 * narrowed it — and because a caught value that is not an `Error` at all has a
 * message of its own choosing, which must not match by accident.
 */
export function pageRefusalOfSentinel(message: unknown): PageRefusal | null {
  if (typeof message !== "string" || message === "") return null;
  return PAGE_REFUSALS.find((refusal) => refusal.sentinel === message) ?? null;
}
