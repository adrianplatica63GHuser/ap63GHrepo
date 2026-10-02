# TC-DOC-04 — Listele derulante ale unui CVC: cât cea mai lungă alegere, două pe rând

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.53 a document type's own dropdown is as wide as its widest choice needs (the
blank „— fără valoare —" included), rounded up to half a rem — not the next step up. On a CVC
most are 10 rem (160 px) where they were L (208 px), and a panel of dropdowns takes a third unit
when that pairs them, so „Stare juridică afirmată" and „Conformitate și formalități" show two
dropdowns to a row. Narrower must not mean clipped: every dropdown, with its widest choice
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
| 3 | Looks at „Stare juridică afirmată" and „Conformitate și formalități" | Two boxes to every row: 14 boxes in 7 rows, 10 in 5 |
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
