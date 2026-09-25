# TC-ASSOC-09 — Două persoane corelate, citite la fel din ambele capete

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-09-25 |

## What this proves

Two people can be linked to each other from one person's screen, and the link is then visible
from **both** people — each lists the other. It asks of person↔person links the question
TC-ASSOC-07 asks of document↔document ones.

**How this family encodes direction — it does not, and today it offers no role.**
`person_person` stores the pair in uuid order and an optional role from `lookup_person_role`,
and no direction flag; and on this database no role carries „Valabil pentru persoană", so the
screen offers no „Tip relație" at all and the link is made without one. A link with no role reads
the same from both ends, so **this case asserts symmetric reading**; the day a directional role
(„Moștenitor", „Mandatar") is ticked for people, it meets TC-ASSOC-08's defect (FU-221).

## Before you start

- TC-AUTH-01 is green. Nothing else: the case creates both its people.

## What Adrian is asked for

Nothing.

## The records this case creates

Two natural persons, typed by hand, no CNP: „Nume" **`TC-ASSOC-09`**, „Prenume" **`Ana`** and
**`Mihai`** — listed as `Ana TC-ASSOC-09` and `Mihai TC-ASSOC-09`.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates both people: „Persoane Fizice" → „Adaugă persoană", types „Nume" and „Prenume", „Salvează" | Two rows badged „Nou!", codes beginning `PPERS` |
| 2 | Opens `Ana TC-ASSOC-09`, tab **„Asocieri"** | „Nicio persoană corelată", with „Asociază" and „Dezasociază" |
| 3 | Presses „Asociază" | „Asociere persoană corelată" at `/natural-persons/[id]/associate-person`, the person's name under it, the filters „Nume" („Nume…") and „Cod" („Cod…"), a table Cod · Nume · Tip listing every other person, the hint „Selectați cel puțin o persoană", and **no „Tip relație"** |
| 4 | Ticks `Mihai TC-ASSOC-09` | The hint goes away |
| 5 | Presses „Asociază selecția" | Back on Ana's „Asocieri" (`?tab=related`): a table Nume · Tip · Tip relație, one row — `Mihai TC-ASSOC-09`, „Fizică", „—", „Vizualizare" |
| 6 | Opens `Mihai TC-ASSOC-09`, tab „Asocieri" | One row — `Ana TC-ASSOC-09`, „Fizică", „—" |

Step 6 is the other end: the link is there from both people, and with no role it says the same
thing from each.

## At the end — leaving things as they were found

On either person's „Asocieri", select the row's radio and press „Dezasociază" — „Nicio persoană
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
