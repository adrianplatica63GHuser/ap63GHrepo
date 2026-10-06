# TC-GRP-04 — Ecranul unui grup: trei fișe cu nume, „Deja în grup" sub identitate, trase ca pe formulare

| | |
|---|---|
| **Area** | group |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.12 the group screen (Administrare → Grupuri → a group) has three tiles named by their
titles — „Identitatea grupului", „Membri disponibili pentru includere" and „Deja în grup" — drawn by the
record forms' own packing and drag (#37.75, #37.76). By default „Deja în grup" stands under „Identitatea
grupului", with „Membri disponibili pentru includere" at their right, at 1366 px and at 1920 px alike
(the three are never one row). A tile dragged by its unused space to a free place stays there, and
after a reload, under the screen's own key (`ga40-tile-positions-admin-group-v1`); „Implicit" at the
screen's top right puts it back. A tile that opens in one row with the others, a place lost on reload,
or an „Implicit" that leaves it where it was dragged, is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property group
  „TC-GRP-04 Grup de test" and three properties „TC-GRP-04 Teren A", „B" and „C"; A and B added to the
  group (`POST /api/metadata/{id}/groups`, what „Conexiuni"'s picker sends), C not.
- The browser holds no arrangement for the screen (`ga40-tile-positions-admin-group-v1` removed).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | With the window 1366 px wide, opens the group | Three tiles: „Identitatea grupului" (Țintă, Cod, Descriere, the save button); „Deja în grup" — count 2, A and B — **under it**; „Membri disponibili pentru includere" — with C — **at their right**, its top level with „Identitatea grupului"'s. „Implicit" at the screen's top right |
| 2 | Widens the window to 1920 px | The same three places: „Deja în grup" still under „Identitatea grupului"; the space at the right of „Membri disponibili pentru includere" is empty |
| 3 | Presses on „Deja în grup"'s unused space (the padding of its bottom bar, beside „Elimină din grup (0)") and drags it to the right of „Membri disponibili pentru includere", level with its top | While it moves, a dashed outline where it would land; released, the tile stays there. „Identitatea grupului" and „Membri disponibili…" have not moved |
| 4 | Reloads the page | „Deja în grup" is where it was dropped |
| 5 | Presses „Implicit" | „Deja în grup" goes back under „Identitatea grupului"; the browser no longer holds an arrangement for the screen |

## At the end — leaving things as they were found

Delete the group and the three properties (`DELETE` on each); remove `ga40-tile-positions-admin-group-v1`.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.12).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, its viewport emulated at 1920 × 1000 and 1366 × 900; the drag was dispatched as
pointer events from a script (FU-290). Group GRP-385.
- Step 1 (1366): the row 968 px (6 units); „Identitatea grupului" at (0, 0), „Membri disponibili pentru
  includere" at (492, 0), „Deja în grup" at (0, 320) — 304 px of identity tile and the 16-px gap.
- Step 2 (1920): the row 1624 px; the same three places.
- Step 3: pressed in „Deja în grup"'s bottom bar, moved 984 px right and 320 px up: the outline read free;
  dropped at (984, 0), the others unmoved; stored `{"in-group":{"col":6,"top":0}, …}`.
- Step 4: after the reload, (984, 0).
- Step 5: „Implicit": back at (0, 320); the key gone.
- Also tried: „Ascunde elementele" leaves „Identitatea grupului" alone; pressed again, the default places.
- All four deleted (204 × 4).

**2026-10-05 — run 2, `confirmed` (Slice #38.12).** The same pane, a new group (GRP-386) and three new
properties, the file as written: step 1 at 1366 — (0, 0), (492, 0), (0, 320), „Implicit" at the top
right; step 2 at 1920 — the same; step 3 — the pointer „grab" over the bottom bar's padding, the outline
dashed and free, dropped at (984, 0), the others unmoved; step 4 — (984, 0) after the reload; step 5 —
(0, 320), the key gone. All four deleted (204 × 4). A pane artefact, not the screen's: the pane's page
reports itself hidden, so it draws no animation frames, and a window widened after the page loaded was
not laid out afresh until a reload — the step 3 drop was first refused there. A shown browser lays the
row out on the resize; the spec widens the window and drags in one. Nothing in the file changed, so the
case is confirmed, and `e2e/group/group-screen-tiles.spec.ts` translates it.
