# TC-PERS-06 — Lista persoanelor juridice: fără filtrul „Grupuri", „Persoană de contact" în „Câmpuri afișate"

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-03 |

## What this proves

The Judicial Persons list has no „Grupuri" filter: the search box is its only filter, followed by
„Câmpuri afișate". „Câmpuri afișate" offers „Persoană de contact", which shows the company's contact
person's name — the first, when it has two, and the second when its first slot is empty. A „Grupuri"
dropdown back on the toolbar, or a contact column that shows the wrong person or none, is the defect
this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - two natural persons „Unu TC-PERS-06 Contact" and „Doi TC-PERS-06 Contact";
  - a company „TC-PERS-06 Firma A SRL" with „Unu" as its first contact person and „Doi" as its second;
  - a company „TC-PERS-06 Firma B SRL" with no first contact person and „Doi" as its second.
- „Câmpuri afișate" on this list has never been changed in this browser (or its choice is set aside
  and put back).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Juridice" | The toolbar starts with the search box („caută după cod, nume, poreclă sau ID"), then „Câmpuri afișate 0/4"; no „Grupuri" anywhere on it |
| 2 | Presses „Câmpuri afișate", ticks „Persoană de contact", presses outside, types `TC-PERS-06` into the search | „Câmpuri afișate 1/4"; a column „PERSOANĂ DE CONTACT"; „TC-PERS-06 Firma A SRL" shows „Unu TC-PERS-06 Contact" and „TC-PERS-06 Firma B SRL" shows „Doi TC-PERS-06 Contact" |
| 3 | Unticks „Persoană de contact" | „Câmpuri afișate 0/4"; the column is gone |

## At the end — leaving things as they were found

Step 3 leaves „Câmpuri afișate" as it was. Delete the two companies, then the two persons (`DELETE`
on each route).

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.71).** Driven in the desktop app's browser pane at its own
width against `npm run dev` on 3000, the ticks and the search made by a script. The file was written
from the code first and needed no correction.
- Step 1: the toolbar's first child the search box („caută după cod, nume, poreclă sau ID"), then
  „Câmpuri afișate 0/4"; no „Grupuri" on it.
- Step 2: the four fields Tip, Nr. înregistrare (CUI), Nr. registru comerțului, Persoană de contact;
  „Câmpuri afișate 1/4"; headings DENUMIRE · PORECLĂ · PERSOANĂ DE CONTACT; Firma A „Unu TC-PERS-06
  Contact", Firma B „Doi TC-PERS-06 Contact".
- Step 3: „0/4", the column gone. The browser had never chosen (no stored key); the untick stored
  `[]`, so the key was removed to leave it as found. The four records deleted (204 ×4).

**2026-10-03 — run 2, `confirmed` (Slice #37.71).** The same pane, four new records, the file above
unchanged: the same in every step. The stored key removed again; the four records deleted (204 ×4).
Nothing in the file changed, so the case is confirmed, and `e2e/person/company-list.spec.ts`
translates it.
