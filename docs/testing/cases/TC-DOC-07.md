# TC-DOC-07 — Cota-parte doar pentru rolurile care dețin o cotă: un PAD cu un Proiectant, un CVC cu un Vânzător

| | |
|---|---|
| **Area** | document |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

On a Document's „Persoane", the three share values — „Cotă-parte", „Suprafață echivalentă (mp)" and
„Mod de deținere" — appear only for a role that holds a share in the property on that document's
type, and the tick that decides it („Deține cotă", in „Roluri pe Document") brings them back when
it is set. Boxes on a Proiectant, or none on a Vânzător, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person
  „Ion TC-DOC-07", a PAD (Plan de amplasament și delimitare) „TC-DOC-07 PAD" and a Contract de
  Vânzare „TC-DOC-07 CVC"; the person associated to the PAD as „Proiectant / Consultant" and to the
  CVC as „Vânzător".
- In „Roluri pe Document", the pair PAD — „Proiectant / Consultant" exists with „Deține cotă" NOT
  ticked, and Contract de Vânzare — „Vânzător" with it ticked (migration_091).

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-07 PAD`, tile „Corelate" | One row, `Ion TC-DOC-07 (Proiectant / Consultant)`, with no „Cotă" button — so no „Cotă-parte", „Suprafață echivalentă (mp)" or „Mod de deținere" box |
| 2 | Opens `TC-DOC-07 CVC`, tile „Corelate", and presses the row's „Cotă" | One row, `Ion TC-DOC-07 (Vânzător)`; behind „Cotă" the three boxes, empty |
| 3 | Opens „Date de referință" → „Tipuri de Document" → „Roluri pe Document" | A table Tip document · Rol persoană · Deține cotă; the PAD's „Proiectant / Consultant" unticked, Contract de Vânzare's „Vânzător" ticked |
| 4 | Ticks „Deține cotă" on the PAD's „Proiectant / Consultant" | The tick stays after the screen is opened again |
| 5 | Opens `TC-DOC-07 PAD`, tile „Corelate", and presses the row's „Cotă" | The row now has „Cotă", and behind it the three boxes, empty |
| 6 | Types `50` into „Cotă-parte" and presses Enter | The value stays: `50` |
| 7 | Unticks „Deține cotă" on the PAD's „Proiectant / Consultant" again, and opens `TC-DOC-07 PAD`, tile „Corelate", „Cotă" | The three boxes are still there, greyed and not editable, `50` in „Cotă-parte", and under them „Rolul nu deține o cotă pe acest tip de act — valorile salvate rămân, doar de citit." — nothing stored is hidden |

## At the end — leaving things as they were found

„Deține cotă" on the PAD's „Proiectant / Consultant" is unticked again by step 7. Delete the
three records (`DELETE` on their routes); their links go with them. Căutare globală for `TC-DOC-07`
finds nothing.

## Notes from the runs

**2026-10-02 — run 1, `driven` (Slice #37.59).** Driven in Chrome on Windows (Claude in Chrome,
the interface in English) against `npm run dev` on 3000, after migration_091 reached the local
database; the records created through the API, read with a script. This file was written from it.
- Before: a POST of the PAD's link with `cotaParte: 50` answered 400 `SHARE_NOT_HELD` with the
  Romanian sentence, and wrote nothing.
- Step 1: one row, „Ion TC-DOC-07 — Proiectant / Consultant", `data-share="none"`, no box, 72 px tall.
- Step 2: one row, „Vânzător", three boxes, empty and editable, 110 px tall.
- Step 3: „Document Persons": Document Type · Person Role · Holds a share; the PAD's „Proiectant /
  Consultant" unticked; Contract de Vânzare's Cumpărător, Moștenitor / Succesor and Vânzător
  ticked, Notar and Reprezentant legal / Mandatar not.
- Step 4: the first tick, a script's click fired straight after the screen opened, did not stay
  (unticked when the screen was opened again; no error shown). Ticked again it stayed, and three
  more clicks in a row each reached the database. Not seen again; the spec clicks it the way a
  person does.
- Step 5: the three boxes, empty and editable.
- Steps 6–7: `50` saved; unticked, the row read `data-share="readonly"`, the three boxes disabled,
  `50` kept, and the hint under them.

**2026-10-02 — run 2, `confirmed` (Slice #37.59).** Same Chrome, three new records, against the
file above unchanged.
- Steps 1–2: the PAD's row `none`, no box; the CVC's „Vânzător" row three empty, editable boxes.
- Steps 3–4: the three columns; the PAD's „Proiectant / Consultant" unticked, „Vânzător" ticked;
  the tick, clicked once, was on the screen and in the database, and still on when the screen was
  opened again.
- Steps 5–7: three empty, editable boxes; `50` saved; unticked on the screen (the database
  followed), the row `readonly`, the boxes disabled, `50` kept, the hint under them.
- The three records deleted (204 ×3); the tick is off again.
  Nothing in the file changed, so the case is confirmed, and `e2e/document/role-share.spec.ts`
  translates it.

**2026-10-02 — `automated` (Slice #37.59).** `e2e/document/role-share.spec.ts`. Its first full run (`20261003T001042Z-24314`) failed at step 4 — „Clicking the checkbox did not change its state" — which was run 1's „first tick did not stay" again, and a defect: the box went back until the save and the refetch had landed. Fixed in the screen (`a27c956`); the spec then found the tick left on by its own late PATCH and now sets the starting state itself. Green in `20261003T003044Z-3652`.

**2026-10-03 — Slice #37.64 (steps 1, 2, 5 and 7 rewritten).** The share boxes moved behind the
row's orange „Cotă", which a role that holds no share does not get; the steps say so. The spec
follows them, and the runner's whole `full` run on the slice's commit keeps the row `automated`.

**2026-10-03 — Slice #37.65 (steps 1, 2, 5 and 7 rewritten).** A Document's „Persoane", „Proprietăți" and
„Acte corelate" became one tile, „Corelate": the natural persons, the judicial persons, the properties
and the documents, one line each, one „Dezasociază", and „Asociază persoană", „Asociază
proprietate" and „Asociază act" in place of the three „Asociază". The steps say so; the spec follows,
and the runner's whole `full` run on the slice's commit keeps the row `automated`.
