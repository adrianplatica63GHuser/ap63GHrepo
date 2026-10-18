# TC-PERS-04 — Listele de persoane: fără filtre de importanță și relevanță, câmpurile identității în „Câmpuri afișate", previzualizarea pe trei rânduri

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

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
| 1 | Opens „Persoane Fizice" | A search box („caută după ID, Nume, Poreclă, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu"), no „Importanță" or „Relevanță" filter, „Câmpuri afișate 0/4", and no `<select>` — „+ Filtru" is gone since #39.82, a filter opens from its column's funnel |
| 2 | Presses „Câmpuri afișate" | CNP, Data nașterii, Vârstă, Gen, Data decesului, Locul nașterii, Tip profesional, Relația cu firma — in that order |
| 3 | Ticks CNP and Data nașterii, presses outside, types `TC-PERS-04` into the search | „Câmpuri afișate 2/4"; the table headed NUME · PORECLĂ · CNP · DATA NAȘTERII; one row: `Ion TC-PERS-04`, „Ionel TC", `1800101420045`, `01.01.1980` |
| 4 | Presses „Previzualizare" on the row | A tile headed `TC-PERS-04 Ion` (Nume Prenume), then two lines: „Ionel TC, 1800101420045" and „născut: 01.01.1980, Localitatea Exemplu"; no system ID, no Nume or Prenume under the heading |
| 5 | Opens „Persoane Juridice" and presses „Câmpuri afișate" (it reads `0/4`) | Tip, Nr. înregistrare (CUI), Nr. registru comerțului, Persoană de contact, Localitate (#39.82) |
| 6 | Ticks Nr. înregistrare (CUI), presses outside, types `TC-PERS-04` into the search | The table headed DENUMIRE · PORECLĂ · NR. ÎNREGISTRARE (CUI); one row with `RO99999990` |
| 7 | Presses „Previzualizare" on the row | A tile headed `TC-PERS-04 Firmă de test SRL` followed by „(niciun contact)", then „Firma TC, SRL" and „RO99999990, J99/9999/2026"; no system ID |

## At the end — leaving things as they were found

Put each list's „Câmpuri afișate" back as it was. Delete the two records (`DELETE` on their
routes). Căutare globală for `TC-PERS-04` finds nothing.

## Notes from the runs

**2026-10-11 — Slice #39.04.** On a list the preview stands in the row tiles' column and is 40 rem wide; the spec's
width check reads that now (it read „narrower than three units and a little").

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

**2026-10-03 — Slice #37.71 changed what step 5 reads.** „Câmpuri afișate" on „Persoane Juridice"
offers a fourth field, „Persoană de contact", and room for all four: it reads `0/4`, and `1/4` after
step 6. The step now says so and `e2e/person/person-lists.spec.ts` follows; TC-PERS-06 drives the
new field.

**2026-10-16 — step 1 rewritten for #39.62.** The person lists have a filter bar now (TC-PERS-12, TC-PERS-13), so
step 1's „no `<select>`" became „one, „+ Filtru"". Read in the browser pane on localhost:3000 the same day: one select,
its first option „+ Filtru". The rest of the case is unchanged.

**2026-10-17 — step 2 widened (Slice #39.70).** „Relația cu firma” joined „Câmpuri afișate” after „Tip profesional”;
the case stays `automated` — its spec ran with the new label in the slice's targeted run.

**2026-10-18 — steps 1 and 5 rewritten for #39.82.** „+ Filtru" left the list, so it holds no `<select>` again, as
before #39.61/#39.62; and the juridical persons' chooser offers „Localitate" fifth, so its filter has a column. The
rest of the case is unchanged.

**2026-10-18 — `automated` (Slice #39.82).** The test runner's targeted run 20261018T160701Z-15737 on a47c980 ran `e2e/person/person-lists.spec.ts` green
with the rewritten steps (lint, tsc and the slice's jest suites green too).

**2026-10-18 — the search box's words updated for #39.85.** The box's explanation now names its fields as
„Câmpuri afișate", the column headers or the form spell them; the box is as wide as „Adaugă …" and shows the whole
explanation on hover. Only the quoted words changed in this file.
