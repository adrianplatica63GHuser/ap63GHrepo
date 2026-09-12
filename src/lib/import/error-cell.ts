/**
 * What the import results table prints in the cell of a row that failed.
 *                                                               (Slice #34.23)
 *
 * ⚠️ **THE CELL IS ONE LINE AND THE DECISION BEHIND IT IS NOT, WHICH IS THE
 * WHOLE REASON THIS IS A MODULE.** `ImportResult.errorMsg` is written at four
 * sites in `bulk-import-dialog.tsx` and they are not the same kind of string.
 * Three of them call `t(…)` and produce a Romanian sentence. The fourth, the
 * per-task catch, writes ALL THREE KINDS: `t(…)` for a page refusal
 * `uploadPage` sent as a token, the Romanian of a `TranslatedError` the run
 * threw itself (see below), and otherwise whatever the caught `Error` carried —
 * `HTTP 500`, `Failed to fetch`, `Import failed`. One field, two populations,
 * mixed at one site. Printing it unconditionally puts English on a Romanian
 * screen; printing the constant unconditionally is what Slice #34.20 shipped
 * and what #34.23 was raised to fix: a two-word sentence written for the row
 * was reachable only by hovering it.
 *
 * ⚠️ **THE FLAG IS A SECOND FIELD, NEVER A PARSE OF THE FIRST.** What separates
 * the two populations is whether the WRITER had a translator, which the writer
 * knows and no reader can recover: testing `errorMsg` against a list of known
 * translations, or against a diacritic, or against "does it look English", is a
 * guess that goes wrong on the first message either side adds. So every writer
 * that had a translator says so — directly, where it writes the row, or through
 * `TranslatedError` where a throw is in the way — and this function reads that
 * and nothing else about the string except whether there is one.
 *
 * ⚠️ **„Eroare” IS NOT A PLACEHOLDER AND IS NOT BEING REMOVED.** For an
 * `HTTP 500` it is the honest answer, and the raw text stays exactly where it
 * has always been — on the cell's `title`. A row that ends up with no status
 * word at all is worse than the constant this slice narrows.
 *
 * ⚠️ **THE OTHER TWO READERS OF `errorMsg` DO NOT COME THROUGH HERE, AND MUST
 * NOT.** The saved session keeps `errorMsg` verbatim and the saved HTML report
 * prints it verbatim through `reportRowFailed`; the report is a document that
 * outlives the dialog and cannot be edited afterwards. This function is about
 * the SCREEN. `import-error-cell.test.ts` pins both of those lines against the
 * day somebody decides they should agree with it.
 */

/**
 * An `Error` whose message is already a sentence a user can read.
 *                                                               (Slice #34.23)
 *
 * ⚠️ **THE THIRD POPULATION, AND A FIFTH ADVERSARIAL ROUND FOUND IT.** The
 * per-task `try` in `bulk-import-dialog.tsx` does not only catch what the
 * fetch helpers throw: it also catches its OWN throws, and two of those are
 * `t(…)` calls made in a scope that has a translator — the corner-source
 * conflict, which the dialog's own comment calls the commonest coordinate-file
 * failure, and the provenance guard. They arrive at the catch as an ordinary
 * `Error.message`, indistinguishable by the string from `HTTP 500`, so the
 * first version of this slice printed „Eroare” for exactly the failure it was
 * raised to name.
 *
 * ⚠️ **A CLASS RATHER THAN A SENTINEL, BECAUSE THESE THROWS ALREADY HAVE THE
 * SENTENCE.** `page-upload-refusals.ts` exists because `uploadPage` has no
 * translator and has to send a token the catch can translate. These two do have
 * one; what they cannot send through a `throw` is the fact that they had one.
 * The class carries it, and `instanceof` is a test of the THROW rather than of
 * the text — the same contract `errorMsgTranslated` keeps one layer down.
 *
 * ⚠️ **`name` IS DELIBERATELY NOT OVERRIDDEN.** The run-level catch decides
 * whether a message is ours to show with `err instanceof Error && err.name ===
 * "Error"`, and a subclass that leaves `name` alone inherits `"Error"` and
 * keeps passing that test. Setting `name = "TranslatedError"` would read better
 * in a stack trace and would make one of our own sentences fall to
 * `importStartFailed` if it ever reached that catch.
 */
export class TranslatedError extends Error {}

/**
 * The two fields of a result row this decision reads.
 *
 * Structural rather than `Pick<ImportResult, …>` on purpose: `ImportResult`
 * lives in a client component 404 KB long, and a `lib/` module importing it
 * would put the whole dialog into the import graph of anything that wants to
 * decide what one cell says. Every row satisfies this shape by having the two
 * fields, which is what a structural type is for.
 */
export type ErrorCellRow = {
  readonly errorMsg?: string;
  readonly errorMsgTranslated?: boolean;
};

/**
 * What the cell shows, and what it carries on hover.
 *
 * `title: undefined` is a real answer, not a gap: when the sentence IS the
 * content, a tooltip repeating the text under the cursor is noise. React omits
 * the attribute for `undefined`, so the two branches differ by exactly the
 * tooltip the visible text has made redundant.
 */
export type ErrorCell = {
  readonly text: string;
  readonly title: string | undefined;
};

/**
 * The cell for one failed row.
 *
 * `fallback` is the caller's already-translated „Eroare” — passed in rather
 * than looked up, because this module has no translator and the one place that
 * does is the component. The same contract `report-html.ts` keeps.
 *
 * A flag set over an absent or blank `errorMsg` falls back rather than printing
 * nothing: the flag is a claim about a string, and a claim about a string that
 * is not there decides nothing.
 */
export function errorCell(row: ErrorCellRow, fallback: string): ErrorCell {
  const msg = row.errorMsg;
  if (row.errorMsgTranslated === true && msg !== undefined && msg.trim() !== "") {
    return { text: msg, title: undefined };
  }
  return { text: fallback, title: msg };
}
