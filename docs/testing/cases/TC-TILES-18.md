# TC-TILES-18 — Bifele fișelor în patru grupuri colorate, fiecare fișă în culoarea grupului ei

| | |
|---|---|
| **Area** | tiles |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-05 |

## What this proves

On Property, Natural Person, Judicial Person and Document the checkboxes above the tiles stand in
groups, each in a narrow strip of its own colour, and each tile wears its group's colour (Slice
#37.88). The record's own data is the cards' grey-blue, „Corelate" light green (and the previews),
„Clasificări" and „Conexiuni" light yellow, the fixed right-hand tiles light purple. A box outside its
group, a group out of order, or a tile in another group's colour — after a drag included — is the
defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: „TC-TILES-18
  Teren" (a property), „TC-TILES-18 Ion" (a natural person), „TC-TILES-18 SRL" (a judicial person)
  and „TC-TILES-18 Act" (a Contract de Vânzare).
- The window is 1366 px, then 1920 px wide.

## What Adrian is asked for

Nothing.

## The colours

| Group | Fill | Rim |
|---|---|---|
| record (grey-blue) | rgb(238, 244, 250) | rgb(198, 212, 232) |
| related (green) | rgb(235, 247, 237) | rgb(187, 221, 194) |
| meta (yellow) | rgb(248, 243, 229) | rgb(221, 211, 174) |
| fixed (purple) | rgb(246, 240, 254) | rgb(218, 203, 238) |

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „TC-TILES-18 Teren", presses „Toate" | Four strips, left to right: [Date cadastrale, Adresă] grey-blue · [Corelate] green · [Clasificări, Conexiuni] yellow · [Hartă, Puncte de contur, Street View] purple. Each tile in its group's colour |
| 2 | Opens „TC-TILES-18 Ion", presses „Toate" | Four strips: [Identitate, Carte de identitate, Contact, Adrese] grey-blue · [Corelate] green · [Clasificări, Conexiuni] yellow · [Interacțiuni] purple. Each tile in its group's colour |
| 3 | Opens „TC-TILES-18 SRL", presses „Toate" | Four strips: [Identitate, Persoane de contact, Adrese] grey-blue · [Corelate] green · [Clasificări, Conexiuni] yellow · [Interacțiuni] purple. Each tile in its group's colour |
| 4 | Opens „TC-TILES-18 Act", presses „Toate" | Four strips: [Date generale, Preț și taxe, Cadastru și carte funciară, Stare juridică, Formalități] grey-blue · [Corelate] green · [Clasificări, Conexiuni] yellow · [Pagini] purple. Each tile in its group's colour |
| 5 | Steps 1–4 at 1920 px | The same |
| 6 | „Persoane Fizice", „Previzualizare" on „TC-TILES-18 Ion"'s row | The preview is green |
| 7 | On „TC-TILES-18 Ion", unticks „Interacțiuni" (#37.89), drags „Conexiuni" by its empty space to under „Corelate" | It stands there, still yellow |

## At the end — leaving things as they were found

Delete the four records (`DELETE`) and the natural person's stored tile arrangement.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.88).** Driven in the desktop app's browser pane, its viewport
emulated at 1920 × 1080, against `npm run dev` on 3000; a script read the bar's strips
(`data-tile-group`) and the tiles. Steps 1–4 held for the groups and their order. **The colours
could not be read there:** the dev server on 3000 had not rebuilt its CSS after `globals.css` gained
the green and yellow tokens (its stylesheet held `card-pinned` and not `card-related`, even after the
file was touched), so the green and yellow strips and tiles were transparent. That is the server's
cache, not the code. The runner's own server builds fresh, so the colours, steps 6 and 7, and 1366 px
are read by the spec on every run.

**2026-10-05 — run 2, `confirmed` (Slice #37.88).** The same file, driven again in the pane against
the test runner's own `next dev` on 3100, which builds fresh, while it was up for a run of the specs.
- Steps 1–4: the property and the judicial person and the document at 1920, the natural person at
  1366 and 1920. Every strip in its group's fill, in the order the steps give, every tile in its
  group's fill: grey-blue `rgb(238, 244, 250)`, green `rgb(235, 247, 237)`, yellow
  `rgb(248, 243, 229)`, purple `rgb(246, 240, 254)`.
- Step 6: the preview from „Persoane Fizice" is `rgb(235, 247, 237)`, its rim `rgb(187, 221, 194)`,
  dashed.
- Step 7: the pane's emulated 1920 × 1300 is scaled down to fit, so the row stood in one column and a
  scripted drag found no free place (FU-290). „Conexiuni" stayed yellow, and the spec drags it with
  Playwright's real mouse to a place the outline calls free.
- Nothing in the file changed, so the case is confirmed. The four records were deleted (204 ×4), with
  the person's stored arrangement. `e2e/tiles/tile-groups.spec.ts` translates the case.

**2026-10-05 — Slice #37.89.** The two persons gained a purple strip, [Interacțiuni], and the Judicial Person's first tile reads „Identitate". Steps 2 and 3 and the spec changed together.
