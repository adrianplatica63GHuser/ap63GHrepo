# TC-TILES-19 — Lângă o listă, a doua previzualizare se deschide sub prima, nu sub listă

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
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
| 1 | The window 1920 × 1080; „Proprietăți", searches `TC-TILES-19` | The two properties' rows |
| 2 | „Previzualizare" on „TC-TILES-19 Teren A" | Its preview at the table's right, its top level with the table's top |
| 3 | „Previzualizare" on „TC-TILES-19 Teren B" | Its preview under A's: the same left edge, its top just under A's bottom; both right of the table. Nothing under the table |
| 4 | The window 1366 × 900 | The table and a preview do not fit side by side, so both previews stand below the table, B under A with the same left edge; the page does not scroll sideways |

## At the end — leaving things as they were found

Delete both properties (`DELETE` on each). A preview only reads.

## Notes from the runs

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
