# TC-ASSOC-02 — Proprietate asociată actului

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-03 |

## What this proves

A property can be attached to a document, and the link is visible from **both** ends —
the document's „Proprietăți" list and the property's „Acte" tab. A link that shows on
one side only is the defect this case exists to catch.

## Before you start

- TC-PROP-01 is green — `TC-PROP-01 Teren de test` exists.
- TC-DOC-01 is green — `TC-DOC-01 Contract de test` exists.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-01 Contract de test` | The document's detail screen |
| 2 | Ticks the tile **„Corelate"** | „Nimic corelat încă.", with „Asociază persoană", „Asociază proprietate", „Asociază act" and „Dezasociază" |
| 3 | Presses „Asociază proprietate" | „Asociere proprietate" at `/documents/[id]/associate-property`, the document's title under it, one filter „Căutare" (placeholder „Cod sau denumire…"), and a table Denumire listing **every** property. There is no „Rol" on this screen |
| 4 | Types `TC-PROP-01` into „Căutare" | The table narrows to one row, „Denumire" = `TC-PROP-01 Teren de test` |
| 5 | Ticks that row | The row is selected, and the hint „Selectați cel puțin o proprietate" under the buttons goes away |
| 6 | Presses „Asociază selecția" | Back on the document, on its „Corelate" tile |
| 7 | Looks at „Corelate" | No column headings and no „Cod": one row, on one line, `TC-PROP-01 Teren de test`, with „Vizualizare" |
| 8 | Presses „Vizualizare" on that row | The property's own screen, headed `TC-PROP-01 Teren de test`, opened **read-only** (`?readonly=true`) |
| 9 | Ticks the tile „Corelate" on the property | One line: `TC-DOC-01 Contract de test (Contract de Vânzare)` |

Step 9 is the other end of the link, and is the whole reason this case is not just
step 7.

## At the end — leaving things as they were found

Back on the document, tab „Proprietăți": **select the row first** — its radio button at
the left — then press „Dezasociază", which is disabled while no row is selected.
„Nicio proprietate asociată" follows.

**If the property is later deleted from the document's screen**, the application refuses
with „Nu se poate șterge de aici" — dissociate first, then open the property from
„Proprietăți — Listă" and delete it there. That refusal is correct behaviour, not a
failure of this case.

## Notes from the runs

**2026-09-23 — `automated` (Slice #36.06).** Green in `npm run e2e` with the whole suite,
12 passed; the spec is named in the catalogue's `Spec` column.

**2026-09-22, second run (Slice #36.06) — `confirmed`: the file held line for line.**
`PROP01629` attached to `DOC01631`: „Asociere proprietate" listing every property, one
row after `TC-PROP-01` in „Căutare", the hint gone on ticking it, back on the document's
„Proprietăți" with the single column „Denumire", „Vizualizare" opening
`/properties/…?readonly=true`, and the property's „Acte" reading „Contract de Vânzare",
`TC-DOC-01 Contract de test`. Removed with the radio and „Dezasociază". Only this section
was written on this run.

**2026-09-22 — driven for the first time, green. `PROP01622` attached to `DOC01624`, and
the link read from both ends.**

Four corrections:

1. **„Proprietăți" is a top-level tab of the document**, beside „Asocieri" — the old
   step 2 went through „Asocieri", which holds the document-to-document references.
2. **This screen has no „Rol".** The old step 3 promised one; nothing in
   `associate-property-view.tsx` renders it.
3. **The associated-properties table has only „Denumire"**, not „Cod" and „Denumire".
4. **„Vizualizare" opens the property read-only**, and „Dezasociază" needs the row's radio
   selected first — the same as on the „Persoane" tab.

**2026-10-02 — Slice #37.57 (the system ID in one place).** The record's code (PPERS/JPERS/PROP/DOC…) now stands only in the corner of its first panel (TC-SYSID-01); the lists, the pickers, the association tables, Căutare globală and the relation chips no longer show it — a related record is named by its name or title. The steps above that read a code or a „Cod" column were rewritten to match, the search boxes' placeholders („Cod…", „caută după cod…") unchanged — they still search by code. The spec follows, green in the runner's full `20261002T222558Z-906`.

**2026-10-03 — Slice #37.64 (steps 7 rewritten).** A Document's „Persoane", „Proprietăți" and
„Acte corelate" became one line a row under no headings; the share values went behind the row's
orange „Cotă", a related document's relationship behind „Relația", and „Înscrisuri citate în acest
document" behind one button. The steps now say what the screen shows; the spec follows them, and
the runner's whole `full` run on the slice's commit is the run that keeps the row `automated`
(TC-DOC-09 drove the new shape by hand, twice).

**2026-10-03 — Slice #37.65 (steps 2, 3, 6 and 7 rewritten).** A Document's „Persoane", „Proprietăți" and
„Acte corelate" became one tile, „Corelate": the natural persons, the judicial persons, the properties
and the documents, one line each, one „Dezasociază", and „Asociază persoană", „Asociază
proprietate" and „Asociază act" in place of the three „Asociază". The steps say so; the spec follows,
and the runner's whole `full` run on the slice's commit keeps the row `automated`.

**2026-10-03 — Slice #37.66 (steps 9 rewritten).** The Property's „Proprietăți corelate",
„Persoane" and „Acte" became one tile, „Corelate" — the Document's (#37.65): one line a row, the
relationship behind „Relația", one „Dezasociază", and „Asociază persoană", „Asociază proprietate"
and „Asociază act" in place of the three „Asociază". The steps say so; the spec follows, and the
runner's whole `full` run on the slice's commit keeps the row `automated`.
