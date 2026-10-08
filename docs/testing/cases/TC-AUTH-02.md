# TC-AUTH-02 — Contul care era „user" are toată aplicația, ca administratorul

| | |
|---|---|
| **Area** | auth |
| **Kind** | authz |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

Since Slice #38.21 there is one kind of user: every account with an `app_users` row has the whole
application, whatever its row's `role` says. The `test-user` account — created as a **`user`** in
#36.20 to be turned away from administration — now sees what the administrator sees and opens what
the administrator opens. A section missing from its sidebar, or an administration address that
sends it to the dashboard, is the defect.

Until #38.21 this case proved the opposite: that a `user` was refused. Its matrix of refusals
(the sidebar without administration, `/admin/*` sending it to `/`, a 403 for one write per guarded
family) is gone with the role checks; `src/__tests__/one-kind-of-user.test.ts` holds every former
check on the one predicate, `hasFullAccess`, and the parked spec of #36.20, which asserted the 403s,
was rewritten to the steps below.

It stays `authz` — who may do what — and stays `draft`: Claude never types a password, so the hand
runs wait for Adrian's sign-in as `test-user`. TC-AUTH-01's step 9 signs in as it on every e2e run
and checks the sidebar.

## Before you start

- TC-AUTH-01 is green.
- The account `test-user`, approved as a `user` on 2026-09-26, and `.env` holding it as
  `E2E_USER_EMAIL` / `E2E_USER_PASSWORD`. Once migration 094 has run, its row says `superuser`;
  before, it still says `user` — the case reads the same either way, because the application no
  longer reads the role.
- **Its `app_users` row must carry its Supabase id.** On 2026-10-06 it does not: the account signs
  in, but `/api/auth/me` answers `fullAccess: false` — no row has its id (the request was approved
  on 2026-09-26; the Supabase account behind the e-mail is not the one that approval created, or the
  row's id was never set). Until #38.21 that went unseen, because an account without a row was a
  `user` by default; now it is refused like any account without a row, and `auth.setup.ts` skips
  the `user` specs with that reason. Putting the account's Supabase id into its row is Adrian's.

## What Adrian is asked for

**Sign in as `test-user`** in the browser Claude drives, for each hand run: Claude never types a
password. Claude does every other step.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Adrian signs in as `test-user` | „Tablou de bord", and at the top of the sidebar „Autentificat ca test-user" |
| 2 | Reads the sidebar | All six sections drawn since #38.42: „Tablou de bord", „Domeniu", „Instrumente", „Import", „Administrare", „Setări" |
| 3 | „Administrare" → „Utilizatori & Acces" | „Utilizatori & Acces", its tabs „Cereri în așteptare" and „Istoric" — no role anywhere on the screen |
| 4 | Types `/admin/value-lists` into the address bar | „Date de referință" — not the dashboard |
| 5 | „Administrare" → „Etichete" | „Etichete" and its cloud |

## At the end — leaving things as they were found

Nothing is created. Adrian signs out („Ieșire") and signs back in as himself.

## Notes from the runs

**2026-10-06 — rewritten, not yet driven (Slice #38.21).** The case's premise — a `user` is
refused administration — is gone: every account with an `app_users` row has the whole application.
The steps above are the new truth, read from `src/lib/auth/current-role.ts` (`hasFullAccess`),
`src/app/admin/layout.tsx` and the sidebar; FU-223's decision and FU-298 (two routes left open to
a `user`) no longer mean anything, since nothing is closed to an account with a row. The earlier
notes (#36.20, #37.03, #37.92, #38.20) described the refusals and are in the file's history.
