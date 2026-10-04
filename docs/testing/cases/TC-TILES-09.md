# TC-TILES-09 — „Clasificare subiectivă": Relevanță lângă Importanță, butonul de salvare pe linia „Istoric"

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

On every record screen „Clasificare subiectivă" shows Importanță and Relevanță side by side on one
row, Proveniență on a row of its own under them, and the save button on the line of „Istoric",
against the tile's right edge — no longer on a row of its own. The button still does its job: it
stays disabled until a value changes, and a save writes. A Relevanță under Importanță, a save
button on a row of its own or off the tile's right edge, or a save that no longer writes is the
defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-TILES-09 Teren de test", an „Adeverință" „TC-TILES-09 Act de test", a natural person
  „TC-TILES-09 Ion" and a company „TC-TILES-09 Firmă de test SRL".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the natural person with `?tab=metadata` on its address | „CLASIFICARE SUBIECTIVĂ" is 476 px wide (3 units). Importanță and Relevanță stand side by side: Relevanță's select is level with Importanță's (the same top, to the pixel) and to its right. Proveniență's select is under both |
| 2 | Looks at the line of „ISTORIC" | The save button „Salvează" is on it, disabled: its middle is within the height of „ISTORIC", and its right edge is the tile's right edge less its padding (12 px), to the pixel. There is no other „Salvează" in the tile |
| 3 | Changes Importanță to „Ridicată" and presses „Salvează" | The button turns into „✓ Salvat", still on „Istoric"'s line. Opened again, the person's Importanță reads „Ridicată" |
| 4 | Opens the company, the property and the document the same way (`?tab=metadata`) | On each, steps 1 and 2 read the same |

## At the end — leaving things as they were found

`?tab=metadata` adds the two tiles for the visit only; nothing is stored. Delete the four records
(`DELETE` on each route).

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.68).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, the tab emulating 1366 × 900, read with a script. This file was written from
the code first and needed no correction.
- Step 1: on the person „CLASIFICARE SUBIECTIVĂ" 476 × 279 px (it was 312 × 392 in 2 units);
  Importanță's and Relevanță's selects both at top 938, Relevanță's to the right; Proveniență's under
  both.
- Step 2: one „Salvează", disabled; its middle at 1098, „ISTORIC" from 1090 to 1106; its right edge
  711.2, the tile's right edge less its border and 12 px 711.2.
- Step 3: the pane's click landed beside the button in the emulated window (FU-290), so the press
  was the button's own `click()`; it turned into „✓ Salvat" on the same line. Opened again:
  „Ridicată".
- Step 4: the company, the property and the document — 476 px, the two selects level, the button on
  „Istoric"'s line at the right edge, disabled, one in each tile. The four records deleted (204 ×4).

**2026-10-03 — run 2, `confirmed` (Slice #37.68).** The same pane, four new records, the file above
unchanged: the same in every step on all four — 476 px, the selects level, one disabled „Salvează"
on „Istoric"'s line at the right edge; on the person the change to „Ridicată" saved („✓ Salvat") and
read back after reopening. The four records deleted (204 ×4). Nothing in the file changed, so the
case is confirmed, and `e2e/tiles/classification-one-row.spec.ts` translates it.

**2026-10-03 — `automated` (Slice #37.68).** The test runner's full run 20261004T020726Z-28073 on
cfda189 ran `e2e/tiles/classification-one-row.spec.ts` green with the other 64 specs (lint, tsc,
jest and forms-drift green too).
