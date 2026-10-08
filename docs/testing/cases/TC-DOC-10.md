# TC-DOC-10 — „Corelate" pe un act: persoanele fizice, juridice, proprietățile și actele într-o singură fișă, un singur „Dezasociază"

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

A Document's persons, properties and related documents are one tile, „Corelate": the natural
persons, the judicial persons, the properties and the documents, in that order, each row on one
line with the icon of its kind. One row is selected at a time, whatever its kind, and one
„Dezasociază" removes the selected row's link. „Asociază persoană", „Asociază proprietate" and
„Asociază act" open the screens the three tiles opened, and leaving each returns to „Corelate". A
row in the wrong group, a second selected row, or „Dezasociază" removing the wrong kind of link is
the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-DOC-10", a company „TC-DOC-10 Firmă SRL", a property „TC-DOC-10 Teren", a Contract de
  Vânzare „TC-DOC-10 CVC" and a PAD „TC-DOC-10 PAD"; on the CVC the person as „Vânzător", the
  company as „Cumpărător" and the property; the PAD associated to the CVC as „Titlu anterior al"
  (posted from the PAD).
- The CVC is opened with `?tab=related`, which shows „Corelate" for the visit without changing
  which tiles you keep ticked.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-10 CVC`, tile „Legături" | Four rows, each on one line, in this order, with no headings over them and a thin line between two kinds: `Ion TC-DOC-10 (Vânzător)` with the person icon, `TC-DOC-10 Firmă SRL (Cumpărător)` with the building, `TC-DOC-10 Teren` with the map, `TC-DOC-10 PAD (Plan de Amplasament și Delimitare)` with the document. Under them „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" in one row, „Înscrisuri citate" after them |
| 2 | Selects the property's radio, then the company's | Only the company's is selected; „Dezasociază" is active and the three „Asociază …" are not |
| 3 | Presses „Dezasociază" | The company's row goes, and with it its group; the person, the property and the PAD stay; nothing is selected and the three „Asociază …" are active again |
| 4 | Presses „Asociază persoană", then „Anulează" | „Asociere persoană"; back on the CVC with „Legături" on screen |
| 5 | Presses „Asociază proprietate", then „Anulează" | „Asociere proprietate"; back on the CVC with „Legături" on screen |
| 6 | Presses „Asociază act", then „Anulează" | „Asociază Document"; back on the CVC with „Legături" on screen |

## At the end — leaving things as they were found

Delete the five records (`DELETE` on their routes); their links go with them. Căutare globală for
`TC-DOC-10` finds nothing.

## Notes from the runs

**2026-10-03 — run 1, `driven` (Slice #37.65).** Driven in the Claude desktop app's browser pane on
Windows against `npm run dev` on 3000, at the pane's own width (FU-290), the records created
through the API from the page, read with a script. This file was written from it.
- Step 1: the groups natural · judicial · property · document, a `border-t` on the last three,
  no heading; the icons `lucide-user`, `lucide-building-2`, `lucide-map`, `lucide-file-text`;
  every row 34 px; the tile 640 px (4 units). The four buttons at one top, „Înscrisuri citate"
  38 px below them.
- Step 2: the pane's first click on a radio delivered no event at all (nothing reached the
  document); after a screenshot the same click landed — FU-290. Then one radio checked, the
  company's; the three „Asociază …" disabled, „Dezasociază" enabled.
- Step 3: the API listed only „Ion TC-DOC-10"; the groups natural · property · document; no
  radio checked; the three „Asociază …" enabled.
- Steps 4–6: `/associate-person`, „Asociere persoană", „Anulează" → `?tab=persons`;
  `/associate-property`, „Asociere proprietate" → `?tab=properties`; `/associate-reference`,
  „Asociază Document" → `?tab=related`; each time „Corelate" on screen. The header calls the way
  back „Înapoi"; the screens' own word is „Anulează", which is what the case uses.

**2026-10-03 — run 2, `confirmed` (Slice #37.65).** Same pane and width, five new records, against
the file above unchanged.
- Step 1: natural · judicial · property · document, the line on the last three, no heading, the
  four icons, every row 34 px; the four buttons at one top, „Înscrisuri citate" under them.
- Step 2: the property's radio, then the company's: one checked, the company's; the three
  „Asociază …" disabled, „Dezasociază" enabled.
- Step 3: the company's row and group gone, the API listing only „Ion TC-DOC-10"; nothing
  checked; the three „Asociază …" enabled.
- Steps 4–6: „Asociere persoană" → `?tab=persons`, „Asociere proprietate" → `?tab=properties`,
  „Asociază Document" → `?tab=related`, „Corelate" on screen each time.
- The five records deleted (204 ×5).
  Nothing in the file changed, so the case is confirmed, and `e2e/document/related-tile.spec.ts`
  translates it.

**2026-10-03 — `automated` (Slice #37.65).** `e2e/document/related-tile.spec.ts`, green in the
runner's whole `full` run `20261003T172547Z-19016` on `04a6f4b` (64 passed).
