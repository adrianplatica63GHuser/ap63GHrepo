# TC-DOC-04 — Listele derulante ale unui CVC: cât cea mai lungă alegere, trei pe rând

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.53 a document type's own dropdown is as wide as its widest choice needs (the
blank one included), rounded up to half a rem — not the next step up — and a panel of dropdowns
takes a third unit when that pairs them. Since #37.55 the blank reads „fără valoare", in italics
and without dashes, so on a CVC most are 9 rem (144 px) — they were 10, and L (208 px) before
#37.53 — and „Declarații și garanții" and „Declarații și obligații legale" show three dropdowns
to a row. Narrower must not mean clipped: every dropdown, with its widest choice
selected, shows that choice whole beside its arrow.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare, „Etichetă scurtă" `TC-DOC-04 CVC`.

## What Adrian is asked for

Nothing.

## Steps

„Its widest choice" is the option whose text draws widest in the dropdown's own font (a canvas
measure, not the character count). „Whole" is the dropdown's inner width (less its padding) at
least that text's width plus 24 px for the arrow. A choice is selected on screen only; nothing is
saved.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-04 CVC` in a 1366 × 900 window and presses „Toate" | 36 dropdowns of the type's own fields |
| 2 | Selects in each its widest choice | Every one shows it whole |
| 3 | Looks at „Declarațiile vânzătorului" and „Declarații legale" (#38.33) | Boxes per row 3, 3, 3, 3 and 3, 2 („Temei legal evicțiune" is a text box, with one dropdown beside it) |
| 4 | Widens the window to 1920 × 1080 | Steps 2 and 3 the same |

## At the end — leaving things as they were found

Leave without saving, and delete the document (`DELETE /api/documents/<id>`). Căutare globală for
`TC-DOC-04` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.53).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000, the window emulated, the choices set with a script; this file was
written from it.
- Steps 1–2 at 1366: 36 dropdowns in Arial; none clipped; the least room left beside the arrow
  6 px („Scop vânzare" with „Vânzare obișnuită", 160 px wide), the blank „— fără valoare —" 8 px.
- Step 3: both panels 450 px inside (3 units); boxes per row 2,2,2,2,2,2,2 and 2,2,2,2,2.
- Step 4 at 1920: the same numbers.
- The document deleted at the end (204).

**2026-10-02 — run 2, `confirmed` (Slice #37.53).** Same pane, against the file above unchanged.
- Steps 1–3 at 1366: 36 dropdowns, none clipped, least room 6 px; 14 boxes as 2,2,2,2,2,2,2 and
  10 as 2,2,2,2,2. Deleted (204).
- Step 4 at 1920: the reading was lost to a page change the same script made, so it was read again
  on a second `TC-DOC-04 CVC`, opened straight at 1920: the same numbers. Deleted (204); nothing
  left for `TC-DOC-04`. Nothing in the file changed, so the case is confirmed, and
  `e2e/document/template-dropdowns.spec.ts` translates it.

**2026-10-02 — `automated`.** `e2e/document/template-dropdowns.spec.ts` translates the case and
takes #37.53's pictures. Green on its first runner run, `20261002T144858Z-6734` on `0d546b6` (with
TC-DOC-01's spec, whose unit grid holds the wider panels, lint, tsc and the three jest suites).

**2026-10-02 — Slice #37.54.** The CVC's tiles and panels were renamed: „Instrument" → „Preț și taxe", „Cadastru" → „Cadastru și carte funciară", „Conformitate" → „Formalități"; „Antet instrument" → „Dosar și exemplar", „Stare juridică afirmată" → „Declarații și garanții", „Conformitate și formalități" → „Declarații și obligații legale". The steps read the new names; the notes above keep the old ones, as they were run. The spec reads them too.

**2026-10-02 — Slice #37.55.** The blank choice lost its dashes („— fără valoare —" → „fără valoare", in italics), so the clauses are 9 rem and step 3's two panels hold three boxes to a row: 3,3,3,3,2 and 2,3,3,2 (measured in TC-DOC-06's runs, in Chrome). The title, the opening paragraph and step 3 say so; the notes above keep the old counts, as they were run. The spec reads the new rows.

**2026-10-05 — Slice #37.90.** The CVC's tab „Cadastru și carte funciară" is „Cadastru și CF" (renamed in the
form on both databases; a remembered tick carries over), and inside a tile a panel's subtitle reads in
square brackets. The steps above name the tab by its new name; nothing else in them changed. The
spec reads the same name and finds the two panels by their bracketed headings.
