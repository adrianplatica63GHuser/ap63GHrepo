# TC-TILES-16 — „Clasificări": linii între cele trei, Importanță și Relevanță fiecare în celula ei, Proveniență pe linia Importanței

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

In „Clasificări" (Slice #37.81) a vertical line separates Importanță from Relevanță, and a
horizontal one separates the two from Proveniență; with two versions the version controls' line is
the same line. Every line is 1 px in the rim colour and stops inside the tile's padding. Importanță
and Relevanță each stand centred in a cell of their own, their selects level. A cell's content
pushed to one side, the lines looking different from each other, or a line touching the tile's
border is the defect this case exists to catch; a change and a save still write.

Since Slice #38.01 each cell's select row stands a little left of the centre: the select's gap to its
cell's left edge is three quarters of what centring gave it (d), its review button still beside it,
the title and the notes under it still centred. Proveniență's title, select and „Istoric" start on
Importanță's select's left edge. A select back at its cell's centre, or Proveniență starting at the
tile's padding, is the defect that change adds.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-TILES-16" and a Contract de Vânzare „TC-TILES-16 Act".
- The window is 1920 px wide (1366 px for step 5). „Clasificări" is ticked on both screens.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person | One version: two lines in the tile — a vertical one between Importanță and Relevanță, a horizontal one under them, before Proveniență. Relevanță's select level with Importanță's (the same top); each select's left edge 3/8 × (the cell's width − the select's width) from its cell's left edge, ±1 px — three quarters of the centred gap (#38.01); Proveniență's title, select and „Istoric" each starting on Importanță's select's left edge, ±1 px; the vertical line between the two cells, from the cells' top to their bottom, and every line inside the tile's padding (12 px from the tile's edges, or more) |
| 2 | Chooses an Importanță value and presses the tile's „Salvează" | The version controls appear („Versiunea anterioară"): two versions; and a third line, under them, the same 1 px and colour as the other two. The two cells as in step 1 |
| 3 | Goes to the older version („Versiunea anterioară") | The three lines are there, Importanță and Relevanță still side by side, their selects placed as in step 1 and level, Proveniență on Importanță's select's line — with no review buttons |
| 4 | Opens the document and does steps 1–2 there | The same |
| 5 | Narrows the window to 1366 px and opens the person again | The selects placed as in step 1 and level, Proveniență on Importanță's select's line, every line inside the padding |

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
