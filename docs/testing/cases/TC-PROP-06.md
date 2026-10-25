# TC-PROP-06 — Lista proprietăților: fără „Importanță" și „Relevanță", fără „Cod", Poreclă mereu afișată, „Câmpuri afișate" cu toate câmpurile cadastrale

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

## What this proves

„Proprietăți" keeps its search and its chosen columns, and has no „Importanță" or „Relevanță"
filter and no „Cod" column. Since #37.72 Poreclă is always shown — the first column after the tick
box, whatever is ticked — and is no longer offered in „Câmpuri afișate", which offers every field of
„Date cadastrale" but Poreclă and Note, then Localitate: „Categorie de folosință" and „Tip
proprietate" among them, shown by their names. A filter back on the toolbar, a code in the table, a
missing Poreclă, Poreclă or Note in the chooser, or an id where a name should be is the defect this
case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-06 Teren de test", its Categorie de folosință the first value of that list and its Tip
  proprietate the first of its own (by `/api/admin/value-lists/use-categories` and
  `/api/admin/value-lists/property-types`).
- This browser's „Câmpuri afișate" choice on this list is set aside first and put back at the end.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți" | The search box („caută după Cod, Poreclă, Nr. cadastru, Nr. CF, Tarla/Solă sau Parcelă") and „Câmpuri afișate 1/4" — the choice set aside, the list's default, Tip proprietate (#37.94, #38.02); no `<select>` on the list — „+ Filtru" is gone since #39.82, a filter opens from its column's funnel; no „Importanță" or „Relevanță" anywhere on the list |
| 2 | Types `TC-PROP-06` into the search | One row, `TC-PROP-06 Teren de test`; the first header after the tick box is „PORECLĂ", then „TIP PROPRIETATE" — no „Cod" — and no system ID in the table |
| 3 | Presses „Câmpuri afișate" | Tarla/Solă, Parcelă, Oficială (m²), Calculată (m²), Nr. CF, Nr. cadastru, Categorie de folosință, Tip proprietate, Localitate — and no Poreclă, Note, Importanță, Relevanță or Proveniență |
| 4 | Unticks every ticked field | „Câmpuri afișate 0/4"; between the tick box and the buttons one header, „PORECLĂ", and the row still reads `TC-PROP-06 Teren de test` |
| 5 | Ticks „Categorie de folosință" and „Tip proprietate", presses outside | „Câmpuri afișate 2/4"; the headers PORECLĂ · CATEGORIE DE FOLOSINȚĂ · TIP PROPRIETATE; the row shows the two values' names, not ids |

## At the end — leaving things as they were found

Put this browser's „Câmpuri afișate" choice back as it was. Delete the property (`DELETE` on its
route).

## Notes from the runs

**2026-10-25 — Slice 40.66.** The lists open on four default columns (TC-LAYOUT-03). This case's steps read the lists
as they opened before — Proprietăți on Tip proprietate, the other three on their fixed columns — so its spec stores
that choice first (`listsOnTheirEarlierColumns`, e2e/helpers/list-columns.ts); a hand run unticks the defaults first.

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

**2026-10-02 — `automated` (Slice #37.61).** The test runner's full run 20261003T020117Z-4160 on
43437a1 ran `e2e/property/property-list.spec.ts` green with the other 59 specs (lint, tsc, jest and
forms-drift green too).

**2026-10-04 — run 3, `driven` (Slice #37.72).** The case was rewritten for #37.72 — Poreclă fixed,
the chooser's new order and two new fields, and steps 4–5 — then driven in the desktop app's browser
pane at its own width against `npm run dev` on 3000, the ticks made by a script. Its property had
Categorie de folosință „Arabil" and Tip proprietate „Garaj" (the first of each list). The pane's
browser had never chosen (no stored key), so it opened at the three defaults, „3/4".
- Step 1: no `<select>`, neither word; „Câmpuri afișate 3/4".
- Step 2: one row; headers PORECLĂ · NR. CADASTRU · OFICIALĂ (M²) · LOCALITATE between the two
  unnamed ones; no `PROP…`.
- Step 3: Tarla/Solă, Parcelă, Oficială (m²), Calculată (m²), Nr. CF, Nr. cadastru, Categorie de
  folosință, Tip proprietate, Localitate.
- Step 4: „0/4"; headers PORECLĂ alone; the row „TC-PROP-06 Teren de test".
- Step 5: „2/4"; PORECLĂ · CATEGORIE DE FOLOSINȚĂ · TIP PROPRIETATE; the row „Arabil", „Garaj".
- The stored key removed again; the property deleted (204).

**2026-10-04 — run 4, `confirmed` (Slice #37.72).** The same pane, a new property, the file above
unchanged: the same in every step. The stored key removed again; the property deleted (204).
Nothing in the file changed, so the case is confirmed, and `e2e/property/property-list.spec.ts`
follows it.

**2026-10-04 — `automated` again (Slice #37.72).** The test runner's full run 20261004T044252Z-16792
on 88f753b ran the rewritten `e2e/property/property-list.spec.ts` green with the other 67 specs
(lint, tsc, jest and forms-drift green too).

**2026-10-05 — Slice #37.92.** The sidebar's „Proprietăți — Listă" and „Proprietăți — Hartă" are one item,
„Proprietăți"; the whole map opens from the list's „Hartă completă" (TC-PROP-10). The steps above name
the sidebar item by its new name; nothing else in them changed.

**2026-10-05 — Slice #37.94.** A browser with no stored choice now opens this list with Tarla/Solă
and Parcelă ticked (TC-LAYOUT-03), so steps 1 and 2 name them: „Câmpuri afișate 2/4", and the two
headers after „PORECLĂ". Nothing else changed; the spec, whose browser stores nothing, reads them.

**2026-10-05 — Slice #38.02.** A browser with no stored choice now opens this list with Tip
proprietate alone (TC-LAYOUT-03), so steps 1 and 2 read „Câmpuri afișate 1/4" and the header TIP
PROPRIETATE. Steps 3–5 are unchanged: step 4 unticks it with the rest. The spec follows.

**2026-10-05 — `automated` (Slice #38.02).** The test runner's full run 20261005T193605Z-29374 on
7505a33 ran the changed spec green with the other 87 (lint, tsc, jest and forms-drift green too).

**2026-10-16 — step 1 rewritten for #39.61.** The list has a filter bar now (TC-PROP-14), so step 1's „no
`<select>` on the list" became „one `<select>`, „+ Filtru"". Read in the browser pane on localhost:3000 the same day:
one select whose first option is „+ Filtru", and no „Importanță" or „Relevanță" in the list's text. The rest of
the case is unchanged. The bar's fields are TC-PROP-14's, not this case's.

**2026-10-18 — step 1 rewritten for #39.82.** „+ Filtru" left the list, so it holds no `<select>` again, as before
#39.61/#39.62. The rest of the case is unchanged.

**2026-10-18 — `automated` (Slice #39.82).** The test runner's targeted run 20261018T160353Z-12564 on 9916957 ran `e2e/property/property-list.spec.ts` green
with the rewritten steps (lint, tsc and the slice's jest suites green too).

**2026-10-18 — the search box's words updated for #39.85.** The box's explanation now names its fields as
„Câmpuri afișate", the column headers or the form spell them; the box is as wide as „Adaugă …" and shows the whole
explanation on hover. Only the quoted words changed in this file.

**2026-10-18 — `automated` (Slice #39.85).** The test runner's targeted run 20261018T165019Z-11827 on 4e824a7 ran `e2e/property/property-list.spec.ts` green
with the search box's new words (lint, tsc and the slice's jest suites green too).

**2026-10-21 — names shortened (Slice 40.20).** The band of names and „Câmpuri afișate" show Adrian's short names
(„Născut pe", „Tip Prop.", „#Document", „Contact" …), the field's whole label on hover; a filter's chip and the
forms keep the whole labels. Where a step above quotes a column or a box in „Câmpuri afișate" by its whole label, it
now reads the short one; the spec's locators follow.
