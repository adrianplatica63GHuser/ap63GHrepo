# TC-MAP-08 — „Instrumente": trei ghiduri ale butoanelor hărții; „OK" deschide harta cu butoanele lor clipind

| | |
|---|---|
| **Area** | map |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

## What this proves

Slice #39.78: under „Instrumente", after „Calcul drum lateral", three items — „Măsurători pe hartă", „Grupări de
proprietăți" and „Navigare" — each open a box that draws the buttons it is about, with the map's own icons and
names, and says what each does. „OK" on the first opens the map of all properties with Unghiuri, Riglă and the two
area buttons pulsing together for three seconds; on the second, with Tarlale, Grupuri and Selectează; on „Navigare"
it only closes the box. The box opens every time its item is pressed. On the map, the gap before „Tarlale" (after
„Suprafața unei zone oarecare") and the gap before „Setări hartă" (after „Selectează") are twice the row's.

## Before you start

- TC-AUTH-01 is green, with full access. The window is 1366 × 900; the language is Română.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Instrumente" in the sidebar | „Distilare Tipizate", „Calcul drum lateral", „Măsurători pe hartă", „Grupări de proprietăți", „Navigare"; no „Calcul suprafață" |
| 2 | Presses „Măsurători pe hartă" | A box „Măsurători pe hartă": four rows, each with the map's button and a sentence — „Unghiuri", „Riglă", „Suprafața unei zone delimitate", „Suprafața unei zone oarecare" — and „La OK se deschide harta tuturor proprietăților, cu aceste butoane clipind." |
| 3 | Presses „OK" | „Toate Proprietățile", the map, the address ending `?pulse=measure`; the four buttons pulse together in violet, three times, and no other does; none is pressed |
| 4 | Waits four seconds | All four settled, none pressed |
| 5 | Looks at the toolbar's gaps | Between „Suprafața unei zone oarecare" and „Tarlale", and before „Setări hartă", twice the gap between the other buttons |
| 6 | Opens „Instrumente" and presses „Grupări de proprietăți" | A box „Grupări de proprietăți": three rows — „Tarlale", „Grupuri", „Selectează" — the last saying it puts the selection into a group and deletes nothing |
| 7 | Presses „OK" | The address ends `?pulse=groups`; „Tarlale", „Grupuri" and „Selectează" pulse together, and no other button does |
| 8 | Waits four seconds, then presses „Grupări de proprietăți" again, and „OK" | The box opens again; on the same address, the three pulse again |
| 9 | Presses „Navigare" | A box „Navigare": one row, „Navighează", saying it is on the property form and in the window a property's click opens on the map of all properties |
| 10 | Presses „OK" | The box closes; the page and the address are as before |

## At the end — leaving things as they were found

Nothing to undo.

## Notes from the runs

**2026-10-18 — written and automated (Slice #39.78).** `e2e/map/map-guides.spec.ts`. The pulse is read as the
class `ga-area-pulse` on each button, the gaps as the distance between neighbouring boxes. No real maps: the boxes,
the buttons and their pulse draw whether or not Google's map loads.
