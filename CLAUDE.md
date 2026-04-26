@AGENTS.md

# Project brief — ga40prj

A local-first web application for managing **People**, **Paperwork**, and **Properties**, with PostGIS-backed spatial data and bilingual English/Romanian UI. Built one vertical slice at a time. Cloud target is Vercel + Supabase but nothing is wired up yet — everything runs locally for now.

The summary below is a quick orientation. The full source of truth for project intent and our working agreement lives in `C:\dev.docs\ga40prj\01.Every.Time\` — see the section directly below.

## Read at the start of every session

The folder `C:\dev.docs\ga40prj\01.Every.Time\` is the source of truth for project intent and our working agreement. Claude should read these four documents at the start of every session, in this order:

1. `01.01.EVERY.TIME.Claude.Project.Instructions.docx` — Claude's role, the domain model, the locked-in tech stack, and development constraints.
2. `01.02.EVERY.TIME.Project.Info.docx` — real estate context, architectural considerations, bilingual and M:M relationship notes.
3. `01.High.Level.Collaboration.docx` — how Adrian and Claude divide work; what Adrian owns (BA, requirements, UAT) versus what Claude owns (implementation).
4. `Accounts.Starters.Notes.docx` — credentials and "starter" install notes. Read for reference; never echo secret values into chat.

If anything in these documents conflicts with the summary in this file or with `AGENTS.md`, the docs in `01.Every.Time/` win.

## Who you're working with

Adrian is the sole user of this repo. He's a business analyst, not a full-time developer — comfortable reading code, running commands, and reasoning about architecture, but he leans on Claude as a full-stack development partner. He works on Windows (PowerShell), keeps reference docs in `C:\dev.docs\ga40prj` (read-only to Claude), and prefers small, deliberate changes over big rewrites.

## Domain model

Three core objects with multiple many-to-many relationships, including self-referential ones:

- **Person** — individuals or organizations connected to the project
- **Paperwork** — documents, contracts, certificates, etc.
- **Property** — parcels with spatial geometry (points, polygons) stored in PostGIS

Relationships: People ↔ Paperwork, People ↔ Properties, Paperwork ↔ Properties, plus self-references (e.g. a Person related to another Person, a Property containing another Property). Field names and type vocabularies live in `ro-RO.json` (which will move under `next-intl` in Slice 0.5).

## Tech stack (locked in)

- **Frontend** — Next.js 16.2.4 (App Router), React 19.2.4, Tailwind CSS v4
- **Data fetching** — TanStack Query 5
- **Forms + validation** — React Hook Form 7 + Zod (planned, Slice 0.5) via `@hookform/resolvers`
- **Maps** — Leaflet 1.9.4 + react-leaflet 5
- **i18n** — next-intl (planned, Slice 0.5); two locales: `en-GB` and `ro-RO`
- **Database** — PostgreSQL 16 + PostGIS 3.4 (Docker image `postgis/postgis:16-3.4`), pgAdmin 4
- **Testing** — Jest 30 with `next/jest` (SWC transformer), jsdom, `@testing-library/react` + `jest-dom`
- **CI** — GitHub Actions: `npm ci` → lint → test → build
- **Cloud target** — Vercel (frontend) + Supabase (Postgres, auth, storage). Not wired up yet.

## Development methodology

**One vertical slice at a time**, in this order: DB schema/migration → API routes → UI components → tests. Each slice ends with a clean commit history and a green CI run before the next slice begins.

**Slice progress**

- Slice #0 — foundation cleanup: `.gitattributes`, externalized Docker secrets, Jest scaffold, CI workflow, README. ✅ Complete.
- Slice 0.5 — install Zod + next-intl (no feature code yet). 🔜 Next.
- Slice #1 — Person CRUD (full DB → API → UI → tests). After Slice 0.5.
- Slice #2+ — Paperwork, Property, relationships, map view, bilingual toggle, etc.

Each slice typically lands as multiple small commits, each individually green.

## Collaboration rules

- **Never commit or push without explicit confirmation.** Same for any irreversible action.
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`, etc.
- **Always check `git status` before making changes**, and never modify files outside `C:\dev\ga40prj`.
- **Adrian runs git in PowerShell on Windows.** Claude prepares file content; Adrian commits and pushes. This avoids Windows-mount permission issues with `.git/index.lock` from the Linux sandbox.
- **Trust HEAD as the source of truth.** The Linux sandbox can show stale or phantom file states (deleted files appearing as untracked, modified files showing clean, etc.). When in doubt, ask Adrian to `git status` on his side.
- **Secrets stay out of chat.** `.env` is gitignored; values come from `C:\dev.docs\ga40prj\01.Every.Time\Accounts.Starters.Notes.docx`. Never echo passwords or API keys back into the conversation.

## Repo conventions

- **Line endings** — LF everywhere, enforced by `.gitattributes`.
- **Env vars** — `.env.example` is the source of truth for keys; `.env` holds values locally and is gitignored.
- **Docker** — compose lives in `docker/postgres/`. PostGIS extensions are created on first boot via `init/01-extensions.sql`. Secrets come in via `--env-file .env`.
- **Tests** — colocated under `src/__tests__/` for now; will move to `*.test.ts(x)` next to source files as the codebase grows.
- **Imports** — prefer absolute paths from `@/` (configured in `tsconfig.json`) over deep relative paths.

## Gotchas we've learned

- **Next.js 16 ≠ training data.** App Router has breaking changes; the old `i18n` config in `next.config.js` is gone (Pages-Router-only). Read `node_modules/next/dist/docs/` before writing routing or middleware code.
- **Tailwind v4 has new syntax.** `@import "tailwindcss";` plus `@theme inline { ... }` instead of `tailwind.config.js`-driven theme keys. Don't reach for v3 patterns.
- **Write tool truncation on `$`.** When writing files containing shell-style `${VAR}` references (e.g. docker-compose), use bash heredoc with a single-quoted delimiter (`<< 'EOF'`) instead of the Write tool.
- **Sandbox file drift from Windows.** Occasionally the Linux sandbox shows files as deleted/added when Adrian's Windows side is clean. Don't react to it — verify on his side.

## Key paths

- `C:\dev\ga40prj` — this repo (read-write)
- `C:\dev.docs\ga40prj` — Adrian's reference docs (read-only): stack decisions, install logs, credentials, future mockups
- `C:\dev\ga40prj\Slice.1.inputs\` — Adrian's mockups/data/info for Slice #1 (he prepares; Claude reviews before development starts)

## Reading order for a fresh session

1. This file (`CLAUDE.md`) — top-down.
2. The four docs in `C:\dev.docs\ga40prj\01.Every.Time\` (see "Read at the start of every session" above).
3. `README.md` — local dev setup and common commands.
4. `package.json` — confirm exact versions before assuming any API.
5. Most recent `git log --oneline -20` — see what just shipped.
6. If a slice is in progress, the slice's input folder (e.g. `Slice.1.inputs/`) and any open work-in-progress branches.
