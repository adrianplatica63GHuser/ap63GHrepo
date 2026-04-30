@AGENTS.md

# Project brief — ga40prj

A local-first web application for managing **People**, **Paperwork**, and **Properties**, with PostGIS-backed spatial data and bilingual English/Romanian UI. Built one vertical slice at a time. Cloud target is Vercel + Supabase but nothing is wired up yet — everything runs locally for now.

The summary below is a quick orientation. The full source of truth for project intent and our working agreement lives in `C:\dev.docs\ga40prj\01.Every.Time\` — see the section directly below.

## Read at the start of every session

The folder `C:\dev.docs\ga40prj\01.Every.Time\` is the source of truth for project intent and our working agreement. Claude should read `Instructions.docx` — Claude's role, the domain model, the locked-in tech stack, accounts, and development constraints.

If anything in this document conflicts with the summary in this file or with `AGENTS.md`, the doc in `01.Every.Time/` win.

## Who you're working with

Adrian is the sole user of this repo. He's a business analyst, not a full-time developer — comfortable reading code, running commands, and reasoning about architecture, but he leans on Claude as a full-stack development partner. He works on Windows (PowerShell), keeps reference docs in `C:\dev.docs\ga40prj` (read-only to Claude), and prefers small, deliberate changes over big rewrites.

## Domain model

Three core objects with multiple many-to-many relationships, including self-referential ones:

- **Person** — individuals or organizations connected to the project
- **Paperwork** — documents, contracts, certificates, etc.
- **Property** — parcels with spatial geometry (points, polygons) stored in PostGIS

Relationships: People ↔ Paperwork, People ↔ Properties, Paperwork ↔ Properties, plus self-references (e.g. a Person related to another Person, a Property containing another Property). Field names and type vocabularies live in `messages/en-GB.json` and `messages/ro-RO.json`, served via next-intl.

## Tech stack (locked in)

- **Frontend** — Next.js 16.2.4 (App Router), React 19.2.4, Tailwind CSS v4
- **Data fetching** — TanStack Query 5
- **Forms + validation** — React Hook Form 7 + Zod v4 (`import { z } from "zod/v4"`) via `@hookform/resolvers`
- **Maps** — Leaflet 1.9.4 + react-leaflet 5
- **i18n** — next-intl; two locales: `en-GB` and `ro-RO`; cookie-based (no URL segment); messages in `messages/*.json`
- **Database** — PostgreSQL 16 + PostGIS 3.4 (Docker image `postgis/postgis:16-3.4`), pgAdmin 4
- **Testing** — Jest 30 with `next/jest` (SWC transformer), jsdom, `@testing-library/react` + `jest-dom`
- **CI** — GitHub Actions: `npm ci` → lint → test → build
- **Cloud target** — Vercel (frontend) + Supabase (Postgres, auth, storage). Not wired up yet.

## Development methodology

**One vertical slice at a time**, in this order: DB schema/migration → API routes → UI components → tests. Each slice ends with a clean commit history and a green CI run before the next slice begins.

**Slice progress**

- Slice #0 — foundation cleanup: `.gitattributes`, externalized Docker secrets, Jest scaffold, CI workflow, README. ✅ Complete.
- Slice 0.5 — Zod v4 + next-intl installed and wired (cookie-based locale, `src/i18n/request.ts`, `src/lib/i18n/locale.ts`, `NextIntlClientProvider` in root layout, bilingual toggle on list pages). ✅ Complete (landed inside Slices #1–2).
- Slice #1 — Person CRUD (full DB → API → UI → tests). ✅ Complete.
- Slice #2 — Property CRUD with map view, Stereo70 input, PostGIS corners, bilingual UI. ✅ Complete.
- Slice #2.5 — Property UI polish: Google Maps (satellite/street toggle), full-page map fix, compact 4-col cadastral layout, full-width stacked minimap, draggable corner markers, click-to-draw polygon, DD/DMS/S70 input inheritance in Add/Edit corner row. ✅ Complete.
- Slice #3 — Paperwork CRUD. 🔜 Next.
- Slice #4+ — Relationships (People ↔ Properties ↔ Paperwork, self-refs), relationship map view, etc.

Each slice typically lands as multiple small commits, each individually green.

## Collaboration rules

- **Never commit or push without explicit confirmation.** Same for any irreversible action.
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`, etc.
- **Always check `git status` before making changes**, and never modify files outside `C:\dev\ga40prj`.
- **Adrian runs git in PowerShell on Windows.** Claude prepares file content; Adrian commits and pushes. This avoids Windows-mount permission issues with `.git/index.lock` from the Linux sandbox.
- **Trust HEAD as the source of truth.** The Linux sandbox can show stale or phantom file states (deleted files appearing as untracked, modified files showing clean, etc.). When in doubt, ask Adrian to `git status` on his side.
- **Secrets stay out of chat.** `.env` is gitignored; values come from `C:\dev.docs\ga40prj\01.Every.Time\Instructions.docx`. Never echo passwords or API keys back into the conversation.

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
- **Zod v4 import.** The package is `zod ^4.x`. Always use `import { z } from "zod/v4"` — the default `"zod"` entry point re-exports v3 shims for compatibility and behaves differently.

## Key paths

- `C:\dev\ga40prj` — this repo (read-write)
- `C:\dev.docs\ga40prj` — Adrian's reference docs (read-only): stack decisions, install logs, credentials, future mockups
- `C:\dev\ga40prj\Slice.1.inputs\` — Adrian's inputs for Slice #1 (reference only, complete)
- `C:\dev\ga40prj\Slice.3.inputs\` — Adrian's mockups/data/info for Slice #3 when ready (he prepares; Claude reviews before development starts)

## Reading order for a fresh session

1. This file (`CLAUDE.md`) — top-down.
2. The doc in `C:\dev.docs\ga40prj\01.Every.Time\` (see "Read at the start of every session" above).
3. `README.md` — local dev setup and common commands.
4. `package.json` — confirm exact versions before assuming any API.
5. Most recent `git log --oneline -20` — see what just shipped.
6. If a slice is in progress, the slice's input folder (e.g. `Slice.1.inputs/`) and any open work-in-progress branches.
