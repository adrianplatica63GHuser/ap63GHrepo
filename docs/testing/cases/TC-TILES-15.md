# TC-TILES-15 — O fișă trasă în spațiul liber de sub coloana din dreapta rămâne acolo; coloana nu se mișcă

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

Since Slice #37.79 the space under the right column — under „Hartă" and „Puncte de contur" on a
Property, under „Pagini" on a Document — is free space like any other: a tile dragged there stays,
and the arrangement survives a reload. The column's own tiles never move. A column tile that grows
pushes the tile under it down, and gives the place back when it goes. In a window whose column
cannot stand beside the left area the tile is placed as the screen places it, without losing its
place for the wider window. „Implicit" forgets it. A drop refused under the column, a column tile
that moves, or a place lost on reload is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-TILES-15 Teren" with four corners, and a Contract de Vânzare „TC-TILES-15 Act" with one page
  (an image, `POST /api/documents/<id>/pages`).
- In this browser the stored tile choices and arrangements (`ga40-tiles-*`, `ga40-tile-positions-*`)
  are set aside and put back at the end. On the property „Date cadastrale", „Puncte de contur",
  „Adresă", „Hartă" and „Conexiuni" are ticked, „Street View" not.
- The window is 1920 px wide. „A box's place" is its rectangle relative to the tile row.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-15 Teren" | „Hartă" and „Puncte de contur" in the column at the right; „Conexiuni" under „Date cadastrale", as the screen always opened |
| 2 | Presses on „Conexiuni"'s padding and drags until its top-left corner is 60 px under „Puncte de contur", on its left edge; releases | While dragging the outline is marked free. „Conexiuni" stays there: its left edge on „Puncte de contur"'s, its top at least 16 px under its bottom. Every other box — „Hartă" and „Puncte de contur" included — where it was in step 1 |
| 3 | Reloads the page | „Conexiuni" where step 2 put it |
| 4 | Ticks „Street View"; then unticks it | „Street View" under „Puncte de contur", and „Conexiuni" pushed down to 16 px under „Street View"; unticked, „Conexiuni" is back where step 2 put it |
| 5 | Narrows the window to 1366 px; then widens it to 1920 | At 1366 „Conexiuni" stands in the left area, the column beside it; at 1920 it is back under „Puncte de contur" |
| 6 | Opens „TC-TILES-15 Act", ticks „Clasificare subiectivă", drags it by its padding until its top-left corner is 40 px under „Pagini", on its left edge; releases | „Clasificare subiectivă" stays there, its left edge on „Pagini"'s; „Pagini" where it was |
| 7 | Back on the property: „Implicit", then ticks „Conexiuni" | „Conexiuni" under „Date cadastrale", where step 1 had it; the browser holds no arrangement for the property |

## At the end — leaving things as they were found

Put the stored choices and arrangements back; delete the document and the property (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.79).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200 (and 1366 for step 5), against `npm run dev` on 3000. The pane's
emulated viewport drops real clicks (FU-290), so a script dispatched the pointer events
(`pointerdown` on the element under the point, twelve `pointermove`s, `pointerup`) and read the boxes
relative to the row.
- Step 1: cadastral 0,0; address 492,0; „Conexiuni" 0,465; map 1148,0; corners 1148,394 (bottom 734).
- Step 2: the press lands on „Conexiuni"'s own `section`; the outline reads free; „Conexiuni" lands
  at 1148,792 — „Puncte de contur"'s left edge, 58 px under its bottom (snapped); every other box
  where it was; stored as `connections: { col: 7, top: 792 }`.
- Step 3: after the reload „Conexiuni" at 1148,792.
- Step 4: „Street View" at 1148,750; „Conexiuni" at 1148,1144 (16 px under it). Unticked: back at
  1148,792.
- Step 5: at 1366 cadastral 0,0, address 0,465, „Conexiuni" 0,872, map and corners at 492; the stored
  entry unchanged. At 1920 „Conexiuni" back at 1148,792.
- Step 6: „Clasificare subiectivă" from 0,298 to 984,808 — „Pagini"'s left edge (984), „Pagini" at
  984,0 as before.
- Step 7: after „Implicit" and „Conexiuni" ticked, „Conexiuni" at 0,465; no arrangement stored.

**2026-10-04 — run 2, `confirmed` (Slice #37.79).** The same pane and records, the stored choices
and arrangements removed again, the file unchanged: every step to the pixel as run 1 (step 6 read
back from the stored arrangement: `classification: { col: 6, top: 808 }`). The choices put back; the
document and the property deleted (204, 204). Nothing in the file changed, so the case is confirmed,
and `e2e/tiles/tiles-under-column.spec.ts` translates it.

**2026-10-04 — `automated` (Slice #37.79).** The test runner's full run 20261004T194754Z-27320 on
cbafeb3 ran `e2e/tiles/tiles-under-column.spec.ts` green with the other 75 (lint, tsc, jest and
forms-drift green too).
