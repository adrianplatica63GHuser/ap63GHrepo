@AGENTS.md

# Project brief — ga40prj

A web application for managing **People**, **Paperwork**, and **Properties**, with PostGIS-backed spatial data and bilingual English/Romanian UI. Built one vertical slice at a time. Deployed on Vercel + Supabase; local Docker Postgres remains the primary dev environment.

## How Claude works with Adrian (generic rules)

These apply regardless of which slice is in progress:

- **One vertical slice at a time** — confirm the current slice before writing any code.
- **Wait for approval before writing code** at the start of every session.
- **Provide complete, ready-to-copy code** — components, hooks, schema migrations, API routes. No stubs or placeholders unless explicitly asked.
- **Include TypeScript types, error handling, loading states, and accessibility** on every component.
- **Bilingual by default** — use the established next-intl patterns already in the repo; never hard-code UI strings.
- **Never commit or push without explicit confirmation.** Same for any irreversible action.
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`.

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
- **Cloud target** — Vercel (frontend) + Supabase (Postgres, auth, storage). Live at `https://ga40prj.vercel.app`. Every push to `main` auto-deploys.

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
- Slice #4.3 — Inline field labels across all three detail forms. ✅ Complete. Full detail below.
- Slice #4.4 — Document list filtering via sidebar checkboxes + "Paperwork" → "Documents" GUI rename. ✅ Complete. Full detail below.
- Slice #4.5 — CI lint fixes: three `react-hooks/set-state-in-effect` errors. ✅ Complete. Full detail below.
- Slice #5.n — Relationships (People ↔ Properties ↔ Paperwork, self-refs), relationship map view. ✅ Complete.
- Slice #6.0 — Pagination on all lists. ✅ Complete. Full detail below.
- Slice #6.1 — Pagination for association lists. ✅ Complete. Full detail below.
- Slice #7.0 — Authentication. ✅ Complete. Full detail below.
- Slice #7.1 — Bilingual (Romanian) sign-in page. ✅ Complete. Full detail below.
- Slice #7.2 — Push auth to GitHub / Vercel. ✅ Complete.
- Slice #7.3 — Fix TypeScript build error in `proxy.ts`. ✅ Complete. Full detail below.
- Slice #8.0 — Principal Object base class + shared code counter. ✅ Complete. Full detail below.
- Slice #9.1 — Fix Romanian diacritics in lookup tables. ✅ Complete. Full detail below.
- Slice #9.6 — Document Pages: file upload per paperwork record. ✅ Complete. Full detail below.
- Slice #9.7 — Reference Data: split "Services & Interests" into two separate lists under an "Others" section. ✅ Complete. Full detail below.
- Slice #9.8 — Reference Data: rename lookup table + add Groups and Stamps lists. ✅ Complete. Full detail below.
- Slice #9.9 — Reference Data: Description field on Services, Interests, Groups, Stamps. ✅ Complete. Full detail below.
- Slice #10.03 — Reference Data: Person Roles list. ✅ Complete. Full detail below.
- Slice #10.04 — Reference Data: Document Persons (Document Type ↔ Person Role associations). ✅ Complete. Full detail below.
- Slice #10.05 — Reference Data: Property Persons (Person Role whitelist for Property ↔ Person associations). ✅ Complete. Full detail below.

Each slice typically lands as multiple small commits, each individually green.

### Slice #4.4 — Document list filtering via sidebar checkboxes (detail)

Pure frontend + small API extension — no DB schema changes.

**What changed**

**Sidebar (`src/components/sidebar/sidebar-nav.tsx` + `nav-config.ts`)**
- `nav-config.ts`: paperwork section items replaced with an empty array. The `File` icon import removed. The sidebar handles the paperwork section entirely via `PaperworkNavSection`.
- `PaperworkNavSection` — new client component rendered for `section.key === "paperwork"`:
  - First row: `(Select All)` checkbox with native browser indeterminate state (via `ref.indeterminate`).
  - 19 rows: one checkbox per `PAPERWORK_TYPES` entry, labelled via `t("types.*")` from the `paperwork` namespace.
  - State: `checkedTypes: Set<string>` initialised to all 19 types (all checked).
  - Resets to all-checked whenever the accordion transitions from closed → open (tracked with `wasOpen` ref).
  - Indeterminate rule: 1–18 checked → (Select All) indeterminate; 0 → unchecked; 19 → checked.
  - On any checkbox change → `router.push(...)`: all 19 → `/paperwork`; 0 → `/paperwork?types=`; 1–18 → `/paperwork?types=A,B,C,...`.
- `activeSectionKey` computation updated: if `getActiveSectionKey` returns null but `pathname.startsWith("/paperwork")`, returns `"paperwork"` (since paperwork items are no longer in nav-config, the helpers can't auto-detect the active section).

**API layer**
- `src/lib/paperwork/validation.ts`: `paperworkListQuerySchema` field `type` (single enum) replaced by `types` (optional `PaperworkType[]`). Empty array guard documented.
- `src/lib/paperwork/queries.ts`: imports `inArray` from drizzle-orm. Early return `{ items: [], total: 0 }` when `opts.types` is an empty array (avoids `IN ()` bad SQL). Otherwise uses `inArray(paperwork.type, opts.types)` when types are specified.
- `src/app/api/paperwork/route.ts`: parses `?types=A,B` comma-separated string → `PaperworkType[]`. Key absent → `undefined` (show all); key present but empty (`?types=`) → `[]` (show nothing); otherwise splits and validates each token against `PAPERWORK_TYPES`.

**List view (`src/app/paperwork/list-view.tsx` + `page.tsx`)**
- Prop changed: `initialType?: string` → `initialTypes?: string[]` (`undefined` = all, `[]` = nothing, `[...]` = filter).
- `<select>` type dropdown removed.
- When `typeFilters` is `[]`: skips the API call (`enabled: false`) and renders a "please select at least one document type" message instead of the table.
- `page.tsx` parses `?types=` from `searchParams` into `string[] | undefined` and passes as `initialTypes`.
- `fetchPaperwork` sends `?types=A,B` param when types are specified.

**"Paperwork" → "Documents" GUI rename (English only)**
- `messages/en-GB.json`: updated `home.subtitle`, `home.sections.paperwork`, `nav.sections.paperwork`, `paperwork.listTitle`, `property.tabs.paperwork`, `naturalPerson.tabs.paperwork`.
- Both JSON files: removed `paperwork.filterAll` (dropdown gone) and `nav.items.allDocuments` (no longer a nav item); added `paperwork.selectAll` and `paperwork.noTypeSelected`.
- Romanian strings were already "Acte" / "Document" everywhere — no display changes needed.

**Non-GUI "Paperwork" occurrences (intentionally NOT renamed)**
- File/folder paths, API routes, DB table, TypeScript type names, i18n namespace keys — all remain `paperwork`. Renaming them is a wide cross-cutting change deferred to a future slice.

**Files touched**
- `src/lib/paperwork/validation.ts`
- `src/lib/paperwork/queries.ts`
- `src/app/api/paperwork/route.ts`
- `src/app/paperwork/list-view.tsx`
- `src/app/paperwork/page.tsx`
- `src/components/sidebar/nav-config.ts`
- `src/components/sidebar/sidebar-nav.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`

### Slice #4.5 — CI lint fixes (detail)

Pure frontend — no DB schema, API, or i18n changes.

**Problem**: Three `react-hooks/set-state-in-effect` errors blocked the GitHub Actions CI run (`npm run lint` exits with code 1). All three were cases of calling `setState` synchronously inside a `useEffect` body.

**Fix 1 — `src/app/paperwork/list-view.tsx`**
- Removed the `typeFilters` local state and the `useEffect(() => setTypeFilters(initialTypes), [initialTypesKey])` that synced it from props.
- Root cause: `typeFilters` was always just a copy of `initialTypes` — the URL drives everything (sidebar checkbox → `router.push` → `page.tsx` re-renders with new `initialTypes` → component re-renders). No local state copy was ever needed.
- Fix: use `initialTypes` directly in `noTypesSelected`, `typeFiltersKey`, and `queryFn`. The component re-renders naturally when `initialTypes` changes.

**Fix 2 — `src/components/sidebar/sidebar-nav.tsx` (line 304)**
- Replaced `useState(false)` + `useEffect(() => setIsCollapsed(...), [])` pattern for the localStorage-backed `isCollapsed` state.
- Fix: lazy `useState` initializer with a `typeof window === "undefined"` guard — returns `false` on the server (SSR-safe), reads `localStorage` on the client. Added `suppressHydrationWarning` to the `<aside>` element to handle the potential SSR/client mismatch when the stored value is `true`. Visual behaviour is identical to before (sidebar briefly shows expanded then collapses on first load, same as the old `useEffect` approach).

**Fix 3 — `src/components/sidebar/sidebar-nav.tsx` (line 339)**
- Replaced `useEffect(() => setOpenSection(activeSectionKey), [activeSectionKey])` with React's recommended "derived state during render" pattern.
- Added `prevActiveSectionKey` state; during render, if `prevActiveSectionKey !== activeSectionKey && activeSectionKey`, both are updated immediately. This avoids the extra render cycle from `useEffect` and satisfies the lint rule.

**Fix 4 — `src/components/sidebar/sidebar-nav.tsx` (`PaperworkNavSection`)**
- Bug: the `wasOpen` effect reset `checkedTypes` to all-checked on every accordion open, but never reset the URL. Result: checkboxes showed all-checked while the list still displayed the old filter (e.g. `?types=` → "please select" message, even though all boxes appeared ticked).
- Root cause: checkbox state was local (`useState`) while the list relied on the URL (`initialTypes` prop). These two sources of truth could get out of sync.
- Fix: removed `checkedTypes` state, `wasOpen` ref, and the reset `useEffect`. Replaced with a `useMemo` that derives `checkedTypes` directly from the URL via `useSearchParams()`. Checkboxes now always mirror what the list is actually showing — no sync required.
- Side effect: the "reset to all on accordion open" behaviour is replaced by "reflect current URL on open". This is more correct: if the user filtered to one type and reopens the accordion, they see one type checked (consistent with the visible list).

**Remaining warnings (4, non-blocking)**
- `Section` and `TextAreaField` defined but never used in `natural-person-form.tsx`.
- `setMode` assigned but never used in `corners-manager.tsx`.
- `ROUND_TRIP_TOL` assigned but never used in `transdatRO.test.ts`.
These are warnings (not errors) and do not fail CI. Deferred to a future cleanup slice.

**Files touched**
- `src/app/paperwork/list-view.tsx`
- `src/components/sidebar/sidebar-nav.tsx`

### Slice #4.3 — Inline field labels across all three detail forms (detail)

Pure frontend — no DB schema, API, or i18n changes.

**What changed**
- In all three form files (`natural-person-form.tsx`, `property-form.tsx`, `paperwork-form.tsx`), the local `Field`, `TextAreaField`, `SelectField`, and `ReadOnlyField` helper components were refactored from a stacked (`flex flex-col`) layout to an inline (`flex items-center`) layout.
- Label column: `w-36 shrink-0` (144 px fixed width, never wraps).
- Control column: `flex-1 min-w-0` — takes all remaining width, with errors/hints stacked below inside a `flex flex-col gap-0.5` wrapper div.
- `TextAreaField` uses `items-start` (not `items-center`) with `pt-1` on the label span so the label aligns with the top of the textarea rather than its vertical centre.
- Person Identity section re-laid out as a uniform 8-row `grid grid-cols-2 gap-2` per the spec: Last Name | First Name; Code | CNP; ID Type | ID Number; Gender | Date of Birth; Nickname | Notes; Personal Phone 1 | Personal Email 1; Personal Phone 2 | Personal Email 2; Work Phone | Work Email. Code is conditional (edit mode only); in create mode CNP shifts to the left column.

**Files touched**
- `src/app/natural-persons/_components/natural-person-form.tsx`
- `src/app/properties/_components/property-form.tsx`
- `src/app/paperwork/_components/paperwork-form.tsx`

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

### Slice #10.05 — Reference Data: Property Persons (detail)

DB + schema + query helpers + API routes + UI + i18n.

**What changed**

**DB table name: `lookup_property_person_role`** — whitelist of Person Roles that are valid for the Property ↔ Person association. When a user later associates a specific Person to a specific Property, the Role dropdown on that association is populated from this table. No second FK (unlike `lookup_doc_type_person_role`) — each row simply marks a role as applicable to property-person links.

**DB migration (`src/db/migration_015_property_person_role.sql`)**
- `CREATE TABLE IF NOT EXISTS lookup_property_person_role` with `id` (uuid PK), `person_role_id` (FK → `lookup_person_role.id`, ON DELETE CASCADE), `created_at`. Unique constraint on `person_role_id`.
- No seed data — starts empty by design.

**Schema (`src/db/schema/index.ts`)**
- Added `lookupPropertyPersonRole` in the Proprietate group (before the Document Type ↔ Person Role junction).

**Query helpers (`src/lib/admin/property-person-roles/queries.ts`)**
- `listPropertyPersonRoles()` — inner-join select with `lookup_person_role`, ordered by role name.
- `createPropertyPersonRole(personRoleId)` — insert + re-fetch with joined name/description.
- `deletePropertyPersonRole(id)` — hard delete by PK.

**API routes**
- `GET/POST /api/admin/property-person-roles` — list all / add a role.
- `DELETE /api/admin/property-person-roles/[id]` — remove one role.
- POST validates `{ personRoleId: uuid }` with Zod; returns 409 on duplicate.

**UI (`src/app/admin/value-lists/_components/property-persons-modal.tsx`)**
- Standalone modal (same pattern as `document-persons-modal.tsx`).
- Table: Person Role | Description | Delete button. Ordered alphabetically by role name.
- Add form: single `<select>` dropdown showing all Person Roles not already in the list.
- Hint: "If a person role is not listed, add it using the Person Roles button in the Person section."
- Delete confirm dialog (same pattern as other modals).
- Escape closes the add form, then the modal.

**Hub UI (`src/app/admin/value-lists/_components/value-list-hub.tsx`)**
- Added `showPropertyPersons: boolean` state.
- Added "Property Persons" button right after "Property Types" in the Proprietate section.
- Renders `PropertyPersonsModal` when `showPropertyPersons` is true.

**i18n**
- Added `valueList.lists.propertyPersons` in both files.
- Added `valueList.propertyPersons.*` namespace (title, column headers, form labels, hint, status strings) in both files.

**Files touched**
- `src/db/migration_015_property_person_role.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/admin/property-person-roles/queries.ts` (new)
- `src/app/api/admin/property-person-roles/route.ts` (new)
- `src/app/api/admin/property-person-roles/[id]/route.ts` (new)
- `src/app/admin/value-lists/_components/property-persons-modal.tsx` (new)
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #10.04 — Reference Data: Document Persons (detail)

DB + schema + query helpers + API routes + UI + i18n.

**What changed**

**DB table name: `lookup_doc_type_person_role`** — M:M junction between `lookup_document_type` and `lookup_person_role`. Both FKs use ON DELETE CASCADE so removing a document type or person role automatically cleans up its associations.

**DB migration (`src/db/migration_014_doc_type_person_role.sql`)**
- `CREATE TABLE IF NOT EXISTS lookup_doc_type_person_role` with `id` (uuid PK), `document_type_id` (FK → `lookup_document_type.id`), `person_role_id` (FK → `lookup_person_role.id`), `created_at`. Unique constraint on `(document_type_id, person_role_id)`.
- Seed: CTE resolves document type and person role names to IDs, inserts 74 associations.
- `ON CONFLICT DO NOTHING` — idempotent, safe to re-run.
- Note: required fixing `lookup_document_type` row 6 from "Certificat de Macanentur" → "Certificat de Moștenitor" (diacritics corruption from original seeding) before applying the seed.

**Schema (`src/db/schema/index.ts`)**
- Added `lookupDocTypePersonRole` in the Document group (after `lookupInstitution`, before `lookupOthers`).

**Query helpers (`src/lib/admin/doc-type-person-roles/queries.ts`)**
- `listDocTypePersonRoles()` — inner-join select, ordered by document type name then role name.
- `createDocTypePersonRole({ documentTypeId, personRoleId })` — insert + re-fetch with joined names.
- `deleteDocTypePersonRole(id)` — hard delete by PK.

**API routes**
- `GET/POST /api/admin/doc-type-person-roles` — list all / create new association.
- `DELETE /api/admin/doc-type-person-roles/[id]` — delete one association.
- POST validates `{ documentTypeId: uuid, personRoleId: uuid }` with Zod; returns 409 on duplicate.

**UI (`src/app/admin/value-lists/_components/document-persons-modal.tsx`)**
- Standalone modal (does not go through `ValueListModal` / `config.ts` — M:M junction editing has a different shape).
- Table: Document Type | Person Role | Delete button. Ordered alphabetically.
- Add form: two `<select>` dropdowns (all document types / all person roles fetched from existing value-list API) + Save/Cancel.
- Two hint lines: "If a document type is not listed, add it using the Document Types button." and "If a person role is not listed, add it using the Person Roles button."
- Delete confirm dialog (same pattern as `ValueListModal`).
- Escape closes the add form, then the modal.

**Hub UI (`src/app/admin/value-lists/_components/value-list-hub.tsx`)**
- Added `showDocPersons: boolean` state (separate from `openList`).
- Added "Document Persons" button after "Document Types" in the Document section.
- Renders `DocumentPersonsModal` when `showDocPersons` is true.

**i18n**
- Added `valueList.lists.documentPersons` in both files.
- Added `valueList.documentPersons.*` namespace (title, column headers, form labels, hints, status strings) in both files.

**Files touched**
- `src/db/migration_014_doc_type_person_role.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/admin/doc-type-person-roles/queries.ts` (new)
- `src/app/api/admin/doc-type-person-roles/route.ts` (new)
- `src/app/api/admin/doc-type-person-roles/[id]/route.ts` (new)
- `src/app/admin/value-lists/_components/document-persons-modal.tsx` (new)
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #10.03 — Reference Data: Person Roles (detail)

DB + schema + config + validation + queries + UI + i18n.

**What changed**

**DB table name: `lookup_person_role`** — own dedicated table (not `lookup_others`) because it is large, domain-specific, and warrants its own backing table.

**DB migration (`src/db/migration_013_person_roles.sql`)**
- `CREATE TABLE IF NOT EXISTS lookup_person_role` with `id` (uuid PK), `name` (text NOT NULL), `description` (text), `sort_order` (int default 0), `created_at`, `updated_at`.
- `touch_updated_at` trigger attached.
- Pre-populated with 56 distinct roles (deduplicated from the supplied list, sorted alphabetically by name, `sort_order` 1–56).
- `INSERT … ON CONFLICT DO NOTHING` — idempotent, safe to re-run.

**Schema (`src/db/schema/index.ts`)**
- Added `export const lookupPersonRole = pgTable("lookup_person_role", { ... })` in the Persoană group, between `lookupPersonType` and `lookupCitizenship`.

**Config (`src/lib/admin/value-lists/config.ts`)**
- Added `"person-roles"` to `VALID_LIST_KEYS`.
- Added `LIST_META["person-roles"]`: `name` (required) + `description` (optional, multiline).

**Validation (`src/lib/admin/value-lists/validation.ts`)**
- Added `personRoleSchema` (name required, description nullish, sortOrder).
- Added `"person-roles": personRoleSchema` to `LIST_SCHEMAS`.

**Queries (`src/lib/admin/value-lists/queries.ts`)**
- Imported `lookupPersonRole`.
- Added `"person-roles"` case to all four switch statements (list, create, update, delete).
- List is ordered by `name ASC` (alphabetical) — not `sort_order` — as requested.

**Hub UI (`src/app/admin/value-lists/_components/value-list-hub.tsx`)**
- Added `<ListBtn label={t("lists.personRoles")} onClick={() => open("person-roles")} />` in the Persoană section, between Person Types and Citizenship.

**i18n**
- `messages/en-GB.json`: added `valueList.lists.personRoles = "Person Roles"`.
- `messages/ro-RO.json`: added `valueList.lists.personRoles = "Roluri Persoană"`.

**Files touched**
- `src/db/migration_013_person_roles.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/admin/value-lists/config.ts`
- `src/lib/admin/value-lists/validation.ts`
- `src/lib/admin/value-lists/queries.ts`
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #9.9 — Reference Data: Description field on Services, Interests, Groups, Stamps (detail)

DB + schema + config + validation + UI + i18n — no changes to queries or API routes.

**Problem**: The four "Others" lists (Services, Interests, Groups, Stamps) had only a Name field. The user wanted a Description field beside it.

**DB migration (`src/db/migration_012_lookup_others_description.sql`)**
- `ALTER TABLE lookup_others ADD COLUMN IF NOT EXISTS description text;`
- Idempotent; safe to re-run.

**Schema (`src/db/schema/index.ts`)**
- Added `description: text("description")` to `lookupOthers`.

**Config (`src/lib/admin/value-lists/config.ts`)**
- Added `multiline?: boolean` to `FieldMeta` type — when true, the edit form renders a `<textarea>` instead of `<input>`.
- Added `{ key: "description", labelKey: "description", required: false, multiline: true }` as the second field in services, interests, groups, and stamps.

**Validation (`src/lib/admin/value-lists/validation.ts`)**
- Added `description: z.string().nullish()` to `serviceInterestSchema`.
- Fixed a pre-existing bug: `LIST_SCHEMAS` still referenced the old `"service-interests"` key (removed in Slice 9.7). Replaced with the four valid keys: `"services"`, `"interests"`, `"groups"`, `"stamps"`.

**UI (`src/app/admin/value-lists/_components/value-list-modal.tsx`)**
- `EditForm`: multiline fields render as `<textarea rows={3}>` (full width, resizable); plain fields keep `<input>`. Enter inside textarea is not intercepted (allows newlines); Escape still closes the form.
- Table rows: multiline cells get `max-w-[240px] truncate` with a `title` tooltip showing the full text.

**Queries** — no changes needed. The `description` field flows through the existing generic `data` spread in create/update.

**i18n**
- `messages/en-GB.json`: added `valueList.fields.description = "Description"`.
- `messages/ro-RO.json`: added `valueList.fields.description = "Descriere"`.

**Files touched**
- `src/db/migration_012_lookup_others_description.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/admin/value-lists/config.ts`
- `src/lib/admin/value-lists/validation.ts`
- `src/app/admin/value-lists/_components/value-list-modal.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #9.8 — Reference Data: lookup rename + Groups & Stamps (detail)

Pure frontend + query layer + DB rename — no new columns, no data changes.

**Problem**: The `lookup_service_interest` table name no longer reflected its scope (it already held four categories after Slice 9.7). The user wanted two more lists — Groups and Stamps — under the existing "Others" section.

**DB migration (`src/db/migration_011_lookup_others.sql`)**
- `ALTER TABLE lookup_service_interest RENAME TO lookup_others;`
- PostgreSQL preserves triggers on table rename; no trigger changes needed.

**Schema (`src/db/schema/index.ts`)**
- Export `lookupServiceInterest` renamed to `lookupOthers`; table name string changed to `"lookup_others"`.

**Config (`src/lib/admin/value-lists/config.ts`)**
- Added `"groups"` and `"stamps"` to `VALID_LIST_KEYS` and `LIST_META` (`name`-only field, same pattern as services/interests).

**Queries (`src/lib/admin/value-lists/queries.ts`)**
- Import updated to `lookupOthers`.
- Added `CATEGORY_GROUP = "Grup"` and `CATEGORY_STAMP = "Stampila"` constants.
- Added `"groups"` and `"stamps"` cases to all four switch statements (list, create, update, delete). Update and delete fall through the existing `services`/`interests` case group.

**Hub UI (`src/app/admin/value-lists/_components/value-list-hub.tsx`)**
- Added two `<ListBtn>` for Groups and Stamps in the Others section.

**i18n**
- `messages/en-GB.json`: added `valueList.lists.groups = "Groups"`, `valueList.lists.stamps = "Stamps"`.
- `messages/ro-RO.json`: added `valueList.lists.groups = "Grupuri"`, `valueList.lists.stamps = "Ștampile"`.

**Files touched**
- `src/db/migration_011_lookup_others.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/admin/value-lists/config.ts`
- `src/lib/admin/value-lists/queries.ts`
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #9.7 — Reference Data: Services & Interests split (detail)

Pure frontend + query layer — no DB schema change, no migration.

**Problem**: The Reference Data page had a standalone "Services & Interests" button opening a single combined list. The user wanted two separate lists — one for Services, one for Interests — grouped under an "Others" section matching the style of Property / Person / Document.

**How it works**: The `lookup_service_interest` table already has a `category` column seeded with Romanian values `'Serviciu'` (services) and `'Interes'` (interests). The new list keys filter on this column; when creating a new entry the category is injected automatically by the query layer and never exposed in the form.

**What changed**
- `src/lib/admin/value-lists/config.ts` — removed `"service-interests"`; added `"services"` and `"interests"` (both with `name`-only form field; category is implicit).
- `src/lib/admin/value-lists/queries.ts` — replaced `"service-interests"` switch cases with `"services"` (filter/inject `category = 'Serviciu'`) and `"interests"` (filter/inject `category = 'Interes'`). Update strips `category` from the payload to prevent accidental overwrites.
- `src/app/admin/value-lists/_components/value-list-hub.tsx` — removed standalone button; added `<Section label="Others">` with two buttons.
- `messages/en-GB.json` + `messages/ro-RO.json` — added `valueList.sections.others`, `valueList.lists.services`, `valueList.lists.interests`; removed `valueList.lists.serviceInterests`.

**Files touched**
- `src/lib/admin/value-lists/config.ts`
- `src/lib/admin/value-lists/queries.ts`
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #9.6 — Document Pages (detail)

Adds a **Pages panel** to every Paperwork form (edit and view modes). Each page is a user-uploaded file (image, PDF, Word, Excel, plain text, etc.) with an optional name and notes.

**What changed**

**DB schema + migration**
- New table `paperwork_page`: `id`, `paperwork_id` (FK → paperwork ON DELETE CASCADE), `page_number` (integer, UNIQUE per paperwork), `page_name`, `page_notes`, `file_name` (original filename), `file_path` (storage key), `file_size`, `mime_type`, `created_at`, `updated_at`.
- `src/db/migration_010_paperwork_pages.sql` — creates the table and the `touch_updated_at` trigger.

**File storage (`src/lib/storage/index.ts`)**
- Dev (`NODE_ENV !== "production"`): files written to `<project-root>/uploads/<filePath>`; served by the new `/api/files/[...path]` route.
- Prod (`NODE_ENV === "production"`): files stored in Supabase Storage bucket `paperwork-pages`; served via 60-second signed URLs.
- API: `uploadFile(buffer, filePath, mimeType)`, `deleteFile(filePath)`, `getFileUrl(filePath) → string`.

**`/uploads/` directory**: gitignored (added to `.gitignore`).

**Local dev file server (`src/app/api/files/[...path]/route.ts`)**
- `GET /api/files/[...path]` — streams a file from `<project-root>/uploads/`, path-traversal guarded.
- Returns 404 in production.

**Query layer (`src/lib/paperwork/pages-queries.ts`)**
- `listPaperworkPages(paperworkId)`, `getPaperworkPage(pageId)`, `createPaperworkPage(data)`, `deletePaperworkPage(pageId)`.

**API routes**
- `GET  /api/paperwork/[id]/pages` — list pages.
- `POST /api/paperwork/[id]/pages` — upload file + create page (multipart/form-data; max 20 MB; blocks `.js/.sh/.exe` MIME types).
- `DELETE /api/paperwork/[id]/pages/[pageId]` — delete storage object + DB row.
- `GET /api/paperwork/[id]/pages/[pageId]/view` — returns `{ url, mimeType, fileName }` (signed URL or `/api/files/…` in dev).

**UI (`src/app/paperwork/_components/pages-panel.tsx`)**
- Responsive dual-pane: viewer (left, `flex-1`) + table (right, `w-[380px]`) on `lg:` screens; stacked (table above, viewer below) on smaller screens.
- Viewer renders: images (`<img>`), PDFs (`<iframe h-[600px]>`), all other types → download prompt + file icon.
- Table columns: `#`, Page Name, Notes (hidden on mobile), Actions (`View` / `Print` / `Delete`).
  - Clicking a row = clicking View (loads the viewer).
  - **Print**: fetches view URL and opens it in a new tab (`window.open`).
  - **Delete**: shows a confirm dialog; deletes storage object + DB row.
- **Add Page dialog**: Page Number (auto-defaults to next), Page Name (optional), Page Notes (optional), Upload button. File is staged in React state until Save — no orphan uploads. 20 MB guard on file select.
- Only shown when `paperworkId` exists (edit/view mode). Not rendered in create mode.

**PaperworkForm changes (`src/app/paperwork/_components/paperwork-form.tsx`)**
- `PagesPanel` imported and rendered after the Notes section, **outside the `<fieldset disabled={...}>` wrapper** so its buttons remain interactive in view mode.
- Action buttons (Save / Delete / Cancel) and the ConfirmDelete dialog also moved outside the fieldset (behaviour unchanged — they were already gated by `mode !== "view"`).

**i18n**
- Added `paperwork.pages.*` namespace to both `messages/en-GB.json` and `messages/ro-RO.json`.

**Supabase setup (production)**
- Create a private Storage bucket named `paperwork-pages` in the Supabase dashboard before deploying to production. No public URL needed.

**Files touched**
- `src/db/schema/index.ts`
- `src/db/migration_010_paperwork_pages.sql` (new)
- `src/lib/storage/index.ts` (new)
- `src/app/api/files/[...path]/route.ts` (new)
- `src/lib/paperwork/pages-queries.ts` (new)
- `src/app/api/paperwork/[id]/pages/route.ts` (new)
- `src/app/api/paperwork/[id]/pages/[pageId]/route.ts` (new)
- `src/app/api/paperwork/[id]/pages/[pageId]/view/route.ts` (new)
- `src/app/paperwork/_components/pages-panel.tsx` (new)
- `src/app/paperwork/_components/paperwork-form.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `.gitignore`
- `CLAUDE.md`

### Slice #9.1 — Fix Romanian diacritics in lookup tables (detail)

Pure data fix — no schema, API, or UI changes.

**Root cause**: The eight lookup tables (`lookup_person_type`, `lookup_citizenship`, `lookup_property_type`, `lookup_use_category`, `lookup_document_type`, `lookup_institution`, `lookup_service_interest`, `lookup_tarla`) were seeded via a DB connection that was not in UTF-8 mode. Each 2-byte UTF-8 diacritic sequence was stored as two latin1 `?` characters (e.g. "Persoană" → "Persoan??").

**Fix**: `src/db/migration_009_fix_diacritics.sql` — 61 UPDATE statements keyed on `sort_order` (since names were corrupted and could not be matched). Idempotent; safe to re-run.

**Delivery note**: PowerShell's `Get-Content | docker exec -i` pipe corrupts UTF-8. Always use `docker cp` + `psql -f` to apply SQL files containing diacritics:
```powershell
docker cp <file.sql> <container>:/tmp/fix.sql
docker exec <container> psql -U postgres -d ga40db -f /tmp/fix.sql
```

**Applied to**: local Docker (`ga40prj-postgres`). Must also be applied to Ciprian UAT (`ciprian-ga40prj-postgres`) and Supabase (SQL Editor).

**Files touched**
- `src/db/migration_009_fix_diacritics.sql` (new)
- `CLAUDE.md`

### Slice #8.0 — Principal Object base class + shared code counter (detail)

Pure DB schema + query layer — no UI changes.

**What changed**

**New `principal_object` table**
- Columns: `id` (uuid PK), `code` (text, UNIQUE), `object_type` (`principal_object_type` enum: `PERSON | PROPERTY | PAPERWORK`), `created_at`.
- One shared Postgres sequence: `principal_object_code_seq`. The app layer inserts this row first using `sql\`'PREFIX' || lpad(nextval('principal_object_code_seq')::text, 5, '0')\`` and receives the generated code back via `.returning()`.
- Codes are still prefixed (PERS/PROP/PAPR) but the number is unique across all three types (e.g. PERS00001, PROP00002, PERS00003).

**Domain table changes (`person`, `property`, `paperwork`)**
- Each gains `principal_object_id` (uuid, NOT NULL, UNIQUE, FK → `principal_object.id`).
- The `code` column is kept on each table (no DEFAULT — supplied by app layer from the `principal_object` insert). All read queries continue to use `person.code` / `property.code` / `paperwork.code` unchanged.
- The three old per-table sequences (`person_code_seq`, `property_code_seq`, `paperwork_code_seq`) are dropped.

**Migration files**
- `src/db/migration_008_principal_object.sql` — full migration (applied to Supabase).
- `src/db/migration_008_repair.sql` — repair script used on local Docker after a partial-failure on first run; kept for audit trail.
- **Root cause of partial failure**: new codes drawn from the shared sequence (starting after all persons) collided with existing codes on unprocessed property/paperwork rows. Fix: blank all property/paperwork codes to `'PROP_TMP_' || id::text` before the reassignment loop.

**Query layer**
- `src/lib/persons/queries.ts` → `createNaturalPerson`
- `src/lib/judicial-persons/queries.ts` → `createJudicialPerson`
- `src/lib/properties/queries.ts` → `createProperty`
- `src/lib/paperwork/queries.ts` → `createPaperwork`
- Each CREATE now inserts into `principal_object` first, then inserts the domain row with `principalObjectId` and `code` copied from the returned row.

**Validation**
- `src/lib/properties/validation.ts`: added `principalObjectId: true` to the `createInsertSchema(property).omit({...})` call so it stays out of the user-facing Zod schema (drizzle-zod would otherwise surface it as a required input field).

**Seed**
- `src/db/seed.ts`: updated persons and properties seed loops to follow the same two-step insert pattern.

**Files touched**
- `src/db/schema/index.ts`
- `src/db/migration_008_principal_object.sql` (new)
- `src/db/migration_008_repair.sql` (new)
- `src/lib/persons/queries.ts`
- `src/lib/judicial-persons/queries.ts`
- `src/lib/properties/queries.ts`
- `src/lib/properties/validation.ts`
- `src/lib/paperwork/queries.ts`
- `src/db/seed.ts`

### Slice #7.3 — Fix TypeScript build error in `proxy.ts` (detail)

Build was failing on Vercel with:

```
./src/proxy.ts:38:16
Type error: Parameter 'cookiesToSet' implicitly has an 'any' type.
```

The `setAll` method inside the Supabase SSR cookie handler lacked an explicit type annotation. Fix: add an inline type to the `cookiesToSet` parameter — `{ name: string; value: string; options: CookieOptions }[]` (or the equivalent Supabase SSR type). No logic changes.

**Files touched**
- `src/proxy.ts`

### Slice #7.1 — Bilingual (Romanian) sign-in page (detail)

Added a Romanian-language sign-in experience using the same flag-emoji locale toggle already present throughout the app. The sign-in page reads the current locale cookie and renders all labels, placeholders, and error messages via next-intl. Switching flags on the sign-in page sets the locale cookie and refreshes the page — identical behaviour to the rest of the app.

**Files touched**
- `src/app/[...auth]/` (or equivalent sign-in page)
- `messages/en-GB.json` — auth namespace
- `messages/ro-RO.json` — auth namespace

### Slice #7.0 — Authentication (detail)

Standard authentication boilerplate using Supabase Auth (email/password). Because authentication patterns are well-established, Supabase Auth conventions take precedence over project-specific instructions where they conflict.

Key decisions:
- Supabase Auth with SSR cookie session (`@supabase/ssr`).
- Middleware (`src/proxy.ts`) refreshes the session token on every request and redirects unauthenticated users to `/sign-in`.
- Protected routes: all app routes except `/sign-in`.
- Session exposed via a server-side helper; no client-side token storage.

**Files touched**
- `src/proxy.ts` (Supabase SSR middleware)
- `src/lib/supabase/` (server + client helpers)
- `src/app/sign-in/` (sign-in page and form)
- `src/db/index.ts` (unchanged; auth is handled at Supabase layer)

### Slice #6.1 — Pagination for association lists (detail)

Extension of Slice 6.0. When clicking the **Associate** button to link one object to another (e.g. attach a Person to a Property), the picker modal/list was fetching and rendering the full dataset instead of paginating. Fixed to apply the same 15-item page size and Next/Previous controls as the main lists.

- API endpoints for association lookups now accept `page` and `pageSize` query params.
- Association picker components use the same pagination UI component introduced in Slice 6.0.

**Files touched**
- API routes for association lookups (people, properties, paperwork)
- Association picker UI components

### Slice #6.0 — Pagination on all lists (detail)

Added **Next** / **Previous** pagination controls to every list view.

Rules:
- Page size: **15 items**.
- Both buttons **disabled** when total items ≤ 15 (fits on one page).
- **Previous** disabled on page 1; **Next** disabled on the last page.
- Page state lives in URL query params (`?page=N`) so it survives a refresh.

**Files touched**
- All list view components (`natural-persons`, `properties`, `paperwork`)
- Shared `Pagination` UI component (new)
- API route handlers updated to accept `page` / `pageSize` and return `total` alongside `items`

## Collaboration rules

- **Never commit or push without explicit confirmation.** Same for any irreversible action.
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`, etc.
- **Always provide commit statements as ready-to-run PowerShell `git` commands**, not just the commit message text. Each commit should be a full `git add <files> && git commit -m "message"` command (or equivalent multi-line PowerShell form) that Adrian can paste directly into his terminal.
- **Always check `git status` before making changes**, and never modify files outside `C:\dev\ga40prj`.
- **Adrian runs git in PowerShell on Windows.** Claude prepares file content; Adrian commits and pushes. This avoids Windows-mount permission issues with `.git/index.lock` from the Linux sandbox.
- **Trust HEAD as the source of truth.** The Linux sandbox can show stale or phantom file states (deleted files appearing as untracked, modified files showing clean, etc.). When in doubt, ask Adrian to `git status` on his side.
- **Secrets stay out of chat.** `.env` is gitignored; values live in `C:\dev.docs\ga40prj\` (Adrian's reference docs, not in the repo). Never echo passwords or API keys back into the conversation.

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
- **DB migration reminders — display these at the start of any migration step:**
  - *Local Docker:* **Do NOT use `npm run db:migrate`** — it exits silently without applying the file (confirmed repeatedly). Always apply migrations directly via `docker cp` + `psql -f`:
    ```powershell
    docker cp src/db/migration_NNN_name.sql ga40prj-postgres:/tmp/mNNN.sql
    docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/mNNN.sql
    ```
    Expected output: `CREATE TABLE` (or `ALTER TABLE`, etc.). No output = not applied.
  - *Supabase:* Paste the migration SQL directly into the Supabase SQL Editor. If using `db:migrate`, first set `DIRECT_URL` to the direct connection string (port 5432, `?sslmode=require`): `DIRECT_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres?sslmode=require`. Remove it again afterwards.

## Key paths

- `C:\dev\ga40prj` — this repo (read-write)
- `C:\dev.docs\ga40prj` — Adrian's reference docs (read-only): stack decisions, install logs, credentials, future mockups
- `C:\dev.docs\ga40prj\01.Slice.Inputs\` — Adrian's slice input docs (reference only; read only the folder relevant to the current slice)

## Reading order for a fresh session

1. This file (`CLAUDE.md`) — top-down.
2. `README.md` — local dev setup and common commands.
3. `package.json` — confirm exact versions before assuming any API.
4. Most recent `git log --oneline -20` — see what just shipped.
5. If a slice is in progress, the relevant folder under `C:\dev.docs\ga40prj\01.Slice.Inputs\` and any open work-in-progress branches.
