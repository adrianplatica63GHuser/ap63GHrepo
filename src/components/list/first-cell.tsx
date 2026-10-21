/**
 * A principal list's first named cell, with the row's badges after its text.                       (Slice 40.24)
 *
 * Adrian, 2026-10-21: „We got rid of the check boxes which is great but the column is still there taking up space for
 * nothing; Please remove the column for all four principal objects". That column held only the badges — „Nou!"
 * (`RecencyBadge`), and on Proprietăți „Încrucișat" (`BowTieBadge`) — so they move here, into the first named column
 * (Nume, Denumire, Poreclă, Tip), after its text on the same line (Ask first 1). The text truncates before them, so a
 * badge is never cut; they belong to that column, and go with it wherever the column is moved (40.25).
 *
 * The cell keeps its own `truncate` and tooltip (TC-LAYOUT-05 reads them); this is what is inside it.
 */
import type { ReactNode } from "react";

export function FirstCellText({ children, badges }: { children: ReactNode; badges: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center" data-first-cell="">
      <span className="min-w-0 truncate">{children}</span>
      <span className="inline-flex shrink-0 items-center" data-row-badges="">
        {badges}
      </span>
    </span>
  );
}
