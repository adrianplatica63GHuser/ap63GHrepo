# TC-ASSOC-06 — Firmă proprietară a unui teren

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

A company can be made the owner of a property **from the company's screen**, under a role,
and the property then lists the company among its people — with „Vizualizare" opening the
company, not a natural person.

## Before you start

- TC-PERS-02 is green — `TC-PERS-02 Firmă de test SRL` exists.
- TC-PROP-01 is green — `TC-PROP-01 Teren de test` exists.

## What Adrian is asked for

**Nothing — the role was a choice, recorded so it can be overturned in one line.** The role is
**„Proprietar / Titular de drept real"**, for the reason TC-ASSOC-04 gives: a company that owns
land is written in the land book as the holder of the right of ownership, whatever kind of
person it is. The list the company is offered is the same four roles a natural person is.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-PERS-02 Firmă de test SRL` from „Persoane Juridice" | The company's screen |
| 2 | Presses the tab **„Proprietăți"** | „Nicio proprietate asociată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere proprietate" at `/judicial-persons/[id]/associate-property`, the company's name under it, one filter „Căutare" („Cod sau denumire…"), a table Cod · Denumire listing every property, and „Rol" offering „Coproprietari / Coindivizari", „Cumpărător", „Proprietar / Titular de drept real", „Titular de drept" |
| 4 | Types `TC-PROP-01` into „Căutare" and ticks the one row | The row is selected |
| 5 | Chooses „Proprietar / Titular de drept real" in „Rol" | The role is selected |
| 6 | Presses „Asociază selecția" | Back on the company's „Proprietăți" (`?tab=properties`): Denumire · Rol, `TC-PROP-01 Teren de test`, „Proprietar / Titular de drept real", „Vizualizare" |
| 7 | Opens `TC-PROP-01 Teren de test` and presses its tab „Persoane" | Nume · Rol, one row: `TC-PERS-02 Firmă de test SRL`, „Proprietar / Titular de drept real" |
| 8 | Presses „Vizualizare" on that row | **The company's** screen at `/judicial-persons/[id]?readonly=true`, with „Înapoi la listă" and „Modifică" at the bottom |

Step 7 is the other end; step 8 checks that the property knows what kind of person it holds.

## At the end — leaving things as they were found

On the company's „Proprietăți" tab, select the row's radio and press „Dezasociază".
„Nicio proprietate asociată" follows.

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.18).** Green in the test runner's whole `npm run e2e`,
result `20260925T201927Z-23319` on `1493c18` (21 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line.** `JPERS01899` made
owner of `PROP01896`; read from the property's „Persoane"; „Vizualizare" opened
`/judicial-persons/<id>?readonly=true` with „Înapoi la listă" and „Modifică"; removed with the
radio and „Dezasociază". Only this section was written; the spec is
`e2e/association/company-property.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08).** `JPERS01716` made owner of
`PROP01713`; read from the property's „Persoane"; „Vizualizare" opened
`/judicial-persons/<id>?readonly=true`; removed with the radio and „Dezasociază". Nothing
written from the code needed correcting.
