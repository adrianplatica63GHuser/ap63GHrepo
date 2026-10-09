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
| 1 | Opens „Domeniu” → „Date de referință” | On the left the categories „Tipuri de obiecte”, „Roluri și legături”, „Liste de valori”, each with its lists (#38.61; was „Proprietăți”, „Persoane”, „Acte”, „Roluri”, „Legături între obiecte”); on the right „Alegeți o listă din stânga.” |
| 2 | Presses „Cetățenie” | The list „Cetățenie” opens on the right (the address reads `?list=citizenships`), with „+ Adaugă”, „8 înregistrări” and a DENUMIRE column: Română, Moldoveană, Americană, Germană, Franceză, Italiană, Spaniolă, Engleză, each with „N obiecte” (#38.59; was „folosit de …”), „Editează”, „Unește” and „Șterge” |
| 3 | „+ Adaugă” — „Adaugă înregistrare nouă”, „Denumire*”, „Salvează”, „Anulează” — types `TC-VL-01 Cetățenie de test`, „Salvează” | „9 înregistrări”; the new value is the **last** row, after Engleză |
| 4 | „Editează” on it — „Editează înregistrarea”, the name in „Denumire*” — changes it to `TC-VL-01 Cetățenie redenumită`, „Salvează” | The row reads the new name, still last |
| 5 | „Șterge” on it | „Ștergeți „TC-VL-01 Cetățenie redenumită”?”, first „Se verifică ce depinde de această înregistrare…”, then „Nimic nu depinde de această înregistrare. La ștergere dispare definitiv — acțiunea nu poate fi anulată.” and a note on version history; „Șterge” and „Anulează” |
| 6 | Presses „Șterge” | „8 înregistrări”; the value is gone |

## At the end — leaving things as they were found

Steps 5–6 are the cleanup.

## Notes from the runs

**2026-10-08 — Slice #38.35.** „Date de referință” is one page: the categories on the left, the list
on the right, no dialog and no „✕”. Steps 1–2 read the page as it is now; the steps on the list are
unchanged. Not re-run; the case stays `driven`.

**2026-09-27 — driven for the first time, green (Slice #37.08).** Added last (its stored position
was 18: the list's largest, 8, plus 10 — FU-056), renamed in place, deleted after the dependency
check found nothing; the list read the same eight values afterwards and the API had no `TC-VL-01`
row.

Corrections to the file: the list's eight values and the panel's words; the delete is a confirmation
with its own dependency check, now step 5, and the delete itself step 6. The check took a while on
the first press — its route's first compile — and said „Se verifică…” until it answered.

**One finding, not a step (FU-248):** the add/edit form's „Denumire” box has no accessible name (the
label is not tied to it).

**2026-10-01 — the editors' widths (Slice #37.37), by a throwaway Playwright script through the
test runner (e2e 20261001T044915Z-14475), deleted after; nothing saved.** It opened „Tipuri de
Proprietate", „Roluri Persoană" and „Tipuri de Document", then „Roluri pe Document", then
„Formular" on „Contract de Vânzare", and read each card at 1366, 1920 and 2560 px. Every value
list's card was the same width (1,296 px, 8 units) at all three widths and on all three lists;
„Roluri pe Document" was 968 px (6 units); the Form editor 1,624 px (10 units) at 1920 and 2560,
and the window's width at 1366, where its table scrolls with the dialog. No fixed column's cell
was wider than its column. The steps above were not re-run; the case stays `driven`.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Domeniu" → „Date de referință". The screen and every step on it are unchanged, and the spec follows (`e2e/helpers/sidebar.ts` opens the section that holds an item).
