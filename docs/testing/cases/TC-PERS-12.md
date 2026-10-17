# TC-PERS-12 — Lista persoanelor fizice filtrată după „Tip profesional” și „Decedat”: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-16 |

## What this proves

„Persoane Fizice" filters with the 39.61 bar (Slice #39.62): „Tip profesional" is a checklist with each value's count,
counted with the search and the other filters, and „Decedat" a choice of „Toți", „În viață" and „Decedați". The two AND
together. The filters live in the address, survive a reload, and „Șterge filtrele" takes them off.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: three natural persons, last name `TC-PERS-12`,
  first names `A`, `B` and `C`. Their Tip profesional is the first two
  values of `/api/admin/value-lists/person-types`, called T1 and T2:

  | | Tip profesional | Decedat |
  |---|---|---|
  | A | T1 | no |
  | B | T1 | yes, on 2020-05-01 |
  | C | T2 | no |

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Fizice" with `TC-PERS-12` in the search | A, B (with its „†") and C |
| 2 | Chooses „Tip profesional" from „+ Filtru"; ticks T1 | T1 with 2, T2 with 1; after the tick, A and B |
| 3 | Chooses „Decedat" from „+ Filtru"; chooses „În viață" | „Toți", „În viață", „Decedați"; after the choice, A alone; the address carries `deceased=alive` |
| 4 | Reloads the page | A alone; the chips „Tip profesional T1" and „Decedat În viață" |
| 5 | Presses „Șterge filtrele" | A, B and C; the address keeps the search and no filter |

## At the end — leaving things as they were found

Delete the three persons.

## Notes from the runs

**2026-10-16 — run 1, `driven` (Slice #39.62).** Claude, in the browser pane on localhost:3000, read with a script.
T1 Expert, T2 PFA. Step 2: „Expert 2", „PFA 1"; then A and B. Step 3: A, the address
`…&deceased=alive`. Step 4: A, the chips „Tip profesional Expert" and „Decedat În viață". Step 5: A, B, C, and the
address `?q=TC-E2E-PERS-12`. This file was written from it.

**2026-10-16 — run 2, `confirmed` (Slice #39.62).** The same, against the file unchanged. The persons were deleted
(204). `e2e/person/person-list-filters.spec.ts` translates it.

**2026-10-16 — `automated` (Slice #39.62).** The test runner's targeted run 20261017T035354Z-9515 on e0c28b0 ran its
spec green, with the person and property lists' other specs (lint, tsc and jest green too).
