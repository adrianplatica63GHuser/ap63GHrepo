# TC-TILES-24 — O fișă ținută peste alta îi face loc: fișa de dedesubt alunecă în jos, la primul loc liber

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-19 |

## What this proves

Slice 39.91, Adrian, 2026-10-19: „If: on a screen with tiles I am dragging any tile on top of another tile
and stopping on top for more than a time interval that I can set in Settings (seconds with decimals), that
tile should slide down until it finds an available spot, large enough, to make room for me to drop off the
tile I am moving ; applies to all screens with tiles, now and in the future". So a tile dragged until its
outline stands over another tile, and held there past the make-room delay (1,0 s until 39.92 puts it in
„Setări"), makes that tile slide straight down, in its own columns, to the first place below where it fits
whole; the outline then shows the place free, and the dragged tile is dropped there. Both places hold after
a reload; Esc puts every tile back. It is checked on a record screen (through `TileAreas`) and on an
administration screen (through `TileUnitRow`), the two ways a screen's tiles are dragged. A tile that does
not move, moves sideways or up, lands on another, or a place lost on reload, is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: one natural person,
  „TC-TILES-24 Unu" (first name „Ion"); a property group „TC-TILES-24 Grup de test" with two properties in
  it, „TC-TILES-24 Teren A" and „TC-TILES-24 Teren B".
- This browser has no stored arrangement for a Natural Person (`ga40-tile-positions-natural-person-v1`) nor
  for a group's screen (`ga40-tile-positions-admin-group-v1`), and no tile choice for a Natural Person.
- „Held" is the pointer kept still, the button down, for 1,5 s. „A box's place" is its rectangle relative to
  the tile row.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | The window at 1920 px. Opens „TC-TILES-24 Unu"; „Toate" in „Părți afișate"; unticks „Interacțiuni" and „Arbore de moștenire" | Every tile where #37.75 places it |
| 2 | Presses on „Act de identitate"'s left padding and drags it until its top-left corner is at „Corelate"'s; holds; releases | While it is held the outline turns from red to free, and „Corelate" — with any tile the outline covers — slides straight down, its left edge unchanged, clear of the outline; every other tile stays. Released, „Act de identitate" stands where the outline was, and „Corelate" stays where it slid |
| 3 | Reloads the page | „Act de identitate" and „Corelate" where step 2 left them |
| 4 | Drags „Act de identitate" over „Identitate"; holds until a tile has slid; presses Esc; releases | Every tile, „Act de identitate" too, back where step 3 had it |
| 5 | The window at 1920 px. Opens the group's screen; presses on „Deja în grup"'s bottom bar and drags it until its top-left corner is at „Membri disponibili pentru includere"'s; holds; releases | While it is held the outline turns free and „Membri disponibili…" slides straight down under it. Released, „Deja în grup" stands where the outline was; „Identitatea grupului" never moves |
| 6 | Reloads the page | Both places hold |

## At the end — leaving things as they were found

Remove both stored arrangements and the tile choice; delete the person, the group and the two properties
(`DELETE`).

## Notes from the runs

**2026-10-19 — `automated` (Slice 39.91).** Written with the behaviour, and translated at once into
`e2e/tiles/tiles-make-room.spec.ts`, which the test runner ran green (the slice's handover names the run).
