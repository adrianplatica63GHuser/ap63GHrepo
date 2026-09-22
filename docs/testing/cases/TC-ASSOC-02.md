# TC-ASSOC-02 — Proprietate asociată actului

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-09-22 |

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
| 2 | Presses the tab **„Proprietăți"** — it sits beside „Asocieri", not inside it | „Nicio proprietate asociată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere proprietate" at `/documents/[id]/associate-property`, the document's title under it, one filter „Căutare" (placeholder „Cod sau denumire…"), and a table Cod · Denumire listing **every** property. There is no „Rol" on this screen |
| 4 | Types `TC-PROP-01` into „Căutare" | The table narrows to one row, „Denumire" = `TC-PROP-01 Teren de test` |
| 5 | Ticks that row | The row is selected, and the hint „Selectați cel puțin o proprietate" under the buttons goes away |
| 6 | Presses „Asociază selecția" | Back on the document, on its „Proprietăți" tab |
| 7 | Looks at „Proprietăți" | A table with one column, „Denumire" — there is no „Cod" column — and one row, `TC-PROP-01 Teren de test`, with „Vizualizare" |
| 8 | Presses „Vizualizare" on that row | The property's own screen, headed `TC-PROP-01 Teren de test`, opened **read-only** (`?readonly=true`) |
| 9 | Presses the tab „Acte" on the property | A table Tip · Titlu with one row: „Contract de Vânzare", `TC-DOC-01 Contract de test` |

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
