# TC-PROP-06 — Lista proprietăților: fără filtre de importanță și relevanță, fără „Cod", „Câmpuri afișate" fără importanță, relevanță și proveniență

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-02 |

## What this proves

„Proprietăți — Listă" keeps its search and its chosen columns, and has no „Importanță" or „Relevanță"
filter, no „Cod" column, and no importance, relevance or provenance among the fields „Câmpuri
afișate" offers. A filter back on the toolbar, a code in the table or one of the three in the
chooser is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-06 Teren de test".

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți — Listă" | The search box („caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă") and „Câmpuri afișate n/4"; no „Importanță" or „Relevanță" anywhere on the list |
| 2 | Types `TC-PROP-06` into the search | One row, `TC-PROP-06 Teren de test`; the table's headers are the chosen columns between the tick box and the buttons — no „Cod" — and no system ID in the table |
| 3 | Presses „Câmpuri afișate" | Poreclă, Parcelă, Tarla/Solă, Nr. cadastru, Nr. CF, Oficială (m²), Calculată (m²), Localitate — and no Importanță, Relevanță or Proveniență |

## At the end — leaving things as they were found

Press anywhere outside the chooser (nothing ticked or unticked). Delete the property (`DELETE` on
its route).

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.61).** Driven in Chrome on Windows (Claude in Chrome, the
interface in English) against `npm run dev` on 3000, read with a script. Your browser's stored
choice (`["nickname","locality","tarlaSola","parcela"]`) was read, not changed. This file was
written from it.
- Step 1: no `<select>` on the list; neither „Importance" nor „Relevance" in its text; „Choose
  fields 4/4".
- Step 2: one row; the headers Nickname · Locality · Tarla/Solă · Parcelă between the two
  unnamed ones.
- Step 3: the eight fields, in order; the four stored ones ticked.

**2026-10-02 — run 2, `confirmed` (Slice #37.61).** Same Chrome, the same record, against the file
above unchanged: the same in every step, no `PROP…` in the table; the stored choice unchanged
afterwards; the property deleted (204). Nothing in the file changed, so the case is confirmed, and
`e2e/property/property-list.spec.ts` translates it.
