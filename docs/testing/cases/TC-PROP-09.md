# TC-PROP-09 — „Hartă": desenarea și harta extinsă pe rândul de sus; harta extinsă se închide și păstrează desenul

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #37.91 the Property's „Hartă" tile carries its controls on one line at its top right,
left to right: „Hartă extinsă" (lucide's Maximize, corner brackets), „Desenează" (PenTool) and
„HARTĂ | SATELIT". „Hartă extinsă" opens the full-screen map — the one there is, the theater
overlay — and „Restrânge" (lucide's Minimize) or Escape brings the map back to its tile. The
corners tile no longer has a „Hartă extinsă" of its own: the full-screen map has one door.
Drawing works in full screen as on the tile, and a corner drawn there is the tile's corner. A draw
button at the bottom left, a second „Hartă extinsă", or a corner lost on closing is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-09 Teren" with three corners (44.37 25.98, 44.3702 25.9806, 44.3697 25.9808).
- „Hartă" and „Puncte de contur" ticked in „Părți afișate".

## What Adrian is asked for

Nothing.

## Steps

„On one line" is the controls' vertical centres within 2 px; „at the top right" is the row's
right edge within 16 px of the map's and its top within 16 px of the map's.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the property, the window 1920 × 1080 | In „Hartă", at the top right and on one line, left to right: „Hartă extinsă" (the Maximize icon), „Desenează" (the PenTool icon), „HARTĂ" „SATELIT". Nothing of these at the bottom left. „Puncte de contur" has no „Hartă extinsă" |
| 2 | The window 1366 × 900 | The same three, on one line at the top right of „Hartă" |
| 3 | Presses „Hartă extinsă" | The full-screen map „Hartă extinsă": its header's „Restrânge" (the Minimize icon); on the map, at the top right, „Desenează" and „HARTĂ" „SATELIT", and no second „Hartă extinsă" |
| 4 | Presses „Restrânge" | The full-screen map is gone; „Hartă" shows its map in the tile |
| 5 | Presses „Hartă extinsă", then Escape | The full-screen map opens, and Escape closes it |
| 6 | Presses „Hartă extinsă", „Desenează", clicks the map once away from the triangle, presses „Gata", then „Restrânge" | „Gata" in „Desenează"'s place while drawing, a hint under the row; after „Restrânge", „Puncte de contur" lists four corners |

## At the end — leaving things as they were found

Nothing is saved. Delete the property (`DELETE`).

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.91).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, its viewport emulated at 1920 × 1080 and 1366 × 900 for steps 1–5 (a script
pressed the buttons: the emulated viewport drops real clicks, FU-290) and at the pane's own size for
step 6, whose map click was a real one. The pane's remembered property tiles were left as they were.
- Step 1 (1920): „Hartă extinsă" (lucide-maximize) at x 1645, „Desenează" (lucide-pen-tool) 1683,
  „HARTĂ" 1722, „SATELIT" 1782, all centred at y 201; the row 8 px from the map's right and top
  edges; no button at the bottom left; „Puncte de contur": „+ Adaugă punct", „Ascunde Street View",
  „Arată Unghiuri" — no „Hartă extinsă".
- Step 2 (1366): the same order, one centre (y 1340), 8 px from the edges.
- Step 3: the dialog „Hartă extinsă" — „Restrânge" (lucide-minimize), „Desenează", „HARTĂ",
  „SATELIT", the row 8 px from the edges; no second „Hartă extinsă".
- Steps 4–5: „Restrânge" closed it, the tile's map in place; reopened, Escape closed it.
- Step 6: „Gata" in „Desenează"'s place, the hint under the row; one real click away from the
  triangle; „Gata", „Restrânge": four corner rows. (The tile's map held the fourth marker too once
  zoomed out — it fell outside the tile's view at zoom 19, so the case reads the table, not the
  markers.) The property deleted (204).

**2026-10-05 — run 2, `confirmed` (Slice #37.91).** A new `TC-PROP-09 Teren`, against the file above
unchanged, the same way. Step 1 (1920): x 1645 / 1683 / 1722 / 1782 at y 201, Maximize and PenTool,
8 px from the edges, nothing at the bottom left, no „Hartă extinsă" in „Puncte de contur". Step 2
(1366): x 497 / 535 / 574 / 634 at one centre. Step 3: „Restrânge" (Minimize), „Desenează",
„HARTĂ", „SATELIT" and nothing else. Steps 4–5 as written. Step 6: „Gata" and the hint; one real
click; four corner rows after „Restrânge". The property deleted (204). Nothing in the file changed,
so the case is confirmed, and `e2e/property/map-top-row.spec.ts` translates it.

**2026-10-05 — `automated`.** `e2e/property/map-top-row.spec.ts` translates the case; green on its first
runner run, `20261005T062231Z-22072` on `ca47ee5` with the slice's tree (with the other property specs,
TC-ICON-04's, TC-MAP-01's and TC-TILES-14's).
