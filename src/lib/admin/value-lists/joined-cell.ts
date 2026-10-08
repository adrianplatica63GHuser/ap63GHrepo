/**
 * Fields read together in ONE cell, on one line.                 (Slice #38.55)
 *
 * A role's three converse names (#37.28) share one column of „Roluri
 * Persoană". #37.28 stacked them, one under another, which made those rows
 * three lines tall; Adrian: „Vânzător, Vânzător, Vânzătoare", not three lines.
 * The cell joins the values that are not blank, in the fields' order, with
 * „, " — and a role with none shows „–", the dash every other empty cell
 * prints (#29.13). One line, cut with „…" and whole on hover, as #38.50 does
 * for every cell.
 *
 * PURE — `joined-cell.test.ts` covers it; value-list-modal.tsx renders it.
 */

/** The cell's text: the non-blank values joined with „, ", or „–" when every one is blank. */
export function joinedCellText(values: readonly unknown[]): string {
  const shown = values.map((v) => (v === null || v === undefined ? "" : String(v).trim())).filter((v) => v !== "");
  return shown.length > 0 ? shown.join(", ") : "–";
}
