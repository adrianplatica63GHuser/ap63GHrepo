# TC-ASSOC-01 — Persoană asociată actului cu rol și cotă-parte

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A person can be attached to a document under a role, given a cotă-parte, and the screen
adds the shares up per role. The per-role total is the business rule here: shares under
one role are expected to reach 100%, and the application **says so without refusing the
save**.

## Before you start

- TC-PERS-01 is green — `TC-PERS-01 Ion` exists.
- TC-DOC-01 is green — `TC-DOC-01 Contract de test` exists.

## What Adrian is asked for

**Nothing. The one question this case had was answered on 2026-09-21 and the answer is
below**, which is what a case file is for — the next person to run this does not have to
ask again.

### The answer, and what it means on screen

> **Inside the contract itself, keep the standard label — Purchaser / „Cumpărător" — and
> add a short qualifier that they already own a share. A notary writes `50%`.**
> — Adrian, 2026-09-21

Two consequences for the steps:

- **The role is „Cumpărător"**, not a special one. It is a seeded role
  (`src/db/migration_013_person_roles.sql`, with the hint „(Dobânditor)"), and
  `migration_014_doc_type_person_role.sql` offers it on a Contract de Vânzare. A buyer
  who already holds a share is still a buyer; the deed does not rename them.
- **The qualifier is a separate column, not a second role.** The screen's place for it is
  **„Mod de deținere"** — the values are „în nume propriu", „devălmășie",
  „indiviziune" and „prin mandatar" (`document.persons.cotaMod.*`). „Indiviziune" is the
  one that records an undivided share, so that is what this case sets. Do **not** reach
  for „Coproprietar" as the role: it exists (`migration_013`, „(în cazuri de
  indiviziune)"), and using it here would say the person's part in the deed was
  co-ownership rather than purchase.
- **The cotă-parte is written `50%`**, with the percent sign, because that is what the
  paperwork says. The field also accepts `50`, `63,64` and `1/2` — its own error message
  offers all three shapes — but the case types what a notary types.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `TC-DOC-01 Contract de test` | The document's detail screen |
| 2 | Presses the tab „Asocieri", then „Persoane" | „Nicio persoană asociată acestui act" |
| 3 | Presses „Asociază" | The heading „Asociere persoană", with fields „Nume", „Cod" and „Rol" |
| 4 | Types `TC-PERS-01` into „Nume" | The results table fills; one row, „Tip" = „Fizică" |
| 5 | Chooses **„Cumpărător"** in „Rol" (placeholder „— fără rol —") | The role is selected |
| 6 | Ticks the row for `TC-PERS-01 Ion` | The row is selected |
| 7 | Presses „Asociază selecția" | The button reads „Se asociază…", then the screen returns to the document |
| 8 | Looks at „Persoane" | A row: „Cod", „Nume" = `Ion TC-PERS-01` (prenume first — see TC-PERS-01), „Rol" = „Cumpărător" |
| 9 | Types `50%` into that row's „Cotă-parte" | „Se salvează…" appears briefly |
| 10 | Sets „Mod de deținere" on that row to „indiviziune" | The qualifier is recorded beside the share |
| 11 | Looks under the table | „Total Cumpărător: 50%" |
| 12 | Reads the warning beside it | „Cotele pentru „Cumpărător" însumează 50%, nu 100%. Actul se salvează oricum — verificați ce scrie în act." |
| 13 | Changes the cotă-parte to `100%` | The total becomes „Total Cumpărător: 100%" and the warning is gone |

Step 12 is the assertion that matters most: the application **warns and saves anyway**.
A version that refused the save would be wrong — a deed can say whatever it says, and
the archive records it.

**If „Cumpărător" is not offered in „Rol"**, the screen says so itself — „Rolul
„{roleName}" nu este configurat încă pentru acest tip de document." That is a finding,
not a step to work around: the role is seeded and wired to this document type, so its
absence means the reference data on that database has drifted.

## At the end — leaving things as they were found

Press „Dezasociază" on the row. „Se elimină…" appears, then „Nicio persoană asociată
acestui act". The person and the document are left for the cases that follow; only the
link is removed.

## Notes from the runs

_(not yet driven — TC-DOC-01 has to run first, and it needs the operating system's file
dialog.)_

**Two things already corrected without a run**, both from TC-PERS-01's first run, because
they would have failed step 8 on sight: a person's name renders **prenume-first**, and
the subject-matter answer above has replaced the open question the case shipped with.

**What to watch for on the first real run.** The three-part shape of step 9-10 —
cotă-parte, „Mod de deținere", and the per-role total underneath — is read from
`messages/ro-RO.json` and has never been seen working together. The most likely
correction is that „Mod de deținere" is not an inline cell on the row but lives
somewhere else on the screen.
