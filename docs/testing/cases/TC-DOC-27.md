# TC-DOC-27 — Lista actelor filtrată cu bara de filtre peste „Tip document” și „Câmp specific”: „Data”, adresa, „Șterge filtrele”

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-17 |

## What this proves

„Acte" gets the 39.61 filter bar (Slice #39.63) and keeps its own two filters. A bar filter — here „Data" — adds up with
„Tip document:" and „Câmp specific:": the list shows the documents that pass all three. The bar's filter lives in the
address beside the other two and survives a reload. „Șterge filtrele" takes off the bar's filter and leaves the type and
the type-specific field as they were.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: four documents, titles `TC-DOC-27 A`
  to `TC-DOC-27 D`:

  | | Tip document | Data | Stare plată |
  |---|---|---|---|
  | A | Contract de Vânzare | 2026-03-10 | Achitat integral |
  | B | Contract de Vânzare | 2019-05-01 | Achitat integral |
  | C | Contract de Vânzare | 2026-04-01 | De achitat |
  | D | Adeverință | 2026-03-15 | — |

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte" with `TC-DOC-27` in the search | A, B, C and D |
| 2 | Opens „Tip document", unticks „Toate tipurile", ticks only „Contract de Vânzare" | A, B and C |
| 3 | At „Câmp specific:" chooses „Stare plată", then „Achitat integral" | A and B |
| 4 | Chooses „Data" from „+ Filtru"; at „De la" writes 01.01.2026 | A alone; the address carries `dateDocument=2026-01-01..` beside the type and the field |
| 5 | Reloads the page | A alone; the chip „Data din 01.01.2026"; the type and the field as they were |
| 6 | Presses „Șterge filtrele" | A and B; the address keeps the search, the type and the field, and no `dateDocument` |

## At the end — leaving things as they were found

Delete the four documents.

## Notes from the runs

**2026-10-17 — run 1, `driven` (Slice #39.63).** Claude, in the browser pane on localhost:3000, read with a script.
Step 1: A, B, C, D. Step 2: A, B, C. Step 3: A, B. Step 4: A; the address
`?q=TC-E2E-DOC-27&documentTypeIds=<the contract's type>&field=starePlata&value=ACHITAT_INTEGRAL&dateDocument=2026-01-01..`.
Step 5: A, the chip „Data din 01.01.2026", the type and the field kept. Step 6: A and B; the address without
`dateDocument`. The „Instituție / Notariat" values for the four read „(necompletat)" 4 — none has an institution. This file
was written from it.

**2026-10-17 — run 2, `confirmed` (Slice #39.63).** The same, against the file unchanged: A, B, C, D; A, B, C; A, B;
A with the same address; after the reload A and the one chip „Data din 01.01.2026"; after „Șterge filtrele" A and B,
the address
`?q=TC-E2E-DOC-27&documentTypeIds=<the contract's type>&field=starePlata&value=ACHITAT_INTEGRAL`. The documents were
deleted (204 ×4). `e2e/document/document-list-filters.spec.ts` translates it.
