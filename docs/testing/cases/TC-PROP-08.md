# TC-PROP-08 — „Puncte de contur" cât „Hartă", butoanele unui rând lângă marginea din dreapta

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-04 |

## What this proves

On the Property screen „Puncte de contur" is 3 units, as wide as „Hartă" and „Street View", and the
three stand flush right in a right column of the same width (Slice #37.77). On a corner row the four
buttons — „Mută mai sus", „Mută mai jos", „Editează", „Șterge" — are on one line and „Șterge" stands
against the table's right edge, less the cell's padding. The edit row fits inside the tile: in
Stereo 70 and in DMS, where each line stays on one line clear of „Salvează", and the table never
scrolls sideways. A tile wider than „Hartă", empty space after „Șterge", or an edit row that spills
sideways is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-08 Teren cu colțuri" with five corners (44.43512 26.10234, 44.43561 26.10301,
  44.43527 26.10372, 44.43470 26.10335, 44.43468 26.10262).
- „Afișare" on „Stereo 70", as the screen opens; „Street View" ticked in „Părți afișate" (it was,
  in the pane, for both runs below).

## What Adrian is asked for

Nothing.

## Steps

Steps 1–4 at **1920 px**, then again at **1366 px**.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the property | „Hartă", „Puncte de contur" and „Street View" the same width, their right edges on one line; the right column as wide as they are |
| 2 | Looks at the first corner row | „Mută mai sus", „Mută mai jos", „Editează", „Șterge" on one line; the right edge of „Șterge" 12 px (the cell's padding) from the table's inner right edge, ±1 |
| 3 | „Editează" on the first row | The edit row with „Salvează" and „Anulează"; every box and button of it inside the tile; the table does not scroll sideways. „Anulează" closes it |
| 4 | „DMS", then „Editează" on the first row | The latitude's three boxes and „N" „S" on one line, all left of „Salvează"; the table does not scroll sideways. „Anulează" closes it |

## At the end — leaving things as they were found

Delete the property (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.77).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200 and then 1366 × 1200, against `npm run dev` on 3000. The pane's
emulated viewport drops real clicks (FU-290), so a script pressed the buttons and read the boxes.
- At 1920: „Hartă", „Puncte de contur", „Street View" and the right column each 476 px, right edges
  at 1872. The four buttons on one line; „Șterge" 11 px from the table's inner edge (12 px padding,
  the boxes rounded). The edit row: „Salvează" / „Anulează", nothing outside the tile, the table
  449 px with nothing to scroll. Closed with „Anulează".
- At 1366: the same widths (476), the four buttons on one line, „Șterge" 11 px; the edit row inside
  the tile; DMS: the latitude's boxes and „N" „S" on one line, left of „Salvează"; nothing to scroll.
- The property deleted (204).

**2026-10-04 — run 2, `confirmed` (Slice #37.77).** The same pane, a new property, the file above
unchanged, 1366 then 1920: the same in every step — widths 476 at both, right edges on one line
(1216, 1872), one line of buttons, „Șterge" 11 px, nothing outside the tile, DMS on one line clear
of „Salvează", nothing to scroll. Deleted (204). Nothing in the file changed, so the case is
confirmed, and `e2e/property/corners-tile-narrow.spec.ts` translates it.
