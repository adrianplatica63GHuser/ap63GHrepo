# TC-VL-01 — O valoare adăugată în „Date de referință”, redenumită și ștearsă

| | |
|---|---|
| **Area** | reference-data |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-27 |

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
| 2 | Presses „Cetățenie” | A panel „Cetățenie” with „✕”, „+ Adaugă”, „8 înregistrări” and a DENUMIRE column: Română, Moldoveană, Americană, Germană, Franceză, Italiană, Spaniolă, Engleză, each with „Editează” and „Șterge” |
| 3 | „+ Adaugă” — „Adaugă înregistrare nouă”, „Denumire*”, „Salvează”, „Anulează” — types `TC-VL-01 Cetățenie de test`, „Salvează” | „9 înregistrări”; the new value is the **last** row, after Engleză |
| 4 | „Editează” on it — „Editează înregistrarea”, the name in „Denumire*” — changes it to `TC-VL-01 Cetățenie redenumită`, „Salvează” | The row reads the new name, still last |
| 5 | „Șterge” on it | „Ștergeți „TC-VL-01 Cetățenie redenumită”?”, first „Se verifică ce depinde de această înregistrare…”, then „Nimic nu depinde de această înregistrare. La ștergere dispare definitiv — acțiunea nu poate fi anulată.” and a note on version history; „Șterge” and „Anulează” |
| 6 | Presses „Șterge” | „8 înregistrări”; the value is gone |

## At the end — leaving things as they were found

Steps 5–6 are the cleanup.

## Notes from the runs

**2026-09-27 — driven for the first time, green (Slice #37.08).** Added last (its stored position
was 18: the list's largest, 8, plus 10 — FU-056), renamed in place, deleted after the dependency
check found nothing; the list read the same eight values afterwards and the API had no `TC-VL-01`
row.

Corrections to the file: the list's eight values and the panel's words; the delete is a confirmation
with its own dependency check, now step 5, and the delete itself step 6. The check took a while on
the first press — its route's first compile — and said „Se verifică…” until it answered.

**One finding, not a step (FU-248):** the add/edit form's „Denumire” box has no accessible name (the
label is not tied to it).
