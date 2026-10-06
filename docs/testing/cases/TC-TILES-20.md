# TC-TILES-20 — O fișă trasă sub două fișe urcă sub cea rămasă când una dintre ele nu e afișată

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-06 |

## What this proves

Since Slice #38.16 a stored tile arrangement (#37.76) leaves no empty space above a tile: once the
stored places are laid out, every tile rises, in its own columns, to right under the tile above it.
So a tile the user put under two side-by-side tiles stands right under the one that is left on a
record where the other is not shown. The arrangement itself is not rewritten: shown again, the
other tile has its place back and the tile stands under it as the user made it. A drop rises at
once, so what the user sees on letting go is what the next visit shows. A tile left with a hole
above it, a tile that moves sideways, or an arrangement rewritten by a visit is the defect this case
exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: two natural persons,
  „TC-TILES-20 Unu" (first name „Ion") and „TC-TILES-20 Doi" (first name „Ana").
- The window is **1920 px** wide. This browser has no stored arrangement for a Natural Person
  (`ga40-tile-positions-natural-person-v1` removed from its localStorage), and its tile choice
  (`ga40-tiles-natural-person-v1`) is set aside and put back at the end.
- „A box's place" is its rectangle relative to the tile row (the page scrolls in its pane). „Its
  columns" are the units its left and right edges span; „right under" is the lowest bottom of the
  other boxes in those columns plus the 16-px PANEL_GAP, exactly.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-20 Unu"; „Toate" in „Părți afișate"; unticks „Interacțiuni" | Every tile but „Interacțiuni", each where #37.75 places it; „Clasificări" at the left edge, under „Adresă domiciliu" |
| 2 | Presses on „Conexiuni"'s left padding and drags until its top-left corner is one unit right of „Clasificări"'s left edge and 60 px under the lowest other tile in the columns it will span; releases | While dragging the outline is marked free. Released, „Conexiuni" rises: its left edge one unit right of „Clasificări"'s, its top right under „Clasificări" — under two tiles, „Clasificări" and „Adresă corespondență", the lower one. Every other box where it was in step 1 |
| 3 | Opens „TC-TILES-20 Doi"; unticks „Clasificări" | „Conexiuni" keeps its left edge, and stands right under the tiles left in its columns („Adresă domiciliu" and „Adresă corespondență") — no empty space above it |
| 4 | Ticks „Clasificări" again | „Clasificări" where step 1 had it, and „Conexiuni" right under it again, its left edge unchanged |
| 5 | Reloads the page | „Conexiuni" where step 4 had it |

## At the end — leaving things as they were found

Remove `ga40-tile-positions-natural-person-v1`, put the tile choice back; delete the two persons
(`DELETE`).

## Notes from the runs

**2026-10-06 — run 1, `driven` (Slice #38.16).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1300, against `npm run dev` on 3000. The pane's emulated viewport drops
real clicks (FU-290), so a script clicked the boxes and buttons and dispatched the pointer events
(`pointerdown` on the element under the point, twelve `pointermove`s, `pointerup`), and read the
boxes relative to the row.
- Step 1: identity 0,0; idCard 492,0; contact 984,0; „Adresă domiciliu" 0,369 (bottom 694); „Adresă
  corespondență" 492,397 (bottom 690); „Corelate" 984,363; „Clasificări" 0,710 (bottom 1006);
  „Conexiuni" 492,706.
- Step 2: the press lands on „Conexiuni"'s own `section`; the outline reads free (it stood at 164,1144:
  the pointer near the window's bottom edge scrolls the page, so the release lands lower than 60 px —
  the rise does not care). Released, „Conexiuni" stands at 164,1022 — one unit right of
  „Clasificări", 16 px under its bottom. No other box moved.
- Step 3: on „Doi", „Clasificări" unticked: „Conexiuni" at 164,710 — 16 px under „Adresă domiciliu"
  (694), the lowest left in its columns. The stored arrangement unchanged (`connections` still
  `{col 1, top 1022}`).
- Step 4: „Clasificări" back at 0,710; „Conexiuni" at 164,1022, 16 px under it.
- Step 5: after the reload „Conexiuni" at 164,1022.
- Both persons deleted (204); the browser's arrangement removed and its tile choice put back.

**2026-10-06 — run 2, `confirmed` (Slice #38.16).** The same pane and viewport, two new persons, the
file above unchanged: the same in every step, to the pixel (the outline at 164,1128 in step 2).
Deleted (204). Nothing in the file changed, so the case is confirmed, and
`e2e/tiles/tiles-rise.spec.ts` translates it.

**2026-10-06 — `automated` (Slice #38.16).** The test runner's full run 20261006T154851Z-356 on
c8c9259 ran `e2e/tiles/tiles-rise.spec.ts` green with the other 97 specs (lint, tsc and forms-drift
green; jest's one red was this case's missing route in `catalogue-map.ts`, added in the next commit).
