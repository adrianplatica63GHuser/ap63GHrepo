# TC-TILES-07 — Unde stau părțile la deschidere: pagina actului la dreapta; harta, colțurile și Street View ale proprietății într-o coloană la dreapta

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

Since Slice #37.56 a detail screen's tiles stand in two areas when it opens: a column at the right,
top-aligned with the row, and the left area, where every other tile flows and wraps as before. A
Document's page image („Pagini") is that column. A Property's column is „Hartă", „Puncte de contur"
under it and, when ticked, „Street View" under that. An unticked tile leaves no gap; with nothing
in the column ticked it is not drawn and the left area takes the whole row. On a window too narrow
for the column beside the left area's widest tile, the column goes under the left area — the form
first. Since #37.77 the Property's column is 3 units, so at 1366 px it still stands beside the
3-unit „Date cadastrale".

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare „TC-TILES-07 Act de test" with one page (an image, `POST /api/documents/<id>/pages`), and
  a property „TC-TILES-07 Teren de test" with four corners.
- In this browser, the stored tile choices `ga40-tiles-document-CONTRACT_VANZARE-v1` and
  `ga40-tiles-property-v1` are set aside, so both screens open on their defaults; whatever was
  there is put back at the end.
- The window is at least 1920 px wide, so the tile row is 10 units (1624 px).

## What Adrian is asked for

Nothing.

## Steps

„At the right" is the tile's right edge on the tile row's right edge; „top level with the row" is
its top on the row's top. Nothing is saved.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-07 Act de test" | „Date generale", „Pagini" and „Preț și taxe" ticked. „Pagini" is at the right, top level with the row; „Date generale" and „Preț și taxe" to its left |
| 2 | Opens „TC-TILES-07 Teren de test" | „Date cadastrale", „Puncte de contur", „Adresă" and „Hartă" ticked, „Street View" not. „Hartă" at the right, top level with the row; „Puncte de contur" under it, also at the right; „Date cadastrale" and „Adresă" to their left |
| 3 | Ticks „Street View" | „Street View" under „Puncte de contur", at the right |
| 4 | Unticks „Hartă" | „Puncte de contur" at the top of the column, level with the row; „Street View" under it |
| 5 | Unticks „Puncte de contur" and „Street View" | No column: only „Date cadastrale" and „Adresă", side by side from the left |
| 6 | Ticks „Hartă" and „Puncte de contur" again, and narrows the window to 1366 px | The row is 6 units (968 px). „Date cadastrale" at the left, top level with the row; beside it the column: „Hartă" at the right, top level with the row, „Puncte de contur" under it. „Adresă" under „Date cadastrale" |

## At the end — leaving things as they were found

Put the two stored choices back, delete the document and the property (`DELETE /api/documents/<id>`,
`DELETE /api/properties/<id>`). Căutare globală for `TC-TILES-07` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.56).** Driven in Chrome on Windows (Claude in Chrome,
the interface in English, the window maximised at 2016 px: a 1624 px row) against `npm run dev`
on 3000; positions read with a script, relative to the row. This file was written from it.
- Step 1: Date generale, Pagini, Preț și taxe ticked; „pages" x984 y0, 640 wide, 0 from the right
  edge; „Preț și taxe" x492 y0. The left area 968 px (6 units), the column 640 (4).
- Step 2: map x1148 y0, 476 wide, 0 from the right; corners x984 y394, 640, 0; cadastral x0 y0,
  address x492 y0. The map stood at x984 (left-aligned in the column) on a first look; the column
  now stands its tiles against the right edge.
- Step 3: streetView x1148 y750. Step 4: corners y0, streetView y357. Step 5: the column hidden;
  cadastral x0, address x492.
- Step 6: the extension cannot resize a maximised window, so the page's content column was set to
  what a 1366 px window gives (1080 px inside its padding): row 968; cadastral x0 y0, address x492
  y0, map x164 y524, corners x0 y917.

**2026-10-02 — run 2, `confirmed` (Slice #37.56).** Same Chrome, the two records, both stored
choices set aside again, against the file above unchanged.
- Step 1: pages x984 y0, 0 from the right; Preț și taxe x492 y0. Steps 2–5: the same positions as
  run 1, to the pixel. Step 6: row 968; map x164 y524, corners x0 y917.
- The two stored choices put back as they were; the document and the property deleted (204, 204).
  Nothing in the file changed, so the case is confirmed, and `e2e/tiles/tile-placement.spec.ts`
  translates it.

**2026-10-02 — `automated`.** `e2e/tiles/tile-placement.spec.ts` translates the case, takes
#37.56's pictures and measures the narrowest window at which each column stands beside the left
area on the defaults: **1404 px** for both screens (at 1366 the column is under the form). Its
first run, `20261002T200409Z-28873`, was green; that `full` was red on two other specs the new
layout moved a button under (TC-PROP-04, TC-ASSOC-04), fixed in `9eedadb`–`c0a2896`. Green in the
whole run `20261002T204206Z-23356` on `c0a2896`.

**2026-10-04 — run 3, `driven` (Slice #37.77).** „Puncte de contur" became 3 units, so at 1366 px
the 3-unit column stands beside „Date cadastrale" and „Adresă" goes under it; step 6 was corrected
to say so, which sent the case back to `driven`. Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080 (a 1624 px row) and then 1366 × 900, against `npm run dev` on 3000,
a script ticking the boxes; both stored choices set aside.
- Step 1: ticked „Date generale", „Pagini", „Preț și taxe"; pages x984 y0, 0 from the right; Preț
  și taxe x492 y0.
- Step 2: the four ticked, „Street View" not; map x1148 y0, 0 from the right; corners x1148 y394,
  0 from the right; cadastral x0 y0, address x492 y0.
- Step 3: streetView x1148 y750. Step 4: corners y0, streetView y357. Step 5: no column; cadastral
  x0, address x492, both y0.
- Step 6: row 968; cadastral x0 y0; map x492 y0, 0 from the right; corners x492 y394; address x0
  y465, under cadastral.

**2026-10-04 — run 4, `confirmed` (Slice #37.77).** The same pane and records, both stored choices
set aside again, the corrected file unchanged: every step to the pixel as run 3. The two choices put
back; the document and the property deleted (204, 204). The spec's step 6 follows.

**2026-10-04 — `automated` (Slice #37.77).** The test runner's full run 20261004T184042Z-22698 on
ed466ff ran its spec green with the other 73 (lint, tsc, jest and forms-drift green too).
