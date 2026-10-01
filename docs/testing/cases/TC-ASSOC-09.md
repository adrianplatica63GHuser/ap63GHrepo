# TC-ASSOC-09 — Două persoane corelate, citite corect din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

Two people can be linked to each other from one person's screen with a **directional** role, and
the link then reads correctly from **both** people: each lists the other beside the word that is
*that* person's — the role on one end, its converse on the other, in the gender of the person
shown. It asks of person↔person links the question TC-ASSOC-07 asks of document↔document ones and
TC-ASSOC-08 of property↔property ones.

**How this family encodes direction (Slice #37.28).** `person_person` stores the pair in uuid
order, an optional role from `lookup_person_role`, and since migration_088 `role_reads_a_to_b`,
saying which of the two holds the role. On „Asociere persoană corelată" the role is the **ticked**
person's, towards the person whose screen it is — the sentence under „Tip relație" says so. The
other end shows the role's converse, stored on the role itself (Date de referință → Roluri
Persoană → „Rol invers", „— bărbat", „— femeie"): the converse of „Părinte" is „Fiu" for a man,
„Fiică" for a woman, and „Copil" when the gender is not set. Before #37.28 both ends showed the
same word (FU-221), so this case picked no role.

## Before you start

- TC-AUTH-01 is green. Nothing else: the case creates both its people.

## What Adrian is asked for

Nothing.

## The records this case creates

Two natural persons, typed by hand, no CNP: „Nume" **`TC-ASSOC-09`**, „Prenume" **`Ana`** with
„Gen" **Feminin**, and **`Mihai`** with „Gen" **Masculin** — listed as `Ana TC-ASSOC-09` and
`Mihai TC-ASSOC-09`. Mihai is Ana's father.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates both people: „Persoane Fizice" → „Adaugă persoană", types „Nume", „Prenume", chooses „Gen", „Salvează" | Two rows badged „Nou!", codes beginning `PPERS` |
| 2 | Opens `Ana TC-ASSOC-09`, tile **„Persoane"** | „Nicio persoană corelată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere persoană corelată" at `/natural-persons/[id]/associate-person`, the person's name under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Cod · Nume · Tip listing every other person, the hint „Selectați cel puțin o persoană", **„Tip relație"** offering Soț, Soție, Părinte, Fiu, Fiică, Frate, Soră, and beside it „Rolul pe care persoana bifată îl are față de Ana TC-ASSOC-09." |
| 4 | Ticks `Mihai TC-ASSOC-09`, chooses „Tip relație" **„Părinte"** | The hint goes away |
| 5 | Presses „Asociază selecția" | Back on Ana's „Persoane" (`?tab=related`): a table Nume · Tip relație, one row — `Mihai TC-ASSOC-09`, **„Părinte"**, „Vizualizare" |
| 6 | Opens `Mihai TC-ASSOC-09`, tile „Persoane" | One row — `Ana TC-ASSOC-09`, **„Fiică"** (not „Părinte") |

Step 6 is the other end: Mihai is Ana's „Părinte", so Ana is Mihai's „Fiică".

## At the end — leaving things as they were found

On either person's „Persoane", select the row's radio and press „Dezasociază" — „Nicio persoană
corelată". Then delete both people: open each, „Șterge" at the bottom of the form, „Da".

## Notes from the runs

**2026-09-25 — `automated` (Slice #36.19).** Green in the test runner's whole `npm run e2e`,
result `20260925T205914Z-28808` on `7195b77` (23 tests); the spec is named in the catalogue's `Spec` column.

**2026-09-25, second run (Slice #36.19) — `confirmed`: the file held line for line.**
`PPERS01981` (Ana) and `PPERS01982` (Mihai), both typed in; Ana's „Asociere persoană corelată"
showed Mihai alone, no „Tip relație", the hint gone on the tick; each end read the other with
„—". Removed with the radio and „Dezasociază" from Mihai's end, then „Șterge" and „Da" on
each. Only this section was written.

**2026-09-25 — driven for the first time, green (Slice #36.19).** `PPERS01979` (Ana) linked to
`PPERS01980` (Mihai) from Ana's screen; each read the other with „—". Written from the code and
corrected by the run in one place: the „Tip relație" select is not disabled or empty, it is
**absent** — `associate-person-view.tsx` renders it only when there is a role to offer, and
says nothing when there is none (FU-221). Removed with the radio and „Dezasociază", then both
people through `DELETE /api/people/[id]`, the route „Șterge" → „Da" calls.
