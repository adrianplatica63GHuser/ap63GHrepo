# TC-DOC-09 — „Persoane", „Proprietăți" și „Acte corelate" pe un rând: cota-parte după butonul portocaliu, relația după butonul ei, „Înscrisuri citate" pliate

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-07 |

## What this proves

On a Document, every row of „Persoane" and „Acte corelate" takes one line — a radio button, one
content field and its buttons — under no column headings. A person reads „Nume (Rol)"; the three
share values are not on the row but behind an orange „Cotă", which a role that holds no share does
not get, and a value typed behind it is saved when the panel closes. A related document reads
„Etichetă scurtă (Tip)", its relationship behind a button that shows the sentence and hides it on a
click outside or Esc. „Înscrisuri citate în acest document" is folded behind one button. A heading
over an empty column (#37.59's Proiectant), a second line on a row, or a typed share lost when the
panel closes is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-DOC-09", a PAD (Plan de amplasament și delimitare) „TC-DOC-09 PAD" and a Contract de
  Vânzare „TC-DOC-09 CVC"; the person associated to the PAD as „Proiectant / Consultant" and to the
  CVC as „Vânzător"; the PAD associated to the CVC as „Titlu anterior al" (posted from the PAD).
- In the role panels (Date de referință → Roluri), PAD — „Proiectant / Consultant" has „Deține cotă" NOT ticked, Contract
  de Vânzare — „Vânzător" has it ticked (migration_091).
- Each screen is opened with `?tab=…`, which shows the tile for the visit without changing which
  tiles you keep ticked.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-09 PAD`, tile „Legături" | No column headings. The person's row, on one line: `Ion TC-DOC-09 (Proiectant / Consultant)`, then „Vizualizare" and „Previzualizare" — no „Cotă" button and no share box |
| 2 | Opens `TC-DOC-09 CVC`, tile „Părți" | The person's row, on one line: `Ion TC-DOC-09 (Vânzător)`, then a solid orange „Cotă", „Vizualizare", „Previzualizare" |
| 3 | Rests the mouse on „Cotă" | A bubble: „Cotă-parte: fără cotă · Suprafață echivalentă (mp): fără suprafață · Mod de deținere: nespecificat" |
| 4 | Presses „Cotă" | A small panel beside the row with „Cotă-parte", „Suprafață echivalentă (mp)" and „Mod de deținere", empty; the cursor in „Cotă-parte" |
| 5 | Types `50` and presses Esc | The panel closes and `50` is saved: „Cotă" is now an orange outline, and resting on it reads „Cotă-parte: 50 · …" |
| 6 | Presses „Cotă", types `120` into „Suprafață echivalentă (mp)", clicks outside the panel | The panel closes and `120` is saved beside `50` |
| 7 | The documents of `TC-DOC-09 CVC`'s „Legături" | No column headings. One row, on one line: `TC-DOC-09 PAD (Plan de Amplasament și Delimitare)`, then „Relația", „Vizualizează", „Previzualizare"; the relationship sentence is not on the row |
| 8 | Presses „Relația" | A bubble beside it: `TC-DOC-09 PAD „Titlu anterior al” acest document` |
| 9 | Presses Esc; presses „Relația" again and clicks outside the bubble | Each time the bubble goes |
| 10 | Under the rows, „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" stand in one row, „Înscrisuri citate" after them; presses „Înscrisuri citate" | The panel „Înscrisuri citate în acest document" unfolds under them, as before — „Acest document nu a fost încă citit pentru înscrisurile pe care le citează.", „Verifică înscrisurile citate", „Recitește documentul" and the cost sentence |
| 11 | Presses „Înscrisuri citate" again | The panel folds |

## At the end — leaving things as they were found

Delete the three records (`DELETE` on their routes); their links go with them. Căutare globală for
`TC-DOC-09` finds nothing.

## Notes from the runs

**2026-10-07 — Slice #38.33.** A CVC's sellers and buyers are on „Părți", so steps 2–6 are
there; step 7 reads the CVC's documents on „Legături" as before.

**2026-10-03 — run 1, `driven` (Slice #37.64).** Driven in the Claude desktop app's browser pane on
Windows against `npm run dev` on 3000, the records created through the API from the page, read with
a script. This file was written from it.
- Step 1: `data-share="none"`, the content „Ion TC-DOC-09 (Proiectant / Consultant)" whole in its
  title, the row 34 px tall, no heading; the tile 476 px (3 units).
- Step 2: the row 34 px, „Cotă" `bg-orange-700`.
- Step 3: the pane's hover does not raise a pointer event the page hears — no tooltip opened on any
  button, „Vizualizare"'s own included — so the bubble was read as the button's description:
  „Cotă-parte: fără cotă · Suprafață echivalentă (mp): fără suprafață · Mod de deținere:
  nespecificat". The spec rests the mouse with Playwright, which does raise it.
- Step 4: the panel open, the cursor in „Cotă-parte — Ion TC-DOC-09 — Vânzător". (A 1366-px
  emulated window in the pane sent every click to the wrong place, so the run was made at the
  pane's own width; the tile scrolls sideways there and the row stays one line.)
- Step 5: Esc closed the panel, the focus went back to „Cotă", the API read 50 · — · —, the
  button an outline, the description „Cotă-parte: 50 · …".
- Step 6: the click outside landed on the sidebar's „Acte" and left the page — the panel had
  closed first and the API read 50 · 120 · —. Step 6 says „outside the panel", not where.
- Steps 7–9: the row „TC-DOC-09 PAD (Plan de Amplasament și Delimitare)", 34 px, the slots
  relation · view · preview each holding its button; the bubble read the sentence; Esc hid it and
  gave the focus back to „Relația"; a press on the tile's title hid it again.
- Steps 10–11: „Înscrisuri citate" `aria-expanded="false"`, no badge (never read); pressed, the
  panel with the never-read sentence; pressed again, gone.

**2026-10-03 — run 2, `confirmed` (Slice #37.64).** Same pane and width, three new records, against
the file above unchanged.
- Steps 1–2: the PAD's row „Ion TC-DOC-09 (Proiectant / Consultant)", 34 px, no heading, no box,
  only „Vizualizare" and „Previzualizare"; the CVC's „Ion TC-DOC-09 (Vânzător)", 34 px, „Cotă"
  solid orange, then „Vizualizare" and „Previzualizare".
- Step 3: read as the button's description, as in run 1 (the pane cannot hover).
- Steps 4–5: the panel, three empty boxes, the cursor in „Cotă-parte"; `50`, Esc: closed, the API
  50 · — · —, the outline, „Cotă-parte: 50 · …".
- Step 6: „Cotă", Tab to „Suprafață echivalentă (mp)", `120`, a press on the tile's title: closed,
  the API 50 · 120 · —.
- Steps 7–9: „TC-DOC-09 PAD (Plan de Amplasament și Delimitare)", 34 px, no sentence on the row,
  „Relația" · „Vizualizează" · „Previzualizare"; the bubble `TC-DOC-09 PAD „Titlu anterior al” acest
  document`; Esc hid it; pressed again and a press on the tile's title hid it.
- Steps 10–11: „Asociază" · „Dezasociază" · „Înscrisuri citate" in one row; unfolded with the
  never-read sentence and its two buttons and the cost; folded again.
- The three records deleted (204 ×3).
  Nothing in the file changed, so the case is confirmed, and `e2e/document/one-line-rows.spec.ts`
  translates it.

**2026-10-03 — `automated` (Slice #37.64).** `e2e/document/one-line-rows.spec.ts`, green in the
runner's whole `full` run `20261003T163253Z-20215` on `835e118` (63 passed).

**2026-10-03 — Slice #37.65 (steps 1, 2, 7 and 10 rewritten).** A Document's „Persoane", „Proprietăți" and
„Acte corelate" became one tile, „Corelate": the natural persons, the judicial persons, the properties
and the documents, one line each, one „Dezasociază", and „Asociază persoană", „Asociază
proprietate" and „Asociază act" in place of the three „Asociază". The steps say so; the spec follows,
and the runner's whole `full` run on the slice's commit keeps the row `automated`.
