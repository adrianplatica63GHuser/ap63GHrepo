# TC-PERS-05 — „Corelate" pe o persoană fizică și pe o firmă: persoanele, proprietățile și actele într-o singură fișă, rolul în act după „Relația"

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

A person's related persons, properties and documents are one tile, „Corelate", built as the
Document's (TC-DOC-10) and the Property's (TC-PROP-07), on a Natural Person and on a company alike:
the natural persons, the judicial persons, the properties and the documents, in that order, each row
on one line with the icon of its kind, no share button. A related person and a property read
„Nume (Rol)"; the person's role in a document is not on its row but behind „Relația", and a click
outside or Esc hides it. One „Dezasociază" removes the selected row's link; each „Asociază …" opens
its screen and leaving it returns to „Corelate".

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-PERS-05" (masculin), a second one „Maria TC-PERS-05" (feminin), a company
  „TC-PERS-05 Firmă SRL", a property „TC-PERS-05 Teren" and a Contract de Vânzare „TC-PERS-05 CVC";
  Maria related to Ion as „Soț" (posted from Ion), Ion related to the company as
  „Reprezentant legal / Mandatar" (posted from the company), the property on Ion as
  „Proprietar / Titular de drept real", and on the contract Ion as „Vânzător" and the company as
  „Cumpărător".
- Each screen is opened with `?tab=related`, which shows „Corelate" for the visit without changing
  which tiles you keep ticked.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `Ion TC-PERS-05`, tile „Corelate" | Four rows, each on one line, in this order, no headings, a thin line between two kinds — `Maria TC-PERS-05 (Soț)` with the person icon, `TC-PERS-05 Firmă SRL (Reprezentat / Mandant)` with the building, `TC-PERS-05 Teren (Proprietar / Titular de drept real)` with the map, `TC-PERS-05 CVC (Contract de Vânzare)` with the document and a „Relația" button. No „Cotă" on any row. Under them „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" in one row |
| 2 | Presses „Relația" on `TC-PERS-05 CVC` | A bubble: `Rol în act: „Vânzător”` |
| 3 | Clicks the tile's title, outside the bubble | It goes |
| 4 | Selects Maria's radio | Only hers is selected; the three „Asociază …" are not offered |
| 5 | Presses „Dezasociază" | Maria's row goes, and with it its group; the company, the property and the contract stay |
| 6 | Presses „Asociază persoană", then „Anulează" | „Asociere persoană corelată"; back on Ion with „Corelate" on screen |
| 7 | Presses „Asociază proprietate", then „Anulează" | „Asociere proprietate"; back with „Corelate" on screen |
| 8 | Presses „Asociază act", then „Anulează" | „Asociere act"; back with „Corelate" on screen |
| 9 | Opens `TC-PERS-05 Firmă SRL`, tile „Corelate" | Two rows, one line each: `Ion TC-PERS-05 (Reprezentant legal / Mandatar)` with the person icon, `TC-PERS-05 CVC (Contract de Vânzare)` with the document and „Relația" |
| 10 | Presses „Relația" on the contract, then Esc | `Rol în act: „Cumpărător”`; Esc hides it |
| 11 | Selects the contract's radio, presses „Dezasociază" | The contract's row and group go; Ion stays |
| 12 | Presses each „Asociază …", then „Anulează" | The same three screens; back on the company with „Corelate" on screen each time |

## At the end — leaving things as they were found

Delete the five records (`DELETE` on their routes); their links go with them. Căutare globală for
`TC-PERS-05` finds nothing.

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.67).** Driven in the Claude desktop app's browser pane on
Windows against `npm run dev` on 3000, at the pane's own width, a screenshot before each click
(FU-290), the records created through the API from the page, read with a script. This file was
written from it.
- Step 1: the tile 640 px (4 units); groups natural · judicial · property · document, the line on
  the last three, one heading (the tile's); the icons `lucide-user`, `lucide-building2`,
  `lucide-map`, `lucide-file-text`; every row 34 px; the share slot empty on every row, the relation
  slot filled only on the contract's.
- Steps 2–3: `Rol în act: „Vânzător”`; a press on the tile's title hid it.
- Steps 4–5: one radio checked, Maria's, the three „Asociază …" disabled; after „Dezasociază" the
  groups judicial · property · document. „Dezasociază" was found again after the selection: the
  button is a new element once enabled (FU-291).
- Steps 6–8: `/associate-person` → `?tab=related`, `/associate-property` → `?tab=properties`,
  `/associate-document` → `?tab=document`, „Corelate" on screen each time.
- Steps 9–12: on the company, natural · document; `Rol în act: „Cumpărător”`, gone on Esc; after
  „Dezasociază" only Ion; the three screens and back as on Ion.
- The five records deleted (`DELETE` 204 on each), Căutare globală for `TC-PERS-05` empty.

**2026-10-03 — run 2, `confirmed` (Slice #37.67).** Same pane, same width, fresh records. Every
step as written: on Ion four rows on one line each (34 px), groups natural · judicial · property ·
document, the four buttons at one top, „Relația" only on the contract's row; `Rol în act:
„Vânzător”`, gone on a press on the tile's title; Maria's radio alone checked and the three
„Asociază …" disabled, after „Dezasociază" judicial · property · document; „Anulează" back to
`?tab=related`, `?tab=properties`, `?tab=document`. On the company natural · document, `Rol în act:
„Cumpărător”` gone on Esc, after „Dezasociază" only Ion, and the three screens and back. The five
records deleted (`DELETE` 204 on each), Căutare globală for `TC-PERS-05` empty.

**2026-10-03 — `automated` (Slice #37.67).** `e2e/person/related-tile.spec.ts`, green first time in the
runner's e2e run of the slice's specs `20261003T191258Z-18437` and in its whole `full` run
`20261003T191537Z-11484` on `d7aafae` (66 passed).
