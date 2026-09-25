# What we test, what each kind of testing is for, and what nobody tests

**Written for a reader who knows the business and does not write code.** Every claim
below is followed by the file that makes it true, so that a sentence here which stops
being accurate can be checked against the thing it describes rather than believed.

This document describes testing as it exists on **2026-09-21** (Slice #36.04). It covers
four kinds of testing, and they are genuinely different in what they cost and in who
has to remember them:

| Kind | Runs | Who has to remember |
|---|---|---|
| The four commands of the verification sequence | Every slice, by hand | Adrian, from the handover |
| The two GitHub workflows | Every push, automatically | Nobody |
| The PowerShell and SQL checks | When a slice touches the database | Adrian, from the handover |
| What Claude does inside a session | Every session | Claude, and until now it was written down nowhere |

The companion document is `docs/testing/TEST-CATALOGUE.md`, which is the fifth kind:
business-user test cases driven through the real screens. It exists because everything
on this page except `npm run e2e` tests the *code*, and the catalogue is the only thing
that tests the *product*.

---

## 1. The four commands, in plain language

`ga40prj/CLAUDE.md` → "Verification order" fixes the order:
**`npm run e2e` → `npm run lint` → `npx tsc --noEmit` → `npx jest`**, every time. The
order is not taste. `npm run e2e` needs the dev server **running**; the other three need
it **stopped**, and not merely "don't need it" — `C:\dev\CLAUDE.md` → "Delivering work"
records that leaving `next dev` up makes `tsc` produce no output at all, because it
reads `.next/types/**` while the dev server rewrites it underneath, and makes Jest's
workers exhaust memory.

**Who runs it.** Since Slice Propus.2, the test runner does (`scripts/test-runner/`,
installed by `scripts/Install-TestRunner.ps1`). It is a Scheduled Task on Adrian's
laptop, and Claude sends it a request file when it needs a result. It keeps that order:
e2e against its **own** `next dev` on port 3100, then lint, tsc and jest with that
server stopped. So Adrian's server on 3000 can stay up. Adrian runs the sequence
himself only when the runner is down.

### `npx tsc --noEmit` — does every piece of data match the shape the code expects?

This is the TypeScript compiler, told to check and to produce nothing. It reads every
hand-written file in the project and asks one question, over and over: is this value
being used as the kind of thing it actually is? Rename a database column and forget one
of the eleven places that read it, and this is what says so — by file, by line, in a few
seconds, before anything runs.

It knows nothing whatsoever about whether the code is *correct*. A function that
confidently returns the wrong number, in the right shape, passes every time.

- **Purpose:** nothing is being called with the wrong kind of thing.
- **Blind to:** everything about behaviour.
- **Where it is configured:** `tsconfig.json`.

### `npm run lint` — the mistakes a compiler cannot see

ESLint over the whole tree (`package.json` → `"lint": "eslint"`, configured in
`eslint.config.mjs`, which composes `eslint-config-next/core-web-vitals` and
`eslint-config-next/typescript`). Part of what it finds is style, and that part matters
least. The part that matters is a whole class of real defect that is invisible to the
type checker *because the types are all perfectly fine*: a React hook called inside an
`if`, an effect that reads a value it never declared it depends on, a variable assigned
and then never used because the line that was going to use it was deleted.

These are the defects that produce a screen which renders and then does not update —
the most expensive kind to find by hand, because nothing is broken, something is merely
stale.

- **Purpose:** the shapes of mistake a compiler cannot see.
- **Blind to:** whether the feature does what a user wanted.

### `npx jest` — 152 suites, no database, no browser, ten seconds

152 test files under `src/__tests__` (`jest.config.ts`; `testPathIgnorePatterns`
excludes `e2e/`, so Jest and Playwright never overlap). Each one takes a piece of logic
in isolation and pins down what it must do: a cotă-parte written „63,64%" parses to
63.64, a document status transition is refused, a lookup name folds the way it is meant
to. Nothing is running — no database, no server, no browser.

It runs with **two workers**, and that number is a fix rather than a tuning choice.
`jest.config.ts` carries the whole story: above a certain worker count this machine
stops failing with a Node error Jest can catch and starts failing with Windows refusing
the process's memory, which surfaces as `Test suite failed to run` naming files that are
present on disk. The tell is a summary reading `Tests: N passed` with **zero** failed
assertions beside a non-zero `Test Suites: n failed`. Measured in Slice #32.05, the full
run then took 9.3 s for the 98 suites that existed at the time, against the 144 s Jest
itself estimated from the crashed run.

This project also uses Jest for a **second, less obvious job: structural guards that
assert the codebase has a particular shape.** This is worth understanding, because it is
the mechanism the test catalogue is built on:

- **Twelve `*-single-source*` suites** assert that a rule has exactly one home and has
  not been copy-pasted into a second (`src/__tests__/auth-single-source.test.ts`,
  `file-kinds-single-source.test.ts`, `hard-delete-single-source.test.ts`, and nine
  others).
- **`src/__tests__/help-coverage.test.ts`** fails when any route under `src/app` has no
  help screen and is not on an explicit opt-out list in `src/lib/help/route-map.ts`.
  It exists because Slice #16.UX.02 built the entire help mechanism and then mounted the
  button in one file, so ten registered screens could be authored and never appear.
- **`src/__tests__/shared-claude-deploy.test.ts`** fails when the deployed copy of the
  shared instruction files under `C:\dev\` drifts from the versioned original in
  `docs/claude/shared/`.
- **89 of the 152 suites call `readFileSync`** — they read a component's own source text
  to find every message key it asks for, or to prove a rule is not restated somewhere it
  should not be.

- **Purpose:** a rule, once decided, stays decided.
- **Blind to:** anything that needs two parts of the system to be running at once.

### `npm run e2e` — the only one that can tell you the application works

Playwright (`playwright.config.ts`), driving a real Chromium against the running dev
server and the real local database, with nothing mocked or stubbed anywhere. It logs in
through the real `/login` form as a real user, clicks real buttons labelled in Romanian,
and checks what appears on the screen.

Since Slice #36.06 it is **one spec per promoted catalogue case** — eight, from TC-AUTH-01
to TC-SRCH-01, listed in `e2e/README.md` and in the catalogue's `Spec` column — plus the
four property-versioning tests that predate the catalogue. `e2e/README.md` still
describes the state in its own words as **"a foothold, not a safety net"**, and lists
what is not covered: the import wizard, AI interpret, person and document versioning,
corners editing, maps, the admin screens, and every unhappy path.

Three details of how it runs matter to anything built on top of it:

- `fullyParallel: false` and `workers: 1` are deliberate, because every spec shares one
  fixed property row and parallel runs would fight over its version history.
- `e2e/auth.setup.ts` logs in once, pins `NEXT_LOCALE=ro-RO` so every assertion matches
  Romanian, and creates or reuses a single fixed property called
  **„E2E Proprietate Test"**, caching its id in `e2e/.auth/e2e-ids.json`.
- The suite **writes to the dev database**, on purpose. The versioning tests' assertions
  are all relative (`startVersion + 1`), so the fixed property accumulating versions is
  harmless; every other record a spec writes is marked `TC-E2E-` and removed by the same
  spec before it ends (`e2e/helpers/records.ts`).

- **Purpose:** a person can actually do the thing.
- **Blind to:** the large majority of the application, which has no spec. That is the
  hole `docs/testing/TEST-CATALOGUE.md` exists to start filling.

---

## 2. What runs on every push, without anyone asking

Two workflows, both in `.github/workflows/`. These are the only testing in this project
that nobody has to remember.

**`ci.yml`** runs `npm ci` → `npm run lint` → `npm test` → `npm run build`, in that
order, fast checks first. The build at the end is a real check in its own right and not
a formality: `next build` type-checks the generated route table, which `next dev` never
prunes, so a route that only the production build sees is checked here and nowhere else.

**`db-rebuild.yml`** starts a throwaway `postgis/postgis:16-3.4` service container,
replays the entire migration chain onto an empty database, builds a second database from
`supabase_schema_full.sql`, and compares the two object by object under `pg_dump -s`
against a committed list of accepted differences (`src/db/rebuild-known-differences.txt`).

Its header records why it exists, and the reason is the best argument in this repository
for automated testing: **Slice #29.04 was the first thing in months to need the Supabase
rebuild path, and found six consecutive defects in it — every one of which was correct as
read and wrong as run.** Nothing in the repository had been running those files. The
workflow refuses `--stub-postgis` when `CI` is set, so it cannot quietly become a run
that skipped the hard part.

**Neither workflow can run anything that needs a database *and* a browser.** `ci.yml` has
no Postgres, no dev server, no seeded user and no browser binaries, and
`playwright.config.ts` declares no `webServer` block that would start one. That is why
`npm run e2e` is a local tool and why the whole of the test catalogue is a local tool.
`e2e/README.md` → "Why this isn't in CI" names what wiring it up would take.

---

## 3. What Adrian runs by hand, and why each one exists

None of the four commands above touch the database **delivery** path, and they never
did. They cover the application. These cover the database, and each one exists because
of a specific failure.

**`scripts/Verify-Rebuild.ps1`** — the same rebuild comparison as the workflow, run
locally, for a slice that touches a migration. It starts a disposable container on
127.0.0.1 on a port of its own, so it cannot reach `ga40prj-postgres` and cannot reach
Supabase: it takes no connection string from the environment, refuses any non-loopback
host, and refuses any server whose `postgres` database is not empty. **Its exit codes are
not pass/fail:** 0 pass, 1 fail, 2 partial (PostGIS was faked — never in CI), 3 the
baseline was rewritten. Takes two to three minutes.

**`scripts/Verify-Schema.ps1`** — parses every `pgTable(...)` declaration out of
`src/db/schema/index.ts` and compares that list against what the running container
actually contains. It exists because **`schema_migrations` can lie, and once did:**
`migration_056` backfilled filenames 008–055 by assertion rather than by inspection, so a
migration that was never applied is still recorded as applied. `Apply-Migration.ps1` will
then report "Database is up to date" while a table is missing — which is exactly how
`help_content` and `help_hint` went absent until a 500 in the dev server surfaced it
(Slice #21.09). Read-only.

**`scripts/Apply-Migration.ps1`** — applies pending migrations, and before applying
anything, verifies the ones already recorded: each stored MD5 is compared against the
file on disk, and a file that changed since it was applied stops the run. "Up to date"
therefore means *the file that ran is the file in the repository*, not merely that the
name is in the table.

**`scripts/Check-ImportHealth.ps1`** — answers two specific import defects off the
database in one command. It counts by **page identity** — the set of (file name, file
size) — rather than by title, and its header records the measurement that forced that:
the AI retitles a document differently on every read, so the two halves of a duplicated
pair can carry different titles, and a `GROUP BY title` finds neither. Measured on the
32.05 UAT run of 2026-08-30, two documents that are the same file imported twice carried
two different titles. Its third query is labelled as **evidence, not proof**, for the
same reason: two genuinely different scans off one machine can share a name and a byte
count.

**`scripts/decision-checks.sql`** and **`scripts/closed-list-review.sql`** — read-only
worksheets that answer questions the source code cannot, for decisions taken with
Ciprian. Every statement is a `SELECT`; they decide nothing and change nothing. They are
run as `Get-Content .\scripts\decision-checks.sql | docker exec -i ga40prj-postgres psql -U postgres -d ga40db`.

---

## 4. What Claude has been doing in every session without naming it

This section is the honest answer to the question that prompted this slice. The answer
is: quite a lot, none of it was written down, and some of it has been misreported in the
past by being given a more impressive name than it deserves.

**The narrowed `tsconfig` run.** On a slice where the full-project type check cannot
finish over the device mount, Claude runs a narrowed `tsconfig` that checks every
hand-written file and skips the build cache. It is a real type check of the source. It
is not the command in the verification sequence, and the handover has to say so.

**The jest shim, which is not jest.** On a pure-module slice, Claude copies the modules
into its own container, compiles them, and runs the suites under a roughly 120-line
`describe`/`it`/`expect` shim it writes itself. This is fast and has caught real defects.
It has **no module mocking, no snapshots, and only the matchers somebody wrote into it**,
so a green run under the shim is never reported as `npx jest` passing —
`C:\dev\CLAUDE.md` → "Delivering work" states that rule, and this paragraph is why it
exists.

**Per-file parser diagnostics.** Where even the shim is not possible, Claude runs
TypeScript's parser over each changed file for structural errors. This finds a missing
brace and nothing else. **It is not a type check** and is supposed to be described as
such at handover.

**The named-file ESLint pass.** Claude runs ESLint over an explicit list of the files a
slice touched, over the bridge — about ninety seconds for eight files, with the full
config including the React-hooks rules. This is a real check against the real
configuration, and for a long time it was being skipped in favour of handing the
whole-tree command to Adrian.

**The derived staging list.** Before writing anything, Claude greps `src/__tests__` for
every message namespace and component path the slice touches, to find out which existing
suites the change will break. This is not optional housekeeping: 89 of the 152 suites
read a component's own source, so a message key added without being declared turns a
suite red in a file the slice never opened.

**The self-review of its own diff.** After all of it, Claude reads its own diff against
`HEAD` before committing. With the adversarial review rounds suspended until 2027-01-19
(`C:\dev\CLAUDE.md` → "Speed is a requirement"), **this is the last check a slice gets**,
and it is the whole of it — not the first draft of a findings report.

**One-question measurement scripts.** `scripts/testing/measure-title-loss.ts` is the
example: written to answer a single question with a number rather than an opinion — how
often does the AI read overwrite the title the import stored — and kept afterwards
because the number will need re-measuring when the rule changes. It calls the real
decision function and the real predicates rather than restating any of them, and its
header states plainly that its number is an **upper bound**, validated against one run.
`scripts/testing/postgis_stub.sql` sits beside it, for the rebuild check on a machine
with no PostGIS.

**And the episodic kind, which is the one Adrian already knows about.** Claude driving
Chrome, or taking control of the laptop, to use the application the way a person uses
it — filling a form, watching what happens, reading the console and the network tab when
it does not. It has the **highest value per minute** of anything on this page, because it
is the only kind that meets the product rather than the code. It also has the **lowest
repeatability of anything on this page**, because nothing of it survives the session.
`docs/testing/TEST-CATALOGUE.md` is the answer to exactly that: keep the value, stop
losing it at the end of the session.

---

## 5. Machine-enforced, or a person choosing to run it

Blurring these two is how a project comes to believe it is covered.

| Check | Machine-enforced on every push | Depends on a person |
|---|---|---|
| `npm run lint` | ✅ `ci.yml` | also run by hand, in the sequence |
| `npx jest` | ✅ `ci.yml` (as `npm test`) | also run by hand, in the sequence |
| `npm run build` | ✅ `ci.yml` | — |
| Migration-chain rebuild | ✅ `db-rebuild.yml` | `Verify-Rebuild.ps1`, locally, on a migration slice |
| `npx tsc --noEmit` | indirectly, via `npm run build` | ✅ every slice |
| `npm run e2e` | ❌ never | ✅ every slice |
| `Verify-Schema.ps1`, `Apply-Migration.ps1`, `Check-ImportHealth.ps1` | ❌ never | ✅ when the slice calls for it |
| Everything in `docs/testing/TEST-CATALOGUE.md` at state `driven` | ❌ never | ✅ a person chooses to run it |
| A catalogue case promoted to `automated` | ❌ never (no CI database) | ✅ but it joins `npm run e2e`, so it is one command and not a checklist |

The last two rows are the whole point of the promotion pipeline in the catalogue: a case
at `driven` costs attention every time it runs; a case at `automated` costs one command
for the whole suite, forever.

---

## 6. What nobody here tests

A gap that is written down is a backlog. A gap that is not is a surprise. None of these is
tested today. Since Slice #36.17 each one also says which slice takes it or why it waits. The
whole plan, and the order, is in `docs/claude/WHERE-SLICES-COME-FROM.md` → §7.

**Whether a role that should not see a screen actually cannot reach it.** There are two
roles, `superuser` and `user` (`src/lib/auth/roles.ts`). Nothing anywhere asserts that
the second cannot reach an administration screen. This is the most valuable item on this
list. It is also not a happy path, so it is a slice of its own with its own number, and
`docs/testing/TEST-CATALOGUE.md` carries a `kind` column ready for it.
→ **Slice 36.20** (FU-076). It is paired with the live defect behind the gap, FU-002: 19 of 26
`/api/admin` routes check no role. It adds `authz` as the second `kind`.

**Whether the AI reading of a deed got better or worse between two slices.** This is the
single largest hole in this project's testing. There is no labelled corpus and no score,
so every improvement to the extraction prompts is an **opinion**. What it would take:
twenty or thirty deeds with their correct field values recorded by a person, and a
harness that reports one number per run. `scripts/testing/measure-title-loss.ts` shows
the shape of the harness; it is the corpus that does not exist.
→ **Slice 36.23** (FU-073). It starts with ten Contracts de Vânzare, whose field values Adrian
confirms against the paper, and records a baseline score in `docs/testing/ai-score/cvc.md`.

**Whether a restore from backup produces a working archive.** The rebuild path is tested
(`db-rebuild.yml`); a restore of real data is not. So today a backup is a hope, not a guarantee.
→ **Waits** (FU-006). Two choices are Adrian's first: which backup to test (a `pg_dump` of
the local container, Supabase's own, the storage bucket too), and where a restored copy may be
stood up without touching anything live. Proposed as the next gap slice after 36.23, starting
with an investigation.

**Whether the application is usable by keyboard alone, or by a screen reader.** Some
individual components have been built with it in mind — `version-nav-controls.tsx`
carries an `sr-only` span specifically so the version number stays discoverable — but
nothing tests it as a whole.
→ **Waits** (FU-104). The keyboard and screen-reader defects already filed (FU-039, FU-062,
FU-065, FU-066, FU-126) go to the Monday review. A systematic test waits until the happy path
is `automated` end to end.

**Whether anything is fast enough with ten thousand documents rather than two hundred.**
No load test, no query-plan check, no page-weight budget.
→ **Last** (FU-106). It needs a volume of data the archive does not have yet.

**Whether the English half of `messages/` is actually English.** Completeness has been checked
since Propus.3.q1 (`3271987`): `messages-key-parity.test.ts` fails when either file lacks a key
the other holds, and names each one. So a missing Romanian key no longer reaches a user as a raw
key path. Nothing checks that an English value is not a copy of the Romanian one; FU-071 found
ten that were.
→ **Mostly closed.** What remains, FU-071, is a copy item for the Monday review's sweep, not a
test slice.

**Whether an import that reported success actually landed every page it was given.**
`Check-ImportHealth.ps1` answers two known defects off the database; nobody reconciles a
finished import against the folder it came from, file by file.
→ **Slice 36.22** (FU-012). It adds a reconciliation check, then uses it on a long import
(`05.big`, FU-089) and on the two special folders (`04.mixed`, FU-090). That slice replaces
this paragraph with a short section on the check.

**Negative, boundary, stress, load, concurrency and performance testing.** Deliberately
out of scope for Slice #36.04, each one line here so it is a backlog. None is scheduled; the
register holds negative and boundary as FU-099 and concurrency as FU-014:

- *Negative* — what happens on an empty required field, a malformed cotă-parte, a
  rejected file type. Would take: the same case-file format, a `kind` of `negative`, and
  a decision per case about what the correct refusal looks like.
- *Boundary* — a 300-character name, a zero-area polygon, a document with 400 pages.
  Would take: a list of the limits the system actually declares, which is not written
  down anywhere yet.
- *Stress and load* — ten thousand documents, a hundred concurrent imports. Would take:
  a data generator and a machine that is not Adrian's laptop.
- *Concurrency* — two tabs editing one property, two imports of the same folder. Would
  take: Playwright with more than one worker, which `playwright.config.ts` deliberately
  does not do today.
- *Performance* — a number per screen, tracked over slices. Would take: a budget nobody
  has set.

**Visual regression and screenshot diffing.** Not started, and out of scope for #36.04.

**A cross-browser or mobile-viewport matrix.** `playwright.config.ts` declares one
project, `chromium`, and that is a decision rather than an omission.
