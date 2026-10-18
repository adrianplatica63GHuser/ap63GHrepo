# TC-MAP-04 — O legătură veche `?area=1`: harta tuturor proprietăților, cu cele două butoane de suprafață arătate

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

## What this proves

„Calcul suprafață" (Slice #39.09) opened the map of all properties at `/properties/map?area=1`, with its two area
buttons (#39.07, #39.08) pulsing in violet for three seconds. Slice #39.78 took the item out of „Instrumente" — three
guides to the map's buttons took its place (TC-MAP-08) — but a link to the old address, kept in a bookmark or a note,
still works: the map opens on „Toate", both area buttons pulse together, and only they; nothing is pressed for the
user; a reload points them out again. The sidebar's active item there is „Proprietăți", as on the map from any other
door.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Types `/properties/map?area=1` into the address bar | „Toate Proprietățile", the map; in the sidebar „Proprietăți" is the active item; „Instrumente" has no „Calcul suprafață" |
| 2 | Looks at the map's toolbar | „Suprafața unei zone delimitate" and „Suprafața unei zone oarecare" pulse together — a violet ring and band, three times — and no other button does; neither is pressed |
| 3 | Waits four seconds | Both settled, neither pressed, the address unchanged |
| 4 | Reloads the page | They pulse again |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-18 — rewritten (Slice #39.78).** The case was „Instrumente → Calcul suprafață", the item that opened this
address; the item went, the address stays. Its spec (`e2e/map/area-calculation-nav.spec.ts`) now types the address,
and no longer opts into real maps: the pulse is the toolbar's, which draws whether or not Google's map loads.

**2026-10-11 — written and automated (Slice #39.09).** `e2e/map/area-calculation-nav.spec.ts`. The pulse is read as
the class `ga-area-pulse` on each button.
