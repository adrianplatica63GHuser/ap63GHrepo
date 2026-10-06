# TC-USERS-01 — O cerere de acces respinsă, citită în „Istoric”

| | |
|---|---|
| **Area** | users |
| **Kind** | happy |
| **Data** | — |
| **State** | `driven` |
| **Last green** | 2026-09-27 |

## What this proves

An access request waiting on „Utilizatori & Acces” can be refused with „Respinge”, leaves
„Cereri în așteptare”, and is kept in „Istoric” with its state, the day and who refused it.

## Before you start

- TC-AUTH-01 is green.
- A pending request named `TC-USERS-01`, email `tc-users-01@example.com`, exists. It is made through
  `POST /api/auth/signup-request` — the call „Solicită acces” on `/signup` sends — because `/signup`
  itself has no case (`CATALOGUE_OPTED_OUT`). `example.com` is reserved for examples and receives no
  mail.

## What Adrian is asked for

Nothing.

## Why this case refuses and never approves  (Slice #37.08)

„Aprobă” creates a Supabase Auth account and emails a temporary password, and no screen can delete
either. A repeatable case would leave an account behind on every run. So the case drives
„Respinge”, which changes nothing but the request's own row. The approve path has been exercised
once, by hand: the `test-user` account Adrian approved on 2026-09-26 for TC-AUTH-02, which is in
„Istoric” as „Aprobat”.

## Shared state — what the case writes, and what it cannot give back

- **One `user_requests` row**, created before step 1 and refused in step 3. **It cannot be removed
  from any screen**: a refused request stays in „Istoric” for good, one row per run. That is the
  record the screen exists to keep, and the case leaves it.
- **One email attempt** to `tc-users-01@example.com` („Cerere respinsă…”). It reaches no one; if the
  mail service refuses the address, the screen says the email failed, which is the same outcome for
  this case.
- No account, no `app_users` row, nothing else.

**If a run is abandoned** after the request was made and before step 3: open „Utilizatori & Acces”
and press „Respinge” on `TC-USERS-01`. A second pending request with the same email is refused by
the database, so a run cannot start while an earlier one is still pending.

**To clear the history by hand** (optional, Adrian's): `DELETE FROM user_requests WHERE username =
'TC-USERS-01' AND status = 'rejected';` on the local database.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Opens „Administrare” → „Utilizatori & Acces” | Breadcrumb „Acasă › Administrare › Utilizatori & Acces”; the heading „Utilizatori & Acces”, „Revizuiți și gestionați cererile de cont. Aprobarea creează un cont și trimite solicitantului parola temporară pe email.”, the tabs „Cereri în așteptare” (with a count, **1**) and „Istoric”; under the first, Utilizator · Email · Trimis la · Acțiuni and the row `TC-USERS-01` · `tc-users-01@example.com` · today's date and time, with „Aprobă” and „Respinge” |
| 2 | Checks nothing else is pending that is not his | Only `TC-USERS-01` |
| 3 | Presses „Respinge” on `TC-USERS-01` — **not** „Aprobă” | A green line: „Cerere respinsă (trimiterea emailului a eșuat — verificați RESEND_API_KEY).” (or „Cerere respinsă și solicitantul notificat.” where mail is configured); the row leaves the list, the count goes, and „Nu există cereri în așteptare.” |
| 4 | Opens „Istoric” | Utilizator · Email · Trimis la · Stare · Procesat la · De; `TC-USERS-01` · `tc-users-01@example.com` · the time it was sent · „Respins” · today · „Adrian”, above `test-user` „Aprobat” (and one more `TC-USERS-01` „Respins” per earlier run) |

## At the end — leaving things as they were found

Nothing to undo: the refused request is the record. See „Shared state”.

## Notes from the runs

**2026-09-27 — driven for the first time, green (Slice #37.08).** The request was made through
`POST /api/auth/signup-request` (answered `{ ok: true }`), refused with „Respinge”, and read in
„Istoric” as „Respins”, „Adrian”, beside `test-user` „Aprobat”. The mail service did not send
(„…trimiterea emailului a eșuat — verificați RESEND_API_KEY”), as `test-user`'s approval email had
not either: the local server has no working mail key, which step 3 now allows for.

Corrections to the file: step 1's breadcrumb, description and count; step 3's exact sentence; step
4's columns, and that „Istoric” keeps one `TC-USERS-01` row per run.

**The first press looked like a defect and was not.** It was the reject route's first request on a
cold `next dev`: 17 s to answer, and in that time the page did not change — no line, the row still
listed — until a reload showed it refused. A second request made at once and refused on the warm
server gave the line and emptied the list in under a second. So the case was driven twice, and
„Istoric” holds two `TC-USERS-01` rows from 2026-09-27. Times on this screen are in the browser's
time zone.

**2026-10-06 — Slice #38.20.** The sidebar is nine sections now; the way to this screen reads „Administrare" → „Utilizatori & Acces". The screen and every step on it are unchanged but one: the breadcrumb's middle crumb, „Admin", now names the section, „Administrare", as text. The spec follows (`e2e/helpers/sidebar.ts` opens the section that holds an item).
