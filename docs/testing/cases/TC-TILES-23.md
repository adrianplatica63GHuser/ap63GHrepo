# TC-TILES-23 — Bara de butoane e ultimul lucru de pe ecran, la orice lățime, pe persoană, act și proprietate

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.47, Adrian: „The button row should be the lowest thing on the page". Before it, the action bar
(Salvează, Anulează, …) stood under the left tiles only: with the right column wrapped under the left
area it stood above „Interacțiuni", „Pagini" or the map, and with the column beside, a column taller
than the left tiles reached below it. Since #38.46/#38.47 the bar stands under every tile — the right
column's too, beside or wrapped — and spans the row. A tile whose bottom is below the bar's top, at any of
the three widths, on any of the three screens, is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a natural person „TC-TILES-23 Unu" (first name „Ion"), a contract de
  vânzare „TC-TILES-23 Act", and a property „TC-TILES-23 Teren" with four corners.
- This browser has no stored arrangement and no tile choice for the three screens.

## What Adrian is asked for

Nothing.

## Steps

On each of the three records, „Toate" first.

| # | A person does | And sees |
|---|---|---|
| 1 | The window at **1920 px** | The bar's top under the bottom of every tile on the screen, the right column's included; the bar as wide as the tile row |
| 2 | The window at **1366 px** | The same |
| 3 | The window at **960 px** | The same |

## At the end — leaving things as they were found

Remove the three screens' stored arrangements and tile choices; delete the three records (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.47).** Written with the fix, and translated at once into
`e2e/tiles/action-bar-lowest.spec.ts`, which the test runner ran green (the slice's handover names the
run).
