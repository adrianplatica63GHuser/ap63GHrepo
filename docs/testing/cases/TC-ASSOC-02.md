# TC-ASSOC-02 — Proprietate asociată actului

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
| 2 | Presses the tab „Asocieri", then „Proprietăți" | „Nicio proprietate asociată" |
| 3 | Presses „Asociază" | The heading „Asociere proprietate", with „Căutare" (placeholder „Cod sau denumire…") and „Rol" |
| 4 | Types `TC-PROP-01` into „Căutare" | One result row, „Denumire" = `TC-PROP-01 Teren de test` |
| 5 | Ticks that row | The row is selected |
| 6 | Presses „Asociază selecția" | „Se asociază…", then back to the document |
| 7 | Looks at „Proprietăți" | A row with „Cod" and „Denumire" = `TC-PROP-01 Teren de test` |
| 8 | Presses „Vizualizare" on that row | The property's own detail screen opens |
| 9 | Presses the tab „Acte" on the property | A row for `TC-DOC-01 Contract de test` |

Step 9 is the other end of the link, and is the whole reason this case is not just
step 7.

## At the end — leaving things as they were found

Back on the document, „Asocieri" → „Proprietăți", press „Dezasociază". „Se elimină…",
then „Nicio proprietate asociată".

**If the property is later deleted from the document's screen**, the application refuses
with „Nu se poate șterge de aici" — dissociate first, then open the property from
„Proprietăți — Listă" and delete it there. That refusal is correct behaviour, not a
failure of this case.

## Notes from the runs

_(filled in by the first run)_
