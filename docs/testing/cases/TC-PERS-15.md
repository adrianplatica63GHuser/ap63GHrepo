# TC-PERS-15 — Persoana fizică citită ca text; „Editează” pe o dală, „Salvează” o versiune, „Renunță”

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-25 |

## What this proves

Since Slice 40.72 a saved natural person's form tiles read as text. Each label is small and muted above its value,
the birth date is written with the age beside it („15.06.1985 (41 de ani)"), and „Editează" sits in each tile's
corner. „Editează" turns only that tile into its form, outlined in blue, with „Salvează" and „Renunță" under it.
„Salvează" saves that tile's fields and makes one version, and „Renunță" puts the tile back. One tile is open at a
time: opening another while the open one has changes asks first (Salvează, Renunță, Anulează). Esc is „Renunță".
The record has no Save of its own any more. A new person is still one form with one Save (TC-PERS-01).

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites, all invented: a natural person,
  „Nume" `TC-PERS-15`, „Prenume" `Citit`, „Data nașterii" `15.06.1985`, „Telefon Personal 2" `0700 000 015`.

## What Adrian is asked for

Nothing.

## Steps

The window is 1366 × 900.

| # | A person does | And sees |
|---|---|---|
| 1 | Opens the person | No box in „Identitate" or „Contact": the values as text, „Data nașterii" reading `15.06.1985 (41 de ani)` (the age today). „Editează" in each tile's corner, and no „Salvează" for the record |
| 2 | Presses „Editează" on „Contact" | „Contact" outlined in blue with its six boxes, the cursor in „Telefon Personal 1"; „Salvează" and „Renunță" under them. „Identitate" still reads as text |
| 3 | Writes `021 000 0015` in „Telefon serviciu" and presses „Salvează" | „Contact" reads as text again, with the new phone; the person has one version more; only the phone changed |
| 4 | Presses „Editează" on „Identitate", writes `Schimbat` in „Poreclă", presses „Renunță" | „Identitate" reads as text, without „Schimbat"; no new version |
| 5 | Again writes `Schimbat` in „Poreclă", then presses „Editează" on „Contact": first „Anulează", then again and „Renunță" | „Modificări nesalvate" asks. „Anulează" leaves „Identitate" open with „Schimbat". „Renunță" opens „Contact", and „Identitate" reads as it was |
| 6 | With nothing changed in „Contact", presses Esc | „Contact" reads as text; still one version more than at step 1 |

## At the end — leaving things as they were found

Delete the person (`DELETE /api/people/<id>`).

## Notes from the runs

**2026-10-25 — written with Slice 40.72.** Written from the slice's own change and translated at once into
`e2e/person/read-view.spec.ts`; not driven by hand first.
