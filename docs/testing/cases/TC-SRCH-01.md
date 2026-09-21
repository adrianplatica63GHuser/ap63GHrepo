# TC-SRCH-01 — Cele trei obiecte găsite prin Căutare globală

| | |
|---|---|
| **Area** | search |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

One search box reaches all three kinds of record — a person, a property and a document —
and the `TC-` prefix that every case in this catalogue writes into a visible field is
enough to find everything a run left behind. That second half is what makes an abandoned
run reversible by hand.

## Before you start

- TC-PERS-01, TC-PROP-01 and TC-DOC-01 are green and their three records still exist.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Presses „Admin-Operațiuni" → „Căutare globală" | The heading „Căutare globală" and, under it, „Căutați printre toate entitățile după nume, cod, adresă sau combinând filtre…" |
| 2 | Types `TC-` into „Căutare nume / cod" (placeholder „ex. Popescu sau PERS00012") | The value appears |
| 3 | Leaves „Tip entitate" at „Orice" | No entity type is excluded |
| 4 | Presses „Caută" | „Se caută…", then a result count |
| 5 | Reads the results | Three rows: **`Ion TC-PERS-01`** („Tip" = „Persoană" — the name renders prenume-first, see TC-PERS-01), `TC-PROP-01 Teren de test` („Proprietate"), `TC-DOC-01 Contract de test` („Document") |
| 6 | Looks at the „Proveniență" column | All three read „Manual (Adaugă nou)" — they were typed in, not imported |
| 7 | Sets „Tip entitate" to „Proprietate" and presses „Caută" again | One row, the property |
| 8 | Presses „Resetează" | The filters clear |

Step 6 is worth keeping: it is the one column that distinguishes a record a case typed
in from one an import created, and it is how a cleanup tells the two apart.

## At the end — leaving things as they were found

Nothing is written by this case.

**This is also the cleanup tool for the whole catalogue.** After a run, searching `TC-`
here lists everything the run left behind, across all three kinds, in one table.

## Notes from the runs

_(not yet driven — TC-DOC-01 has to run first, and it needs the operating system's file
dialog.)_

**One correction already made from TC-PERS-01's run**, because it would have broken
step 5: a person's name renders **prenume-first** in a list, so the row reads
`Ion TC-PERS-01`.

**And one thing to check when this case is first driven**: the „Căutare nume / cod"
filter's placeholder is „ex. Popescu sau PERS00012", but natural-person codes on this
database begin `PPERS` (`PPERS01621`). Either the placeholder is stale or some other
entity carries `PERS…`. Find out before treating it as a defect.
