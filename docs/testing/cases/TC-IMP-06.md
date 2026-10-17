# TC-IMP-06 — Un plan parcelar importat: tarla lui, cu parcelele, propusă, confirmată și legată de plan

| | |
|---|---|
| **Area** | import |
| **Kind** | happy |
| **Data** | `C:\dev\TEST.DATA\Test.Claude\13.tc.plan.parcelar` |
| **State** | `automated` |
| **Last green** | 2026-10-17 |

## What this proves

Since Slice #39.69 the import reads a „Plan parcelar” a second time, for its tarla: the locality, the tarla's code and
the parcels it draws (number, area, use), never the owners. After the run's other questions, the step „Tarla din
planul parcelar” shows what was read and proposes:

- to create the tarla when that code does not exist in that locality;
- to link the plan to the tarla when it does.

Nothing is written before the press. Then the tarla holds the parcels, the plan is linked to it, and the tarla's page
lists both. The proposal follows a corrected code or locality. A tarla with a linked plan cannot be deleted until the
plan goes.

## Before you start

- TC-AUTH-01 is green, on an account that can reach „Import”.
- The data folder holds one file, `flotante/TC-E2E-IMP-06 Plan parcelar.png`. It is a plan **drawn for this case**:
  plainly fictitious, with „SPECIMEN • DATE INVENTATE” across it. It shows „UAT Testeni, jud. Exemplu”, „Tarla TCP9”,
  and parcels 1–4 of 2.500, 3.200, 1.850 and 4.100 mp, A, A, P and V. The owners are „PROPRIETAR INVENTAT 1–4”. No
  real plan is ever used (`C:\dev\.claude\rules\capture-and-personal-data.md`).
- The archive has no tarla TCP9 in Testeni. The dev archive's 40 — Bragadiru exists (step 3 uses it and changes
  nothing).
- The run costs three paid calls: the plan's classification at „Scanare”, its general read, and its tarla read.

## What Adrian is asked for

Nothing. The folder is chosen by script, as TC-ICON-06 chooses one.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | TC-IMP-01's steps 1–10 on `13.tc.plan.parcelar` | „Structură”: „Reguli încălcate” 0, „Foldere citite” 2, „Foldere de proprietate găsite” 0, „Documente găsite în folder” 1. The scan: the plan „Plan Parcelar”, „Încredere ridicată”, „Scanat”. At „Import”: „Se creează un document, cu fișierele lui.” and „Citirea AI se plătește: cel mult un document va fi citit. Planul parcelar se citește încă o dată, pentru tarla lui.” |
| 2 | „Importă”, „Continuă”, „Da, pregătește etichetele”, „Importă Fișierele (1)” | „Tarla din planul parcelar” with „Tarla” `TCP9`, „Localitate” `Testeni` and „Județ” `Exemplu`. Under „4 parcele”: 1 · 2.500 · Arabil; 2 · 3.200 · Arabil; 3 · 1.850 · Pășune; 4 · 4.100 · Vie. No owner anywhere. „Tarla TCP9 — Testeni nu există încă: va fi creată, cu parcelele de mai jos, iar planul va fi legat de ea.” and the button „Creează tarla și leagă planul” |
| 3 | Types `40` in „Tarla” and `Bragadiru` in „Localitate”, then empties „Tarla”, then types back `TCP9` and `Testeni` | „Tarla 40 — Bragadiru există deja: planul va fi legat de ea și parcelele pe care nu le are vor fi adăugate. Deschide pagina tarlalei” and the button „Leagă planul de tarla”. Empty: „Fără codul tarlalei nu se poate crea sau lega nimic. Scrie-l, sau sari peste.” with the button off. Back: step 2's sentence |
| 4 | „Creează tarla și leagă planul” | The step closes. The plan's row: „tarla TCP9 creată, cu 4 parcele”. „Un document importat.” |
| 5 | Opens the tarla's page (`/tarlale`, „TCP9”) | „Tarla TCP9 — Testeni”. „Un plan parcelar”: the new document's code and title. „4 parcele”: the four rows of step 2, each with the document's code under „Din planul” |

**Steps 2, 4 and 5 are the assertion.**

## At the end — leaving things as they were found

- Deleting the tarla first is refused („IN_USE”): one linked plan holds it, and its 4 parcels are named as going with
  it.
- „Șterge” and **„Da”** on the document. The link goes with it, and the parcels keep no source.
- Then delete the tarla (Reference Data → „Indicative Tarla”, or its row's delete).

## Notes from the runs

**2026-10-17 — written (Slice #39.69)** from the code, the message files and a first drive in the pane.

**2026-10-17 — run 1, `driven` (Slice #39.69).** Claude, in the browser pane on localhost:3000, with **the real
reads**. The folder was put in the browser's own storage and given to the page's `showDirectoryPicker`, as TC-ICON-06
does; the buttons were pressed by script (FU-290).
- The pane was hidden, so the page's `requestAnimationFrame` was replaced by a 16 ms timer before step 1. Without it,
  „Se pregătesc etichetele…” waits for a frame a hidden pane never draws (the first attempt stopped there after its
  classification).
- Every step was as written. The scan typed the plan „Plan Parcelar”, „Încredere ridicată”. The tarla read gave
  `TCP9`, `Testeni`, `Exemplu` and the four parcels with A/P/V written out as Arabil, Pășune and Vie, and no owner.
- After step 4 the tarla was origin IMPORT, county Exemplu, no corners.
- Cleanup: the tarla's delete was refused (409 `IN_USE`, `tarlaPlans` 1, `tarlaParcels` 4 going with it). The
  document was deleted (204), the parcels' source cleared, then the tarla (204).

**2026-10-17 — run 2, `confirmed` (Slice #39.69).** The same pane and stand-in, the file unchanged, new rows: every
step the same, word for word. Cleanup the same (409, then 204, 204).

Paid calls for the slice's runs: 10 (three per run, plus the first attempt's classification).

**2026-10-17 — `automated` (Slice #39.69).** The test runner's targeted run 20261017T145651Z-32332 on 76a4631 ran
`e2e/import/plan-parcelar-tarla.spec.ts` green with four other specs and 39 jest suites (lint and tsc green too). The
spec answers the three paid calls itself, with what the hand runs read.
