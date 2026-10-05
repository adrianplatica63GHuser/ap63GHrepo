# TC-TILES-13 — O fișă trasă de spațiul ei gol într-un loc liber rămâne acolo; peste altă fișă nu se poate

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

A tile is moved by pressing on its unused space and dragging it to free space (Slice #37.76). Dropped
on a free place it stays there and no other tile moves; dropped on another tile it is refused and
goes back; a press on a field or a label starts no drag, so the field takes focus as before. The
arrangement survives a reload, and „Implicit" forgets it. A tile that pushes another, a drop that
lands on a tile, a field that starts a drag, or an arrangement lost on reload is the defect this case
exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „TC-TILES-13 Ion".
- The window is **1920 px** wide. This browser has no stored arrangement for a Natural Person
  (`ga40-tile-positions-natural-person-v1` removed from its localStorage).
- „A box's place" is its rectangle relative to the tile row (the page scrolls in its pane).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person; „Toate" in „Părți afișate" | Every tile, each where #37.75 places it; „Corelate" reads „Nimic corelat încă." |
| 2 | Points at „Conexiuni"'s left padding, presses, drags until the tile's top-left corner is 60 px under „Corelate" on its left edge, releases | Over the padding the pointer is „grab"; while dragging an outline shows the place, marked free. „Conexiuni" stays there: its left edge on „Corelate"'s, its top at least 16 px under „Corelate"'s bottom. Every other box where it was in step 1 |
| 3 | Drags „Conexiuni" the same way until the pointer is over „Corelate", releases | The outline is marked not free; released, „Conexiuni" goes back to where step 2 put it |
| 4 | Presses on the „Nume" field of „Identitate", moves 200 px with the button held, releases; then the same on its label „Nume" | No outline, no tile moves; the field has the focus |
| 5 | Reloads the page | „Conexiuni" where step 2 put it |
| 6 | „Implicit"; then „Toate" | „Implicit" shows the default tiles; after „Toate", „Conexiuni" is where step 1 had it, and the browser holds no arrangement |

## At the end — leaving things as they were found

Delete the person (`DELETE`); remove `ga40-tile-positions-natural-person-v1` from this browser's
localStorage („Implicit" in step 6 already does).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.76).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1300, against `npm run dev` on 3000. The pane's emulated viewport drops
real clicks (FU-290), so a script dispatched the pointer events (`pointerdown` on the element under
the point, twelve `pointermove`s, `pointerup`) and read the boxes relative to the row. The pane was
hidden, so after „Toate" the script unticked and re-ticked „Conexiuni" to lay the row out with the
loaded heights (#37.75's note on hidden pages).
- Step 1: every tile; „Corelate" reads „Nimic corelat încă."; „Conexiuni" at 492,708.
- Step 2: over the left padding the tile's cursor is „grab"; the press lands on the tile's own
  `section`; the outline reads free; „Conexiuni" lands at 984,592 — „Corelate"'s left edge, 60 px under
  its bottom; no other box moved; the arrangement is in `ga40-tile-positions-natural-person-v1`.
- Step 3: the outline reads not free over „Corelate"; released, „Conexiuni" is back at 984,592.
- Step 4: the press on „Nume" lands on the `input`; no outline during the 200 px move; no box moved.
  A dispatched press does not move the focus, so the script focused the field and read it (the spec
  checks the focus with a real mouse). The press on the label lands on its text `span`: no outline.
- Step 5: after the reload „Conexiuni" is at 984,592.
- Step 6: „Implicit" hides „Conexiuni"; after „Toate" every box is where step 1 had it, and the
  browser holds no arrangement.
- The person deleted (204).

**2026-10-04 — run 2, `confirmed` (Slice #37.76).** The same pane and viewport, a new person, the file
above unchanged: the same in every step, to the pixel. Deleted (204). Nothing in the file changed, so
the case is confirmed, and `e2e/tiles/tiles-drag.spec.ts` translates it.

**2026-10-04 — `automated` (Slice #37.76).** The test runner's full run 20261004T075105Z-3824 on
9197df6 ran `e2e/tiles/tiles-drag.spec.ts` green with the other 72 specs (lint, tsc, jest and
forms-drift green too).

**2026-10-05 — Slice #37.89.** A person has a right-hand column now, „Interacțiuni", ticked by default and by „Toate"; at 1920 px it narrows the row this case measures. Right after „Toate" the case unticks „Interacțiuni" (TC-PERS-07 holds the column), so every number above stands. The spec follows.
