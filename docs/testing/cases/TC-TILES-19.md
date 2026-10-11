# TC-TILES-19 — Lângă o listă, previzualizarea unui rând stă în coloana lui, de 40 rem; celelalte rânduri așteaptă

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.05 a list's open previews stand in one column of their own beside the table: the
first at the top, level with the table, the second under it, with the same left edge. The column
drops below the table only when the window cannot hold the table and one preview side by side —
and then the second is still under the first. One component draws it on the four lists; this case
reads Proprietăți. A second preview under the TABLE while the first stands beside it is the defect
this case exists to catch (Adrian's report: „it will display the second mini tile under the list").

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: two properties,
  „TC-TILES-19 Teren A" and „TC-TILES-19 Teren B".
- „Câmpuri afișate" on Proprietăți is the list's default (TC-LAYOUT-03), so the table is narrow
  enough for a preview beside it at 1920 px.

## What Adrian is asked for

Nothing.

## Steps

„Level" and „the same" are within 2 px; „just under" is the first's bottom plus the column's 16-px
gap, within 2 px.

| # | A person does | And sees |
|---|---|---|
| 1 | The window 1920 × 1080; „Proprietăți", searches `TC-TILES-19` | The three properties' rows |
| 2 | „Previzualizare" on „TC-TILES-19 Teren A" (#39.04) | Its preview in the column at the list's right, its top level with the list's top (the toolbar's), 40 rem wide; the magnifier reads pressed |
| 3 | Looks at the other two rows (#39.04) | Their magnifiers are disabled |
| 4 | The window 1366 × 900 | The list and the column do not fit side by side, so the preview stands under the list, still 40 rem; the page does not scroll sideways |
| 5 | „Previzualizare" on A again, then on B | A's preview closes and every row is free; B's preview opens and A's magnifier is disabled |

## At the end — leaving things as they were found

Delete both properties (`DELETE` on each). A preview only reads.

## Notes from the runs

**2026-10-11 — Slice #39.04, rewritten.** It was „a doua previzualizare se deschide sub prima, nu sub listă": two
previews from two rows, B's under A's beside the table, and (#38.71) a third replacing the oldest. A list row's
three toggles are now one row at a time, the open tiles in one 40 rem column beside the whole list.

**2026-10-05 — run 1, `driven` (Slice #38.05).** Driven in the desktop app's browser pane, its
viewport emulated, against `npm run dev` on 3000; the search was typed through the field and the
eyes pressed by script (FU-290).
- Step 1: two rows.
- Step 2 (1920): the table x 249–1145, y 189–310; A's preview x 1162–1638, y 188–384.
- Step 3: B's preview x 1162–1638, y 400–595 — under A (384 + 16); the column held both, A then B.
- Step 4 (1366): A at x 248–724, y 327–522; B at x 248–724, y 538–733, both below the table;
  scroll width 1366 = client width.
- Before the fix, measured by the slice's own pictures at 1920: A at x 1162, B at x 248, y 400 —
  under the table.
- Both deleted (204, 204). Nothing in this file needed correcting.

**2026-10-05 — run 2, `confirmed` (Slice #38.05).** The same pane, two new properties, the file
unchanged: every step the same, to the pixel — A at x 1162, y 188–384; B at x 1162, y 400–595; at
1366 both below the table, x 248, y 327 and 538; no sideways scroll. Both deleted (204, 204).
Nothing in the file changed, so the case is confirmed, and `e2e/tiles/list-second-preview.spec.ts`
translates it.

**2026-10-05 — `automated` (Slice #38.05).** The test runner's full run 20261005T213827Z-4294 on
3b80dd0 ran `e2e/tiles/list-second-preview.spec.ts` green with the other 90 (lint, tsc, jest and
forms-drift green too).

**2026-10-10 — `automated` (Slice #38.71).** A third property and step 5: the third preview releases the first row's
magnifier; the test runner ran it green.
