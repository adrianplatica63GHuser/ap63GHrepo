# TC-PERS-13 — Lista persoanelor juridice filtrată după „Tip” și CUI: numărul de lângă fiecare valoare, adresa, „Șterge filtrele”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-16 |

## What this proves

„Persoane Juridice" filters with the 39.61 bar (Slice #39.62): „Tip" is a checklist with each value's count, and
„Nr. înregistrare (CUI)" a „contains". The two AND together. The filters live in the address, survive a reload, and
„Șterge filtrele" takes them off.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: three companies, `TC-PERS-13 A`, `B`
  and `C`. Their Tip comes from `/api/admin/value-lists/judicial-person-types`:

  | | Tip | CUI |
  |---|---|---|
  | A | SRL | RO99913301 |
  | B | SRL | RO99913302 |
  | C | SA | RO99913401 |

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Juridice" with `TC-PERS-13` in the search | A, B and C |
| 2 | Chooses „Tip" from „+ Filtru"; ticks SRL | SA with 1, SRL with 2; after the tick, A and B |
| 3 | Chooses „Nr. înregistrare (CUI)" from „+ Filtru"; types `13302` | B alone; the address carries `cuiNumber=13302` |
| 4 | Reloads the page | B alone; the chips „Tip SRL" and „Nr. înregistrare (CUI) conține „13302”" |
| 5 | Presses „Șterge filtrele" | A, B and C; the address keeps the search and no filter |

## At the end — leaving things as they were found

Delete the three companies.

## Notes from the runs

**2026-10-16 — run 1, `driven` (Slice #39.62).** Claude, in the browser pane on localhost:3000, read with a script.
Every step as the table says. This file was written from it.

**2026-10-16 — run 2, `confirmed` (Slice #39.62).** The same, against the file unchanged. The companies were deleted
(204). `e2e/person/company-list-filters.spec.ts` translates it.
