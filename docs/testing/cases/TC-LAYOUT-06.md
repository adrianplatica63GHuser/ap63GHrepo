# TC-LAYOUT-06 — Linia dintre coloane: trasă în banda numelor, schimbă lățimea coloanei

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-20 |

## What this proves

Slice 40.12, Adrian: „the lists for the principal objects must have a vertical divider similar to the horizontal
dividers between rows and we should be able to grab this divider on the title bar Move it left or right to change the
width of the column; This should apply to all the lists and tables that are similar to the lists of principal
objects". Every list-like table — the four lists, the associate screens, „Căutare globală", the users, „Calcul", the
reference data's lists, the dashboard, „Grupuri" and „Ștampile" — draws a 1-px line in the rows' colour between its
columns, band and rows, none after the last. In the band each line can be grabbed and dragged: the column on its left
grows or shrinks by the distance dragged, live, and the table with it; never under 3 rem. The width is kept for that
table in this browser; a double-click gives the usual width back. From the keyboard the handle is a separator: Right
and Left change the width by half a rem, Home gives it back. A table that fills its tile or its frame keeps that
width: what a column gains, its fill column — which has no handle — loses. A line missing, a drag that also presses
what is under it, a width lost on reload, or a tile that changes width is the defect.

## Before you start

- TC-AUTH-01 is green.
- **No stored width** on Acte, „Grupuri" or the associate screen (`ga40-colw-v1:*` absent from localStorage).
- **„Câmpuri afișate"** on Acte: Instituție / Notariat, Nr. pagini, Nr. document, Nr. proprietăți — so the table is
  wider than its toolbar.
- **Created through the API** for step 8: a natural person „Ion TC-E2E-LAYOUT-06" and a Contract de Vânzare
  „TC-E2E-LAYOUT-06 Contract".

## What Adrian is asked for

Nothing.

## Steps

At 1366 × 900 px.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte" | A thin line between every two columns, in the band and down every row, the colour of the lines between rows; none after the last column. Resting the mouse on a line in the band, the cursor is the column-resize one and the line darker; a bubble: „Trageți ca să lățiți sau să îngustați coloana; dublu-clic îi dă înapoi lățimea obișnuită." |
| 2 | Drags the line right of „Tip" 80 px to the right | „Tip" 80 px wider (±1) as the mouse moves, the table 80 px wider, „Titlu" unchanged; nothing under the mouse is pressed — still on „Acte" |
| 3 | Reloads the page | „Tip" still 80 px wider |
| 4 | Double-clicks the line | „Tip" at its usual width; nothing stored for Acte |
| 5 | Presses Tab until the line is focused (a screen reader reads „Lățimea coloanei Tip, separator"), presses Right, then Home | 8 px wider (half a rem), then back |
| 6 | Drags the same line 400 px to the left | „Tip" stops at 3 rem (48 px); a double-click gives it back |
| 7 | Opens „Grupuri"; drags the line right of „Cod" 80 px to the right; then double-clicks it | „Cod" 80 px wider, „Descriere" 80 px narrower, the list exactly as wide as before; „Descriere" has no line to drag. Back as it was |
| 8 | Opens the contract's „Asociere persoană", searches „TC-E2E-LAYOUT-06"; drags the line right of „Tip" 40 px to the right; then double-clicks it | „Tip" 40 px wider, „Nume" 40 px narrower, the table — the tile — as wide as before. Back as it was |

## At the end — leaving things as they were found

Delete the two records (`DELETE`). Every width dragged is given back in its step (no `ga40-colw-v1:*` left); set
„Câmpuri afișate" on Acte back as it was.

## Notes from the runs

**2026-10-20 — driven by hand, green: `driven` (Slice 40.12).** Claude, in the browser pane on localhost:3000 at
1100 × 800, the drag driven by pointer events on the handle (the pane was drawn in the background).
- Step 1: a line (`inset -1px 0 0` in #D4DAE2) on every cell but the last; four handles named „Lățimea coloanei
  nr. 1", „… Tip", „… Titlu", „… nr. 4", each 74 px tall — the band — and the caption sticking with the band.
- Steps 2, 4, 5: „Tip" 136 → 216 px, the table 800 → 880, `{"listDocumentType":13.5}` stored; Right → 14 rem, 224 px;
  a double-click → 136 px, nothing stored.
- Step 7: „Cod" 168 → 529 px dragged 2000 px to the right: „Descriere" stopped at 48 px, the table 745 px throughout;
  a double-click → 168 / 409 / 168. No console error.

**2026-10-20 — driven a second time, unchanged, green: `confirmed` (Slice 40.12).** After a reload, steps 1–4 and 7 on
the same screens, the same widths.

The spec (`e2e/layout/column-resize.spec.ts`) is written from this file.
