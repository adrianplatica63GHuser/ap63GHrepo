# End-to-end tests (Playwright)

These drive a **real browser against your running dev server and your real local
database**. They are not unit tests — nothing is mocked. A passing run means a
real user, clicking real buttons in Romanian, gets the right result.

Jest (`npm test`) and Playwright (`npm run e2e`) are separate and never overlap:
`jest.config.ts` excludes `e2e/` via `testPathIgnorePatterns`.

---

## What is covered today

One suite: **Property versioning** (`e2e/versioning/property-versioning.spec.ts`),
four tests against the Property detail form — the most complex versioned entity
(fields + address + corners).

| Test | What it proves |
|---|---|
| `salvarea adauga o versiune noua` | Saving an edit appends exactly one version, and the nav label increments by 1 |
| `navigare inapoi — formularul devine read-only` | ◀ steps back, the form goes read-only (`fieldset[disabled]`), and "Setează ca actuală" becomes enabled |
| `Seteaza ca actuala — creaza versiune noua din snapshot vechi` | Restoring an old snapshot creates a NEW latest version rather than rewriting history, and the form is editable again afterwards |
| `butonul Salveaza: dezactivat → activ → dezactivat dupa salvare` | Save tracks dirty state correctly — the bug class from Slice #18.15.bugs |

These are exactly the behaviours that are painful to verify by hand and easy to
regress, because they depend on React Hook Form baselines, a React Query cache
invalidation and a server-side transaction all agreeing with each other.

## What is NOT covered

Person and Document versioning, corners editing, associations, the import
wizard, AI interpret, maps, auth flows beyond logging in. This is a foothold,
not a safety net — don't read a green run as "the app works".

---

## Running it

**Two things must be true first**, or you get a confusing failure:

1. The dev server is running in another terminal (`npm run dev`), reachable at
   `http://localhost:3000`.
2. Your `.env` has a working test account:

   ```
   E2E_EMAIL=you@example.com
   E2E_PASSWORD=your-password
   ```

   It must be an **already-approved** account in the app — the suite logs in, it
   does not sign up. Any role works.

Then, in a second PowerShell window:

```powershell
npm run e2e
```

Interactive mode — a UI where you can watch each step, time-travel through the
run and re-run one test at a time. This is the one to use when something fails:

```powershell
npm run e2e:ui
```

Run a single spec, or a single test by name:

```powershell
npx playwright test e2e/versioning/property-versioning.spec.ts
npx playwright test -g "Setează ca actuală"
```

Watch it happen in a visible browser instead of headless:

```powershell
npx playwright test --headed
```

**First run only** — Playwright needs its browser binaries:

```powershell
npx playwright install chromium
```

---

## How a run is wired together

`playwright.config.ts` defines two projects that run in order:

1. **`setup`** (`e2e/auth.setup.ts`) — runs once per invocation. It logs in
   through the real `/login` form, sets `NEXT_LOCALE=ro-RO` (every assertion
   matches Romanian UI text), and saves the session to
   `e2e/.auth/session.json`. It then creates a property called
   **"E2E Proprietate Test"** and caches its UUID in `e2e/.auth/e2e-ids.json`.

2. **`chromium`** — every spec, starting already logged in via that saved
   session.

`workers: 1` and `fullyParallel: false` are deliberate: all specs share that one
property row, so running them in parallel would have them fighting over the same
version history.

### Two things worth knowing

**The suite writes to your dev database.** "E2E Proprietate Test" is a real
property and will show up in your Properties list. It is reused across runs on
purpose, so its version history grows every time you run the suite. That is
harmless — every assertion is *relative* (`startVersion + 1`), never absolute —
but don't be surprised to find it at version 200 one day. Delete it whenever you
like; the next run just creates a fresh one.

**`e2e/.auth/` is gitignored, and must stay that way.** `session.json` holds a
live Supabase session cookie for your test account. It is also excluded from the
Docker build context via `.dockerignore` (which does *not* inherit `.gitignore`).

---

## When something fails

Read the failure in this order:

1. **"E2E_EMAIL and E2E_PASSWORD must be set"** — `.env` is missing them.
2. **"Login failed — redirected back to /login"** — wrong credentials, or the
   account was never approved.
3. **`ECONNREFUSED` / everything times out** — the dev server isn't running.
4. **A locator times out** — usually a UI string changed. The helpers in
   `e2e/helpers/version-nav.ts` match Romanian text from `messages/ro-RO.json`
   (`property.corners.prevVersion` = "Versiunea anterioară", the version label
   format `v {n}`, and so on). **Rename a Romanian string and you break these
   tests** — that is by design, it is the tests noticing.
5. **Cached-property errors after a DB reset** — delete `e2e/.auth/` and re-run;
   setup will make a new property. (It already self-heals by checking the cached
   id, but deleting is the sledgehammer.)

A failed run leaves a trace (`trace: "retain-on-failure"`). Open it — it's a
full step-by-step recording with DOM snapshots:

```powershell
npx playwright show-trace test-results\<folder>\trace.zip
```

---

## Adding a test

Prefer extending `e2e/helpers/` over putting raw locators in a spec — the
helpers are the single place that knows what the version nav looks like, so a UI
change is one edit rather than a hunt.

Match users by what they *see*, not by CSS: `getByRole("button", { name: "Salvează" })`
rather than a class selector. The one deliberate exception is
`fieldset[disabled]` in `isFormReadOnly`, where the DOM state *is* the thing
being asserted.

Remember the locale: assertions must use the Romanian string, because setup
pins `NEXT_LOCALE=ro-RO`.

---

## Why this isn't in CI

CI (`.github/workflows/ci.yml`) runs `npm ci → lint → test → build`. It has no
Postgres, no dev server, no seeded user and no browser binaries, and
`playwright.config.ts` has no `webServer` block to start one. Wiring that up is
a slice of its own — a service container for Postgres, migrations, a seeded E2E
account, `playwright install --with-deps`. Until then this is a **local
pre-commit tool**: run it before pushing anything that touches versioning.
