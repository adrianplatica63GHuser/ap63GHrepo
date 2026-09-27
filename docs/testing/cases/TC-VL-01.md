# TC-VL-01 — O valoare adăugată în „Date de referință”, redenumită și ștearsă

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A value added to a list under „Date de referință” appears in it — after the values already there —
can be renamed, and can be deleted when nothing uses it.

## Before you start

- TC-AUTH-01 is green.

## What Adrian is asked for

Nothing.

## Shared state — one `TC-` value on a list no case reads

- List: **„Cetățenie”** (Persoană). No case selects a citizenship, so a value that is there for a
  minute disturbs no run in progress.
- Value: `TC-VL-01 Cetățenie de test`, renamed to `TC-VL-01 Cetățenie redenumită`.
- The delete is a real delete — the row is gone, nothing is left in the list.

What cannot be given back: nothing on the list; the rows around it keep their positions. (A new
value is placed after the others since Slice #37.07, FU-056.)

**If a run is abandoned:** open „Date de referință” → „Cetățenie” and „Șterge” every value that
starts with `TC-VL-01`.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Admin-Configurare” → „Date de referință” | Sections PROPRIETATE, PERSOANĂ, DOCUMENT, ROLURI, RELAȚIE ÎNTRE OBIECTE, each with its lists |
| 2 | Presses „Cetățenie” | A panel „Cetățenie” with „+ Adaugă”, „N înregistrări” and one row per value, each with „Editează” and „Șterge” |
| 3 | „+ Adaugă”, types `TC-VL-01 Cetățenie de test`, saves | N+1 înregistrări; the new value is the **last** row |
| 4 | „Editează” on it, changes it to `TC-VL-01 Cetățenie redenumită`, saves | The row reads the new name, in the same place |
| 5 | „Șterge” on it, confirms | N înregistrări; the value is gone |

## At the end — leaving things as they were found

Step 5 is the cleanup.

## Notes from the runs

(none yet)
