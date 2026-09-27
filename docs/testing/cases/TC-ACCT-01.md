# TC-ACCT-01 — Parola contului de test schimbată și pusă la loc

| | |
|---|---|
| **Area** | account |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

A signed-in user changes their password on „Schimbă parola”, signs in with the new one, and
changes it back.

## Before you start

- **The account is `test-user`, never Adrian's.** Its password is the pair `E2E_USER_EMAIL` /
  `E2E_USER_PASSWORD` in `.env`, and TC-AUTH-02 and the e2e setup sign in with it.
- `test-user` signs in with that pair (today it does not — the TC-AUTH-02 note: it still has its
  temporary password).

## What Adrian is asked for

**He types both passwords, in every password field. Claude never types a password.** Claude opens
the screens, reads them and does everything else. Without Adrian at the desk the case is not run.

## Shared state — one password, changed and put back

- `test-user`'s password: changed to a temporary one Adrian picks, then back to the one in `.env`.
- **`.env` is never left out of step with the account.** If the run stops between the two changes,
  Adrian finishes the second one (or writes the temporary password into `.env`) before anything
  else runs, because the e2e setup and TC-AUTH-02 sign in with `.env`.
- What cannot be given back: the account's password-change time in Supabase Auth.

**If a run is abandoned:** sign in as `test-user` with whichever password is current, open „Schimbă
parola” and set the one in `.env`.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Signs in as `test-user` (Adrian types the password) | The dashboard; „Autentificat ca test-user” |
| 2 | Presses „Schimbă parola” in the sidebar | The heading „Schimbă parola”, „Introdu o parolă nouă pentru contul tău.”, „Parola nouă” with „Minimum 8 caractere.”, „Confirmă parola”, „Schimbă parola” and „Anulează”; the tab reads „Schimbă parola — GA40”, the breadcrumb „Acasă › Schimbă parola” |
| 3 | Adrian types a new password in both fields; Claude presses „Schimbă parola” | „Parola a fost schimbată!”, then the dashboard |
| 4 | „Ieșire”, then signs in with the new password (Adrian types it) | The dashboard |
| 5 | „Schimbă parola” again; Adrian types the `.env` password in both fields; „Schimbă parola” | „Parola a fost schimbată!” |
| 6 | „Ieșire”, then signs in with the `.env` password | The dashboard — `.env` and the account agree again |

## At the end — leaving things as they were found

Steps 5–6 are the cleanup, and step 6 proves it.

## Notes from the runs

(none yet — `draft`: it needs Adrian at the desk to type passwords, and `test-user` to sign in from
`.env` first; see TC-AUTH-02.)
