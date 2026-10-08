# TC-PROP-07 — „Corelate" pe o proprietate: persoanele fizice, juridice, proprietățile și actele într-o singură fișă, relația după „Relația"

| | |
|---|---|
| **Area** | property |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

A Property's persons, related properties and documents are one tile, „Corelate", built as the
Document's (TC-DOC-10): the natural persons, the judicial persons, the properties and the
documents, in that order, each row on one line with the icon of its kind, no share button. A
related property's relationship is not on its row but behind „Relația", and a click outside hides
it. One „Dezasociază" removes the selected row's link; each „Asociază …" opens its screen and
leaving it returns to „Corelate".

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a property
  „TC-PROP-07 Teren", a second property „TC-PROP-07 Teren întreg", a natural person
  „Ion TC-PROP-07", a company „TC-PROP-07 Firmă SRL" and a Contract de Vânzare „TC-PROP-07 CVC"; on
  the first property the person and the company as „Proprietar", the
  second property as „Inclus în" (posted from the first), and the contract.
- The property is opened with `?tab=related`, which shows „Corelate" for the visit without
  changing which tiles you keep ticked.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-PROP-07 Teren`, tile „Legături" | On the left, beside the map column: four rows, each on one line, in this order, no headings, a thin line between two kinds — `Ion TC-PROP-07 (Proprietar)` with the person icon, `TC-PROP-07 Firmă SRL (Proprietar)` with the building, `TC-PROP-07 Teren întreg` with the map and a „Relația" button, `TC-PROP-07 CVC (Contract de Vânzare)` with the document. No „Cotă" on any row. Under them „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" in one row |
| 2 | Presses „Relația" on `TC-PROP-07 Teren întreg` | A bubble: `această proprietate „Inclus în” TC-PROP-07 Teren întreg` |
| 3 | Clicks outside the bubble | It goes |
| 4 | Selects the company's radio, presses „Dezasociază" | The company's row goes, and with it its group; the person, the other property and the contract stay |
| 5 | Presses „Asociază persoană", then „Anulează" | „Asociere persoană"; back on the property with „Legături" on screen |
| 6 | Presses „Asociază proprietate", then „Anulează" | „Asociere proprietate corelată"; back with „Legături" on screen |
| 7 | Presses „Asociază act", then „Anulează" | „Asociere act"; back with „Legături" on screen |

## At the end — leaving things as they were found

Delete the five records (`DELETE` on their routes); their links go with them. Căutare globală for
`TC-PROP-07` finds nothing.

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.66).** Driven in the Claude desktop app's browser pane on
Windows against `npm run dev` on 3000, at the pane's own width, a screenshot before each click
(FU-290), the records created through the API from the page, read with a script. This file was
written from it.
- Step 1: the tile in the left area (not in `[data-tile-area="right"]`), 640 px (4 units); groups
  natural · judicial · property · document, the line on the last three, no heading; the icons
  `lucide-user`, `lucide-building-2`, `lucide-map`, `lucide-file-text`; every row 34 px; the share
  slot empty on every row, the relation slot filled only on the property's; the four buttons at
  one top.
- Steps 2–3: the bubble `această proprietate „Inclus în” TC-PROP-07 Teren întreg`; a press on the
  tile's title hid it.
- Step 4: one radio checked, the company's; after „Dezasociază" the groups natural · property ·
  document and the API listing only „Ion TC-PROP-07".
- Steps 5–7: „Asociere persoană" → `?tab=persons`, „Asociere proprietate corelată" →
  `?tab=related`, „Asociere act" → `?tab=document`, „Corelate" on screen each time. The header calls
  the way back „Înapoi"; the screens' word is „Anulează".

**2026-10-03 — run 2, `confirmed` (Slice #37.66).** Same pane, same width, fresh records. Every
step as written: four rows on one line each (34 px), groups natural · judicial · property ·
document, the tile on the left; the bubble `această proprietate „Inclus în” TC-PROP-07 Teren
întreg`, gone on a press on the tile's title (no `[data-press-bubble]` left); after the company's
„Dezasociază" the groups natural · property · document; „Anulează" on the three screens back to
`?tab=persons`, `?tab=related`, `?tab=document`. The five records deleted (`DELETE` 204 on each),
Căutare globală for `TC-PROP-07` empty.

**2026-10-03 — `automated` (Slice #37.66).** `e2e/property/related-tile.spec.ts`, green in the
runner's whole `full` run `20261003T182441Z-10963` on `e80d6fa` (65 passed). Its first `full`
(`20261003T180836Z-93`) passed every step and then timed out in `finally` on an unbounded
„networkidle": the map and Street View keep a property's network busy. The wait is bounded now.
