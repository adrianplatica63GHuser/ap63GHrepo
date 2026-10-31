# TC-TILES-27 — „Legături” lățită pe o persoană are aceeași lățime pe o proprietate, în locul ei; „Implicit” o uită pe amândouă

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | TC-E2E-TILES-27 (a person and a property, created, then removed) |
| **State** | `automated` |
| **Last green** | 2026-10-31 |

## What this proves

Slice 41.19, Adrian (2026-10-31): „For the tiles used in multiple places (like Links, Addresses and Classification)
one change to the size of any of these tiles done on any form will propagate to every other form where these tiles
are being used”. „Legături”, every address tile, „Clasificare” and „Etichete și grupuri” keep one width on every form,
kept by this browser; each form keeps its own place for them. A width that stays on the form it was set on, a tile
moved by it on another form, or an „Implicit” that leaves the other form's width is the defect.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens an invented property, `TC-E2E-TILES-27 Teren`, at 1920 × 1080 | „Legături” at its own width, a whole number of units |
| 2 | Opens an invented person, drags „Legături”'s right edge a third of a unit right and holds it, then lets go | While held, the bubble beside the edge says „Lățimea se aplică panoului Legături pe toate formularele.”; let go, one unit wider |
| 3 | Opens the property again | „Legături” one unit wider too, in the column it stood in |
| 4 | Presses „Implicit” on the property, then opens the person | Its own width on the property, and on the person |

## At the end — leaving things as they were found

Both records are removed. The widths are this browser context's own.

## Notes from the runs

**2026-10-31 — Slice 41.19.** Written from the slice's own change with its spec, `e2e/tiles/tile-width-shared.spec.ts`;
not driven by hand first (`PROMOTED_WITHOUT_DRIVING`).
