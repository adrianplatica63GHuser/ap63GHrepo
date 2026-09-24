@AGENTS.md

# ga40prj

A web app for managing **People**, **Documents** and **Properties**, with PostGIS-backed
spatial data and a bilingual Romanian/English UI. Built one vertical slice at a time.
Deployed on Vercel + Supabase; local Docker Postgres is the primary dev environment.
A second delivery target, Ciprian's UAT box, runs the same code in Docker with no cloud.

`C:\dev\CLAUDE.md` (loaded automatically above this file) holds the working contract that
applies to all of Adrian's projects. This file holds only what is true of *this* app.

## Romanian is the only version that matters

- **Every user is Romanian and must never see English text or an awkward translation.**
  Romanian copy is the deliverable; English is a development convenience.
- It is **fine** for the English version to carry awkward translations or Romanian strings.
  It is **never** fine for the Romanian version to do the reverse.
- **Romanian user data stays Romanian.** Data captured in Romanian is not translated, and
  hardcoded Romanian in a *data* value is not an i18n violation. Hardcoded Romanian in a
  *UI string* still is.
- **Two-track i18n.** Developer-authored static UI strings → next-intl (`messages/*.json`).
  Runtime-editable content Adrian maintains in the Admin UI → DB columns with `_en`/`_ro`
  suffixes. Never mix the two tracks. See `.claude/rules/i18n-and-romanian.md`.
- e2e locators match Romanian strings from `messages/ro-RO.json`. Renaming a Romanian UI
  string breaks the Playwright suite **by design** — fix the locator, don't fight it.
- **Write Romanian straight into `messages/ro-RO.json`. Do not hold it back for review.**
  Adrian reviews the strings in the diff as a matter of course, and Ciprian is the only
  other reader, so an approval round costs a handover and buys nothing. Quote the new
  user-facing sentences in the handover so they are easy to find — but ship them.
  (Superseded rule, kept so it is not reintroduced: strings used to be held out of
  `ro-RO.json` pending review. That is now actively wrong — `DEFAULT_LOCALE` is `ro-RO`,
  so a missing key renders as a raw key path *in the shipping locale*.)

## Verification order

`npm run e2e` → `npm run lint` → `npx tsc --noEmit` → `npx jest`, in that order, every time.

- **None of those four touch the database delivery path, and they never did.** They cover the
  application. The files that rebuild a database from scratch — `supabase_reset.sql`,
  `supabase_schema_full.sql`, `supabase_repair_missing_tables.sql`, `sync-reference-data.sql`,
  `supabase-sync.ts` and every migration — are covered by **`.\scripts\Verify-Rebuild.ps1`**
  instead, which starts a throwaway `postgis/postgis:16-3.4` container, replays the whole
  migration chain onto an empty database, builds a second from `supabase_schema_full.sql`, and
  compares the two object by object under `pg_dump -s` against a committed list of accepted
  differences (`src/db/rebuild-known-differences.txt`). About a minute; needs Docker running.
  It cannot reach `ga40prj-postgres` or Supabase: it takes no connection string from the
  environment, refuses a non-loopback host, and refuses any server whose `postgres` database is
  not empty — which the dev container and a Supabase project both fail. **Run it when a slice
  touches a migration, any of those files, or `scripts/Export-SupabaseSchema.ps1` — not on every
  slice.** It also runs on every push, as the `DB rebuild` workflow, which is the point: Slice
  #29.04 found six consecutive defects in that path because nothing had run it in months.
  `npm run db:verify-rebuild -- --port <p> --password <pw>` is the same check against a server you
  started yourself. **Exit codes are not all pass/fail:** 0 pass, 1 fail, 2 partial (PostGIS was
  faked — never in CI), 3 the baseline was rewritten. Slice #31.01.

- **SUSPENDED until 2027-01-19 — no slice gets an adversarial review.** Adrian, 2026-09-19,
  explicitly, for four months: do not spawn a review subagent, do not offer one, do not hand back
  an unasked-for findings list. The full block, including why and what it costs to ignore, is in
  `C:\dev\CLAUDE.md` → "Speed is a requirement" → "Adversarial review rounds are SUSPENDED". What
  follows is the rule as it stood, kept so it is not reinvented from scratch — and when it resumes
  it resumes **narrowed** per that block: executable code on a destructive path only, never prose,
  two rounds maximum. **The rule text below is dormant — do not act on it before that date:**
  >
  > Once the code is written and type-clean, spawn a subagent whose brief is to *prove the change
  > wrong*: find the input, state transition or call site that breaks it, and do not summarise
  > approvingly. Give it the diff, the new files, the claims the slice makes, and a numbered
  > list of specific things to attack. Tell it to prefer running code over reading it, and to
  > end with one line on what it could not break. Then fix what it finds and say so in the
  > handover, including anything deliberately left. It has caught a lying CTA, a probe that
  > would have blocked every import on Vercel, and a dialog that forced users to destroy
  > their own saved session — none of which type-checking or lint would ever see.

- **The recurring defect in this codebase is confident output that was never measured
  against a realistic input.** Recorded after Slice #26.00, when the import work had to be
  stopped and redesigned. The lesson is *not* "the folders were messy". Every near-miss had
  the same shape: a result that was internally consistent, well worded, and never once run
  against data of the shape it would actually meet. A pre-import report truncated its own
  evidence to five paths while its sentence claimed eighty-six. A copy-detection threshold
  looked clean on the one archive it was tried on and, on a shape that archive did not
  contain — twenty property folders sharing three boilerplate filenames — told the user to
  keep one folder and discard nineteen. In #26.01 a folder-name repair suggestion, correct
  on every name it was designed for, proposed renaming `48-50Arhiva` to `48-50Arh||iva`.
  Not one of the three was visible in the code; every one was obvious the moment a real
  input was pushed through it. **So: before claiming a rule, a threshold or a generated
  value is right, run it over the shape that would embarrass it** — the archive, the
  boundary, the folder full of near-identical siblings — and put the measured numbers in
  the comment. Where a number is load-bearing, say so beside it and re-measure when the
  rule changes rather than assuming it still holds.

- **A rule that describes what the system does must be derived from the code that does it,
  never from the document that asked for it.** Slice #26.01's structure rules delegate to
  `isPageGroupMember` and `coordinateNameConfidence` rather than restating them, because a
  rule written from the source document alone would have blessed a folder of `1.pdf` /
  `2.pdf` that `isPageGroup` refuses — telling the user the folder is correct, reporting a
  successful import, and producing three documents where one was meant. A validator that
  disagrees with the executor is worse than no validator, because it is believed.

- **`npm run e2e` needs `npm run dev` already running in a separate terminal.** When it isn't,
  every test times out waiting for a page load — a failure mode that looks nothing like
  "the dev server isn't running." Say so every time you ask Adrian to run it.
- **Then stop the dev server.** `next dev` rewrites `.next/` continuously, so `tsc` reads a
  moving target, and `jest` workers OOM against it and report it as a test failure.
- Claude runs `npm run lint` (whole tree) and `npx tsc --noEmit` (full project) over the bridge
  before every handover, and shows each with its exit code and wall time; a fallback is named for
  what it is. Adrian runs the other two — `npm run e2e`, then `npx jest` — plus whichever of
  Claude's did not complete, before anything is considered done. See
  `C:\dev\.claude\rules\sandbox-and-toolchain.md`.

## A migration is delivered TWICE, and the second one is the one that gets forgotten

**Local Docker and Supabase are two databases, and a migration applied to one is not applied
to the other.** Until Slice #36.04 the cloud half was "paste the file into the Supabase SQL
Editor", which recorded nothing — so the only record of what the live project held was
Adrian's memory of which tabs he had pasted, and a skipped paste stayed invisible until a
route 500'd in production.

Both halves now have a runner, and both record what they applied in that database's own
`schema_migrations`:

| | Command | Applies to |
|---|---|---|
| Local | `.\scripts\Apply-Migration.ps1` | the `ga40prj-postgres` container |
| Cloud | `npm run supabase:migrate` | the project in `SUPABASE_SYNC_URL` |

- **Claude ends every slice that adds or changes a migration by asking Adrian to run BOTH, as
  two separate lines in the handover, naming the file.** Not "and apply it to Supabase too" —
  the command, written out. This is the step that gets dropped, which is why it is a rule and
  not a habit.
- **Both are idempotent**: running either twice applies nothing the second time. That is a
  property of the RUNNERS, not of the migration files — most of those are not safe to run
  twice, which is why both refuse rather than re-run whenever they cannot prove a file is
  pending.
- `npm run supabase:migrate -- --status` reports without changing anything, and is the right
  thing to ask for when the question is "is the cloud behind?"
- **The first run against a cloud project needs a baseline**, once:
  `npm run supabase:migrate -- --baseline 086`. It RUNS nothing — it records 008..086 as
  already applied, because `supabase_schema_full.sql` builds that schema without writing a
  single `schema_migrations` row. The runner refuses to guess a baseline and stops instead;
  see `.claude/rules/database-and-migrations.md` and the header of `scripts/supabase-migrate.ts`.
- **`npm run supabase:sync` is not this.** That drops the cloud project and rebuilds it from
  `supabase_schema_full.sql` plus the reference tables. It is the full reset; this is the
  incremental path, and after a sync the project needs its baseline declared again.


## Domain model

Three core objects with many-to-many relationships, including self-referential ones:

- **Person** — individuals (natural) or organizations (judicial)
- **Document** — documents, contracts, certificates
- **Property** — parcels with PostGIS geometry (points, polygons)

Relationships: People ↔ Documents, People ↔ Properties, Documents ↔ Properties, plus
self-references. All three are versioned (full-snapshot history).

Codes: entity prefixes are `DOC` / `JPERS` / `PPERS` / `PROP` — **never `PERS`** — and their
sort order is load-bearing. Group codes are `GRP-001`, not two letters.

Pagination: page size 15. Entity lists keep `page` in **local state** and send `offset` to
their API. Only global search puts it in the URL — `?page=`, 1-based in the URL, 0-based in
state to match `PaginationControls`, with `page=1` omitted. That is the precedent to copy,
not a pattern the other lists already follow.

`src/db/schema/index.ts` is the authoritative shape; read it at the start of every slice.

## Tech stack

- **Frontend** — Next.js 16.2.4 (App Router), React 19.2.4, Tailwind CSS v4
- **Data fetching** — TanStack Query 5
- **Forms + validation** — React Hook Form 7 + Zod v4 (`import { z } from "zod/v4"`)
- **Maps** — `@vis.gl/react-google-maps` ^1.8.3. `APIProvider` wraps the whole app in
  `src/components/providers/maps-provider.tsx`, seeded with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
  Leaflet is still in `package.json` but dead — never reach for it.
- **i18n** — next-intl, `en-GB` + `ro-RO`, cookie-based (no URL segment). The runtime-editable
  exception is `help_content` / `help_hint`, whose bilingual text lives in inline DB columns:
  `background_en`/`background_ro`, `how_to_en`/`how_to_ro`, `hint_en`/`hint_ro`.
- **Database** — PostgreSQL 16 + PostGIS 3.4 (`postgis/postgis:16-3.4`), Drizzle, pgAdmin 4
- **Testing** — Jest 30 (`next/jest`, jsdom, Testing Library), colocated under
  `src/__tests__/` + Playwright (`e2e/`, deliberately not in CI)
- **CI** — GitHub Actions: `npm ci` → lint → test → build
- **Cloud** — Vercel + Supabase, `https://ga40prj.vercel.app`; every push to `main` deploys

This list is a summary, not the source of truth. **`package.json` is** — check it before
assuming any API, and fix this section whenever the two disagree.

## Key paths

- `C:\dev` — the session root. Adrian connects **this** folder, not the repo, so that
  `C:\dev\CLAUDE.md` and `C:\dev\.claude\rules\` load.
- `C:\dev\ga40prj` — this repo, read-write. **Access is granted; never ask for it.**
- `C:\dev.docs` — Adrian's reference docs: stack decisions, install logs, credentials,
  future mockups. There is **no `ga40prj` level** under it — the numbered folders
  (`01.Slice.Inputs`, `02.01.Import.topics`, `05.02.User.Manual` …) sit at its root.
- `C:\dev.docs\01.Slice.Inputs\` — slice input docs, one folder per slice. Read only the
  folder for the current slice; don't re-read mockups from earlier slices.

## Where the rest of the knowledge lives

**Existing UI code is the source of truth for patterns from earlier slices.** These files are
the source of truth for decisions and traps, and load automatically when relevant:

| Need | Location |
|---|---|
| Working contract, autonomy, commits, PowerShell | `C:\dev\CLAUDE.md` + `C:\dev\.claude\rules\` |
| **Editing** any of those six shared files | `docs/claude/shared/`, then deploy in the same turn — the banner at the top of `C:\dev\CLAUDE.md` |
| Traps for a file family you're editing | `.claude/rules/*.md` — auto-loads on matching paths |
| Add version history to an entity | `.claude/skills/add-entity-versioning/` |
| Onboard a new document type | `.claude/skills/onboard-document-type/` |
| What a past slice actually did | `git log`, then `docs/claude/slice-log-archive.md` |
| What was noticed and not yet fixed | `docs/claude/FOLLOW-UP-REGISTER.md` |
| How the register is reviewed each Monday, and the fix slate it proposes | `docs/claude/REGISTER-REVIEW.md` |
| What every kind of testing here is for, and what nobody tests | `docs/testing/` |

## Starting a slice

First, before any other work, raise together the platform prompts the header will need — delete
permission always, computer use or a Chrome site only for screen work (`C:\dev\CLAUDE.md` →
„Never wait"). Then read, in one batch: this file, `git log --oneline -20`, and
`src/db/schema/index.ts`.
Then read whatever else the slice needs — freely, without asking. See the autonomy section
in `C:\dev\CLAUDE.md`.

## Ending a slice: file what it noticed

Everything a slice notices and does not fix goes into `docs/claude/FOLLOW-UP-REGISTER.md`, in the
slice's **last** commit — after the fix commits, because a `resolved` row names the commit that fixed
it and a commit cannot name itself.

- Every „Noticed, not fixed" item, recommendation and open question the handover makes becomes a row.
  One the register already holds gets a new `Raised` ref instead, and the handover cites its `FU-nnn`
  rather than describing it again.
- An item fixed in passing that matches an open row closes it: `resolved`, with that commit.
- Update the summary block with the table — `src/__tests__/follow-up-register.test.ts` fails when it
  disagrees. Fields, statuses and the bar for an entry are in the register's header, not here; a
  wording preference is never an entry.
