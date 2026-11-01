# TC-TILES-26 — Lățimea unei plăci, trasă de marginea dreaptă: se prinde la unități întregi, rămâne după reîncărcare, „Implicit” o uită

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | TC-E2E-TILES-26 — a property and (41.20) a natural person (created, then removed) |
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
| 7 | (41.18) Focuses the edge (it says the narrowest the tile can be), drags it one unit past that, and holds it | The edge stops at the narrowest, and beside it a bubble (41.21): „Panoul nu poate fi mai îngust de N unități:”, then a line for every row that would not fit at that width — „«Nume | Prenume» — 306 px (încap 254)”, each needing more than the tile has — the heading's first when it does not fit, „titlul «…» — … px (încap …): «…» … px, spațiu …, «…» …, margini …”, its parts adding up; past six, „… și încă N rânduri”. The live region reads the first line and how many („2 rânduri nu încap.”). Or, where its content fits one unit, „Un panou are cel puțin o unitate.” Let go: the bubble goes, the tile at its narrowest |
| 8 | (41.18) Drags it two units right — two past what it needs — and holds it | A bubble: „Cu 2 unități mai lat decât îi trebuie: rămâne loc gol în dreapta câmpurilor.” Let go: the width is taken, the field box the same |
| 9 | (41.20, 41.21, 41.22) Opens an invented natural person, `TC-E2E-TILES-26 Popescu`, its identity filled with invented data; drags the „Identitate” tile's edge from 3 units to 2, and holds it | The edge is named „Lățimea panoului Identitate” — since 41.22 the heading is only its title, the system ID being in the page bar, and no code is in the tile. The bubble lists every line of Identitate that needs more than 254 px — the row with „Prenume” and „Nume” among them — each with its px, and the heading only if it needs more too; never „ID sistem”, which only a screen reader hears. The live region says how many. Let go: the tile at 3 units. The person is removed |
| 10 | (41.27) On an invented natural person, company, property and Contract de vânzare at 1920 × 1080, „Toate”: presses ← on „Etichete și grupuri”'s edge, from 3 units; on the person types a tag in its box and presses Enter; presses Home | Each takes 2 units (254 px) — no refusal, and nothing a bubble says names a box by a key; the person's tag box, „Etichetă nouă”, is at least 136 px and the tag is added; Home gives it 3 units again. The records are removed |

## At the end — leaving things as they were found

The property is removed. The arrangement is this browser context's own.

## Notes from the runs

**2026-10-31 — Slice 41.27.** Step 10 added: Adrian could not narrow „Etichete și grupuri” to 2 units, and the refusal
named «metaTag», a width key. The tag box now takes what is left beside „Adaugă” (at least M) and is named „Etichetă
nouă”; a box is never named by its key. Written from the slice's own change; not driven by hand first.

**2026-10-31 — Slice 41.22.** The system ID left the Identity tile's heading for the page bar, so step 9's edge is
named „Lățimea panoului Identitate” and the heading's one part is „Identitate”; the heading is in the refusal's list
only if it measures more than 254 px, which the spec logs. Written from the slice's own change; not driven by hand first.

**2026-10-31 — Slice 41.21.** Steps 7 and 9 read the list: a line a row that would not fit, each with its px and the
px the tile has. Written from the slice's own change; not driven by hand first.

**2026-10-31 — Slice 41.20.** Step 7 also accepts the heading's own sentence; step 9 added — the Identity tile of an
invented natural person, whose heading carries the system ID corner. Its heading's parts are measured and logged.
Written from the slice's own change; not driven by hand first.

**2026-10-31 — Slice 41.18.** Steps 7 and 8 added: the refusal and the advice, read in the bubble while the edge is
held. Written from the slice's own change; not driven by hand first.

**2026-10-31 — Slice 41.17.** Written from the slice's own change with its spec, `e2e/tiles/tile-width-drag.spec.ts`;
not driven by hand first (`PROMOTED_WITHOUT_DRIVING`): Adrian's dev server was not running, so the runner's run is the
case's first.
