# TC-DOC-06 — „Fără valoare" în cursive, fără liniuțe; listele derulante ale unui CVC trei pe rând, în română ca în engleză

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-02 |

## What this proves

Since Slice #37.55 a dropdown's blank choice reads „fără valoare" („no value") in italics — in the
closed box while it is the chosen value, and first in the open list — without the long dashes it
used to carry („— fără valoare —"), and every real choice reads in the regular font. With the
dashes gone the blank is no longer a CVC dropdown's widest choice, so a clause offering „Da / Nu /
Nu e menționat" is 9 rem and „Declarații și garanții" holds three of them to a row — in Romanian,
as it already did in English.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare, „Etichetă scurtă" `TC-DOC-06 CVC`.
- Note the interface language, to put back at the end.

## What Adrian is asked for

Nothing.

## Steps

„In italics" is the text's computed `font-style` — `italic` — and what the screen shows; „regular"
is `normal`. „Boxes per row" counts the panel's boxes by the line their top edge sits on. Nothing
is saved.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-06 CVC` in Romanian and presses „Toate" | 36 dropdowns of the type's own fields, each reading „fără valoare" in italics, with no „—" around it (a real choice may carry one: „1 — Cadastru vechi, CF nedefinitivă") |
| 2 | Opens the list of „Circuit civil" („Declarații și garanții") | „fără valoare" first, in italics; „Afirmat", „Nu e menționat", „Excepție" in the regular font |
| 3 | Chooses „Afirmat" | The box reads „Afirmat", regular; the list still has „fără valoare" in italics and the others regular |
| 4 | Chooses „fără valoare" again | The box reads „fără valoare" in italics |
| 5 | Looks at „Declarații și garanții" and „Declarații și obligații legale" | Boxes per row 3, 3, 3, 3, 2 and 2, 3, 3, 2 („Temei legal evicțiune" is a text box, with one dropdown beside it) |
| 6 | Switches the interface to English and presses „All" | Each dropdown reads „no value" in italics; the two panels' boxes per row as in step 5 |

## At the end — leaving things as they were found

Put the interface language back, and delete the document (`DELETE /api/documents/<id>`). Căutare
globală for `TC-DOC-06` finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.55).** Driven in Chrome on Windows (Claude in Chrome,
the window maximised, 2016 px wide) against `npm run dev` on 3000; the open lists photographed
with a screenshot of the screen, since a page screenshot does not include a dropdown's list. This
file was written from it.
- Step 1 in English first (the interface's language when the run began): 36 dropdowns, each „no
  value", the select's `font-style` `italic`, the blank option `italic`, „Lei (RON)" `normal`.
- Step 2: the list drawn by Chrome — „no value" italic, „Afirmat", „Nu e menționat", „Excepție"
  regular (`chrome-open-list-en-2016.png`).
- Steps 3–4 by script on „Circuit civil": with „Afirmat" chosen the select `normal`, the blank
  option still `italic`, „Afirmat" `normal`; back on the blank, `italic`.
- Switched to Romanian: the blank „fără valoare"; boxes per row 3,3,3,3,2 and 2,3,3,2; the open
  list as in English (`chrome-open-list-ro-2016.png`).
- The window could not be set to 1366 (Chrome would not resize a maximised window from the
  extension); the panels are fixed-width, so rows do not depend on the window, and the spec takes
  1366 and 1920.

**2026-10-02 — run 2, one correction (Slice #37.55).** Same Chrome, same document, the file above.
- Step 1: 36 dropdowns, each „fără valoare" in italics — but „no „—" in any dropdown's choices"
  was wrong: „Excepție cadastru"'s „Temei excepție" offers „1 — Cadastru vechi, CF nedefinitivă" …
  „5 — Documentație completă", a dash that is part of the choice. The step now says the blank has
  none.
- Step 2: the list drawn by Chrome as in run 1. Step 3 („Afirmat" chosen from the open list with
  the keyboard): the box `normal`, the blank `italic`, the others `normal`. Step 4: `italic`.
- Step 5: 3,3,3,3,2 and 2,3,3,2. Step 6: 36 „no value", all italic; the same rows. (The panels'
  headings stay Romanian in English: a type's form is Romanian-first data, `groupRo || groupEn`.)

**2026-10-02 — run 3, `confirmed` (Slice #37.55).** Same Chrome, same document, against the file
as run 2 left it, unchanged.
- Steps 1–2 in Romanian: 36 „fără valoare", italic, none with a dash; the open list of „Circuit
  civil" as before. Steps 3–4: `normal` with „Afirmat", `italic` back on the blank. Step 5:
  3,3,3,3,2 and 2,3,3,2. Step 6 in English: 36 „no value", italic; the same rows.
- The interface put back to English; the document deleted (204). Nothing in the file changed, so
  the case is confirmed, and `e2e/document/blank-choice.spec.ts` translates it.

**2026-10-02 — `automated`.** `e2e/document/blank-choice.spec.ts` translates the case and takes
#37.55's pictures. Green on its first runner run, `20261002T191704Z-32333` on `876cea0` (a whole
`full`: e2e 54 passed, lint, tsc, jest 208 suites).
