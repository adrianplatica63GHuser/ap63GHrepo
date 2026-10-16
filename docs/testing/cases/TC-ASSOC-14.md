# TC-ASSOC-14 — Promitentul vânzător și promitentul cumpărător în „Părți" pe un Antecontract

| | |
|---|---|
| **Area** | association |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-15 |

## What this proves

Since Slice #39.57 the antecontract follows the sale contract's rule for „Părți": its parties — the links
whose role holds a share on the type, „Promitent vânzător" and „Promitent cumpărător" — stand in „Părți",
grouped under their role, the promising seller first, each with „Cotă"; „Legături" holds the rest — the
notary — and one line saying where the parties are. Unticking „Părți" brings the parties back to „Legături".
Each link has one home.

## Before you start

- TC-AUTH-01 is green.
- **No data folder.** This case makes the antecontract and the three people by hand.
- The type „Antecontract" offers the roles „Promitent vânzător" and „Promitent cumpărător", both holding a
  share, and „Notar", which does not: the dev seed creates them, and since #39.59 the reference data does.

## What Adrian is asked for

**Nothing.**

## The records this case creates

- Three natural people: „Nume" **`TC-ASSOC-14 Vanzator`**, „Prenume" **`Andrei`**; **`TC-ASSOC-14 Cumparator`**,
  **`Elena`**; **`TC-ASSOC-14 Notar`**, **`Mihai`**.
- A document: „Tip document" **„Antecontract"**, „Etichetă scurtă" **`TC-ASSOC-14 Antecontract de test`**.

All four are deleted at the end.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Creates the three people and the antecontract above; on the antecontract, „Asociază persoană", links Andrei as „Promitent vânzător", Elena as „Promitent cumpărător" and Mihai as „Notar" | Back on the antecontract each time |
| 2 | Looks at the antecontract's tiles | „Părți" is ticked. It holds the headings „Promitent vânzător" and „Promitent cumpărător", in that order, each over one person, „Nume (Rol)", with the orange „Cotă" |
| 3 | Ticks „Legături" | The notary only, „Mihai TC-ASSOC-14 Notar (Notar)", without „Cotă", and above him „Părțile actului (2) sunt în fișa „Părți”." |
| 4 | Unticks „Părți" | „Legături" holds all three people, and the line is gone |
| 5 | Ticks „Părți" again | As in steps 2 and 3 |

## At the end — leaving things as they were found

„Șterge" and **„Da"** on the antecontract („Ștergeți actul?") and on each person („Ștergeți persoana?").

## Notes from the runs

**2026-10-15 — `automated` (Slice #39.57).** Its spec, `e2e/association/antecontract-parties.spec.ts`, green in the test
runner's targeted run `20261016T014842Z-4377`, every step as written.
