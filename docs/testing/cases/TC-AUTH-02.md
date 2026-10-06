# TC-AUTH-02 — Un cont „user" lucrează zilnic și nu poate administra

| | |
|---|---|
| **Area** | auth |
| **Kind** | authz |
| **Data** | — |
| **State** | `draft` |
| **Last green** | — |

## What this proves

An account whose role is **`user`** can do its daily work and cannot do what belongs to a
**`superuser`**: the sidebar offers it no administration, an administration address typed by
hand turns it away, and the ordinary screens open and work. Its spec adds the half a person
cannot see: a write to each guarded family of `/api/admin` routes answers **403** for it and
changes nothing (FU-002, closed in Slice #36.20).

It is the catalogue's first case whose kind is not `happy`: **`authz`** — who may do what.

## Before you start

- TC-AUTH-01 is green.
- **An approved account whose role is `user`** exists, and `.env` holds it as
  `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` (the spec's login). Accounts live in Supabase Auth,
  which is Adrian's.

## What Adrian is asked for

**Two things, both his by rule.** (1) Create the `user` account once — sign-up plus approval on
„Utilizatori", or the seed script's pattern with the role set to `user` — named so it reads as a
test account, and put it in `.env` as above. (2) For each hand run, **sign in as it** in the
browser Claude drives: Claude never types a password. Claude does every other step.

## The matrix

**Screens**, as a person meets them:

| Where | `superuser` | `user` |
|---|---|---|
| Sidebar: „Funcții", „Import", „Rapoarte", „Administrare", „Setări", „Studiu", „Ajutor" (#38.20) | shown | **absent** |
| `/admin/value-lists` typed by hand | opens | **sent to `/`, the dashboard** |
| `/admin/users` typed by hand | opens | **sent to `/`, the dashboard** |
| „Proprietăți", „Persoane Fizice", „Acte" | open | **open** |
| Căutare globală (`/admin/global-search`, and the sidebar's quick search) | opens | **opens** (since #36.20) |

**Writes**, which only the spec makes — one per guarded family, each marked `TC-E2E-AUTH-02`:

| Write | `user` answer | If it wrongly succeeds |
|---|---|---|
| A value in a closed list — `POST /api/admin/value-lists/property-property-roles` | **403** | the spec removes it as the superuser |
| A role pair — `POST /api/admin/doc-type-person-roles` (ids that exist nowhere) | **403** | nothing to remove: no such ids |
| Help text — `PUT /api/admin/help-content/dashboard` | **403** | the spec puts back what it read first |
| A group — `POST /api/groups` („Grupuri", FU-222) | **403** | the spec removes it as the superuser |
| A stamp — `POST /api/stamps` („Ștampile", FU-222) | **403** | the spec removes it as the superuser |
| A tag renamed across every record — `PATCH /api/tags` („Etichete", FU-222), from a tag that exists nowhere | **403** | nothing to rename |
| A time-frame setting — `PATCH /api/time-frames` („Setări", FU-222), to its own current value | **403** | nothing changed; the spec compares every setting |
| A calculation commit — `POST /api/calculation/commit` („Calcul", FU-222), with no text | **403** | nothing to commit |

**Allowed by decision (FU-223, Slice #37.03):** accepting the fields „Descoperire AI" finds on a
document — `PUT /api/document-types/[id]/template-fields`, and `POST /api/document-types/resolve`
beside it — stays open to a `user`, because the feature lives on the document screen a `user`
works on every day. It extends that document type's form for every document of the type. The spec
checks that neither answers 403 (with an id that exists nowhere, so nothing is written). Adrian can
overturn this in one line; then both routes require a superuser and the accept step is hidden for
a `user`. **Slice #37.85 removed „Descoperire AI"**, the reason for this decision; the PUT's only
caller left is DocTypeEngine, a superuser's screen. Closing both routes is FU-298.

## Steps

| # | A person does | And sees |
|---|---|---|
| 1 | Adrian signs in as the `user` account | „Tablou de bord", and at the top of the sidebar „Autentificat ca" and the account's name |
| 2 | Reads the sidebar | „Persoane Fizice", „Persoane Juridice", „Proprietăți", „Acte", and the quick search „Nume, cod…" — and **none** of „Funcții", „Import", „Rapoarte", „Administrare", „Setări", „Studiu", „Ajutor" (#38.20) |
| 3 | Types `/admin/value-lists` into the address bar | The address becomes `/` and the screen is „Tablou de bord". Nothing says why |
| 4 | Types `/admin/users` into the address bar | The same: `/`, „Tablou de bord" |
| 5 | Presses „Proprietăți", then „Persoane Fizice", then „Acte" | Each list, headed „Proprietăți", „Persoană fizică", „Acte", with its „Adaugă…" button |
| 6 | Types `PROP` into the sidebar's quick search and presses Enter | Căutare globală at `/admin/global-search?search=PROP`, with its results — not the dashboard |

## At the end — leaving things as they were found

Nothing is created by the hand run. Adrian signs out („Ieșire") and signs back in as himself.

## Notes from the runs

**2026-09-26 — the matrix grows, still not driven (Slice #37.03).** The five admin-only families
outside `/api/admin` (FU-222) now require a superuser, and the spec's third test sends one write
per family as the `user`. FU-223 is decided and written above. **Not driven yet:** the `test-user`
account is approved (2026-09-26, 23:13) but `auth.setup.ts` still cannot sign in with the
`E2E_USER_*` pair in `.env` — the temporary password is still the account's, as far as the run
can tell — so the hand runs wait for Adrian's sign-in, and the spec stays parked: the catalogue's
coverage guard lets only a `confirmed` row name a spec.

**2026-09-25 — written, not yet driven (Slice #36.20).** It waits for the `user` account,
which is Adrian's to create. Step 6 describes the screen after #36.20: until then the quick
search sent a `user` to the dashboard, because Căutare globală sat inside the superuser-only
admin layout; it now lives in the `(all-roles)` route group. Steps 3–4's „nothing says why" is
read from `src/app/admin/layout.tsx` (`redirect("/")`) and `admin/users/page.tsx`, and the first
run confirms or corrects it. The spec is written and parked as `e2e/auth/user-role.parked.ts`,
outside Playwright's match, until two unchanged runs confirm this file.

**2026-10-05 — Slice #37.92.** The sidebar's „Proprietăți — Listă" and „Proprietăți — Hartă" are one item,
„Proprietăți"; the whole map opens from the list's „Hartă completă" (TC-PROP-10). The steps above name
the sidebar item by its new name; nothing else in them changed.

**2026-10-06 — Slice #38.20.** The admin-only sections are named as the sidebar names them now; the `user` sees „Tablou de bord" and „Domeniu" (the four lists).
