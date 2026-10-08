# TC-PERS-07 — „Interacțiuni”, o fișă fixă la dreapta pe persoane; prima fișă a persoanei juridice se numește „Identitate”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Natural Person and Judicial Person show a fixed right-hand tile „Interacțiuni" (Slice #37.89): as large
as a Document's „Pagini", light purple, pinned like „Hartă" and „Pagini", saying the
interaction-management module will be developed later. Its checkbox stands at the right of the bar in
the purple strip, ticked by default; unticking it hides the tile. The Judicial Person's first tile and
panel are called „Identitate". A tile of another size, in the left area, of another colour, or the old
name „Persoană juridică" on the first tile is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: „TC-PERS-07 Ion"
  (a natural person), „TC-PERS-07 SRL" (a judicial person) and „TC-PERS-07 Act" (a Contract de
  Vânzare with no page).
- The browser has no stored tile choice for persons (`ga40-tiles-natural-person-v1`,
  `ga40-tiles-judicial-person-v1`).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-PERS-07 Act" at 1920 px | „Pagini", with no page, at the right: 640 × 436 px — 420 before #38.30's subtitle line (a few px more or less with another font's line height) |
| 2 | Opens „TC-PERS-07 Ion" at 1920 px | The bar's last box is „Interacțiuni" — not ticked since #38.30; ticks it — alone in the purple strip (`rgb(246, 240, 254)`). At the right of the screen, top-aligned with the row, the tile „Interacțiuni": fill `rgb(246, 240, 254)`, rim `rgb(218, 203, 238)`, 640 × 420 px — „Pagini"'s size and place — reading, in italics and in parentheses (#38.06), „(Modulul de gestionare a interacțiunilor va fi dezvoltat în viitor.)" |
| 3 | Unticks „Interacțiuni" | The tile goes, and the right-hand column with it. Ticks it again: it is back |
| 4 | At 1366 px | The column stands under the left area; „Interacțiuni" still 640 × 436 px and purple, as „Pagini" is on „TC-PERS-07 Act" at 1366 |
| 5 | Opens „TC-PERS-07 SRL" at 1920 px | The bar reads „Date de înregistrare", „Reprezentanți și contact", „Adrese", „Legături", „Clasificare", „Etichete și grupuri", „Interacțiuni"; the first panel is headed „Date de înregistrare"; „Interacțiuni" at the right, 640 × 436 px |

## At the end — leaving things as they were found

Delete the three records (`DELETE`) and the two stored tile choices.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.89).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, the screens read by a script in frames 1920 and 1366 px wide.
- Steps 1 and 2: „Pagini" at (1232, 163), 640 × 420; „Interacțiuni" at (1232, 163), 640 × 420, the
  same, purple, its text as written; the last box „Interacțiuni", ticked, the purple strip holding
  only it.
- Step 3: unticked, no tile and the right area hidden; ticked again, the tile back.
- Step 4: the column under the left area (y 1691), 640 × 420, as „Pagini" (y 2216 on the document,
  whose left area is taller).
- Step 5: the seven boxes as written; the first panel's heading „Identitate"; „Interacțiuni" at
  (1232, 163), 640 × 420.

**2026-10-05 — run 2, `confirmed` (Slice #37.89).** The same pane, records and file, the stored
choices cleared again: the same in every step (1232, 163, 640 × 420 for both tiles at 1920; the
column under the left area at 1366; the seven boxes and „Identitate" on the company). The three
records were deleted (204 ×3) and the two stored choices removed. `e2e/person/interactions-tile.spec.ts`
translates the case.

**2026-10-05 — `automated`.** `e2e/person/interactions-tile.spec.ts` translates the case; green in the
runner's full run `20261005T044813Z-14028` on `d2752d7` (Slice #37.89).

**2026-10-05 — Slice #38.06.** The tile's sentence reads in italics and in parentheses; the
parentheses are drawn around the message, which stays a plain sentence in both message files. Step 2
says so; nothing else changed. The spec follows.

**2026-10-05 — `automated` (Slice #38.06).** The test runner's full run 20261005T220302Z-26924 on
6310565 ran the changed spec green with the other 90 (lint, tsc, jest and forms-drift green too).
