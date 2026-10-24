# TC-LAYOUT-10 — Pictograma de ordonare din banda de nume: pe coloanele care ordonează, două săgeți; apăsată, o săgeată bleumarin în cerc, toată lista ordonată după coloană

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-24 |

## What this proves

Since Slice 40.47 every column that sorts carries a sort icon in its name cell, left of its funnel (or where the
funnel would be): Persoane fizice — Adăugat la, Născut pe, Vârstă, Decedat pe; Persoane juridice — Adăugat la;
Proprietăți — Adăugat la, Tarla, Parcelă, Supr. Ofic., Supr. Calc.; Acte — Adăugat la, Data, Pagini, Persoane,
Proprietăți. Not in use it is „Interacțiuni"'s two arrows; in use, one thick navy arrow in a circle, up or down with
the direction. A press sorts the whole list by the column — the server's order, every page — „Adăugat la" newest
first, any other column ascending; a second press flips it; the sort button says „Ordonat după „<the column>”" and
takes the list back to „Recente întâi". Back from a record keeps the sort. A column outside the list with an icon, one
in it without, an order that is not the column's, or a sort lost on Back, is the defect.

„The rows' order" is read from the list's own answer, `GET /api/<list>`, by the column's value; empty values come last
whichever way. No name is read.

## Before you start

- TC-AUTH-01 is green.
- In this browser the four lists' chosen columns are set before each list opens (`localStorage`), and put back at the
  end: Persoane fizice — Născut pe, Vârstă, Decedat pe, Adăugat la; Proprietăți — Tarla, Parcelă, Supr. Ofic.,
  Supr. Calc.; Persoane juridice — Tip, Adăugat la; Acte — Data, Pagini, Persoane, Adăugat la.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Persoane Fizice" | „Născut pe", „Vârstă", „Decedat pe" and „Adăugat la" each with the two arrows (`lucide-arrow-up-down`), no circle, left of the funnel where the column has one; „Nume" and „Poreclă" none; the button „Recente întâi" |
| 2 | Presses „Născut pe"'s arrows | Its icon one arrow up (`lucide-arrow-up`) in the navy circle, the cell `aria-sort="ascending"`; the rows earliest birth first, empty last; the button „Ordonat după „Născut pe”"; the address `sort=dateOfBirth&order=asc` |
| 3 | Presses it again | The arrow down, `aria-sort="descending"`; the rows latest birth first, empty last |
| 4 | Opens the first row's record, then goes Back | Still sorted by „Născut pe", latest first, the same first row |
| 5 | Presses „Ordonat după „Născut pe”" | „Recente întâi"; no icon in use; the address has neither `sort` nor `order` |
| 6 | Opens „Proprietăți", presses „Supr. Calc."'s arrows | Icons on Tarla, Parcelă, Supr. Ofic. and Supr. Calc.; Supr. Calc. in use; the rows smallest calculated surface first, as numbers |
| 7 | Opens „Persoane Juridice", presses „Adăugat la"'s arrows | An icon on „Adăugat la" alone, „Tip" a funnel only; in use, arrow down; the rows newest added first |
| 8 | Opens „Acte", presses „Pagini"'s arrows | Icons on Data, Pagini, Persoane and Adăugat la, none on Tip or Titlu; „Pagini" in use; the rows fewest pages first |
| 9 | Opens „Persoane Fizice" with „Gen" among its columns (`gender`, before „Născut pe") and `?gender=MALE` in the address | „Gen"'s funnel in use: navy (`#1E3A8A`) in a navy circle, the funnel filled; every other funnel and every sort icon not in use: the glyph alone — no border, no fill (40.48) |

## At the end — leaving things as they were found

Put the four lists' chosen columns back as they were (remove those that were not there). An order lives only in the
address.

## Notes from the runs

**2026-10-24 — `driven` twice, `confirmed` (Slice 40.47).** In the Claude desktop app's browser pane on localhost:3000,
emulated at 1366 × 900; the four lists' chosen columns written to `localStorage` before they loaded and removed after
(none was stored before); the icons pressed by script, each list's answer read by fetching its route with the same
`sort` and `order`, and the first row matched to it by its link's id.
- Run 1, Persoane fizice → Acte: steps 1–8 as written. Step 1's icon stood 2 px left of each funnel; „Adăugat la",
  which has no funnel, in the funnel's place. `GET /api/people?sort=gender` answered 400.
- Run 2, Acte → Persoane fizice: steps 8, 7, 6, then 1–5, as written. Nothing in the file changed, so the case is
  confirmed, and `e2e/layout/column-sort.spec.ts` translates it.

**2026-10-24 — `automated`.** `e2e/layout/column-sort.spec.ts` translates the case. Its first green run is the runner's
`20261024T172744Z-15854` on `9742450` (Slice 40.47); the row moved in Slice 40.48.

**2026-10-24 — Slice 40.48.** Step 9 added: a funnel and a sort icon not in use are the glyph alone (step 1's „two
arrows, no circle" now with no box either), in use navy in a navy circle. Seen in the pane on localhost:3000 at 1366 px:
„Gen"'s funnel with `?gender=MALE` white with a navy border and radius, its icon filled navy; „Născut pe"'s funnel and
the two sort icons with no border and a transparent fill.
