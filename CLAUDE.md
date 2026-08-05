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

- **Every slice gets an adversarial review before handover — not optional.** Once the code
  is written and type-clean, spawn a subagent whose brief is to *prove the change wrong*:
  find the input, state transition or call site that breaks it, and do not summarise
  approvingly. Give it the diff, the new files, the claims the slice makes, and a numbered
  list of specific things to attack. Tell it to prefer running code over reading it, and to
  end with one line on what it could not break. Then fix what it finds and say so in the
  handover, including anything deliberately left. It has caught a lying CTA, a probe that
  would have blocked every import on Vercel, and a dialog that forced users to destroy
  their own saved session — none of which type-checking or lint would ever see.

- **`npm run e2e` needs `npm run dev` already running in a separate terminal.** When it isn't,
  every test times out waiting for a page load — a failure mode that looks nothing like
  "the dev server isn't running." Say so every time you ask Adrian to run it.
- **Then stop the dev server.** `next dev` rewrites `.next/` continuously, so `tsc` reads a
  moving target, and `jest` workers OOM against it and report it as a test failure.
- Claude runs `tsc --noEmit` in the sandbox before every handover where the mount allows it;
  where it doesn't, say plainly that only parser diagnostics were run. Adrian runs all four
  locally before anything is considered done. See `C:\dev\.claude\rules\sandbox-and-toolchain.md`.

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
| **Editing** any of those four shared files | `docs/claude/shared/`, then `scripts\Sync-SharedClaude.ps1` |
| Traps for a file family you're editing | `.claude/rules/*.md` — auto-loads on matching paths |
| Add version history to an entity | `.claude/skills/add-entity-versioning/` |
| Onboard a new document type | `.claude/skills/onboard-document-type/` |
| What a past slice actually did | `git log`, then `docs/claude/slice-log-archive.md` |

## Starting a slice

Read, in one batch: this file, `git log --oneline -20`, and `src/db/schema/index.ts`.
Then read whatever else the slice needs — freely, without asking. See the autonomy section
in `C:\dev\CLAUDE.md`.
