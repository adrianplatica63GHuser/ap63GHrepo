# TC-LAYOUT-03 — „Câmpuri afișate" fără o alegere memorată: Proprietăți cu Tip proprietate, celelalte liste doar coloanele fixe

| | |
|---|---|
| **Area** | layout |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #37.94 a browser that has stored no „Câmpuri afișate" choice opens the Properties list
with one field ticked — Tip proprietate since #38.02 (Tarla/Solă and Parcelă before it, still
offered) — and nothing else, and the Documents, Natural Persons and Judicial
Persons lists with nothing ticked — only their fixed columns. Each list's stored choice moved to a
new key once (the Properties list's once more, in #38.02), so every browser starts there; a choice
made afterwards is kept. A list opening with
other fields ticked, or a choice not kept across a reload, is the defect.

## Before you start

- TC-AUTH-01 is green.
- In this browser, nothing is stored under the four lists' keys — `ga40-col-property-v4`,
  `ga40-col-document-v3`, `ga40-col-person-v3`, `ga40-col-company-v2` (`localStorage`). Whatever
  was there is kept to put back at the end.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900. „The headers" are the list table's column headers, the two unnamed ones
(the tick box, the buttons) as „".

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți" | „Câmpuri afișate 1/4"; the headers „", „Poreclă", „Tip proprietate", „" |
| 2 | Opens „Acte" | „Câmpuri afișate 0/4"; the headers „", „Tip", „Titlu", „" |
| 3 | Opens „Persoane Fizice" | „Câmpuri afișate 0/4"; the headers „", „Nume", „Poreclă", „" |
| 4 | Opens „Persoane Juridice" | „Câmpuri afișate 0/4"; the headers „", „Denumire", „Poreclă", „" |
| 5 | Opens „Proprietăți", „Câmpuri afișate", ticks „Localitate", reloads | „Câmpuri afișate 2/4"; the headers „", „Poreclă", „Tip proprietate", „Localitate", „" |

## At the end — leaving things as they were found

Put the four keys back as they were (remove those that were not there).

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #37.94).** Driven in the desktop app's browser pane against
`npm run dev` on 3000, emulated at 1366 × 900; links and ticks pressed by script (FU-290). Nothing
was stored under the four new keys in the pane, so nothing needed setting aside.
- Step 1: „Câmpuri afișate 2/4"; „", „Poreclă", „Tarla/Solă", „Parcelă", „".
- Step 2: „Câmpuri afișate 0/4"; „", „Tip", „Titlu", „".
- Step 3: „Câmpuri afișate 0/4"; „", „Nume", „Poreclă", „".
- Step 4: „Câmpuri afișate 0/4"; „", „Denumire", „Poreclă", „".
- Step 5: stored `["tarlaSola","parcela","locality"]`; after the reload „Câmpuri afișate 3/4" and
  „Localitate" after „Parcelă". The key removed again.

**2026-10-05 — run 2, `confirmed` (Slice #37.94).** The same way, against the file above unchanged,
the lists opened from the sidebar in the order Acte, Persoane Fizice, Persoane Juridice,
Proprietăți: every reading as in run 1, step 5 too; the key removed. Nothing in the file changed, so
the case is confirmed, and `e2e/layout/list-default-fields.spec.ts` translates it.

**2026-10-05 — `automated`.** `e2e/layout/list-default-fields.spec.ts` translates the case; green on its
first runner run, `20261005T082209Z-27119` on `72893df` with the slice's tree (with TC-PROP-06's,
TC-DOC-08's, TC-PERS-04's and TC-LAYOUT-02's specs).

**2026-10-05 — Slice #38.02.** The Properties list's default is Tip proprietate alone, under the
new key `ga40-col-property-v4`, so steps 1 and 5 read „1/4" and „2/4" with „Tip proprietate" where
„Tarla/Solă" and „Parcelă" were; the other three lists are unchanged. Seen in the runner's browser
before and after (20261005T192746Z-12656, 20261005T193041Z-18703): the list, storage cleared,
headed „Poreclă" · „Tip proprietate". The spec follows.
