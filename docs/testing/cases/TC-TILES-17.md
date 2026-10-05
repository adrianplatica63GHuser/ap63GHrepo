# TC-TILES-17 — „Conexiuni": o linie între fiecare două grupuri, ca în „Clasificări"

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-04 |

## What this proves

„Conexiuni"'s four groups — „Etichete / Cuvinte cheie", „Grupuri", „Ștampile", „Vezi și" — are
separated by a horizontal line, the one „Clasificări" draws (Slice #37.82): three lines,
one between every two groups, none first or last, each inside the tile's padding, 1 px in the rim
colour, the same space above and below. A missing line, a line before the first group or after the
last, or one that looks unlike „Clasificări"'s is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-TILES-17" and a Contract de Vânzare „TC-TILES-17 Act".
- The window is 1920 px wide. „Conexiuni" and „Clasificări" are ticked on both screens.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person | In „Conexiuni": „Etichete / Cuvinte cheie", a line, „Grupuri", a line, „Ștampile", a line, „Vezi și". Each line 12 px or more inside the tile's edges; the space above a line equal to the space below it (±1 px); every line the same width and colour as „Clasificări"'s line |
| 2 | Opens the document | The same |

## At the end — leaving things as they were found

Delete the person and the document (`DELETE`).

## Notes from the runs

**2026-10-04 — run 1, `driven` (Slice #37.82).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1200, against `npm run dev` on 3000; a script read the tile.
- Step 1 (the person): „Etichete / Cuvinte cheie", line, „Grupuri", line, „Ștampile", line, „Vezi și";
  each line inside the tile's padding, 8 px above and 8 px below, and the same
  `0.787402px solid rgb(198, 212, 232)` as „Clasificări"'s line (the pane's device-pixel
  ratio under 1 reads 1 px as 0.787).
- Step 2 (the document): the same.

**2026-10-04 — run 2, `confirmed` (Slice #37.82).** The same pane and records, the file unchanged: the
same on both screens. The person and the document deleted (204, 204). Nothing in the file changed,
so the case is confirmed, and `e2e/tiles/connections-dividers.spec.ts` translates it.

**2026-10-04 — `automated` (Slice #37.82).** The test runner's full run 20261004T211204Z-12473 on
6246938 ran `e2e/tiles/connections-dividers.spec.ts` green with the other 78 (lint, tsc, jest and
forms-drift green too).
