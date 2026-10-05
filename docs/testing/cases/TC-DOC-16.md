# TC-DOC-16 — „Tip document:" numește tipul ales; „Câmp specific" merge doar pentru un singur tip cu formular

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-05 |

## What this proves

Since Slice #38.07 the Documents list's „Tip document:" button reads „Toate tipurile" with every
type ticked, the type's name with exactly one, „N tipuri afișate" in italics with several, and „Niciun
tip" in italics with none. „Câmp specific:" is always drawn; its field list works only when exactly
one type is ticked and that type has a form with closed-list fields — otherwise it is disabled, and a
field already chosen is let go. Its ⓘ says so in italics. A button reading „n/N", or „Câmp specific"
offering every type's fields at once, is the defect.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a Contract de
  Vânzare „TC-DOC-16 Contract de test" and an Adeverință „TC-DOC-16 Adeverință de test". The Contract
  de Vânzare has a form with closed-list fields („Stare plată" among them); Adeverință has none.
- The window is 1920 px wide.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Acte" | „Tip document: Toate tipurile". „Câmp specific:" drawn, its list disabled, offering only „Toate". Its ⓘ's bubble ends, in italics: „Câmpul specific este activ numai când la „Tip document” este ales un singur tip, iar acel tip are un formular cu câmpuri cu listă închisă de valori." |
| 2 | Opens „Tip document" and unticks „Toate tipurile" | The button reads „Niciun tip", in italics; the list says „Selectați cel puțin un tip de document"; „Câmp specific:" disabled |
| 3 | Ticks „Contract de Vânzare" | The button reads „Contract de Vânzare" (not italic; the name is its tooltip). „Câmp specific:" enabled: „Toate", then the contract's closed-list fields — „Monedă", „Stare plată", „Modalitate plată" among them |
| 4 | Chooses „Stare plată" in „Câmp specific:", then ticks „Adeverință" too | The button reads „2 tipuri afișate", in italics. „Câmp specific:" disabled, back on „Toate"; the second list gone |
| 5 | Unticks „Contract de Vânzare" | The button reads „Adeverință"; „Câmp specific:" disabled — Adeverință has no form |

## At the end — leaving things as they were found

Delete both documents (`DELETE` on each). The type filter lives in the address only.

## Notes from the runs

**2026-10-05 — run 1, `driven` (Slice #38.07).** Driven in the desktop app's browser pane, its
viewport emulated at 1920 × 1080, against `npm run dev` on 3000; the boxes were pressed by script
(FU-290).
- Step 1: „Tip document:Toate tipurile", normal; the key list disabled, [„Toate"]; the bubble's note
  in an `<em>`, italic, word for word.
- Step 2: „Niciun tip", italic; „Selectați cel puțin un tip de document"; the key list disabled.
- Step 3: „Contract de Vânzare", normal, title the same; the key list enabled, 37 entries: „Toate",
  „Monedă", „Stare plată", „Modalitate plată", „Scop vânzare" …
- Step 4 (run 1 ticked „Adeverință" without choosing a field first): „2 tipuri afișate", italic; the
  key list disabled, [„Toate"].
- Step 5: „Adeverință", normal; the key list disabled.
- Both deleted (204, 204). The file was corrected after this run: step 4 now chooses „Stare plată"
  first, so it also proves a chosen field is let go.

**2026-10-05 — run 2, `confirmed` (Slice #38.07).** The same pane, two new documents, the corrected
file: every step as written. Step 4: „Stare plată" chosen — the value list appeared — then „Adeverință"
ticked: „2 tipuri afișate", italic, the key back on „Toate" and disabled, the value list gone. The
other steps as in run 1, word for word. Both deleted (204, 204). Nothing in the file needed
correcting, so the case is confirmed, and `e2e/document/document-type-filter.spec.ts` translates it.

**2026-10-05 — `automated` (Slice #38.07).** The test runner's full run 20261005T223454Z-10117 on
bc8e7c6 ran `e2e/document/document-type-filter.spec.ts` green with the other 91 (lint, tsc, jest and forms-drift green too).
