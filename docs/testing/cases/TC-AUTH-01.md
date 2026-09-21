# TC-AUTH-01 — Conectare și tabloul de bord

| | |
|---|---|
| **Area** | auth |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A real account can log in through the real form and reach the application. Everything
else in this catalogue starts here, so when this fails, nothing else is worth running.

## Before you start

- The dev server is running: `npm run dev`, answering on `http://localhost:3000`.
- The local Docker database `ga40prj-postgres` / `ga40db` is up.
- `.env` holds `E2E_EMAIL` and `E2E_PASSWORD` for an **already-approved** account. The
  application does not sign up from here; it logs in.
- The browser has no live session. If one screen already shows the application, use
  „Ieșire" in the sidebar footer first.

## What Adrian is asked for

Nothing, unless the dev server is not running — then: **run `npm run dev` in its own
PowerShell window.**

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens `http://localhost:3000/login` | The heading „Conectare", above two fields labelled „Utilizator sau Email" and „Parolă", and a button „Conectare" |
| 2 | Types the account's user name into „Utilizator sau Email" | The value appears in the field |
| 3 | Types the password into „Parolă" | Dots, not letters |
| 4 | Presses „Conectare" | The button reads „Se conectează…" while it works |
| 5 | Waits | The address becomes `http://localhost:3000/` and the login form is gone |
| 6 | Looks at the page | „Tablou de bord", and under it „Ce necesită atenția dumneavoastră azi" |
| 7 | Looks at the left sidebar | The sections „Persoane Fizice", „Persoane Juridice", „Proprietăți — Listă", „Proprietăți — Hartă", „Acte" |
| 8 | Looks at the sidebar footer | „Autentificat ca", and the account's name |

**Nothing is written by this case.** A failed login shows „Utilizator sau parolă
incorectă" under the form and stays on `/login`.

## At the end — leaving things as they were found

Nothing to clean up. The session cookie is the only thing created and every later case
wants it.

## Notes from the runs

_(filled in by the first run)_
