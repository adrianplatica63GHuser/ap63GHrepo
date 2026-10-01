# TC-ICON-03 — „Asociază" și „Dezasociază" cu pictogramă și cuvinte, și un pas înapoi printre versiuni

| | |
|---|---|
| **Area** | ui |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-01 |

## What this proves

Since Slice #37.44 the domain verbs keep their words beside an icon — „Asociază" and „Asociază
selecția" a link, „Dezasociază" a broken link — and still do what they did. The version strip's
step back is Lucide's StepBack: the „2 versiuni" chip keeps its count as its name, and its
tooltip adds what it does, „Versiunea anterioară".

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites:
  - a Property, „Poreclă" `TC-ICON-03 Teren`;
  - a Natural Person `TC-ICON-03` / `Ion` (listed as `Ion TC-ICON-03`).

## What Adrian is asked for

Nothing.

## Steps

An icon is the Lucide one on the button: `link`, `unlink`, `step-back`, `step-forward`. A
tooltip is the element with role `tooltip`.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the property and ticks „Persoane" in „Părți afișate" | „Nicio persoană asociată acestei proprietăți"; „Asociază" — a link icon and the word — and „Dezasociază" — a broken link and the word, inactive |
| 2 | Presses „Asociază" | „Asociere persoană" (`/properties/<id>/associate-person`), its „Anulează" an X |
| 3 | Types `TC-ICON-03` in „Nume…", ticks `Ion TC-ICON-03`, picks „Rol": „Proprietar / Titular de drept real" | „Asociază selecția" — a link icon and the words — active |
| 4 | Presses „Asociază selecția" | Back on the property (`?tab=persons`): one row, `Ion TC-ICON-03`, „Proprietar / Titular de drept real" |
| 5 | Picks the row's radio, presses „Dezasociază" | „Nicio persoană asociată acestei proprietăți" — no question asked |
| 6 | Changes „Poreclă" to `TC-ICON-03 Teren v1`, presses the floppy disk („Salvează") | It stays; the strip shows a chip „2 versiuni" with the step-back icon before the words |
| 7 | Moves the mouse over the chip | A tooltip of two lines: `2 versiuni` and `Versiunea anterioară` |
| 8 | Presses the chip | „v 0"; the step-back arrow („Versiunea anterioară") inactive, the step-forward arrow („Versiunea următoare") active |

## At the end — leaving things as they were found

Delete the property and the person (`DELETE /api/properties/<id>`, `DELETE /api/people/<id>`,
or „Șterge" and „Da" on each).

## Notes from the runs

**2026-10-01 — run 1, `driven` (Slice #37.44).** Driven in the Claude desktop app's browser pane
against `npm run dev` on 3000; this file was written from it. The pane was hidden, so the hover was
a dispatched `pointerover`, the presses `click()`, and the filter `form_input`.
- Steps 1–8 as written: `lucide-link`, `lucide-unlink` (inactive with no row), the associate
  screen's X; one row with the role; „Dezasociază" asked nothing; „2 versiuni" with
  `lucide-step-back`, described by „Versiunea anterioară"; the tooltip read
  `2 versiuni / Versiunea anterioară`; „v 0", step-back inactive, step-forward active.
- Both records deleted at the end (204 each).

**2026-10-01 — run 2, `confirmed` (Slice #37.44).** Same pane, new records, against the file above
unchanged.
- Steps 1–8 exactly as run 1: link and broken-link icons with their words; the associate
  screen's X; one row with the role; „Dezasociază" with no question; „2 versiuni" with the
  step-back icon, its tooltip `2 versiuni / Versiunea anterioară`; „v 0", back inactive,
  forward active.
- Both records deleted at the end (204 each). Nothing changed between the runs, so the case is
  confirmed, and `e2e/ui/icon-associations.spec.ts` translates it.

**2026-10-01 — `automated`.** `e2e/ui/icon-associations.spec.ts` translates the case with
Playwright's real mouse and takes #37.44's pictures. Green on its first runner run,
`20261001T180511Z-30826` (with the versioning and corner-edit specs, whose step-back locator
moved to roles).
