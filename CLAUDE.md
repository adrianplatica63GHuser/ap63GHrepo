@AGENTS.md

# Project brief — ga40prj

A web application for managing **People**, **Documents**, and **Properties**, with PostGIS-backed spatial data and bilingual English/Romanian UI. Built one vertical slice at a time. Deployed on Vercel + Supabase; local Docker Postgres remains the primary dev environment.

## How Claude works with Adrian (generic rules)

These apply regardless of which slice is in progress:

- **One vertical slice at a time** — confirm the current slice before writing any code.
- **Wait for approval before writing code** at the start of every session.
- **Provide complete, ready-to-copy code** — components, hooks, schema migrations, API routes. No stubs or placeholders unless explicitly asked.
- **Include TypeScript types, error handling, loading states, and accessibility** on every component.
- **Bilingual by default** — use the established next-intl patterns already in the repo; never hard-code UI strings.
- **Never commit or push without explicit confirmation.** Same for any irreversible action.
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`.
- **Minimise human effort — always.** Processing and storage are cheap; human time and attention are not. Always prefer the most automated solution, even if it does more work. Never ask Adrian to run manual export queries, copy-paste SQL, or track deltas by hand. Build scripts that do the full job. When in doubt, do a full reset rather than a targeted delta — correctness and simplicity matter more than efficiency.
- **Full reset over delta.** For Supabase/cloud sync, always do a complete reset (drop everything, recreate from scratch, re-seed all data) rather than trying to calculate and apply only what changed. A full reset is reliable; delta logic is fragile.

## Who you're working with

Adrian is the sole user of this repo. He's a business analyst, not a full-time developer — comfortable reading code, running commands, and reasoning about architecture, but he leans on Claude as a full-stack development partner. He works on Windows (PowerShell), keeps reference docs in `C:\dev.docs\ga40prj` (read-only to Claude), and prefers small, deliberate changes over big rewrites.

## Domain model

Three core objects with multiple many-to-many relationships, including self-referential ones:

- **Person** — individuals or organizations connected to the project
- **Document** — documents, contracts, certificates, etc.
- **Property** — parcels with spatial geometry (points, polygons) stored in PostGIS

Relationships: People ↔ Documents, People ↔ Properties, Documents ↔ Properties, plus self-references (e.g. a Person related to another Person, a Property containing another Property). Field names and type vocabularies live in `messages/en-GB.json` and `messages/ro-RO.json`, served via next-intl.

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

> **Per-slice detail lives in git history, not in this file.** This index lists every slice as a one-liner. The granular per-slice change-logs that used to live below were trimmed to keep CLAUDE.md navigable — recover any of them with `git log -p -- CLAUDE.md` or by reading the relevant commit. Cross-cutting, reusable knowledge is preserved in **Gotchas we've learned** (below) and, for the versioning feature, in **Versioning pattern & pitfalls** (below).

**Slice progress (index)**

- Slice #0 — foundation cleanup: `.gitattributes`, externalized Docker secrets, Jest scaffold, CI workflow, README. ✅
- Slice 0.5 — Zod v4 + next-intl wired (cookie-based locale, `src/i18n/request.ts`, `src/lib/i18n/locale.ts`, `NextIntlClientProvider`, bilingual toggle). ✅
- Slice #1 — Person CRUD (DB → API → UI → tests). ✅
- Slice #2 — Property CRUD with map view, Stereo70 input, PostGIS corners, bilingual UI. ✅
- Slice #2.5 — Property UI polish (Google Maps switch, draggable corners, click-to-draw, Stereo70/DMS input). ✅
- Slice #2.6 — Vercel + Supabase deployment + home page launching pad. ✅
- Slice #3 — Sidebar navigation refactor. ✅
- Slice #4 — Paperwork CRUD. ✅
- Slice #4.1 — Sidebar & nav polish. ✅
- Slice #4.2 — Paperwork filter re-sync + flag locale switcher. ✅
- Slice #4.3 — Inline field labels across all three detail forms. ✅
- Slice #4.4 — Document list filtering via sidebar checkboxes + "Paperwork" → "Documents" GUI rename. ✅
- Slice #4.5 — CI lint fixes: `react-hooks/set-state-in-effect`. ✅
- Slice #5.n — Relationships (People ↔ Properties ↔ Paperwork, self-refs), relationship map view. ✅
- Slice #6.0 — Pagination on all lists (page size 15, URL `?page=`). ✅
- Slice #6.1 — Pagination for association lists. ✅
- Slice #7.0 — Authentication (Supabase Auth, SSR cookie session, `src/proxy.ts` middleware). ✅
- Slice #7.1 — Bilingual (Romanian) sign-in page. ✅
- Slice #7.2 — Push auth to GitHub / Vercel. ✅
- Slice #7.3 — Fix TypeScript build error in `proxy.ts` (`cookiesToSet` typing). ✅
- Slice #8.0 — Principal Object base class + shared code sequence (`principal_object`, codes unique across all three types). ✅
- Slice #9.1 — Fix Romanian diacritics in lookup tables (`migration_009`, apply via `docker cp` + `psql -f`). ✅
- Slice #9.6 — Document Pages: file upload per record (`document_page`, local FS in dev / Supabase Storage in prod). ✅
- Slice #9.7 — Reference Data: split Services & Interests under an "Others" section. ✅
- Slice #9.8 — Reference Data: rename lookup table (`lookup_others`) + add Groups and Stamps. ✅
- Slice #9.9 — Reference Data: Description field on Services/Interests/Groups/Stamps. ✅
- Slice #10.03 — Reference Data: Person Roles list (`lookup_person_role`). ✅
- Slice #10.04 — Reference Data: Document Persons (`lookup_doc_type_person_role` junction). ✅
- Slice #10.05 — Reference Data: Property Persons (`lookup_property_person_role` whitelist). ✅
- Slice #10.06 — Role on Property ↔ Person association. ✅
- Slice #10.07 — Role on Document ↔ Person association. ✅
- Slice #12.01 — Judicial Person form refactor: Contact Persons panel (FK-linked natural persons) + consolidated Office Address ("same as" checkbox). ✅
- Slice #11.vercel.02 — Vercel/Supabase full reset + re-seed; fixed corrupted source files + stale judicial_person column refs. ✅
- Slice #GIS.13.02 — Add Property from scanned image: OCR (tesseract.js) + multi-step dialog. ✅
- Slice #GIS.13.03 — Add Property from text file / folder: `parse-text` route + batch import. ✅
- Slice #GIS.13.05 — Land map: auto-fit, red corner markers, drag-to-select batch delete. ✅
- Slice #GIS.13.06 — Land map: overlap-aware InfoWindow (all properties under cursor). ✅
- Slice #GIS.13.08 — Property form: Show Big Map toggle (two-column layout). ✅
- Slice #GIS.13.10 — OCR parser: fix first-corner-skipped (merged-token) bug. ✅
- Slice #GIS.13.11 — Text-file parser: first token any number < 1 000 + simple-polygon sort. ✅
- Slice #GIS.13.12 — Land map: select/unselect via InfoWindow + "Display all selected" tab. ✅
- Slice #15.01 — Admin → Import: local-folder browser + Classify (Property / Person / Document); ID-card vision extraction. ✅
- Slice #15.02 — Admin → Import: classified-state, context preservation, fit-to-panel preview, rotation, Word link, text preview. ✅
- Slice #15.05 — Project-wide rename: "Paperwork"/`PAPERWORK_TYPES` enum → "Document" + admin-managed `lookup_document_type`. ✅
- Slice #16.UX.01 — Person/Property/Document lists: most-recent-first sort + "New!"/"Nou!" recency badge. ✅
- Slice #15.06 — Reference Data: keep alternate Romanian wordings as distinct document types. ✅
- Slice #15.07 — Reference Data: `judicial_type` enum → admin-managed `lookup_judicial_person_type`. ✅
- Slice #15.09 — Sidebar nav cleanup + unified `/persons` list (Natural + Judicial). ✅
- Slice #15.09.1 — Delete orphaned `/natural-persons` and `/judicial-persons` list pages. ✅
- Slice #15.09.2 — Property sidebar: accordion → two flat-link buttons (List / Map). ✅
- Slice #15.10 — Property "Add new": no DB row on an untouched, all-blank create form. ✅
- Slice #15.11 — Reference Data Person panel: caption rename + button reorder. ✅
- Slice #15.12 — Reference Data: new "Roles" panel (Person Roles, Property Persons, Document Persons). ✅
- Slice #15.13 — Document form: "Show Big Page" toggle (mirrors Show Big Map). ✅
- Slice #15.14 — Document Pages viewer: wheel-zoom + click-drag pan in big-page mode. ✅
- Slice #15.15 — Ops: fixed-name, fully-regenerated `ciprian-schema-update.sql` (full wipe + rebuild every build). See Gotchas / UC-C6. ✅
- Slice #15.16 — Ciprian UAT bug fixes: `LOCAL_FILE_STORAGE` override, `ANTHROPIC_API_KEY` into compose, missing `update.bat`. ✅
- Slice #15.17 — Property corners: track original cadastral-file index per corner (survives reorder) + default display Stereo 70. ✅
- Slice #16.UX.02 — Help Content: Administration screen-help (Background + How-To) + inline micro-hints (`help_content`/`help_hint` + `src/lib/help/registry.ts`). ✅
- Slice #16.UX.03 — Properties Map: click/double-click InfoWindow model (replaces hover). ✅
- Slice #15.18 — Ciprian UAT bug fixes: text-file import 500 (Stereo70 grid file missing from Docker image; `original_index` column missing in Ciprian DB). ✅
- Slice #15.19 — Property Type & Use Category: drop `property_type`/`use_category` enums → nullable FK to `lookup_property_type`/`lookup_use_category` + form dropdowns. ✅
- Slice #18.01 — Property "Add new": enable Save as soon as any single field is entered (compute via `form.watch()`, not `getValues()`). ✅
- Slice #18.02 — Property versioning: full-snapshot history (`property_version`), version nav (◀ / label / ▶) on the corners-line, green/red label + per-field highlight frames + per-row corner red frames / removed-corner red line, derived by diffing adjacent snapshots; only the latest version is editable, edit-save stays on the property. ✅ (See "Versioning pattern & pitfalls" below.)
- Slice #18.03a — Properties Map: enable Street View Pegman (re-enable `streetViewControl` over `disableDefaultUI`; uses the map's built-in, non-billed default panorama). ✅
- Slice #18.03b — Property detail: Street View panorama panel keyed to a property's location (centroid of corners, free coverage check via `StreetViewService`, imperative `StreetViewPanorama`, lazy-loaded "Show Street View" toggle, bilingual). ✅
- Slice #18.05 — Person versioning (natural + judicial, one shared `person_version` table): full-snapshot history, version nav (◀ / label / ▶ + "Make current") centered on the person-name line, green/red label + per-field highlight frames (incl. address blocks via a new `AddressBlock` `highlights` prop). No corners. Only the latest version is editable; edit-save stays on the person. Shared pure diff core in `src/lib/versioning/field-diff.ts`; per-subtype helpers in each `_components/form-schema.ts`. ✅ (See "Versioning pattern & pitfalls" below.)
- Slice #18.06 — Document versioning (`document_version` table): full-snapshot history of the document's ~21 own fields (flat snapshot — no subtypes, no corners, no satellites), version nav (◀ / label / ▶ + "Make current") centered on the document-name line, green/red label + per-field highlight frames. Pages (uploaded files) and M:M associations are OUT of scope (separate lifecycles). Only the latest version is editable; edit-save stays on the document. Reuses the shared diff core in `src/lib/versioning/field-diff.ts` + the shared `VersionNavControls`; diff helpers in `documents/_components/form-schema.ts`. ✅ (See "Versioning pattern & pitfalls" below.)
- Slice #18.07 — Groups (Administration → Reference Data → Groups, now a dedicated screen, not the generic value-list modal). New `groups` + `group_member` tables (`migration_032`); supersedes the old `lookup_others` `category='Grup'` placeholder (deleted in the migration). A group has a single `target_type` (Physical/Judicial person, Property, Document), a required `description` (editable in the editor; ≤500 chars), and a system-assigned two-letter `code` (AA, AB … skipping **I** and **O**) drawn from `group_code_seq` and encoded in `src/lib/groups/code.ts` — codes are **never reused**. Members get a per-group `position` (`[02]`) allocated from `groups.last_position` (high-water counter) — **never reused** (removing leaves a gap). A property may belong to **at most 3 groups** (enforced server-side; candidates already in 3 other groups are filtered out). Editor: Area A (read-only target + code, editable description, "Add items" toggle) over two panels — B (available, search + checkboxes + "Add to Group") / C (in-group, checkboxes + position + "Remove from Group"); staged moves commit on "Save group" (server assigns positions, so a freshly-added member shows `[new]` until saved). Non-Property targets are creatable but their editor shows a "not implemented yet" notice. Property detail: up to three `[AA 02]` badges on the corners-panel header (from `listPropertyGroupTags`). Membership is NOT versioned (M:M, out of scope, like the other associations). Files: `src/lib/groups/{code,members,validation,queries}.ts`, `src/app/api/groups/**`, `src/app/admin/groups/**`. ✅
- Slice #18.10.diviz — Administration → Calculation: upload a 5-section data file (§1 big-polygon Stereo 70 corners / §2 orientation H or V — confirmed against the coords / §3 owners + percentages / §4 road corner SW·NW·SE·NE — the corner the road shares & starts from, and which belongs to owner 1 / §5 road width), compute each owner's parcel border (carve a shared road strip along one long side, then divide the rest by ownership fraction; owners 1…N-2 get perpendicular cuts sized to their Final Area, owner N-1's east border runs parallel to the parcel's end/width sides through the road's NE corner — slope fixed, position solved so owner N-1 also hits its exact Final Area — and owner N takes the full-height remainder so any percentage rounding lands on N). **The road's east end (where it meets owner N) is a right angle (perpendicular to the road's two parallel long sides); the road's west end just follows the polygon's existing slanted side. To make the right angle exact, the working frame is rotated to align u with the ROAD edge itself (not merely a long side), so both road long sides are constant-v and the cap at constant-u is truly perpendicular — keep this alignment as the feature is enhanced.** Preview on a Google map + areas table, then create one Property per owner (nickname = owner name) + an optional common-road Property and assign them all to a new PROPERTY-target Group. Scope: HORIZONTAL and VERTICAL polygons, all four start corners — the road runs along whichever long edge contains the Section-#4 corner (H: road on South/North side × start West/East; V: road on West/East side × start South/North); owner 1 is always at that corner, and the geometry runs in a frame rotated so u follows the road edge (so it is orientation-agnostic). Pure, unit-tested core: `src/lib/calculation/{geometry,parse,compute}.ts` (geometry is conversion-free Stereo 70 maths; compute converts to WGS84 via `transdatRO`). API: `src/app/api/calculation/{preview,commit}/route.ts`. UI: `src/app/admin/calculation/**`. ✅
- Slice #18.15.bugs — Versioning UX bug-fixes across Property/Person/Document forms. **(1)** The N-1 → N change (the latest save) is now pointed out: navigating onto the latest version from a different one — via the ▶ arrow or "Make current" — briefly PULSES the green/red diff frames on the changed fields (~3 blinks over ~2.5s, then clears). Reuses the existing `computeFieldHighlights` diff; the pulse is transient component state (`pulse` + a timer; a `pendingPulseRef` fires the post-"Make current" pulse once the refetched version arrives). Frames are delivered through the existing `highlight=` channel via a shared `FieldPulseContext` (`src/components/versioning/field-pulse.tsx`) + pure `highlightRingClass` (`src/lib/versioning/highlight-ring.ts`); the animation is `@keyframes ga-version-pulse-*` in `globals.css` (reduced-motion → steady ring). Property corner changes pulse a red ring on the whole corners card (the interactive latest-version table can't render the per-row historical diff). NOT pulsed after an ordinary edit-save (you just made that change). **(3)** Document Save now disables once the form matches the saved baseline (`saveDisabled = submitting || (mode==="edit" && isOnLatest && !editDirty)`), matching Property/Person — previously it was `submitting` only, so Save never greyed out after a save. **(4)** Audited the edit-dirty field-key lists in all four `formValuesEqual` (Property / Natural / Judicial / Document) — all complete; every form reads `form.watch()`, so there is no missing-field defect. The intermittent "non-address edit doesn't enable Save" is most plausibly the `!form.formState.isValid` gate keeping Save disabled while an unrelated/address field is invalid (correct behaviour). No backend/DB/i18n changes. ✅
- Slice #18.12 — Property "Street View address": a second street line on the single `property_address` row (`street_view_street_line`, `migration_034`), holding only the street/number/block/floor/apt portion derived from Street View — it shares the row's postal/locality/county/country, so those are entered once and never repeated. In the Address panel it sits under the document-derived street line with a "Fetch from Street View" button that reverse-geocodes the corners' centroid (`google.maps.Geocoder` on the lazily-loaded geocoding library) and fills `route + nr. + street_number`, editable afterwards. Versioned like any other address field (added to `PropertySnapshotAddress` + the snapshot build/keys + the address highlight-key lists — same green/red frames). Out of scope: still one address row (`country` stays `NOT NULL`, so the SV line only persists alongside a country); pre-existing version snapshots read the field as null (no backfill). Pure, unit-tested extraction core: `src/lib/geo/reverse-geocode.ts` (`streetLineFromGeocodeResult`). ✅

Each slice typically lands as multiple small commits, each individually green.

## Versioning pattern & pitfalls (Property + Person + Document all done)

Property versioning shipped in Slice #18.02; Person versioning (both subtypes) shipped in Slice #18.05; Document versioning shipped in Slice #18.06. All three core entities are now versioned. This section is the canonical reference for the pattern — read it before adding versioning to any future entity or extending the existing ones.

**Document-specific notes (Slice #18.06) — the simplest application:**
- **Single table, flat snapshot.** No subtypes, no corners, no satellites — `DocumentSnapshot` is just the document's 21 own fields, all `string | null`, so the snapshot IS the flat field map (`computeFieldHighlights` diffs it directly, no flattening step). `suprafata` is the numeric column read as a string; cast `::text` in the migration backfill to match.
- **Scope = form fields only.** The uploaded `document_page` files and the M:M associations (persons / properties / documents) are deliberately OUT of the versioned scope — they have their own immediate-save lifecycles, like Property's associations and Person's associations.
- **`updateDocument` was wrapped in a transaction** for this slice (it previously did a bare update) so the version-append insert is atomic with the field patch.
- **Reuses the shared primitives** from `src/lib/versioning/field-diff.ts` (the entity-neutral diff core — relocated here from `src/lib/persons/version-diff.ts` once Document became the third consumer) and the shared `VersionNavControls` (`src/components/version-nav-controls.tsx`). i18n keys live under the `document` namespace as `version.*` + a `makeCurrent.*` confirm block.
- **Type-specific field visibility:** the snapshot always captures all 21 fields regardless of which are visible for the current document type; highlight frames render on whatever fields are visible for the viewed version's type, while the label colour reflects ALL field changes (even ones hidden under the current type). `documentTypeId` is itself a versioned field, so changing the type reads as a red modification.

**Person-specific notes (Slice #18.05), as a template for multi-subtype entities:**
- **Two subtypes, one shared table.** Natural and judicial persons both FK `person.id`, so a single `person_version` table serves both; the snapshot JSON shape simply differs by `person.type`. `listPersonVersions` (in `src/lib/persons/queries.ts`) is type-agnostic; each route/form casts to its subtype snapshot. The natural snapshot build + equality live in `persons/queries.ts`; the judicial ones in `judicial-persons/queries.ts`.
- **No corners** — drop the entire corner-diff clause. The diff is purely field-level (own fields + `person.notes` + the owned address blocks). The shared pure primitives (`fieldFrame`, `diffFieldMap`, `fieldMapsEqual`, `labelColorFromHighlights`) live in `src/lib/versioning/field-diff.ts`; each subtype's `form-schema.ts` supplies its field-key list and builds `computeFieldHighlights` / `versionLabelColor` / `snapshotToFormValues` / `formValuesEqual` on top.
- **Address-block highlights** reuse the shared `AddressBlock` component, which gained an optional `highlights` prop (per-subfield green/red ring). The judicial form inlines its own `AddressFields` (single Office Address card) and got the same `highlights` wiring.
- **Booleans in the snapshot** (judicial `correspondenceSameAsHq`) are diffed by stringifying to `"true"`/`"false"` in the field map (so a toggle reads as a red modification) while `formValuesEqual` compares them as booleans.
- **The version nav sits on the entity-name header line.** Each detail-tabs component renders a centered `pointer-events-none` slot in its `<header>`; the form portals the shared `VersionNavControls` into it. i18n keys live under each namespace as `version.*` (label/prev/next/makeCurrent/makeCurrentHint) + a `makeCurrent.*` confirm block.
- **Judicial update writes the version inside the tx** from a tx-consistent refetch — `getJudicialPersonById` (the function it returns) reads via the global `db` connection and would not see the tx's uncommitted writes.

Property versioning shipped in Slice #18.02. The Property recipe below is the canonical reference; the Person/Document notes above record where each diverged.

**Person-specific notes (Slice #18.05), as a template for Document:**
- **Two subtypes, one shared table.** Natural and judicial persons both FK `person.id`, so a single `person_version` table serves both; the snapshot JSON shape simply differs by `person.type`. `listPersonVersions` (in `src/lib/persons/queries.ts`) is type-agnostic; each route/form casts to its subtype snapshot. The natural snapshot build + equality live in `persons/queries.ts`; the judicial ones in `judicial-persons/queries.ts`.
- **No corners** — drop the entire corner-diff clause. The diff is purely field-level (own fields + `person.notes` + the owned address blocks). The shared pure primitives (`fieldFrame`, `diffFieldMap`, `fieldMapsEqual`, `labelColorFromHighlights`) live in `src/lib/versioning/field-diff.ts`; each subtype's `form-schema.ts` supplies its field-key list and builds `computeFieldHighlights` / `versionLabelColor` / `snapshotToFormValues` / `formValuesEqual` on top.
- **Address-block highlights** reuse the shared `AddressBlock` component, which gained an optional `highlights` prop (per-subfield green/red ring). The judicial form inlines its own `AddressFields` (single Office Address card) and got the same `highlights` wiring.
- **Booleans in the snapshot** (judicial `correspondenceSameAsHq`) are diffed by stringifying to `"true"`/`"false"` in the field map (so a toggle reads as a red modification) while `formValuesEqual` compares them as booleans.
- **The version nav sits on the person-name header line.** Each detail-tabs component (`natural-persons` / `judicial-persons` `_components/person-detail-tabs.tsx`) renders a centered `pointer-events-none` slot in its `<header>`; the form portals the shared `VersionNavControls` (`src/components/version-nav-controls.tsx`) into it. i18n keys live under each person namespace as `version.*` (label/prev/next/makeCurrent/makeCurrentHint) + a `makeCurrent.*` confirm block — NOT under a `corners` namespace.
- **Judicial update writes the version inside the tx** from a tx-consistent refetch — `getJudicialPersonById` (the function it returns) reads via the global `db` connection and would not see the tx's uncommitted writes.

Property versioning shipped in Slice #18.02. The Property recipe below is the canonical reference; the Person notes above record where Person diverged.

### Design — full snapshots, not deltas

- One `<entity>_version` table: `id` uuid PK, `<entity>_id` uuid FK (ON DELETE CASCADE), `version_number` int (0-based), `snapshot jsonb NOT NULL`, `created_at`, **unique `(<entity>_id, version_number)`**.
- Each save stores a COMPLETE snapshot (all versioned fields) as JSONB. Reconstructing "version N" is a direct lookup — no delta replay. (Adrian first suggested v0 + deltas; we changed to full snapshots for robustness. The "delta" still exists — it's just computed on the fly by diffing two snapshots at display time, and nothing derived is persisted. This honours the project's "storage is cheap; correctness/simplicity over efficiency; full over delta" rule.)
- **Versioned scope = the entity's own form fields** (plus satellite blocks it owns: Property's address + corners; Person's address(es); etc.). **NOT** the M:M associations (persons/documents/properties) — those live on other tabs and are out of scope.

### Rules (identical across entities; drop the corner clause where there are no corners)

- Version 0 = state at creation (written inside `createX`'s transaction).
- Each saved edit appends `max(version_number)+1` — but **skip the insert if the new snapshot equals the latest stored one** (no-op backstop), compared **field-by-field, NOT `JSON.stringify`** (Postgres jsonb does not preserve object key order).
- **Label colour**: v0 always green; otherwise red if any field was modified or deleted, OR (Property) corners changed in ANY way including a pure addition; green only for additions-with-no-corner-change.
- **Highlight frames** (shown only on a read-only historical version ≥ 1, diffing N vs N-1): green = added field, red = modified/deleted field. Property corners are per-row and **always red** for added/changed corners; a **removed corner renders as an empty, full-height red row at its former position** (so the table doesn't shrink). Corner-diff strategy: when the corner **count is unchanged** (in-place edit or reorder) diff **positionally** (`same`/`changed`) so the row count never changes; only when the count **differs** (genuine add/remove) fall back to an **LCS diff** that places the removed marker at the right spot. (Do NOT diff corners purely by LCS — a reorder/edit then renders as remove+add and grows the table by a row.)
- **Only the latest version is editable**; every earlier version is strictly read-only. Edit-save **stays on the entity page** (create/delete/cancel still navigate away).
- **"Make this version current"** — a button on the nav line (same level as ◀ / label / ▶), enabled **only while viewing a past version** (disabled on the latest). After an OK/Cancel confirmation describing the change, it restores the viewed snapshot as a **new version** (number = latest+1) by re-saving it through the normal save path (`doSave(form.getValues())` with the viewed corners), then follows the new latest — same stay-on-page baseline reset as an edit-save. No new endpoint needed.

### Layers to touch (mirror Slice #18.02's file set)

1. `migration_NNN_<entity>_versions.sql` (new) — create table + **backfill version 0 for every existing row** (idempotent: skip rows that already have a v0). The backfill's `jsonb_build_object` shape MUST match the JS snapshot shape exactly — **cast numerics to `::text`** so they match drizzle's string reads. Apply locally via `docker cp` + `psql -f` (NOT `npm run db:migrate`), to Supabase via SQL Editor, and add the table to `supabase_schema_full.sql`.
2. `src/db/schema/index.ts` — add the version table (`jsonb("snapshot")` left untyped to avoid a circular import; cast to the snapshot type in the query layer).
3. `src/lib/<entity>/validation.ts` — shared `EntitySnapshot` (+ sub-shapes) types. Pure types, safe to `import type` from client modules.
4. `src/lib/<entity>/queries.ts` — `snapshotFromFull`, `snapshotsEqual` (field-by-field), write v0 in `createX`, append-with-dedup in `updateX`, `listEntityVersions(id)` (oldest-first).
5. `src/app/api/<entity>/[id]/versions/route.ts` (new) — read-only `GET` → `{ items }`.
6. form-schema (pure, **unit-tested**): `snapshotToFormValues` / `snapshotToCorners`, `computeFieldHighlights(prev,curr)`, `computeCornerDiff(prev,curr)` (positional same/changed when count equal; LCS same/added/removed when count differs), `versionLabelColor(prev,curr)`, `cornersChanged`, `formValuesEqual`, plus types `HighlightColor` / `FieldHighlights` / `CornerDiffEntry` / `VersionNav`.
7. form component + the child that hosts the nav line; i18n keys `versionLabel` ("version {n}"), `prevVersion`, `nextVersion` (+ `removedCorner` where there are corners); tests.

Nav-line spacing (Adrian's spec, base gap `g`): `[+ Add] —g— [Show Big Map] —2g(ml-8)— [◀] —g(ml-4)— [version N] —g(ml-4)— [▶]`; `first:ml-0` zeroes the leading margin when earlier controls are hidden in read-only views.

### Pitfalls hit during Property versioning — avoid these next time

1. **Apply the migration before testing.** The save writes a version row in the *same transaction* as the field update; if the table doesn't exist the whole save rolls back (looks like "save failed / 500").
2. **Expired Supabase session = silent fake-success.** When the session expires, the auth middleware redirects the `PATCH` to `/sign-in` and `fetch` follows it as a **200** (sign-in HTML) — so the save *looks* successful (it redirects) but nothing persisted ("redirects but change is gone"), with a **401** visible on a token request in the console. Immediate fix: re-login. Permanent guard (`if (res.redirected) throw new Error(t("saveErrorSession"))`) is in the Property, Natural-Person, Judicial-Person, and Document `doSave` paths, each with a `saveErrorSession` i18n key in its namespace. Add it to any new mutating form too.
3. **React-Query cache hides the new version.** A too-high `staleTime` on the versions query serves the stale list (symptom: "stuck at version 0"). Use `staleTime: 0` + `refetchOnWindowFocus: false`, and **invalidate `["<entity>-versions"]` in `doSave` on success**.
4. **A disabled `<fieldset>` disables EVERY descendant control** — including the ◀/▶ nav buttons — and a child cannot be re-enabled per-button. Scope the read-only `<fieldset disabled={...}>` to wrap **only the editable input sections**; render the version-nav line **outside** it (the corners/nav child enforces its own read-only via a `readOnly` prop). Otherwise the arrows go dead on every read-only historical version (you can step back once from the latest, then get stuck).
5. **`editDirty` must compare to a baseline held in state, not RHF's `isDirty`.** Version navigation calls `form.reset(...)`, which clears RHF's `isDirty`. Compare watched values (+ corners) to a baseline initialised from `initialValues`/`initialCorners`; update that baseline after an edit-save so the form goes clean in place.
6. **Stay-on-page after an edit-save.** On success: reset the baseline to the just-saved state (Save disables), set `viewingVersion = null` (follow the new latest), and `router.refresh()` for server-rendered bits (e.g. the page title). The versions query invalidation makes the nav jump to the new version.
7. **Lock the nav while the latest is dirty.** Disable ◀/▶ when on the latest with unsaved edits, so a dirty draft is never stranded on a read-only historical view (where the page-leave guard wouldn't fire) — returning to the latest always restores the clean baseline.
8. **Zod 4 `z.string().uuid()` is strict** (it validates the version/variant nibbles). Test fixtures must use real-shaped v4 UUIDs (e.g. `...-4xxx-8xxx-...`); production ids are `gen_random_uuid` (v4) so live data is fine.
9. **Sandbox cannot run this repo's toolchain.** `node_modules` holds Windows-only esbuild/SWC binaries, so `tsc`/`jest`/`tsx` won't run in the Linux sandbox — verify by careful read-through and cross-checking shapes; **Adrian runs `npm run lint` + `npx jest`** on his machine before committing.

## Collaboration rules

- **Never commit or push without explicit confirmation.** Same for any irreversible action.
- **Conventional commits** — `feat:`, `fix:`, `chore:`, `ci:`, `docs(scope):`, `test:`, etc.
- **Always provide commit statements as ready-to-run PowerShell `git` commands**, not just the commit message text. Each commit should be a full `git add <files>` followed by `git commit -m "message"` that Adrian can paste directly into his terminal. **Never join them with `&&`** — Adrian's PowerShell is Windows PowerShell 5.1, which does not support `&&`/`||` as statement separators (`The token '&&' is not a valid statement separator in this version.`). Put each command on its own line instead (newline-separated is enough; PowerShell runs them sequentially regardless of exit code, which is fine for `git add` + `git commit`). If a single-line chain is genuinely needed, use `;` instead of `&&` — but separate lines are preferred for readability.
- **Always provide complete, ready-to-run PowerShell commands** for every step — including env var assignments, seed runs, migrations, etc. Never give a connection string or value in isolation; always show the full assignment (`$env:VAR = "value"`) as a separate line before the command that uses it. PowerShell cannot run a bare URL or string as a command.
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
- **Sandbox file drift from Windows.** Occasionally the Linux sandbox shows files as deleted/added when Adrian's Windows side is clean. Don't react to it — verify on his side. `tsc --noEmit` in the sandbox also shows phantom JSX parse errors on perfectly valid files that are already committed; these are sandbox artefacts, not real errors. The sandbox also cannot run `jest`/`tsx` (Windows-only esbuild/SWC binaries in `node_modules`). Always verify with `git diff` on Adrian's side, and have Adrian run `npm run lint` + `npx jest`.
- **Outputs-scratchpad sync lag (Windows-tool writes → bash reads), one-directional.** When editing a large file in the temporary outputs scratchpad (e.g. a docx `document.xml` during an unpack → edit → pack cycle), edits made via the Read/Edit/Write tools can take a long time (confirmed 40+ minutes, not resolved by `sleep`/`sync` retries) to become visible to bash `cat`/`wc` on the same nominal path — bash sees a stale, truncated snapshot. The reverse direction is reliable: anything written via bash is visible to the Windows-side tools immediately. Symptom: `pack.py` (which runs in bash) reports a premature/truncated XML error even though the Windows-side `Read` tool shows the file as complete and well-formed — this is the scratchpad lag, not a real XML mistake. Workaround: pull the correct content via `Read` (in chunks if the file is long) and write it into the bash-mounted path using a bash-native command (e.g. `cat >> file << 'EOF' ... EOF`) instead of the Edit/Write tools, then re-run the bash-side step. NOTE: a similar stale/truncated read has also been seen for freshly Edit-written files under the `ga40prj` mount (e.g. `messages/*.json` showing an "Unterminated string"); when in doubt, trust the Windows-side `Read` tool, not bash, for files just edited.
- **Zod v4 import.** The package is `zod ^4.x`. Always use `import { z } from "zod/v4"` — the default `"zod"` entry point re-exports v3 shims for compatibility and behaves differently. Also: `z.string().uuid()` is **strict** in v4 (validates version/variant nibbles) — test fixtures need real-shaped v4 UUIDs (`...-4xxx-8xxx-...`); real ids are `gen_random_uuid` (v4) so production is fine.
- **`AdvancedMarker` requires `mapId`.** Using `<AdvancedMarker>` without a `mapId` on the parent `<Map>` triggers the "This page can't load Google Maps correctly" error overlay on every render. Always pass `mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"}` to any `<Map>` that hosts `AdvancedMarker` children. `"DEMO_MAP_ID"` is Google's official dev placeholder and requires no Cloud Console setup.
- **Google Maps height chain.** `<Map style={{ height: "100%" }}>` only resolves when every ancestor has a concrete pixel height. `flex-1` alone (flex-algorithm height) does not satisfy this — wrap the map container in `<div className="relative flex-1 min-h-0"><div className="absolute inset-0">...</div></div>` to give it a concrete bounding box.
- **`@vis.gl/react-google-maps` event types differ by component.** `Map` component events give `MapMouseEvent` (library type) where `latLng` is a plain literal accessed as `event.detail.latLng?.lat` (property). `AdvancedMarker` drag events give `google.maps.MapMouseEvent` where `latLng` is a `LatLng` object accessed as `e.latLng?.lat()` (method call). Mixing these up is a silent runtime bug.
- **A disabled `<fieldset disabled>` disables EVERY descendant control** (inputs AND buttons), and a descendant cannot be re-enabled per-control. If a read-only form needs some still-clickable control inside it (e.g. version ◀/▶ nav, a toggle), render that control OUTSIDE the disabled fieldset — scope the fieldset to wrap only the truly-read-only inputs. (Hit in Slice #18.02: the version nav arrows died on read-only historical versions until the fieldset was narrowed to the cadastral + address sections.)
- **RHF `form.reset()` clears `isDirty`.** Any feature that programmatically resets the form (e.g. version navigation) must not rely on `form.formState.isDirty` for its "has unsaved changes" signal — compare current values to an explicit baseline held in state instead.
- **Auth: an expired Supabase session makes a save silently *look* successful.** The middleware redirects the mutating request to `/sign-in`; `fetch` follows the redirect and returns a 200 (the sign-in HTML), so the client thinks the save worked and navigates away — but nothing persisted, and a 401 shows on a token request in the console. Guard mutations with `if (res.redirected) throw ...` so the user gets a clear "sign in again" message. (Property, Natural-Person, Judicial-Person, and Document `doSave` paths all have this guard via a `saveErrorSession` key; add it to any new mutating form.)
- **4-column grid: skip the 3-column step.** For `columns={4}` in the `Section` helper, use `"grid grid-cols-2 gap-4 md:grid-cols-4"` — do not add a `md:grid-cols-3` intermediate. At common "half-width browser" sizes (768–1023 px) the 3-column class strands the layout on 3 columns instead of 4.
- **Drizzle `sql` template: a column object interpolated into a *correlated subquery* renders UNQUALIFIED.** Inside a `sql`` ` fragment used as a correlated subquery, `${someTable.id}` emits a bare `"id"` (not `"table"."id"`). If the subquery's own FROM exposes an `id` (e.g. it joins `group_member` + `property`), Postgres either rejects it as `column reference "id" is ambiguous` (SQLSTATE 42702) or — worse — silently binds it to the wrong table. Fix: reference the outer column as a **literal qualified name** in the template (e.g. `WHERE gm.group_id = groups.id`, not `= ${groups.id}`). Hit in Slice #18.07 (`listGroups` member-count + `getGroupDetail` candidate `otherGroupCount`/`NOT EXISTS`).
- **DB migration reminders — display these at the start of any migration step:**
  - *Local Docker:* **Do NOT use `npm run db:migrate`** — it exits silently without applying the file (confirmed repeatedly). Always apply migrations directly via `docker cp` + `psql -f`:
    ```powershell
    docker cp src/db/migration_NNN_name.sql ga40prj-postgres:/tmp/mNNN.sql
    docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/mNNN.sql
    ```
    Expected output: `CREATE TABLE` (or `ALTER TABLE`, etc.). No output = not applied.
  - *Supabase:* Paste the migration SQL directly into the Supabase SQL Editor. If using `db:migrate`, first set `DIRECT_URL` to the direct connection string (port 5432, `?sslmode=require`): `DIRECT_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres?sslmode=require`. Remove it again afterwards.
- **Coordinate axis order in Romanian cadastral text files**: The file columns are labeled `X [m]` (= Northing, ~300 000–850 000) and `Y [m]` (= Easting, ~200 000–800 000). This is the local Romanian geodetic convention where X points North — **opposite** to GDAL/PostGIS standard (X = Easting, Y = Northing). When calling `stereo70ToWgs84(north, east)`: pass the X column as `north` and the Y column as `east`. Valid Stereo70 range for the project area (Bragadiru, Ilfov): Northing ~320 000–325 000, Easting ~575 000–585 000.
- **`pg_dump` schema dump includes PostGIS `topology` schema — causes init conflict.** A schema-only `pg_dump` captures `CREATE SCHEMA topology;`. When this is used as a `docker-entrypoint-initdb.d` init script alongside `01-extensions.sql` (which creates `postgis_topology` and thus the `topology` schema first), psql hits `ERROR: schema "topology" already exists` and aborts with `ON_ERROR_STOP=on`. Fix: change `CREATE SCHEMA topology;` → `CREATE SCHEMA IF NOT EXISTS topology;` in the dump before shipping it.
- **`pg_dump` on Windows → UTF-16LE corruption.** PowerShell's `>` redirection saves files as UTF-16LE with BOM (`FF FE`). PostgreSQL's `psql` expects UTF-8; the null bytes corrupt SQL parsing and diacritics. **Never use `docker exec ... pg_dump > file.sql`.** Always let pg_dump write to the container filesystem, then copy out:
    ```powershell
    docker exec ga40prj-postgres pg_dump -U postgres ga40db -f /tmp/dump.sql
    docker cp ga40prj-postgres:/tmp/dump.sql ./dump.sql
    ```
    If you already have a suspect file, detect/fix encoding with `file`, `iconv -f UTF-16LE -t UTF-8`, strip CRLF (`sed -i 's/\r//'`) and BOM (`sed -i '1s/^\xEF\xBB\xBF//'`).
- **Non-ASCII characters in `.ps1` files break under Windows PowerShell 5.1.** It parses a no-BOM `.ps1` using the system codepage (the file-writing tools save UTF-8 without a BOM), so decorative non-ASCII (box-drawing `─`/`│`, smart quotes, em-dashes) becomes mojibake and can break tokenization (`ParserError: UnexpectedToken`). **Stick to plain ASCII in every `.ps1` file** — use `----`/`====` for dividers.
- **Relative paths break raw `[System.IO.File]` calls in `.ps1` scripts.** PowerShell cmdlets and external processes (`docker cp`, etc.) resolve relative paths against `$PWD`. Raw .NET static calls (`[System.IO.File]::ReadAllText`/`WriteAllText`) resolve them against the process-wide `[Environment]::CurrentDirectory`, which can silently diverge from `$PWD` (seen drifted to `C:\Windows\`). **Always resolve to an absolute path first** (`$repoRoot = $PSScriptRoot`; `[System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\rel"))`) before any raw `[System.IO.File]` call.
- **Ciprian UAT schema + reference-data delivery (UC-C6, `GA40.Operations.Guide.05.docx`).** Every DB schema change is delivered to Ciprian as a single fixed-name file, `ciprian-schema-update.sql`, at the root of `C:\dev\ga40prj.Ciprian\`. It is **fully regenerated, never hand-edited**, every time `build-ciprian-image.ps1` runs (Step 5), assembled live from `ga40prj-postgres`: (1) `DROP SCHEMA public CASCADE; CREATE SCHEMA public;`; (2) Ciprian's `01-extensions.sql`; (3) `pg_dump --schema-only`; (4) `pg_dump --data-only -t 'lookup_*'`. Applying it **wipes Ciprian's entire UAT database** and rebuilds it to match dev (confirmed acceptable). **Adrian never runs commands against `ciprian-ga40prj-postgres` himself** — that container is on Ciprian's PC; delivery always goes through the Ops Guide: schema/refdata change → **UC-C6** (send `ga40prj-app.tar` + `ciprian-schema-update.sql`); code-only → **UC-C5** (app tar only); full reset with no new version → **UC-C8**. `src/db/sync-reference-data.sql` / `npm run export:reference-data` are no longer part of the Ciprian flow.
- **Docker Compose `--env-file` does NOT inject every `.env` variable into a container.** It only makes values available for `${VAR}` substitution *inside the compose YAML*. A variable must be explicitly listed in the service's own `environment:` block (as `KEY: ${KEY}` or a literal) to be readable as `process.env.X` in the container. **When adding a new env var the app reads, also add it to the `environment:` block of every `docker-compose.yml` that runs the app** — local dev's and Ciprian's are separate files.
- **Ciprian's UAT container runs with `NODE_ENV=production` but no real Supabase project.** Code that branches purely on `NODE_ENV === "production"` to use a cloud backend will fail there. Document-page storage has an override: `LOCAL_FILE_STORAGE=true` forces the local-filesystem path even in production. If a future feature adds a "real backend required" path, check whether it needs a similar override rather than trusting `NODE_ENV` alone.
- **OCR (Tesseract) — label text fuses with coordinate tokens.** Left-margin label text (e.g. `"SE A"`) fuses with the first numeric token of the **first data row** (`"SE A 1 321762.117"` → `"11321762.117"`), adding multiple leading digits. Handled via `trySplitMergedToken` (strips 1–3 leading digits) + rescue-2b in `parseTableFormat`. To debug a skipped corner 1, `console.log(rawText)` at the top of `parseOcrText` and inspect the terminal after a scan.
- **OCR (Tesseract) — common digit confusions.** `l`/`I` → `1`, `O` → `0`. `fixOcrDigits` in `scan-image/route.ts` corrects these before numeric parsing.
- **OCR (Tesseract) — do not pre-filter lines by keyword.** OCR sometimes merges the header row (with words like "Suprafata") into the first data row; a keyword filter would discard the real coordinates. Let coordinate-range checks reject non-corner values instead.

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
