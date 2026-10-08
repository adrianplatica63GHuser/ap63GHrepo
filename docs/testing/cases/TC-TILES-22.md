# TC-TILES-22 — O fișă trasă sub „Interacțiuni” rămâne acolo, și după reîncărcare, pe ambele fișe de persoană

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-08 |

## What this proves

Slice #38.46, Adrian: „I cannot place any tile under the Interactions tile; It doesn't allow me". The
cause: when the window is too narrow for the right column beside the left tiles (on a person below
about 1600 px — a maximized window on a 1920-px laptop at 125 % scaling), the column wrapped under the
left area as a line of its own, outside the tile packing, so a tile dropped „under" it landed in the
left area, which grew and pushed „Interacțiuni" down below it again. Since #38.46 the wrapped column's
tiles are boxes of the row, under the left tiles, with the action bar under them. This case drops a
tile under „Interacțiuni" with the column beside (1920 px) and wrapped (1366 px), on a Natural and a
Judicial Person, and reloads. A tile that lands above „Interacțiuni", a place lost on reload, or the
action bar above „Interacțiuni" is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**: a natural person „TC-TILES-22 Unu" (first name „Ion") and a company
  „TC-TILES-22 SRL".
- This browser has no stored arrangement and no tile choice for either screen
  (`ga40-tile-positions-<entity>-v1`, `ga40-tiles-<entity>-v1` removed).

## What Adrian is asked for

Nothing.

## Steps

Each step on the natural person, then on the company.

| # | A person does | And sees |
|---|---|---|
| 1 | The window at **1920 px**; opens the record; „Toate" | „Interacțiuni" at the right, beside the left tiles |
| 2 | Drags the second tile of the left area by its left padding until its top-left corner is at „Interacțiuni"'s left edge, about 120 px under it; releases | While dragging the outline is marked free. Released, the tile stands under „Interacțiuni", its left edge on „Interacțiuni"'s |
| 3 | Reloads | The tile still under „Interacțiuni", at the same place |
| 4 | The stored arrangement removed; the window at **1366 px**; reloads | „Interacțiuni" under the left tiles, from the left edge; the action bar under it |
| 5 | Drags the second tile as in step 2 | Released, the tile stands under „Interacțiuni"; the action bar under the tile |
| 6 | Reloads | The tile still under „Interacțiuni", at the same place; „Interacțiuni" where step 4 had it |

## At the end — leaving things as they were found

Remove both screens' stored arrangements and tile choices; delete the two records (`DELETE`).

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.46).** Written with the fix, and translated at once into
`e2e/tiles/tiles-under-interactions.spec.ts`, which the test runner ran green (the slice's handover
names the run). Before the fix, a probe of the same steps at 1366 and 1536 px put the dropped tile
above „Interacțiuni" after the release, and the action bar above „Interacțiuni"; at 1600 px and up
the column stood beside and the drop already held.
