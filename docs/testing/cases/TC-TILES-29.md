# TC-TILES-29 — Un X în colțul fiecărui panou: „Închide — <panou>" îl ascunde ca „Panouri"

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | TC-E2E-TILES-29 (a person, created, then removed); the dashboard and „Grupuri" as they are |
| **State** | `automated` |
| **Last green** | 2026-11-05 |

## What this proves

Slice 41.91, Adrian (2026-11-05): „Any tile that is in a calm state AKA has an Edit button the top right corner shall
move that button to the left, and shall have a „close tile" button at the old place of the edit button; The gap
between the buttons is the usual one; The „close tile" button is an X similar to the cancel button used elsewhere;
Clicking the „close tile" button will close the tile, and this will reflect also in the panels checkboxes; when a tile
is in edit mode the Close Tile button will not be shown". The X in the corner, „Editează" 8 px to its left, the tile
gone and unticked in „Panouri", and no X in edit or on the last tile shown. An X anywhere else, or a tile that goes
while its box stays ticked, is the defect.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens an invented person, `TC-E2E-TILES-29 Colț`, at 1920 × 1080 | On „Identitate", „Închide — Identitate" (an X) in the corner, „Editează" 8 px to its left on its line |
| 2 | Presses the X | „Identitate" leaves the screen, its box in „Panouri" is unticked, the focus is on „Panouri" |
| 3 | Ticks „Identitate" in „Panouri" | It comes back, with its X |
| 4 | Presses „Editează" on „Identitate", then „Renunță" | No X on it while it is open; „Contact" keeps its X; back at rest, its X again |
| 5 | Closes every other tile by its X | The last tile shown has no X; „Implicit" brings them back |
| 6 | On the dashboard, then on „Grupuri", presses the first X | That tile goes, one box fewer ticked, the focus on „Panouri"; „Implicit" brings it back |

## At the end — leaving things as they were found

The person is removed; the dashboard and „Grupuri" are put back with „Implicit".

## Notes from the runs
