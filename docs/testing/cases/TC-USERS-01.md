# TC-USERS-01 — O cerere de acces respinsă, citită în „Istoric”

| | |
|---|---|
| **Area** | users |
| **Kind** | happy |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

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
| 1 | Opens „Admin-Configurare” → „Utilizatori & Acces” | The heading „Utilizatori & Acces”, „Revizuiți și gestionați cererile de cont. …”, the tabs „Cereri în așteptare” and „Istoric”; under the first, the row `TC-USERS-01` · `tc-users-01@example.com` · today, with „Aprobă” and „Respinge” |
| 2 | Checks nothing else is pending that is not his | — |
| 3 | Presses „Respinge” on `TC-USERS-01` | The row leaves the list, and a line says the request was refused |
| 4 | Opens „Istoric” | `TC-USERS-01` · `tc-users-01@example.com` · „Respins” · today · „Adrian”, beside `test-user` „Aprobat” |

## At the end — leaving things as they were found

Nothing to undo: the refused request is the record. See „Shared state”.

## Notes from the runs

(none yet)
