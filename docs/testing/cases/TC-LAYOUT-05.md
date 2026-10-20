# TC-LAYOUT-05 — Cele patru liste: înguste, câte un rând pe linie, butoanele unul lângă altul

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-18 |

## What this proves

Slice #38.57, Adrian: „the lists are much wider than they should and buttons on the right side should never be
stacked — should stick to one row per item — and when making the list narrower we can stop right before the top
controls (like "add new") clash with the left top controls (like "fields picker")". Proprietăți, Persoane fizice,
Persoane juridice and Acte follow #38.50's rule: each column as wide as its content, each row one line (a long cell
cut with „…" and whole on hover), the row's buttons side by side, and the table never narrower than its toolbar, whose
two sides never meet. A row two lines tall, a cut cell with no tooltip, stacked buttons, or „Adaugă …" over the
controls on its left is the defect. Since #39.83 the band of column names above the rows is three rows tall on every
cell: a column that filters has its name on rows 1–2 and its funnel alone on row 3, a column that does not has its
name centred, no name takes more than two rows, and Adrian's long names always take two. A name on three rows, cut
sideways, a funnel beside its name, or a band that changes height is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API**, each with a name far longer than its column: a property nicknamed „TC-E2E-LAYOUT-05
  Proprietate …", a natural person „TC-E2E-LAYOUT-05 Popescu Ion …", a company „TC-E2E-LAYOUT-05 SRL …" and a
  Contract de Vânzare titled „TC-E2E-LAYOUT-05 Act …".
- **„Câmpuri afișate"** (#39.83), four columns on each list: Proprietăți — Categorie de folosință, Tip proprietate,
  Nr. cadastru, Oficială (m²); Persoane fizice — Data nașterii, Relația cu firma, CNP, Locul nașterii; Persoane
  juridice — Nr. înregistrare (CUI), Nr. registru comerțului, Persoană de contact, Localitate; Acte — Instituție /
  Notariat, Nr. pagini, Nr. document, Nr. proprietăți.

## What Adrian is asked for

Nothing.

## Steps

At 1366 and at 1920 px, on each of the four lists, searched for „TC-E2E-LAYOUT-05".

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți" | The record on one line; its long nickname cut with „…", whole on hover; „Deschide" and „Previzualizare" side by side; „Adaugă proprietate" clear of „Câmpuri afișate"; the table at least as wide as the toolbar |
| 2 | „Persoane fizice" | The same, for the person's name and nickname |
| 3 | „Persoane juridice" | The same, for the company's name |
| 4 | „Acte" | The same, for the document's title |
| 5 | On each list, looks at the band of column names (#39.83) | Every cell the same height, three rows; a filterable column's name on rows 1–2, bottom-aligned, its funnel alone on row 3; Poreclă, the name or title, Nr. cadastru, CNP, Nr. document and the juridical persons' CUI, register and contact person centred; „Categorie de / folosință", „Tip / proprietate", „Oficială / (m²)", „Data / nașterii", „Relația / cu firma", „Locul / nașterii", „Instituție / / Notariat", „Nr. / pagini", „Nr. / proprietăți" on two rows; no name on three |
| 6 | On each list, holds the mouse over the search box (#39.85) | The box is exactly as wide as „Adaugă …" at its row's end; the whole explanation shows on hover, even where the box cuts it with „…" |
| 7 | At 1280 × 600 px (#40.02), opens each list unsearched — a page of rows | The browser page has no vertical scroll bar; the list's frame has one, and its rows scroll inside it |
| 8 | Scrolls the frame to its last row | The band of column names still at the frame's top, the last row at its bottom, and the „Se afișează … / Pagina x din y" row under the frame, inside the window; the page has not moved |
| 9 | Scrolls the frame half-way, presses „Deschide" on a row in sight, then the browser's Back | The list comes back with its frame scrolled where it was (±2 px), the row in sight |
| 10 | Makes the window 1920 × 1080 | A page of rows fits: the frame draws no scroll bar, and the page none either |
| 11 | At 1100 × 800 px (#40.03), on „Acte" with „Data", „Instituție / Notariat", „Nr. pagini" and „Adăugat la" chosen, looks at the band of names | Its columns are wider than the frame. At the band's right edge — the visible part's, just left of the frame's vertical scroll bar — three red „>" one over another, as tall as the band; none at its left |
| 12 | Scrolls the list half-way sideways, then a little down | Three red „<" at the band's left edge too, both kept at the band as the rows scroll |
| 13 | Scrolls to the right end; then back, until a column's funnel stands under the „>" signs, and presses it | Only the „<" at the end. The funnel, pressed through the signs, opens its filter |
| 14 | At 1920 × 1080 px with no column chosen | Every column fits: no sign at either edge |

## At the end — leaving things as they were found

Delete the four records (`DELETE`). Set „Câmpuri afișate" back as it was on each list.

## Notes from the runs

**2026-10-08 — `automated` (Slice #38.57).** Written with the change, and translated at once into
`e2e/layout/domain-lists-one-line.spec.ts`, which the test runner ran green (the slice's handover names the run).

**2026-10-18 — step 5 added for #39.83.** The three-row band of column names, read on four columns per list. Not
driven by hand: the spec, extended with it, is what checks it.

**2026-10-18 — `automated` (Slice #39.83).** The test runner's targeted run 20261018T162356Z-3681 on 09705ab ran `e2e/layout/domain-lists-one-line.spec.ts` green
with the band of names (lint, tsc and the slice's jest suites green too).

**2026-10-18 — step 6 added for #39.85.** The search box as wide as „Adaugă …", its whole explanation on hover. Not
driven by hand: the spec, extended with it, is what checks it.

**2026-10-18 — `automated` (Slice #39.85).** The test runner's targeted run 20261018T165019Z-11827 on 4e824a7 ran `e2e/layout/domain-lists-one-line.spec.ts` green
with the search box's new words (lint, tsc and the slice's jest suites green too).

**2026-10-20 — steps 7–10 added for #40.02.** Adrian, 2026-10-20: „if the browser is not tall enough to accommodate the
entire list I want the list itself to have a vertical scroll bar … I also want the titles row of the list to always be
visible … we don't want the browser page to have a vertical scroll bar". Read in the browser pane on localhost:3000 the
same day, on „Persoane fizice" at 1280 × 600: the page 600 of 600 (no scroll); the frame at y 188, 337 px tall, 715 px
of rows; scrolled to its end, the band at 189 (the frame's 1-px border under 188) and the last row's bottom at 524 in a
frame ending at 525; the pagination row at 541–567; „Adaugă persoană", the frame and the pagination row all ending at
x 765 (the frame's 16-px scroll bar counted in the edge). The spec translates steps 7–10 as a second test.

**2026-10-20 — steps 11–14 added for #40.03.** Adrian, 2026-10-20: „if there columns that are not shown on the right side
we will display 3 greater than signs in red One on top of each other At the right edge of the visible part of the title
bar … similarly … 3 smaller than sign in red … at the left side". Read in the browser pane on localhost:3000 the same
day, on „Acte" at 1000 × 800 (no column chosen; the table 800 px in a frame showing 697): the three „>" at x 925–945,
y 231–305 — the band's height, against the frame's vertical scroll bar — and still there with the list scrolled 40 and
103 px sideways and 200 px down; `pointer-events: none`. The pane's emulated viewport dispatches no scroll events, so the
„<" appearing is the spec's to read (40.03's handover). The spec translates steps 11–14 as a third test.
