# End-to-end tests (Playwright)

These drive a **real browser against your running dev server and your real local
database**. They are not unit tests — nothing is mocked. A passing run means a
real user, clicking real buttons in Romanian, gets the right result.

Jest (`npm test`) and Playwright (`npm run e2e`) are separate and never overlap:
`jest.config.ts` excludes `e2e/` via `testPathIgnorePatterns`.

---

## What is covered today

**One spec per catalogue case**, each translated from its case file under
`docs/testing/cases/` and named in the `Spec` column of
`docs/testing/TEST-CATALOGUE.md`. The catalogue is where to read what each one
proves; this table is where to find the file.

| Case | Spec | What it drives |
|---|---|---|
| TC-AUTH-01 | `e2e/auth/login-dashboard.spec.ts` | After login: the dashboard, the sidebar, „Autentificat ca". The login itself is `auth.setup.ts` |
| TC-PROP-01 | `e2e/property/property-create.spec.ts` | A property typed in by hand appears at the top of the list, count + 1; deleted again |
| TC-PROP-02 | `e2e/versioning/property-versioning.spec.ts` | One save appends one version: „v 0" → „2 versiuni", the unsaved-changes banner, the read-only previous version. Plus the four versioning tests below |
| TC-PERS-01 | `e2e/person/person-create.spec.ts` | A natural person typed in by hand, found by the list's search; deleted again |
| TC-PERS-02 | `e2e/person/company-create-edit.spec.ts` | A company typed in by hand, found by name and by CUI, edited to „v 1"; deleted again |
| TC-DOC-01 | `e2e/document/document-page.spec.ts` | A Contract de Vânzare with one page attached through the hidden file input, opened full-window and closed |
| TC-ASSOC-01 | `e2e/association/document-person.spec.ts` | A person on a document as „Cumpărător", 50% with the warning, „indiviziune", then 100% |
| TC-ASSOC-02 | `e2e/association/document-property.spec.ts` | A property on a document, read from both ends |
| TC-ASSOC-03 | `e2e/association/person-document.spec.ts` | A document on a person as „Cumpărător", made from the person's screen, read from the document |
| TC-ASSOC-04 | `e2e/association/property-person.spec.ts` | A person on a property with a role, made from each end in turn and read from the other |
| TC-ASSOC-05 | `e2e/association/property-document.spec.ts` | A document on a property, made from the property's screen, read from the document |
| TC-ASSOC-06 | `e2e/association/company-property.spec.ts` | A company as a property's owner; „Vizualizare" on the property opens the company |
| TC-PROP-03 | `e2e/property/property-from-coord-file.spec.ts` | A property from a synthetic coordinate file: corners in file order, the area, „Fișier de coordonate (.txt)"; deleted again |
| TC-SRCH-01 | `e2e/search/global-search.spec.ts` | One Căutare globală finds a person, a property and a document |
| TC-GRP-01 | `e2e/group/group-two-properties.spec.ts` | A group, two properties saved into it, found by the group's code; the group deleted, even on a failure |
| TC-TAG-01 | `e2e/tag/tag-property.spec.ts` | A tag on a property, counted on „Etichete", found by Căutare globală, gone with its last use |

The four tests in `property-versioning.spec.ts` that predate the catalogue stay as
they were — the most complex versioned entity (fields + address + corners), on the
fixed property:

| Test | What it proves |
|---|---|
| `salvarea adauga o versiune noua` | Saving an edit appends exactly one version, and the nav label increments by 1 |
| `navigare inapoi — formularul devine read-only` | ◀ steps back, the form goes read-only (`fieldset[disabled]`), and "Setează ca actuală" becomes enabled |
| `Seteaza ca actuala — creaza versiune noua din snapshot vechi` | Restoring an old snapshot creates a NEW latest version rather than rewriting history, and the form is editable again afterwards |
| `butonul Salveaza: dezactivat → activ → dezactivat dupa salvare` | Save tracks dirty state correctly — the bug class from Slice #18.15.bugs |

A case's row reaches `automated` only after a whole run of this suite has been green —
the test runner's, whose result id is quoted, or Adrian's — see the catalogue's states table.

## What is NOT covered

Every screen whose catalogue row is below `automated` or missing: the import wizard and AI
interpret (TC-IMP-01, TC-IMP-02, TC-AI-01 — the folder picker has no file input to set, and each
run spends AI budget), the manual document-to-document reference (TC-ASSOC-07, `draft`), person and
document versioning, corners editing, the map, the admin screens other than groups and tags, and
every unhappy path — empty inputs, wrong shares, two tabs at once. `CATALOGUE_NOT_YET` in
`src/lib/testing/catalogue-map.ts` is the list. Sixteen happy paths is a floor under the ordinary
week's work, not a safety net: a green run says those sixteen still hold, not that the app works.

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

**Claude does not ask you to run this any more** (Slice Propus.2): the test runner on your
laptop runs `npm run e2e` against its own `next dev` on port 3100 when Claude requests it, with
`E2E_BASE_URL=http://localhost:3100` — `playwright.config.ts` reads that variable and falls back
to 3000. Installed once with
`pwsh -NoProfile -ExecutionPolicy Bypass -File C:\dev\ga40prj\scripts\Install-TestRunner.ps1`;
`-Check` says whether it is alive. The commands here are for running it yourself.

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

**Every other spec cleans up after itself.** A spec that creates a record
removes it in the same file — through the UI, or through the DELETE route the
UI's „Șterge" calls, in a `finally` so a failed assertion does not leave it —
and every record a spec writes carries `TC-E2E-<case>` in a visible field
(`e2e/helpers/records.ts`). If a run is killed half-way, the next run of the
same spec removes what it left before starting; in between, Căutare globală
finds it by `TC-E2E-`. A hand run's records say `TC-` without `E2E`, and no spec
ever removes those. TC-GRP-01 and TC-TAG-01 write state every user
sees — a group, a tag — and remove it even when an assertion fails.

**`e2e/fixtures/` holds only files made for the purpose.** TC-DOC-01's hand run
attaches a scan of a real contract; its spec attaches `tc-e2e-pagina.png`, a
blank „PAGINĂ DE TEST". TC-PROP-03's hand run reads a coordinate file cut from a
real parcel; its spec reads `TC-E2E-PROP-03 Teren din fisier.txt`, four made-up
corners — named with the marker because the screen writes the file name into
„Poreclă". No real deed and no real parcel goes into git.

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
4. **`waitForNav` times out around 15-16s, on the FIRST run after editing files or restarting the dev server** — this is very likely Next dev-mode compiling `/properties/[id]` cold, not a real bug. That page is unusually heavy (two Google-Maps `next/dynamic` imports, the corners table, four tabs), so its first compile can be slow, and editing files while `npm run dev` is running can unsettle its module cache (see the "Dev-server route table can go stale" gotcha in CLAUDE.md). Confirm by loading the property URL from the failure's `[E2E setup] Created/Reusing E2E property: <uuid>` line in a normal browser tab — if the version label eventually appears there, restart `npm run dev` and re-run `npm run e2e`. If it never appears even in a plain browser, that is a real bug — capture the `npm run dev` terminal output at that moment before investigating further.
5. **`waitForNav` never finds the label at all, even in a plain browser, once a property has 2+ versions** — this was a real gap, fixed. Slice #20.12 added a compact "history discovery chip" (e.g. "2 versiuni") that replaces the full ◀ / "v N" / ▶ strip whenever you're viewing the latest version and it has prior history — the chip shows a total *count*, not the current version number, and the "v N" text genuinely is not on the page in that state. Fixed by adding a visually-hidden (`sr-only`) "v N" span alongside the chip in `src/components/version-nav-controls.tsx`, so the exact version number stays discoverable to both screen readers and this suite regardless of which of the two UI states is showing. If this ever regresses, it means someone touched `VersionNavControls` without preserving that span.
6. **A locator times out** — usually a UI string changed. The helpers in
   `e2e/helpers/version-nav.ts` match Romanian text from `messages/ro-RO.json`
   (`property.corners.prevVersion` = "Versiunea anterioară", the version label
   format `v {n}`, and so on). **Rename a Romanian string and you break these
   tests** — that is by design, it is the tests noticing.
7. **Cached-property errors after a DB reset** — delete `e2e/.auth/` and re-run;
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

**A new spec starts from a `confirmed` case, never from the screen.** Its header
opens with `Case:` and `Source:` lines (copy any spec's), its row's `Spec` column
names the file, and `src/__tests__/test-catalogue-coverage.test.ts` fails the
build when either side is missing.

**Most form fields here are wrapped in their `<label>`, and a wrapped control can
take its current value into its accessible name** — the accessible-name rules
fold an embedded select's chosen option into the label, and the `<label>`'s own
text on the property form reads „Nr. tarla / sola— niciunul —404647/2" (measured
2026-09-22). So an `exact` label match is fragile, and a plain
`getByLabel("Nume")` also matches „Prenume". For a text input, anchor the label:
`getByLabel(/^Nume(\s|$)/)`. **For a `<select>`, use its role instead** —
`getByRole("combobox", { name: "Rol", exact: true })` — because the label's text
runs straight into the options with no space („Rol— fără rol —Cumpărător…"), and
`/^Rol(\s|$)/` matched nothing on the second run.

---

## Why this isn't in CI

CI (`.github/workflows/ci.yml`) runs `npm ci → lint → test → build`. It has no
Postgres, no dev server, no seeded user and no browser binaries, and
`playwright.config.ts` has no `webServer` block to start one. Wiring that up is
a slice of its own — a service container for Postgres, migrations, a seeded E2E
account, `playwright install --with-deps`. Until then this is a **local
pre-commit tool**: run it before pushing anything that touches versioning.
