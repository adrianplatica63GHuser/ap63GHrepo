# TC-ASSOC-05 — Act asociat proprietății, din ecranul proprietății

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

A document can be attached to a property **from the property's screen**, and the link is
visible from both ends — the property's „Acte" tab and the document's „Proprietăți" tab. It
is the other end of TC-ASSOC-02, which makes the same link from the document.

## Before you start

- TC-PROP-01 is green — `TC-PROP-01 Teren de test` exists.
- TC-DOC-01 is green — `TC-DOC-01 Contract de test` exists.

## What Adrian is asked for

Nothing. There is no role on this link, from either end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-PROP-01 Teren de test` from „Proprietăți — Listă" | The property's screen |
| 2 | Presses the tab **„Acte"** | „Niciun act asociat acestei proprietăți", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere act" at `/properties/[id]/associate-document`, the property's name under it, one filter „Căutare" („Cod sau titlu…"), a table Cod · Tip · Titlu listing every document. **There is no „Rol"** — the same as TC-ASSOC-02 from the other end |
| 4 | Types `TC-DOC-01` into „Căutare" | One row: `DOC…`, „Contract de Vânzare", `TC-DOC-01 Contract de test` |
| 5 | Ticks that row | The hint „Selectați cel puțin un act" goes away |
| 6 | Presses „Asociază selecția" | Back on the property's „Acte" tab (`?tab=document`): a table **Tip · Titlu** with one row — „Contract de Vânzare", `TC-DOC-01 Contract de test` — and „Vizualizare" |
| 7 | Presses „Vizualizare" on that row | The document's own screen, opened **read-only** (`?readonly=true`) |
| 8 | Presses the tab „Proprietăți" on the document | A table with one column, „Denumire", and one row, `TC-PROP-01 Teren de test`, with „Vizualizare" |

Step 8 is the other end of the link.

## At the end — leaving things as they were found

On the document's „Proprietăți" tab — or the property's „Acte" — select the row's radio
and press „Dezasociază". „Nicio proprietate asociată" follows on the document.

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line.** `DOC01898`
attached to `PROP01896` from the property; the property's „Acte" read Tip · Titlu; read back
from the document's „Proprietăți"; removed there with the radio and „Dezasociază". Only this
section was written; the spec is `e2e/association/property-document.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08).** `PROP01713` attached to
`DOC01715` from the property; read back from the document's „Proprietăți"; removed from there
with the radio and „Dezasociază". Every step written from TC-ASSOC-02 and the code held; the
one thing the run added is the property's „Acte" table being **Tip · Titlu**, without „Cod".
