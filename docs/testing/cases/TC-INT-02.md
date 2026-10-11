# TC-INT-02 — „Interacțiuni": un apel telefonic înregistrat de mână, fără niciun cont conectat

| | |
|---|---|
| **Area** | interactions |
| **Kind** | happy |
| **Data** | — |
| **State** | `automated` |
| **Last green** | 2026-10-10 |

## What this proves

The right-hand tile of „Interacțiuni" logs an interaction by hand, with no Gmail or WhatsApp account connected
(Slice #38.85). The „Conturi conectate" card is drawn and does nothing. The form is checked as the route checks
it: no person or no subject is outlined with its hint and takes the focus; a date in the future needs „Programată";
„Salvează" stays inert until the form is valid. A save says „Interacțiune înregistrată" and the new row flashes at
the top of the grid; „Salvează și adaugă" keeps channel, direction and person; „Renunță" asks first when something
was typed; Ctrl+S saves. A record that cannot be logged without an account, or a form that saves what the route
refuses, is the defect this case exists to catch.

## Before you start

- TC-AUTH-01 is green.
- **Created through the API** as `e2e/helpers/records.ts` creates prerequisites: a natural person, „TC-INT-02
  Dobre Irina", with no interaction.

## What Adrian is asked for

Nothing.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | (#39.06) Opens Irina's screen with `?log=new` at 1366 px | „Înregistrează o interacțiune", with no person box — the person is the screen's; her history says „Nicio interacțiune înregistrată cu această persoană." (it read: `/interactions?person=<id>`, the person box holding Irina) |
| 2 | Looks at „Conturi conectate" | Gmail and WhatsApp Business, each „Neconectat", each „Conectează" inert; „Nimic nu se trimite fără confirmare." |
| 3 | With no subject, looks at „Salvează"; clicks „Subiect" and presses Ctrl+S | „Salvează" is inert; then „Adaugă un subiect scurt. Acesta apare în istoric." and the focus on „Subiect" (#39.06: „Golește persoana" and „Alege o persoană din registru." have no box to read) |
| 4 | Chooses „Telefon" and „Primită"; types the subject „Programare vizionare" | The description's placeholder reads „Ce s-a convenit?" (#39.06: no person to find again) |
| 5 | Sets tomorrow's date; then yesterday's, and the description „S-a convenit vizionarea de joi." | „Datele viitoare sunt pentru ce e programat. …" and „Salvează" inert; then „Salvează" live |
| 6 | Presses „Salvează" | „Interacțiune înregistrată"; „Programare vizionare" is the row of her history; the subject box empty (#39.06: her history does not flash a row) |
| 7 | Chooses „Telefon" and „Primită", types „Al doilea apel", presses „Salvează și adaugă" | „Al doilea apel" above „Programare vizionare"; the form keeps „Telefon" and „Primită", the subject empty (#39.06: „and Irina" — no person box) |
| 8 | Types „Ciornă", presses „Renunță", then „Renunță la ea" | „Renunți la interacțiunea nesalvată?"; then the form clean — „E-mail", no subject |
| 9 | Types „Salvat cu tastatura" and presses Ctrl+S | „Interacțiune înregistrată"; it is her history's first row |
| 10 | — | (#39.06) Removed: the module's sticky „Înregistrează interacțiunea" went with the module's form |

## At the end — leaving things as they were found

Delete the person (`DELETE /api/people/<id>`); her interactions go with her.

## Notes from the runs

**2026-10-11 — Slice #39.06.** The log form left the module's screen (A) for the person's (C, #39.05); the case runs
on Irina's screen. What read the person box (steps 1, 3, 4, 7), the grid's flash (6) and the sticky button (10) has
nothing left to read there.

**2026-10-10 — `automated` (Slice #38.85).** `e2e/interactions/log-by-hand.spec.ts`; the test runner ran it
green. Pictures at 1366 px, empty and filled, in `playwright-report/interactions-log`, invented records only.
