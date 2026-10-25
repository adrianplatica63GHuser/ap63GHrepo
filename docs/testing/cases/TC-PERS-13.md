# TC-PERS-13 — Lista persoanelor juridice filtrată după „Tip” și „Localitate”: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

## What this proves

„Persoane Juridice" filters with the 39.61 bar (Slice #39.62), by its columns since #39.82: a filter opens from the funnel
under its column's name, right under it. „Tip" and „Localitate" — the head office's, a column since #39.82 — are
checklists with each value's count. The two AND together. The filters live in the address, survive a reload, and
„Șterge filtrele" takes them off.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: three companies, `TC-PERS-13 A`, `B`
  and `C`. Their Tip comes from `/api/admin/value-lists/judicial-person-types`:

  | | Tip | Sediu (localitate) |
  |---|---|---|
  | A | SRL | Bragadiru |
  | B | SRL | Măgurele |
  | C | SA | Bragadiru |

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Juridice" with `TC-PERS-13` in the search | A, B and C |
| 2 | Ticks „Tip" and „Localitate" in „Câmpuri afișate"; presses the funnel beside „Tip"; ticks SRL | The filter opens right under the funnel; SA with 1, SRL with 2; after the tick, A and B |
| 3 | Presses the funnel beside „Localitate"; ticks Măgurele | The column shows each head office's locality; the filter opens right under its funnel; Bragadiru with 1, Măgurele with 1, counted with the type set; after the tick, B alone; the address carries `locality=Măgurele` |
| 4 | Reloads the page | B alone; the chips „Tip SRL" and „Localitate Măgurele"; no „+ Filtru" |
| 5 | Presses „Șterge filtrele" | A, B and C; the address keeps the search and no filter |

## At the end — leaving things as they were found

Delete the three companies. Untick „Tip" and „Localitate" in „Câmpuri afișate".

## Notes from the runs

**2026-10-25 — Slice 40.66.** The lists open on four default columns (TC-LAYOUT-03). This case's steps read the lists
as they opened before — Proprietăți on Tip proprietate, the other three on their fixed columns — so its spec stores
that choice first (`listsOnTheirEarlierColumns`, e2e/helpers/list-columns.ts); a hand run unticks the defaults first.

**2026-10-16 — run 1, `driven` (Slice #39.62).** Claude, in the browser pane on localhost:3000, read with a script.
Every step as the table says. This file was written from it.

**2026-10-16 — run 2, `confirmed` (Slice #39.62).** The same, against the file unchanged. The companies were deleted
(204). `e2e/person/company-list-filters.spec.ts` translates it.

**2026-10-16 — `automated` (Slice #39.62).** The test runner's targeted run 20261017T035354Z-9515 on e0c28b0 ran its
spec green, with the person and property lists' other specs (lint, tsc and jest green too).

**2026-10-18 — rewritten for #39.82.** CUI is no longer a filter (Adrian's list of 2026-10-18 names „Type" and
„Locality" for juridical persons), so step 3 filters the new „Localitate" column instead, and the three companies
carry a head office where they carried a CUI. A filter opens from its column's funnel, right under it. Not yet driven
by hand: the spec, rewritten with it, is what checks it.

**2026-10-18 — `automated` (Slice #39.82).** The test runner's targeted run 20261018T160353Z-12564 on 9916957 ran `e2e/person/company-list-filters.spec.ts` green
with the rewritten steps (lint, tsc and the slice's jest suites green too).
