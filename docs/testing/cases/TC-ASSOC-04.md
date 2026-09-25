# TC-ASSOC-04 — Persoană asociată proprietății, cu rol, văzută din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-09-25 |

## What this proves

A person can be attached to a property under a role **from either end** — from the
property's „Persoane" tab and from the person's „Proprietăți" tab — and each time the link and
its role are visible from the other end. It drives both association screens between people
and properties.

## Before you start

- TC-PROP-01 is green — `TC-PROP-01 Teren de test` exists.
- TC-PERS-01 is green — `Ion TC-PERS-01` exists.

## What Adrian is asked for

**Nothing — the role was a choice, and it is recorded here so it can be overturned in one
line.** A person on a property takes a role from a closed list which, on this database,
offers four: „Coproprietari / Coindivizari", „Cumpărător", „Proprietar / Titular de drept
real", „Titular de drept". The case uses **„Proprietar / Titular de drept real"**: it is the
wording a notary uses for the holder of the right of ownership in the land book. „Cumpărător"
describes a party to a sale, which belongs on the contract (TC-ASSOC-01), not on the land;
„Coproprietari / Coindivizari" is for a share, which this case does not model.

## Steps

**From the property's end**

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-PROP-01 Teren de test` from „Proprietăți — Listă" | The property's screen, tabs DETALII · ASOCIERI · PERSOANE · ACTE · META INFO |
| 2 | Presses the tab **„Persoane"** | „Nicio persoană asociată acestei proprietăți", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere persoană" at `/properties/[id]/associate-person`, the property's name under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Cod · Nume · Tip listing natural **and** judicial persons, and a select „Rol" with „— fără rol —" and the four roles above |
| 4 | Types `TC-PERS-01` into „Nume" | One row: `PPERS…`, `Ion TC-PERS-01`, „Tip" = „Fizică" |
| 5 | Ticks the row, then chooses **„Proprietar / Titular de drept real"** in „Rol" | Both are selected |
| 6 | Presses „Asociază selecția" | Back on the property's „Persoane" tab (`?tab=persons`): a table **Nume · Rol** — no cotă-parte here — with `Ion TC-PERS-01`, „Proprietar / Titular de drept real", „Vizualizare" |
| 7 | Opens `Ion TC-PERS-01` and presses its tab **„Proprietăți"** | A table Denumire · Rol with `TC-PROP-01 Teren de test`, „Proprietar / Titular de drept real" |

**Undo, then from the person's end**

| # | A person does | And sees |
|---|---|---|
| 8 | On the person's „Proprietăți", selects the row's radio and presses „Dezasociază" | „Nicio proprietate asociată" |
| 9 | Presses „Asociază" | „Asociere proprietate" at `/natural-persons/[id]/associate-property`, one filter „Căutare" („Cod sau denumire…"), a table Cod · Denumire listing every property, and the same „Rol" with the same four roles |
| 10 | Types `TC-PROP-01` into „Căutare", ticks the one row, chooses „Proprietar / Titular de drept real" | Both are selected |
| 11 | Presses „Asociază selecția" | Back on the person's „Proprietăți" (`?tab=properties`), one row with the role |
| 12 | Presses „Vizualizare" on that row, then the property's tab „Persoane" | The property opened **read-only**, and its „Persoane" table reads `Ion TC-PERS-01`, „Proprietar / Titular de drept real" |

Steps 7 and 12 are the other ends, one per direction.

## At the end — leaving things as they were found

On the property's „Persoane" tab (read-only or not — „Dezasociază" works on both), select the
row's radio and press „Dezasociază". „Nicio persoană asociată acestei proprietăți" follows.

## Notes from the runs

**2026-09-25 (Slice #36.18) — `confirmed`: the file held line for line.** `PROP01896` and
`PPERS01897`, linked from the property's end and read from the person's, undone, linked from the
person's end and read — read-only — from the property's; removed with the radio and
„Dezasociază". Only this section was written; the spec is
`e2e/association/property-person.spec.ts`.

**2026-09-23 — driven for the first time, green (Slice #36.08).** `PROP01713` and
`PPERS01714`, linked from each end in turn, each time read from the other; removed with the
radio and „Dezasociază".

Corrections to what was written from the code before the run: the property's „Persoane"
table is **Nume · Rol only** — the cotă-parte and „Mod de deținere" columns exist on a
document's „Persoane" tab, not on a property's; and the property-side screen lists
**companies as well as people** (`JPERS…` rows, „Tip" = „Juridică"), so the name filter is
what keeps step 4 to one row.
