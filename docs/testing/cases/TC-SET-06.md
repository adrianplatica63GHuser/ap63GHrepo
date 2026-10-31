# TC-SET-06 — „Unitatea de lățime” pe „Setări”: 100 px redesenează ecranul pe loc, formularul unei persoane o ia, 119 o pune la loc

| | |
|---|---|
| **Area** | settings |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-31 |

## What this proves

Slice 41.16, Adrian (2026-10-31): „The width of the tiles is a multiple of a unit - which currently is 119 pixels. I
would like to have the ability to set the size of this unit on the Settings page. Dynamically, all the tiles will
adjust to the new unit size - this adjustment may be done lazy, when a certain form is first displayed". „Setări” →
„Contul meu” holds „Unitatea de lățime”, a whole number of px from 80 to 200, kept by this browser (the
`ga40-width-unit` cookie). The field sizes do not change, so a tile becomes the fewest units of the new size at least
as wide as it is on 119 px — never narrower than what it holds. A tile that keeps its 119-px width after „Salvează”, a
width that is not a whole number of the new units, a field that changes size or passes its tile's edge, a TILE box
that does not span its tile, or a reload that comes back at 119 is the defect.

## Before you start

- TC-AUTH-01 is green.
- This browser's unit is 119 (`ga40-width-unit` absent or `119`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Setări” at 1366 × 900 | In „Contul meu”, under „Aspect”, „Unitatea de lățime”: a box reading 119, „px”, „Un număr întreg de pixeli, între 80 și 200.”, „Salvează” disabled, no „Revino la 119 px”. „Contul meu” is 4 units of 119 px, 524 px |
| 2 | Types 100 and presses „Salvează” | „Salvat: 100 px. …”, and at once, without a reload, „Contul meu” is the fewest 100-px units at least 524 px wide — 5, 564 px. „Revino la 119 px” is there |
| 3 | Reloads | The page arrives at 100 px — the server's first answer already carries `--unit: 6.25rem` on `<html>` — and the box reads 100 |
| 4 | Opens „Adaugă persoană” | „Adresă” and „Contact” are the fewest 100-px units at least 254 px wide (2 units of 119) — 3 units, 332 px, each a whole number of units. Their fields keep their sizes (Localitate 136 px, Țară 80), every one inside its tile; „Stradă, Nr., etaj, ap” (TILE) spans the tile inside its padding, 306 px |
| 5 | Back on „Setări”, presses „Revino la 119 px” | The box reads 119, „Contul meu” is 524 px again, the button is gone |

## At the end — leaving things as they were found

Step 5 puts the unit back; the spec also writes `ga40-width-unit=119` in `finally`, so a red run leaves nothing
behind. Nothing is written to the database.

## Notes from the runs

**2026-10-31 — Slice 41.16.** Written from the slice's own change with its spec, `e2e/settings/width-unit.spec.ts`;
not driven by hand first (`PROMOTED_WITHOUT_DRIVING`). Step 4 uses „Adaugă persoană”, the form with every box, so no
record is created.
