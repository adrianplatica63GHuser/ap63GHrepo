# TC-MAP-04 — „Instrumente → Calcul suprafață": harta tuturor proprietăților, cu cele două butoane de suprafață arătate

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-11 |

## What this proves

„Calcul suprafață" (Slice #39.09), under „Instrumente" right after „Calcul drum lateral", opens the map of all
properties on „Toate" and draws the eye to its two area buttons (#39.07, #39.08): both pulse in violet for three
seconds, together, then settle. Nothing is pressed for the user. The item is the sidebar's active one there; a reload
points the buttons out again.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Instrumente" in the sidebar | „Calcul suprafață", with the dotted-corner rectangle, right after „Calcul drum lateral" |
| 2 | Presses it | „Toate Proprietățile", the map; „Calcul suprafață" is the active item, not „Proprietăți"; the address ends `?area=1` |
| 3 | Looks at the map's toolbar | „Suprafața unei zone delimitate" and „Suprafața unei zone oarecare" pulse together — a violet ring and band, three times; neither is pressed |
| 4 | Waits four seconds | Both settled, neither pressed |
| 5 | Reloads the page | They pulse again |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-11 — written and automated (Slice #39.09).** `e2e/map/area-calculation-nav.spec.ts`. The pulse is read as
the class `ga-area-pulse` on each button.
