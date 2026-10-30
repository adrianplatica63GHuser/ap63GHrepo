# TC-TILES-16 — „Clasificare": o fișă gri — citită, „Editează", 2 unități (41.10; was: liniile și cele două celule)

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-30 |

## What this proves

Since Slice 41.10 „Clasificare" is a gray tile, at 2 units (254 px). It reads its three values as text, one to a row,
the label above the value, each with „Marchează ca verificat" as an icon. „Editează" turns them into their selects,
written only by „Salvează". „Renunță" writes nothing. With no value at all it folds to one line. A select drawn while
reading, a value saved as it is chosen, the tile wider than 254 px, or anything past its edge is the defect this case
exists to catch.

Until 41.10 it proved #37.81's lines between Importanță's and Relevanță's cells and #38.01's shifted selects. Those
cells are gone, and the version controls' line is the only one left.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-TILES-16 Teren" (41.10; was a natural person) and a Contract de Vânzare „TC-TILES-16 Act".
- The window is 1366 px wide (41.10; was 1920, and 1366 for a step 5). „Clasificare" is ticked on both screens.

## What Adrian is asked for

Nothing.

## Steps

| # | Does | Sees |
|---|---|---|
| 1 | (41.10) At 1366 px, opens an invented property, tile „Clasificare" | 254 px wide; it reads — Importanță, Relevanță and Proveniență one to a row, Proveniență „Manual (Adaugă nou)" as text, no select |
| 2 | Presses „Editează" | Importanță, Relevanță and Proveniență as selects, one to a row, nothing past the tile's edge; „Salvează" disabled |
| 3 | Chooses an Importanță value, presses „Salvează" | The tile reads: the value as text, no select, „Editează" in the corner; still 254 px |
| 4 | Reloads the page | The value is still there; the version controls, with one line under them, inside the padding |
| 5 | „Editează", Importanță back to blank, „Renunță" | The value as it was — nothing written |
| 6 | „Versiunea anterioară" | No „Editează", no „Marchează ca verificat" |
| 7 | Opens an invented sale contract and does steps 1–5 there | The same |

## At the end — leaving things as they were found

Delete the person and the document (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.81).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200, against `npm run dev` on 3000; a script read the boxes and pressed
the buttons (FU-290). The pane renders at a device-pixel ratio under 1, so a 1-px line reads
0.787 px; what matters is that the three read the same.
- Step 1 (the person): two lines, vertical then horizontal, both 0.787 px `rgb(198, 212, 232)`
  solid, each 12 px or more inside the tile; the selects' tops level; each select's centre 0 px from
  its cell's centre (the cells 209 px, the selects 104 and 131 px); the vertical line between the
  cells and as tall as they are. The first draft of this slice centred the select AND its review
  button as one group, which put each select 21 px left of centre; the select is now centred and
  its button stands to its right.
- Step 2: „Scăzută" chosen, „Salvează": the version controls appear; three lines, the new one first,
  all the same style; the cells as in step 1. This step first said „the tile says it saved" — the
  „Salvat" check shows for two seconds only — and was corrected to what the run can read.
- Step 3: „Versiunea anterioară": the three lines; the two cells side by side, centred, level; no
  review buttons on an older version.
- Step 4 (the document): steps 1–2 the same.

**2026-10-04 — run 2, `confirmed` (Slice #37.81).** The same pane, a new person and document, the
corrected file unchanged: every step the same. Both deleted (204, 204). Nothing in the file changed,
so the case is confirmed, and `e2e/tiles/classification-dividers.spec.ts` translates it.

**2026-10-04 — `automated` (Slice #37.81).** The test runner's full run 20261004T204603Z-28586 on
b6ea81f ran `e2e/tiles/classification-dividers.spec.ts` green with the other 77 (lint, tsc, jest and
forms-drift green too).

**2026-10-05 — Slice #38.01.** Steps 1 and 3 follow the select rows' shift: each select's gap to its
cell's left edge is now 3/8 × (cell − select), not half of it, and Proveniență's title, select and
„Istoric" start on Importanță's select's left edge. Step 5 is new: the same at 1366 px. Measured in
the runner's browser before and after (20261005T185820Z-28557, 20261005T190111Z-4805), the same at
1366 and 1920 px, on a person and a document, with one version, two, and the older one: cells
208.5 px, selects 105 px (Importanță) and 132 px (Relevanță); their gaps 51.75 and 38.25 px before,
38.81 and 28.69 px after (0.75 × each, to 0.01 px); Proveniență's title, select and „Istoric" at
0 px before and at 38.81 px after — on Importanță's select's edge. The spec follows.

**2026-10-05 — `automated` (Slice #38.01).** The test runner's full run 20261005T190755Z-21923 on
c53d919 ran the changed `e2e/tiles/classification-dividers.spec.ts` green with the other 87 (lint,
tsc, jest and forms-drift green too).
