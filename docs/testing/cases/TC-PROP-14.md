# TC-PROP-14 — Lista proprietăților filtrată după „Tip proprietate” și „Categorie de folosință”: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-16 |

## What this proves

„Proprietăți" filters on its fields with multiple choice (Slice #39.61). „+ Filtru" opens a field's checklist. Beside
each value is how many properties of the list hold it, counted with the search and the OTHER filters already set.
Ticking a value narrows the list and leaves a chip naming the field and the value; two fields AND together. The
filters are in the page's address, so a reload keeps them, and „Șterge filtrele" takes them all off. What this case
exists to catch: a count that ignores the other filters, a filter lost on reload, a chip showing an id, or a list
filtered with no chip on screen.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: three properties, `TC-PROP-14 A`,
  `B` and `C`. Their Tip proprietate and Categorie de folosință are the first two values of each list
  (`/api/admin/value-lists/property-types`, `/use-categories`), called T1, T2, C1 and C2 here:

  | | Tip proprietate | Categorie de folosință |
  |---|---|---|
  | A | T1 | C1 |
  | B | T1 | C2 |
  | C | T2 | C1 |

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți" with `TC-PROP-14` in the search | A, B and C |
| 2 | Chooses „Tip proprietate" from „+ Filtru"; ticks T1 | The checklist offers T1 with 2 and T2 with 1; after the tick, A and B; the chip „Tip proprietate T1"; the address carries `propertyType=<T1's id>` |
| 3 | Chooses „Categorie de folosință" from „+ Filtru"; ticks C1 | The checklist offers C1 with 1 and C2 with 1 — counted with the type filter set; after the tick, A alone |
| 4 | Reloads the page | A alone; the two chips, named by the values' names |
| 5 | Presses „Șterge filtrele" | A, B and C; no chip; the address keeps the search and no filter |

## At the end — leaving things as they were found

Delete the three properties (`DELETE` on their route).

## Notes from the runs

**2026-10-16 — run 1, `driven` (Slice #39.61).** Claude, in the browser pane on localhost:3000, read with a script.
T1 Garaj, T2 Teren Arabil, C1 Arabil, C2 Pășune. Step 2: „Garaj 2", „Teren Arabil 1"; then A, B; the chip
„Tip proprietate Garaj". Step 3: „Arabil 1", „Pășune 1"; then A. Step 4: A, with the chips „Tip proprietate Garaj"
and „Categorie de folosință Arabil". Step 5: A, B, C, no chip, the address `?q=TC-E2E-PROP-14`. This file was
written from it.

**2026-10-16 — run 2, `confirmed` (Slice #39.61).** The same, against the file above unchanged, with every step
as in run 1. The three properties were deleted (204 each). `e2e/property/property-list-filters.spec.ts` translates
it.
