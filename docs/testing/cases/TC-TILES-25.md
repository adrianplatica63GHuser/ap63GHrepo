# TC-TILES-25 — Un dreptunghi din harta fișelor se trage ca fișa lui: cele de dedesubt alunecă, fișa se mută

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-24 |

## What this proves

Slice 40.53, Adrian, 2026-10-24: „The rectangles inside this tiles map can be moved in the same way that the tiles
can be moved - by clicking on a rectangle and dragging it to its new position; while moving it, the rectangles that
come under this moving rectangle will also be sliding down; (let's use the same amount of time that triggers the
actual tiles sliding down)". So a rectangle of the tiles diagram, pressed and moved, drags its tile — the screen's own
drag (TC-TILES-24), the same outline, the same make-room delay („Timp de ținere peste altă fișă” in „Setări” →
„Praguri de timp” → „Fișe”), the same drop and the same stored place. Laid on another rectangle's top-left, the tile's
outline stands on that tile's. While it is held there, that tile slides down on the screen and its rectangle slides
down in the diagram; the rectangle dragged is rimmed red while its place is taken. Released, the tile stands there and
the diagram is redrawn from the tiles; both places hold after a reload. Esc, or a release outside the diagram, puts
everything back; a click on a rectangle does nothing. A rectangle that does not move its tile, a tile that lands
elsewhere than the rectangle shows, a slide on the screen that the diagram does not show, or a place lost on reload,
is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: one natural person,
  „TC-TILES-25 Unu" (first name „Ion").
- This browser has no stored arrangement for a Natural Person (`ga40-tile-positions-natural-person-v1`) and no tile
  choice for a Natural Person.
- „Held" is the pointer kept still, the button down, for the saved delay plus 0,75 s, and never under 1,5 s. „A box's
  place" is its rectangle relative to the tile row.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | The window at 1920 px. Opens „TC-TILES-25 Unu"; „Toate" in „Părți afișate"; unticks „Interacțiuni" and „Arbore de moștenire" | Every tile where #37.75 places it; the diagram right of the bar, one rectangle per tile |
| 2 | In the diagram, presses on „Acte de identitate"'s rectangle and drags it until its top-left corner is at „Corelate"'s rectangle's; holds; releases | As soon as it moves, „Acte de identitate" moves on the screen with it, and the screen's outline stands on „Corelate"'s place, red, the rectangle rimmed red. Held, „Corelate" slides straight down on the screen and its rectangle slides down in the diagram; the outline turns free and the rim goes. Released, „Acte de identitate" stands where the outline was, „Corelate" stays where it slid, and the diagram shows both where they now stand |
| 3 | Reloads the page | „Acte de identitate" and „Corelate" where step 2 left them |
| 4 | In the diagram, drags „Acte de identitate"'s rectangle over „Identitate"'s; holds until a tile has slid; presses Esc; releases | Every tile, „Acte de identitate" too, back where step 3 had it |
| 5 | Drags it over „Identitate"'s again, moves the pointer well below the diagram, and releases there | Every tile back where step 3 had it |
| 6 | Clicks „Identitate"'s rectangle | Nothing moves |

## At the end — leaving things as they were found

Remove the stored arrangement and the tile choice; delete the person (`DELETE`).

## Notes from the runs

**2026-10-24 — `automated` (Slice 40.53).** Written with the behaviour, and translated at once into
`e2e/tiles/tiles-diagram-drag.spec.ts`, which the test runner ran green (the slice's handover names the run).
