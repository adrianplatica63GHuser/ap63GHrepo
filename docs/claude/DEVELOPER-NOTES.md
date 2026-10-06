# Developer notes

Notes for whoever develops this application — not for its users. Until Slice #38.22 they sat in a
panel on „Setări" („Opțiuni pentru dezvoltator" → „Afișează note pentru dezvoltatori"), shown only on
a build with `NEXT_PUBLIC_DEV_TOOLS=true`. #38.22 retired that flag, removed the panel everywhere,
and moved its one note here.

## The multi-user model (the panel's note, 2026-10-06)

The panel said, in English, under a Romanian heading:

> **Multi-user model is not production-ready.** There are only two roles (superuser, user) with no
> granular permissions. The Ciprian scenario is handled via a separate UAT environment rather than a
> proper multi-user production model. If more users are coming (which the user request flow
> implies), you need to define: can a "user" create persons? edit properties? delete documents?
> approve other users? The current system gives "user" role access to everything except presumably
> the admin screens — but this is undocumented and likely not enforced at the route level with any
> granularity.

**What is true since then:**

- **Route-level enforcement exists** since #36.20 (FU-002) and #37.03 (FU-222): every mutating
  handler under `/api/admin`, and the admin-only routes outside it, call one guard, and
  `src/__tests__/admin-api-role-guard.test.ts` fails the push when one does not.
- **There is one kind of user** since #38.21: every account with an `app_users` row has the whole
  application, approving others included — the predicate is `hasFullAccess()` in
  `src/lib/auth/current-role.ts`. The questions the note asked („can a user delete documents?
  approve other users?") are answered „yes, every account can" — on purpose, for this application.
- **Approval is the only gate.** Whoever is approved can do everything; that is the decision #38.21
  recorded.
- **The role stays in the data** (`app_users.role`, enum `app_user_role`, `src/lib/auth/roles.ts`)
  for the future Portal application, which will need granular permissions again. Its rule goes
  beside `hasFullAccess()`, not back into the routes one by one.
- **UAT has no sign-in** (`UAT_NO_AUTH=true`, no Supabase project); since #38.22 the screens that
  need accounts say so in one sentence instead of being hidden.
