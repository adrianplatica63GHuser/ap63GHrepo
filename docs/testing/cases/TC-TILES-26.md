# TC-TILES-26 — Lățimea unei plăci, trasă de marginea dreaptă: se prinde la unități întregi, rămâne după reîncărcare, „Implicit” o uită

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | TC-E2E-TILES-26 (created, then removed) |
| **State** | `automated` |
| **Last green** | 2026-10-31 |

## What this proves

Slice 41.17, Adrian (2026-10-31): „I would like to be able to adjust the width of any tile by grabbing its right edge
and moving it left or right; however, for the case of the tiles the width of the tile will snap into place at the next
size possible for that tile - which is an integer number of units … If I grab the right edge of a 3 unit tile and I
move it left it will snap into place as a 2 unit tile; but if I move it right it will snap into place as a 4 unit
tile” — „there will be no change to the size and position of the fields on the tile” — „The new sizes which I set for
each tile will be memorized in the same way the positions of tiles is currently memorized”. A width between whole
units after the drag, a field box that changes width, a width lost on a reload, or one „Implicit” keeps is the defect.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens an invented property, `TC-E2E-TILES-26 Teren`, at 1920 × 1080 | Every tile has, on its right edge, an 8-px strip with the col-resize cursor — a separator named „Lățimea panoului <title>”. Focused, it says the tile's width in units and the narrowest and widest it can be. The first tile that can go a unit either way and holds a field box is taken — on a property, „Date cadastrale”, 4 units (no 3-unit tile on a property holds its fields in 2: „Etichete și grupuri”'s tag box is 272 px) |
| 2 | Drags its right edge a third of a unit left and lets go | One unit fewer, its field box the same width |
| 3 | Drags it a third of a unit right, twice | Its own width, then one unit more; the field box the same width. The arrangement this browser keeps holds the width, in units |
| 4 | Reloads | The same width |
| 5 | Presses „Implicit” | Its own width again |
| 6 | Focuses the edge, presses → then Home | One unit more, the focus still on the edge; then its own width |
| 7 | (41.18) Focuses the edge (it says the narrowest the tile can be), drags it one unit past that, and holds it | The edge stops at the narrowest, and beside it a bubble: „Panoul nu poate fi mai îngust de N unități: rândul «…» are nevoie de … px.” — or, where its content fits one unit, „Un panou are cel puțin o unitate.” — read out too. Let go: the bubble goes, the tile at its narrowest |
| 8 | (41.18) Drags it two units right — two past what it needs — and holds it | A bubble: „Cu 2 unități mai lat decât îi trebuie: rămâne loc gol în dreapta câmpurilor.” Let go: the width is taken, the field box the same |

## At the end — leaving things as they were found

The property is removed. The arrangement is this browser context's own.

## Notes from the runs

**2026-10-31 — Slice 41.18.** Steps 7 and 8 added: the refusal and the advice, read in the bubble while the edge is
held. Written from the slice's own change; not driven by hand first.

**2026-10-31 — Slice 41.17.** Written from the slice's own change with its spec, `e2e/tiles/tile-width-drag.spec.ts`;
not driven by hand first (`PROMOTED_WITHOUT_DRIVING`): Adrian's dev server was not running, so the runner's run is the
case's first.
