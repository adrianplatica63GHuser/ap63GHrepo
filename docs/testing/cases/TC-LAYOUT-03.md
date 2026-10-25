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
- In this browser, nothing is stored under the four lists' keys — `ga40-col-property-v5`,
  `ga40-col-document-v4`, `ga40-col-person-v4`, `ga40-col-company-v3` (`localStorage`, since 40.66). Whatever
  was there is kept to put back at the end.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900. „The headers" are the list table's column headers, the two unnamed ones
(the tick box, the buttons) as „".

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Proprietăți" (Slice 40.66) | „Câmpuri afișate 4/4"; the headers „Poreclă", „Tarla", „Parcelă", „Tip Prop.", „Localitate", „"; the table does not scroll sideways |
| 2 | Opens „Acte" | „Câmpuri afișate 4/4"; the headers „Tip", „Titlu", „#Document", „Data", „Inst./Notar", „Modificat la", „"; the first row's „Modificat la" a day, dd.mm.yyyy; no sideways scroll |
| 3 | Opens „Persoane Fizice" | „Câmpuri afișate 4/4"; the headers „Nume", „Poreclă", „CNP", „Născut pe", „Tip prof.", „Modificat la", „"; „Modificat la" a day; no sideways scroll |
| 4 | Opens „Persoane Juridice" | „Câmpuri afișate 4/4"; the headers „Denumire", „Poreclă", „Tip", „CUI", „Localitate", „Modificat la", „"; „Modificat la" a day; no sideways scroll |
| 5 | Opens „Proprietăți", „Câmpuri afișate", unticks „Localitate", ticks „Modificat la", reloads | „Câmpuri afișate 4/4"; the headers „Poreclă", „Tarla", „Parcelă", „Tip Prop.", „Modificat la", „"; the first row's „Modificat la" a day |

## At the end — leaving things as they were found

Put the four keys back as they were (remove those that were not there).

## Notes from the runs

**2026-10-25 — rewritten (Slice 40.66).** Every list opens on four columns — Adrian: „please pick the best default
yourself" — and all four keys moved once more, so steps 1–5 read the new defaults where they read #38.02's Tip
proprietate and three lists of fixed columns; steps 6–9 (40.45/40.55's „Modificat la" ticked by hand) folded into 2–5,
where it is a default. Written from the slice's own change; not driven by hand first.

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

**2026-10-05 — `automated` (Slice #38.02).** The test runner's full run 20261005T193605Z-29374 on
7505a33 ran the changed spec green with the other 87 (lint, tsc, jest and forms-drift green too).

**2026-10-21 — names shortened (Slice 40.20).** The band of names and „Câmpuri afișate" show Adrian's short names
(„Născut pe", „Tip Prop.", „#Document", „Contact" …), the field's whole label on hover; a filter's chip and the
forms keep the whole labels. Where a step above quotes a column or a box in „Câmpuri afișate" by its whole label, it
now reads the short one; the spec's locators follow.

**2026-10-24 — Slice 40.45.** Steps 6–8 added: „Adăugat la" — the day the record was added, in the reader's time
zone, as on Acte since #37.62 — offered last in „Câmpuri afișate" on Proprietăți, Persoane fizice and Persoane
juridice, ticked by nobody by default (steps 1–4 unchanged). The spec reads the first row's day for its shape alone,
never a name beside it.

**2026-10-24 — Slice 40.55.** Adrian: „I have made a mistake by asking you to add the field "added on" to the field
chooser; The field I was looking for was "Last Modified On" and the label can be shorter: "modified on"". Steps 6–8
read „Modificat la" where they read „Adăugat la" — the day of the record's last change, its adding counting as one,
the date the list's default order goes by — and step 9 is new: Acte offers it too, after its own „Adăugat la"
(#37.62, which stays). The spec follows.
