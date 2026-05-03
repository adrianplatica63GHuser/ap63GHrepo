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
- **Maps** — `@vis.gl/react-google-maps ^1.8.3` (Google Maps JS API React wrapper). Leaflet 1.9.4 + react-leaflet 5 are still installed but no longer used — do not reach for them. The `APIProvider` wraps the whole app in `src/components/providers/maps-provider.tsx`, seeded with `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
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
- Slice #2.5 — Property UI polish. ✅ Complete. Full detail below.
- Slice #2.6 — Vercel + Supabase deployment + home page launching pad. ✅ Complete. Full detail below.
- Slice #3 — Sidebar navigation refactor. ✅ Complete. Full detail below.
- Slice #4 — Paperwork CRUD. ✅ Complete (schema + API + UI landed in earlier sessions).
- Slice #4.1 — Sidebar & nav polish. ✅ Complete. Full detail below.
- Slice #4.2 — Paperwork filter re-sync + flag locale switcher. ✅ Complete. Full detail below.
- Slice #5+ — Relationships (People ↔ Properties ↔ Paperwork, self-refs), relationship map view, etc.

Each slice typically lands as multiple small commits, each individually green.

### Slice #4.2 — Paperwork filter re-sync + flag locale switcher (detail)

Pure frontend — no DB schema or API changes.

**1. Paperwork type filter re-syncs on every sidebar click**
- Root cause: `PaperworkListView` seeded `typeFilter` via `useState(initialType)`. React's state initialiser only runs on mount, so navigating between `/paperwork?type=A` and `/paperwork?type=B` while already on `/paperwork` left the filter stale.
- Fix: added `useEffect(() => { setTypeFilter(initialType); }, [initialType])` in `src/app/paperwork/list-view.tsx`. Now every time `page.tsx` re-renders with a new `initialType` from `searchParams`, the effect fires and the filter updates immediately.

**2. Locale toggle replaced with flag emoji buttons**
- `src/components/locale-toggle.tsx` rewritten: `🇬🇧` and `🇷🇴` emoji buttons replace the old `EN` / `RO` text pill.
- Active (current) locale: `grayscale opacity-50 cursor-default` — appears black-and-white and depressed.
- Inactive locale: full colour, `cursor-pointer hover:scale-110` — inviting to click.
- `LOCALE_META` record maps each locale code to its flag and accessible `aria-label` / `title`.
- Behaviour (cookie write + `router.refresh()`) is unchanged.

### Slice #4.1 — Sidebar & nav polish (detail)

Pure frontend — no DB schema or API changes.

**1. Locale toggle moved into the header bar**
- `LocaleToggle` removed from the bottom slot (the `border-t` div is gone entirely).
- Now rendered in the `h-14` header bar between the "GA40" wordmark and the collapse button.
- Still hidden in collapsed mode (`!isCollapsed` guard unchanged).

**2. Single-open accordion**
- `openSections: Set<string>` replaced by `openSection: string | null`.
- `toggleSection` sets `openSection` to the clicked key, or `null` if it was already open.
- Navigation `useEffect` sets `openSection = activeSectionKey` (replacing whatever was open before, rather than adding to a set).

**3. Paperwork section — 19 real document types**
- `nav-config.ts`: removed the 5 placeholder items (`certificate`, `authorization`, `deed`, `extract`, `report`); renamed `contract` → `allDocuments`; added 20 items total (1 "All Documents" + 19 type-specific links, each `href="/paperwork?type=TYPE_KEY"`). All 19 type items use the `File` icon from lucide-react. Unused icon imports (`FileSignature`, `Award`, `ShieldCheck`, `ScrollText`, `Search`, `BarChart2`) removed.
- `sidebar-nav.tsx`: `itemLabels` map updated to match — old 6 paperwork keys replaced with the new 20.
- `messages/en-GB.json` + `messages/ro-RO.json`: `nav.items` updated (old 6 keys removed, 20 new keys added with bilingual labels; English uses translated equivalents, e.g. `TESTAMENT` → "Will").
- `src/app/paperwork/page.tsx`: accepts `searchParams: Promise<...>`, awaits it, extracts `type`, passes as `initialType` prop to `PaperworkListView`.
- `src/app/paperwork/list-view.tsx`: `PaperworkListView` accepts `initialType?: string` and seeds `typeFilter` state from it — so clicking a sidebar type link lands the user on the list pre-filtered.

**Active-state note**
- `usePathname()` strips query strings, so all 19 type links and "All Documents" share pathname `/paperwork`. Only "All Documents" highlights as active. Individual type highlighting is a future enhancement if needed.

### Slice #3 — Sidebar navigation refactor (detail)

Pure frontend — no DB schema or API changes.

**New components**
- `src/components/sidebar/sidebar-helpers.ts` — pure route-matching helpers (`isItemActive`, `getActiveHref`, `getActiveSectionKey`); no external deps; unit-tested.
- `src/components/sidebar/nav-config.ts` — declarative nav structure: 4 `NavSection` objects (people / property / paperwork / administration), each with a `LucideIcon` and a list of `NavItem`s. An item without `href` is rendered disabled (coming soon).
- `src/components/sidebar/sidebar-nav.tsx` — client component. Accordion sections, collapse-to-icons toggle, `localStorage`-persisted collapse state, `usePathname` auto-highlights the active item and auto-expands its parent section on navigation.
- `src/components/app-shell.tsx` — server component wrapper: `<SidebarNav>` + `<div class="flex-1 overflow-auto">` for page content. Inserted inside `QueryProvider` in the root layout.

**Layout change**
- `src/app/layout.tsx` — `AppShell` wraps `{children}` inside `QueryProvider`.
- `src/app/page.tsx` — the 4-panel launching pad replaced by a slim centred welcome screen; navigation is now entirely the sidebar.

**Sidebar behaviour**
- Expanded width: 224 px (`w-56`). Collapsed (icons only): 56 px (`w-14`). CSS `transition-[width]` for smooth animation.
- Section header click: toggles the accordion (expanded mode) or expands the sidebar (collapsed mode).
- Active item: `bg-cta-pale text-cta font-medium`. Disabled/coming-soon items: `text-fade opacity-60 cursor-not-allowed`.
- Bottom slot: `LocaleToggle` (hidden in collapsed mode).
- `localStorage` key: `"sidebar-collapsed"` (`"true"` / `"false"`). Read in `useEffect` after mount to avoid SSR hydration mismatch.

**i18n**
- Added `nav` namespace to both message files: `sections.*`, `items.*`, `collapse`, `expand`.
- Added `welcome` namespace for the new home page.

**Page header cleanup**
- Removed `LocaleToggle` + invisible centering-spacer from all 8 page headers (`natural-persons/page`, `natural-persons/new`, `natural-persons/[id]`, `properties/page`, `properties/new`, `properties/[id]`, `properties/map`, `admin/value-lists`).
- Map page: `h-screen` → `h-full` (fills the AppShell content area via the flex chain; semantically correct now that the shell provides viewport height).

**Active-route matching gotcha**
- `getActiveHref` returns the *longest* matching href for a given pathname. This ensures `/properties/map` is highlighted (not `/properties`) when the user is on the map page, because both share a prefix.

### Slice #2.6 — Vercel + Supabase deployment + home page (detail)

**Cloud setup**
- Supabase project: `ga40prj` (EU West / Ireland), signed in via Google (`adrianplatica63@gmail.com`). PostGIS enabled manually via `CREATE EXTENSION IF NOT EXISTS postgis;` in SQL editor.
- Schema applied via Supabase SQL editor (drizzle-kit `migrate` could not connect cleanly due to SSL/driver issues with the sandbox; the combined migration SQL is in `supabase_migrations.sql`, gitignored).
- Vercel project: `ga40prj` at `https://ga40prj.vercel.app`, connected to `adrianplatica63GHuser/ap63GHrepo`. Every push to `main` auto-deploys.
- Env vars set in Vercel: `DATABASE_URL` (Supabase pooled, port 6543), `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID`.

**Two connection strings (important)**
- `DIRECT_URL` (port 5432, direct) — local `.env` only; used by `drizzle-kit` for migrations. Never goes to Vercel.
- `DATABASE_URL` (port 6543, Supabase pooler) — used by the running app. Set in both local `.env` and Vercel env vars.
- `drizzle.config.ts` prefers `DIRECT_URL` when present, falls back to `DATABASE_URL`.
- For local dev: `DATABASE_URL` still points at Docker Postgres; only set `DIRECT_URL` when intentionally migrating schema to Supabase.

**SSL**
- `src/db/index.ts` — `Pool` passes `ssl: { rejectUnauthorized: false }` when `NODE_ENV === "production"`. No effect on local Docker.

**Future schema migrations to Supabase**
- Run `npm run db:migrate` locally with `DIRECT_URL` pointing at Supabase (port 5432, `?sslmode=require` appended). If drizzle-kit fails silently again, paste the new migration SQL file directly into the Supabase SQL editor.

**Home page launching pad**
- `src/app/page.tsx` replaced with a four-section grid: People, Property, Paperwork, Administration.
- Active buttons: Natural Person → `/natural-persons`; Land — List → `/properties`; Land — Map → `/properties/map`.
- All other buttons are visually disabled with a "coming soon" / "în curând" label — they become active as slices land.
- Bilingual strings live in `messages/en-GB.json` and `messages/ro-RO.json` under the `"home"` key.

### Slice #2.5 — Property UI Polish (detail)

Everything below is live in `main`. No DB schema or API changes — pure frontend.

**Google Maps switch (`@vis.gl/react-google-maps`)**
- Replaced Leaflet + OpenStreetMap on both the property detail mini-map and the full `/properties/map` page.
- `APIProvider` lives in `src/components/providers/maps-provider.tsx` and is mounted in the root layout — one SDK load shared across all pages.
- Two env vars required (see `.env.example`):
  - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — the Maps JS API key (already in `.env`)
  - `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` — a Cloud map ID, required by `AdvancedMarker`. Falls back to `"DEMO_MAP_ID"` (Google's official dev placeholder) when unset, which is sufficient for local dev.
- Both maps have a **STR / SAT toggle** (roadmap vs hybrid satellite).

**Full-page map black-render fix**
- `map/page.tsx` — the `flex-1 min-h-0` container now wraps `<MapView>` in `<div className="absolute inset-0">` inside a `relative` parent. This gives Google Maps a concrete pixel bounding box; `height: 100%` on the `<Map>` component would not resolve without it.

**Compact cadastral data panel**
- `PropertyForm`'s `Section` helper now accepts `columns?: 1 | 2 | 3 | 4` (default `2`).
- Class map in `COLUMNS_CLASS`: `4` → `"grid grid-cols-2 gap-4 md:grid-cols-4"` — jumps straight from 2 columns (mobile) to 4 columns at 768 px with **no 3-column intermediate step**. Do not re-introduce `md:grid-cols-3` for the 4-col variant; it causes the layout to land on 3 columns on a half-width browser window.
- Cadastral Data section uses `columns={4}`. Address and Notes sections stay at `columns={2}` and `columns={1}`.

**Full-width stacked mini-map**
- Corners + mini-map section switched from `lg:grid-cols-2` (side-by-side) to `flex flex-col gap-4` (stacked).
- Mini-map container: fixed `height: 360px`, full width. `CornersManager` sits above it.

**Draggable corner markers**
- `property-mini-map-inner.tsx` renders an `<AdvancedMarker>` for each corner.
- `draggable={true}` (disabled in draw mode to avoid click/drag ambiguity).
- `onDragEnd` receives a `google.maps.MapMouseEvent`; access position via `e.latLng?.lat()` / `e.latLng?.lng()` (these are method calls — not plain properties).
- On drag-end, calls `onChange(corners.map(...))` which updates the form's `corners` state and re-renders the `CornersManager` table immediately.

**Click-to-draw polygon**
- "✏ Draw" button in the bottom-left corner of the mini-map.
- When active: cursor switches to crosshair (`draggableCursor="crosshair"` on `<Map>`), each click on the map appends a corner via `onChange([...corners, newCorner])`, and a blue preview `<Polyline>` tracks from the last placed corner to the mouse cursor (via `onMousemove` on `<Map>`).
- Clicking the first corner marker when ≥ 3 corners are placed closes the polygon and exits draw mode. "✓ Done" button exits at any time.
- Hint text in the draw toolbar adapts: "Click map to place first corner" → "Click map to add corners" → "...· click corner 1 to close".

**Two-way sync between table and map**
- `corners: Corner[]` state lives in `PropertyForm` and is the single source of truth.
- `CornersManager` receives `corners` + `onChange` (table edits update form state).
- `PropertyMiniMap` / `PropertyMiniMapInner` now also receives `onChange` — map interactions call the same setter.
- `property-mini-map.tsx` (the dynamic-import wrapper) threads both props: `<Inner corners={corners} onChange={onChange} />`.
- `FitBounds` (child of `<Map>`) auto-fits the viewport to corners on first render only (guarded by a `useRef` flag so it doesn't fight the user's pan/zoom after that).

**Map event type nuance (important for future work)**
- `<Map>` component events (`onClick`, `onMousemove`) → library type `MapMouseEvent` from `@vis.gl/react-google-maps`. Access position via `event.detail.latLng` which is a plain `{ lat: number; lng: number } | null`.
- `<AdvancedMarker>` drag events (`onDragEnd`) → native `google.maps.MapMouseEvent`. Access position via `e.latLng?.lat()` and `e.latLng?.lng()` (method calls on a `LatLng` object, not a literal).
- Do not mix these up — `event.detail.latLng.lat` (property, no call) vs `e.latLng.lat()` (method call).

**Stereo70 display + Add/Edit corner inheritance**
- `CornersManager` has a three-way **Display** toggle: DD / DMS / Stereo 70. This controls the read-only coordinate display in the table.
- `InputMode` (for the Add/Edit inline row) is now `"DD" | "DMS" | "STEREO70"` — DMS is a full input mode, not just display.
- `displayFmtToInputMode(fmt)` maps display format → input mode: `"DD"→"DD"`, `"DMS"→"DMS"`, `"S70"→"STEREO70"`.
- Both the Add row and Edit row receive `initialMode={displayFmtToInputMode(displayFmt)}` — no mode-selector toggle inside the row itself. The row opens directly in the right mode.
- DMS input UI: two rows (lat / lon), each with separate `°` / `′` / `″` number fields and N/S or E/W toggle buttons. Conversion uses `decimalToDMS` / `dmsToDecimal` from `src/lib/geo/dms.ts`. Label span is `w-16` (64 px) to fit "Latitude"/"Longitude"; degree/minute inputs are `w-10`, seconds `w-16`.

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
- **Sandbox file drift from Windows.** Occasionally the Linux sandbox shows files as deleted/added when Adrian's Windows side is clean. Don't react to it — verify on his side. `tsc --noEmit` in the sandbox also shows phantom JSX parse errors on perfectly valid files that are already committed; these are sandbox artefacts, not real errors. Always verify with `git diff` on Adrian's side.
- **Zod v4 import.** The package is `zod ^4.x`. Always use `import { z } from "zod/v4"` — the default `"zod"` entry point re-exports v3 shims for compatibility and behaves differently.
- **`AdvancedMarker` requires `mapId`.** Using `<AdvancedMarker>` without a `mapId` on the parent `<Map>` triggers the "This page can't load Google Maps correctly" error overlay on every render. Always pass `mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}` to any `<Map>` that hosts `AdvancedMarker` children. `"DEMO_MAP_ID"` is Google's official dev placeholder and requires no Cloud Console setup.
- **Google Maps height chain.** `<Map style={{ height: "100%" }}>` only resolves when every ancestor has a concrete pixel height. `flex-1` alone (flex-algorithm height) does not satisfy this — wrap the map container in `<div className="relative flex-1 min-h-0"><div className="absolute inset-0">...</div></div>` to give it a concrete bounding box.
- **`@vis.gl/react-google-maps` event types differ by component.** `Map` component events give `MapMouseEvent` (library type) where `latLng` is a plain literal accessed as `event.detail.latLng?.lat` (property). `AdvancedMarker` drag events give `google.maps.MapMouseEvent` where `latLng` is a `LatLng` object accessed as `e.latLng?.lat()` (method call). Mixing these up is a silent runtime bug.
- **4-column grid: skip the 3-column step.** For `columns={4}` in the `Section` helper, use `"grid grid-cols-2 gap-4 md:grid-cols-4"` — do not add a `md:grid-cols-3` intermediate. At common "half-width browser" sizes (768–1023 px) the 3-column class strands the layout on 3 columns instead of 4.

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
