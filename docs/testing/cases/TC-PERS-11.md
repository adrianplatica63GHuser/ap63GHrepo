# TC-PERS-11 — „Decedat”: bifat, datat, refuzat înainte de naștere, debifat; vârsta se oprește la deces

| | |
|---|---|
| **Area** | person |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-14 |

## What this proves

Since Slice #39.30 a natural person can be marked dead. „Decedat” is a tick, off by default, in „Identitate” under
„Data nașterii”. „Data decesului” beside it can be filled only while it is ticked, and is optional. A dead person's
„Vârstă” is the age at death, marked „†”, and a dead person with no date has none. The date is never before the
birth and never in the future, refused in Romanian. Unticking empties the date. The lists put „†” after a dead
person's name.

## Before you start

- TC-AUTH-01 is green. The window is 1366 × 900.
- **Created through the API**, last name `TC-E2E-PERS-11`: Ion, born 01.05.1921, alive.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens Ion | „Decedat” unticked; „Data decesului” cannot be filled; „Vârstă” his age today |
| 2 | Ticks „Decedat” | „Data decesului” can be filled; „Vârstă” „—” |
| 3 | „Data decesului” 30.04.1998, „Salvează” | „Vârstă” „76 †”; saved: dead on 30.04.1998 |
| 4 | „Persoane fizice”, searches `TC-E2E-PERS-11` | „†” after Ion's name, „Decedat” on hover |
| 5 | Opens Ion, „Data decesului” 01.01.1900, „Salvează” | „„Data decesului” nu poate fi înainte de „Data nașterii”.” under the date; nothing saved |
| 6 | Unticks „Decedat”, „Salvează” | The date emptied and closed, „Vârstă” his age today; saved: alive, no date of death |

## At the end — leaving things as they were found

Ion is deleted.

## Notes from the runs

**2026-10-25 — Slice 40.72.** A saved person reads as text: steps 1 and 5 open „Identitate” with „Editează” (every field drawn), and „Salvează” is the tile's. The spec follows; not driven by hand first.
