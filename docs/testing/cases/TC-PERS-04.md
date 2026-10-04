# TC-PERS-04 — Listele de persoane: fără filtre de importanță și relevanță, câmpurile identității în „Câmpuri afișate", previzualizarea pe trei rânduri

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

The Natural Persons and the Judicial Persons lists work the same way: a search box, no
„Importanță" or „Relevanță" filter, and „Câmpuri afișate" offering the fields of the record's
„Identitate" panel. A person's and a company's preview reads on three compact lines, with no system
ID. A filter still on the Natural Persons list, a chooser missing from the Judicial Persons list,
or a preview that still lists Nume and Prenume under the name is the defect this case exists to
catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - a natural person „Ion TC-PERS-04", nickname „Ionel TC", CNP `1800101420045` (synthetic), born
    01.01.1980 in „Localitatea Exemplu";
  - a company „TC-PERS-04 Firmă de test SRL", nickname „Firma TC", type „SRL", CUI `RO99999990`,
    Nr. Reg. Com. `J99/9999/2026`.
- „Câmpuri afișate" has never been changed on either list in this browser (or its choice is set
  aside and put back).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Fizice" | A search box („caută după cod, nume, email sau telefon"), no „Importanță" or „Relevanță" filter, and „Câmpuri afișate 0/4" |
| 2 | Presses „Câmpuri afișate" | CNP, Data nașterii, Vârstă, Gen, Locul nașterii, Tip Profesional — in that order |
| 3 | Ticks CNP and Data nașterii, presses outside, types `TC-PERS-04` into the search | „Câmpuri afișate 2/4"; the table headed NUME · PORECLĂ · CNP · DATA NAȘTERII; one row: `Ion TC-PERS-04`, „Ionel TC", `1800101420045`, `01.01.1980` |
| 4 | Presses „Previzualizare" on the row | A tile headed `TC-PERS-04 Ion` (Nume Prenume), then two lines: „Ionel TC, 1800101420045" and „născut: 01.01.1980, Localitatea Exemplu"; no system ID, no Nume or Prenume under the heading |
| 5 | Opens „Persoane Juridice" and presses „Câmpuri afișate" (it reads `0/3`) | Tip, Nr. înregistrare (CUI), Nr. registru comerțului |
| 6 | Ticks Nr. înregistrare (CUI), presses outside, types `TC-PERS-04` into the search | The table headed DENUMIRE · PORECLĂ · NR. ÎNREGISTRARE (CUI); one row with `RO99999990` |
| 7 | Presses „Previzualizare" on the row | A tile headed `TC-PERS-04 Firmă de test SRL` followed by „(niciun contact)", then „Firma TC, SRL" and „RO99999990, J99/9999/2026"; no system ID |

## At the end — leaving things as they were found

Put each list's „Câmpuri afișate" back as it was. Delete the two records (`DELETE` on their
routes). Căutare globală for `TC-PERS-04` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.60).** Driven in Chrome on Windows (Claude in Chrome, the
interface in English) against `npm run dev` on 3000, read with a script; the stored choices
(`ga40-col-person-v2` = `[]`, `ga40-col-company-v1` absent) set aside first. This file was written
from it.
- Steps 1–3: no `<select>` on the list; „Choose fields 0/4"; the six fields in order; after the
  ticks „2/4", the headers Name · Nickname · CNP · Date of Birth, the row as in step 3.
- Step 4: the tile `data-preview-compact`, headed „TC-PERS-04 Ion", lines „Ionel TC, 1800101420045"
  and „01.01.1980, Localitatea Exemplu"; no `PPERS…` in it. The browser window was minimised for
  this run, so the tile's width and height were not measured (the spec measures them).
- Steps 5–7: „Choose fields 0/3"; Type, Registration No. (CUI), Trade Register No.; the CUI column
  with `RO99999990`; the choice still there after a reload. The company was created without a type
  and given „SRL" through its PATCH during the run, which is why „Before you start" names it; the
  preview then read „Firma TC, SRL" and „RO99999990, J99/9999/2026", and before it, with no type,
  „Firma TC" alone on line 2 — the empty value left no gap.

**2026-10-02 — run 2, `confirmed` (Slice #37.60).** Same Chrome, the same two records (the
company's type already „SRL"), both stored choices reset first, against the file above unchanged.
- Steps 1–4: no filter; „0/4"; the six fields; „2/4", the four headers, the row; the tile
  „TC-PERS-04 Ion", „Ionel TC, 1800101420045", „01.01.1980, Localitatea Exemplu", no `PPERS…`.
- Steps 5–7: „0/3"; the three fields; the CUI column; the tile „TC-PERS-04 Firmă de test SRL",
  „Firma TC, SRL", „RO99999990, J99/9999/2026", no `JPERS…`.
- Both choices put back (`[]`, and the company's removed); both records deleted (204 ×2).
  Nothing in the file changed, so the case is confirmed, and `e2e/person/person-lists.spec.ts`
  translates it.

**2026-10-02 — `automated` (Slice #37.60).** `e2e/person/person-lists.spec.ts` green in the runner's full `20261003T012229Z-23343` and again in `20261003T013901Z-21163` (e2e 59); it also measures each preview narrower than a 3-unit panel and lower than 10 rem.

**2026-10-03 — Slice #37.70 changed what steps 4 and 7 read.** A person's date of birth is printed
after „născut:" (no gender is recorded for Ion, so the masculine), and a company's heading is
followed by its count of contact persons, „(niciun contact)" here. Both steps now say so, and
`e2e/person/person-lists.spec.ts` follows. The rest of the case is unchanged; TC-TILES-11 drives the
four previews themselves.
