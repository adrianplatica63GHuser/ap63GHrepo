# TC-ASSOC-01 — Persoană asociată actului cu rol și cotă-parte

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `confirmed` |
| **Last green** | 2026-09-22 |

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
| 2 | Presses the tab **„Persoane"** — it sits beside „Asocieri", not inside it | „Nicio persoană asociată acestui act", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere persoană" at `/documents/[id]/associate-person`, the document's title under it, the filters „Nume" (placeholder „Nume…") and „Cod" („Cod…"), a table Cod · Nume · Tip, and below it a select „Rol" with the placeholder „— fără rol —" |
| 4 | Types `TC-PERS-01` into „Nume" | One row: `PPERS…`, `Ion TC-PERS-01`, „Tip" = „Fizică" |
| 5 | Chooses **„Cumpărător"** in „Rol" | The role is selected. On a Contract de Vânzare the select offers „Cumpărător", „Moștenitor / Succesor", „Notar", „Reprezentant legal / Mandatar" and „Vânzător" |
| 6 | Ticks the row for `Ion TC-PERS-01` | The row is selected |
| 7 | Presses „Asociază selecția" | The screen returns to the document, on its „Persoane" tab |
| 8 | Looks at „Persoane" | A table headed Nume · Rol · Cotă-parte · Suprafață echivalentă (mp) · Mod de deținere — there is no „Cod" column — and one row: `Ion TC-PERS-01`, „Rol" = „Cumpărător" |
| 9 | Types `50%` into that row's „Cotă-parte" and leaves the field | The value is saved and the cell then reads `50` — the percent sign is accepted and not kept |
| 10 | Chooses „indiviziune" in that row's **„Mod de deținere"** — an inline select on the same row, offering „— nespecificat —", „în nume propriu", „devălmășie", „indiviziune", „prin mandatar" | The qualifier is recorded beside the share, and is still there after a reload |
| 11 | Reads the one line under the table | „Cotele pentru „Cumpărător" însumează 50%, nu 100%. Actul se salvează oricum — verificați ce scrie în act." **While the total is off there is no separate „Total Cumpărător: 50%" line** — the warning replaces it |
| 12 | Changes the cotă-parte to `100%` — click into the cell, select its text with the keyboard (Ctrl+A), type, and leave the field | The warning is replaced by „Total Cumpărător: 100%" |

Step 11 is the assertion that matters most: the application **warns and saves anyway**.
A version that refused the save would be wrong — a deed can say whatever it says, and
the archive records it.

⚠️ **Do not double-click anywhere on a person row, including inside „Cotă-parte" to
select its text.** The row opens the person on double-click
(`document-persons-tab.tsx`), and the editable cells stop a single click from reaching
the row but not a double one — a triple-click to select `50` and overtype it left the
document for `/natural-persons/[id]?readonly=true` on 2026-09-22. That is why step 12
says Ctrl+A. Noted in the 36.05 handover as a defect.

**If „Rol" is missing and the screen says „Acest tip de document nu are niciun rol de
persoană configurat, așa că nu se poate alege un rol aici. …"**, that is the finding
this case is designed to raise, not a step to work around: „Cumpărător" is seeded
(`migration_013`) and wired to Contract de Vânzare (`migration_014`), so its absence
means the reference data on that database has drifted. **Where to look:** the pairs
„this document type accepts this role" are not on the „Roluri Persoană" list, which has
no document column by design (`migration_079`: a role can be valid on one type and not
another). They are under **Date de referință → Tipuri de Document → „Roluri pe
Document"** (English: Document Types → „Document Persons"). Re-running
`migration_014_doc_type_person_role.sql` restores the seeded pairs without touching
anything else. (This file used to quote „Rolul „{roleName}" nu este configurat încă
pentru acest tip de document." here. That message is real, but it belongs to the flow
that links a person read from the document by AI — `roleMissingBody` — and never
appears on this screen.)

## At the end — leaving things as they were found

**Select the row first** — its radio button at the left — and then press „Dezasociază";
the button is disabled while no row is selected. „Nicio persoană asociată acestui act"
follows. The person and the document are left for the cases that follow; only the link
is removed.

## Notes from the runs

**2026-09-23 — the spec found a misspelling every hand run had read past (Slice #36.06).**
Step 7's button said **„Asociează selecția"** on screen — `document.associatePerson.associate`
in `messages/ro-RO.json`, misspelt since Slice #5.4 — while every other association screen,
and this file, say „Asociază selecția". The spec, matching this file's word, never found the
button, six runs running. The hand runs had reported the step as held: the driving tool's
element search answers in the words it is asked for, so it „found" „Asociază". The message
file is corrected, not this file — the case had the right word, which is why only this
section changes and the row stays `confirmed`.

**2026-09-22, third run (Slice #36.06) — `confirmed`: the file as it stood held line for
line.** `PPERS01630` associated to `DOC01631` as „Cumpărător", out of the same five roles;
`50%` stored as `50` with „Cotele pentru „Cumpărător” însumează 50%, nu 100%. …" and no
separate total; „indiviziune" set inline; both still there after a reload; `100%` by
click, Ctrl+A, type and Tab turned the line into „Total Cumpărător: 100%"; the link removed
with the radio and „Dezasociază", which asks for no confirmation. Only this section was
written on this run. One thing that was the driving tool and not the case: the first
Ctrl+A in step 12 went to a cell reference the tool had read before the tab re-rendered,
so nothing was typed; pressing the cell by its position on screen worked at once.

**2026-09-22, second run — driven, green, every step.** After Adrian re-ran
`migration_014` on the local database (`INSERT 0 69`: 69 of its 75 pairs; the other six
name a type or role that has since been renamed, mostly the five „Autorizare" pairs, now
„Autorizație"), „Rol" appeared with five roles on a Contract de Vânzare. `PPERS01627` was
associated to `DOC01628` as „Cumpărător"; `50%` was stored as `50` and raised „Cotele
pentru „Cumpărător" însumează 50%, nu 100%. …"; „indiviziune" was set inline; `100%`
turned the line into „Total Cumpărător: 100%"; all three survived a reload; the link was
removed with the radio and „Dezasociază". The steps were rewritten only to take out the
„(not yet seen)" markers the first run had left, and to say Ctrl+A in step 12 — every
expected result the first run predicted held. This is the case's first green run, so
it is `driven`; the next unchanged run confirms it.

**2026-09-22, first run — driven, NOT green, so the row stayed at `draft`.** `PPERS01623` was
associated to `DOC01624`, the share and the qualifier were set and read back, and the
link was removed — all without a role, because the „Rol" control was not there. In its
place the screen said the type has no person roles configured. `GET
/api/documents/<id>/valid-person-roles` answered `{"items":[]}` and `GET
/api/admin/doc-type-person-roles/distinct-roles` answered `{"items":[]}` too: on Adrian's
local database **`lookup_doc_type_person_role` is empty for every type**, not just this
one. The application behaved correctly for what it was given; the data is what is wrong.
The 36.05 handover carries it.

**The question this case shipped with is settled: „Mod de deținere" IS an inline cell on
the person row**, a select beside „Cotă-parte" and a „Suprafață echivalentă (mp)" field
nobody had mentioned. The per-role line is not two lines but one, which is either the
warning or the total, never both.

Other corrections: „Persoane" is a top-level tab, not „Asocieri" → „Persoane"; the
table has no „Cod" column; the cotă-parte cell drops the `%`; „Dezasociază" needs the
row's radio first.

**What the next run has to see before this reaches `driven`:** step 3's „Rol" select,
step 5, and the role name in steps 8, 11 and 12 — all of which wait on the reference
data, and nothing else. (All of it was seen on the second run, above.)

_(Earlier, without a run: a person's name renders **prenume-first**, from TC-PERS-01's
first run; and the subject-matter answer above replaced the open question the case
shipped with.)_
