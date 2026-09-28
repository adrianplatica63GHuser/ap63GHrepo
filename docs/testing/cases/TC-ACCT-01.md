# TC-ACCT-01 — Parola contului de test schimbată și pusă la loc

| | |
|---|---|
| **Area** | account |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-28 |

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

**2026-09-28 — step 6 GREEN; the case is `driven` (Slice #37.10).** Why step 6 had stayed red: the
runner's setup now logs its reason, and the auth service answered its `.env` pair `400
invalid_credentials` — the password Adrian set on the screen and the one in `.env` were not the
same bytes (`.env` had last been saved before the screen's change). Adrian set a new password of
letters and digits only on „Schimbă parola" and saved the same text in `C:\dev\ga40prj\.env`; the
runner's e2e `20260928T132319Z-27024` then logged „the auth service answered 200" and the `user`
setup (TC-AUTH-02) passed. `.env` and the account agree. (That request's admin setup lost a cold
compile, FU-105; the user half is what this step asks.)

**The lesson for the next run, written into the steps' spirit:** whatever password goes into the
two fields of step 5 is **copied from `.env`, or typed into `.env` in the same breath** — the case
exists because the two drift apart silently.

**2026-09-27, 10:14–16:32 — driven once; steps 1–5 held, step 6 RED (Slice #37.10), Adrian typing every password.**
After Adrian reset test-user in the Supabase dashboard (FU-252), the runner's e2e
`20260927T134015Z-25279` signed in with the `.env` pair (the `user` setup no longer skipped).
- Step 1 held. Claude typed „test-user", Adrian typed the `.env` password: the dashboard. It reads
  „Autentificat ca" followed by the account's **email**, not „test-user" as the step says. The
  sidebar shows the email for this account, so the step's expectation is corrected here, not in
  the app.
- Step 2 held word for word: the heading, „Introdu o parolă nouă pentru contul tău.", „Parola
  nouă" with „Minimum 8 caractere.", „Confirmă parola", both buttons, the tab „Schimbă parola —
  GA40" and the breadcrumb „Acasă › Schimbă parola". The first open compiled the route cold and
  took about 30 s; the address went there directly.
- Step 3: Adrian pressed „Schimbă parola" himself, rather than Claude, and the screen went back to
  the dashboard. „Parola a fost schimbată!" was not read: it shows only briefly before the
  redirect.
- Step 4 held: „Ieșire", then test-user with the temporary password, the dashboard.
- Step 5 held: the `.env` password in both fields, „Schimbă parola", the dashboard.
- Step 6: Claude pressed „Ieșire". The sign-in with the `.env` password was then asked of the
  runner's e2e, which signs in from `.env`: `20260927T204619Z-27712` (`e2e/auth/login-dashboard.spec.ts`)
  passed 3 and **skipped** the `user` setup — the pair no longer signs in (or no longer as role
  `user`), where `20260927T134015Z-25279` that morning had signed in. `.env` was last saved at
  11:03 local, between the two. So `.env` and the account disagree again, which is what this case
  exists to catch; the case stays `draft` until one of them is set to the other and a run of the
  setup signs in. (An earlier request, `20260927T203321Z-2320`, lost its setup to a cold compile.)
  The screen changes the password in Supabase directly; nothing else needs updating there.

Seen on the way: „RECENTE" in the sidebar is kept in the browser, not per account. Signed in as
test-user, it listed the admin's recently opened properties, including the TC-ASSOC-08 properties
deleted this morning through the API (FU-228 forgets a record only when it is deleted from the
screen). Filed as FU-253.

**2026-09-27 — attempted with Adrian at the desk (Slice #37.10), stopped at step 1.** Claude typed
„test-user" in „Utilizator sau Email" (it resolves, through `/api/auth/lookup-email`, to the same
email as `E2E_USER_EMAIL` — compared by hash, the value not read); Adrian typed the `.env` password,
then the account's old one. Both answered „Utilizator sau parolă incorectă", so the account's
password is neither. The app has no way back in — no „forgot password" link and no admin reset
(FU-252) — so it is reset in the Supabase dashboard, which is Adrian's. The case stays `draft`.

(Before that: none — `draft`: it needs Adrian at the desk to type passwords, and `test-user` to sign in from
`.env` first; see TC-AUTH-02.)
