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
- Slice #10.06 — Role on Property ↔ Person association. ✅ Complete. Full detail below.
- Slice #10.07 — Role on Document ↔ Person association. ✅ Complete. Full detail below.
- Slice #12.01 — Judicial Person form refactor: Contact Persons panel (FK-linked natural persons) + Office Address panel (consolidated with "same as" checkbox). ✅ Complete. Full detail below.
- Slice #11.vercel.02 — Vercel/Supabase full reset + re-seed + fix 26 truncated/null-byte-corrupted source files + fix 3 stale TypeScript references to old judicial_person text columns. ✅ Complete. Full detail below.
- Slice #GIS.13.02 — Add Property from scanned image: OCR pipeline (tesseract.js) + multi-step dialog at "Add new property" entry point. ✅ Complete. Full detail below.
- Slice #GIS.13.03 — Add Property from text file / text folder: parse-text API route + 4-choice dialog + batch import. ✅ Complete. Full detail below.
- Slice #GIS.13.05 — Land map: auto-fit to all properties + red corner markers + drag-to-select batch delete. ✅ Complete. Full detail below.
- Slice #GIS.13.06 — Land map: overlap-aware InfoWindow (all properties under cursor, largest area first). ✅ Complete. Full detail below.
- Slice #GIS.13.08 — Property form: Show Big Map toggle (two-column layout with full-height map beside panels). ✅ Complete. Full detail below.
- Slice #GIS.13.10 — OCR parser: fix first-corner-skipped bug for Romanian-format merged tokens. ✅ Complete. Full detail below.
- Slice #GIS.13.11 — Text-file parser: accept first token as any number < 1 000 (was 1–9 999). ✅ Complete. Full detail below.
- Slice #GIS.13.12 — Land map: select/unselect via InfoWindow + "Display all selected" tab view. ✅ Complete. Full detail below.
- Slice #15.01 — Admin → Import: local-folder browser + Classify (Property / Person / Document). ✅ Complete. Full detail below.
- Slice #15.02 — Admin → Import: classified-state tracking, context preservation, fit-to-panel preview, rotation, Word link, text preview. ✅ Complete. Full detail below.
- Slice #15.05 — Project-wide rename: eliminate "Paperwork"/`PAPERWORK_TYPES` enum in favour of "Document" + admin-managed `lookup_document_type`. ✅ Complete. Full detail below.
- Slice #16.UX.01 — Person/Property/Document lists: sort most-recent-first + "New!"/"Nou!" recency badge next to the row checkbox. ✅ Complete. Full detail below.
- Slice #15.06 — Reference Data: keep alternate Romanian wordings as distinct document types + fix stale Ciprian sync script. ✅ Complete. Full detail below.
- Slice #15.07 — Reference Data: replace hardcoded `judicial_type` enum with admin-managed `lookup_judicial_person_type` table. ✅ Complete. Full detail below.
- Slice #15.09 — Sidebar nav cleanup: People/Property accordions → flat link / always-open sub-items; unified `/persons` list page combining Natural + Judicial. ✅ Complete. Full detail below.
- Slice #15.09.1 — Delete orphaned `/natural-persons` and `/judicial-persons` list pages. ✅ Complete. Full detail below.
- Slice #15.09.2 — Property sidebar section: accordion → two flat-link buttons (Properties List / Properties Map). ✅ Complete. Full detail below.
- Slice #15.10 — Property "Add new" form: don't create/guard-trip on an untouched, all-blank create form. ✅ Complete. Full detail below.
- Slice #15.11 — Reference Data Person panel: rename "Person Types" caption → "Physical Person Types" + move Judicial Person Types button to second position. ✅ Complete. Full detail below.
- Slice #15.12 — Reference Data: new "Roles" panel (Person Roles, Property Persons, Document Persons) between Document and Others. ✅ Complete. Full detail below.
- Slice #15.13 — Document form: "Show Big Page" toggle, mirroring Property's "Show Big Map". ✅ Complete. Full detail below.
- Slice #15.14 — Document Pages viewer: mouse-wheel zoom + click-drag pan in "Show Big Page" mode. ✅ Complete. Full detail below.
- Slice #15.15 — Ops: replace Ciprian UAT's incremental migration-file delivery (UC-C6) with a single, fixed-name, fully-regenerated `ciprian-schema-update.sql` (full wipe + rebuild of schema and reference data every time, no hand-maintained seed file). `GA40.Operations.Guide.05.docx` delivered. ✅ Complete. Full detail below.
- Slice #15.16 — Ciprian UAT bug fixes: vision API key never reached the app container + Admin Import "Internal server error" on Document upload + missing `update.bat`. ✅ Complete. Full detail below.
- Slice #15.17 — Property corners: track original cadastral-file index per corner (survives reordering) + default corners display to Stereo 70. ✅ Complete. Full detail below.
- Slice #16.UX.02 — Help Content: Administration screen-help (Background + How-To) + inline micro-hints. ✅ Complete. Full detail below.
- Slice #16.UX.03 — Properties Map: click/double-click InfoWindow model (replaces hover-based InfoWindow). ✅ Complete. Full detail below.
- Slice #15.18 — Ciprian UAT bug fixes: Property-from-text-file import "Internal server error" — two independent causes: (1) Stereo70 grid file missing from the Docker runtime image; (2) `property_corner.original_index` column missing from Ciprian's database (Slice #15.17 migration never delivered). ✅ Complete. Full detail below.
- Slice #15.19 — Property Type & Use Category: drop the `property_type` ("LAND") and `use_category` (CATEG1/2/3) Postgres enums; replace with nullable FK columns to admin-managed `lookup_property_type` / `lookup_use_category`; add a Property Type dropdown + re-point the Use Category dropdown on the property form. ✅ Complete. Full detail below. (The slice-input doc labelled this "Slice.15.16"; renumbered to #15.19 to avoid colliding with the existing #15.16 Ciprian-UAT slice.)
- Slice #18.01 — Property "Add new" form: enable Save as soon as any single field is entered (was wrongly gated on entering corners). ✅ Complete. Full detail below.

Each slice typically lands as multiple small commits, each individually green.

### Slice #18.01 — Property "Add new" form: Save enables on any single field (detail)

Pure frontend, single-file change — no DB, API, schema, validation, i18n, or test changes.

**Bug report (Adrian)**: on the "Add new property" form, Save stayed disabled even after filling in seven or eight fields. The only way to enable Save was to also enter at least one corner. Desired behaviour: Save should enable if **at least one field** (any text field, dropdown, area, address, or corner) has been entered.

**Root cause**: in `src/app/properties/_components/property-form.tsx`, the create-mode Save gate is:
```ts
const createHasData = mode === "create" && hasFormData(form.getValues(), corners);
const saveDisabled =
  submitting ||
  !form.formState.isValid ||
  (mode === "create" && !createHasData) ||
  (mode === "edit" && !form.formState.isDirty && corners === initialCorners);
```
`hasFormData` (in `form-schema.ts`) was already correct — it returns `true` if any single top-level field, any address field, or any corner is present. The bug was that `createHasData` **never recomputed** as the user typed, so it stayed stale at `false`:
- It was read via `form.getValues()`, which does **not** subscribe to value changes — its result is only fresh if the component re-renders.
- The Slice #15.10 comment assumed the component "re-renders on every keystroke" because `formState` is read in `saveDisabled`. But in **create mode** the only `formState` field actually evaluated is `form.formState.isValid` — the `form.formState.isDirty` read sits inside `(mode === "edit" && …)` and is short-circuited away before evaluation, so `isDirty` is never subscribed in create mode.
- Every property field is an optional `z.string()` (nothing required), so an empty create form is **already valid**; `isValid` stays `true` the whole time you type and therefore never *changes*. With no `formState` change, the component never re-rendered on field edits → `getValues()` was never re-read → `createHasData` stayed `false` → Save stayed disabled.
- Entering a **corner** "fixed" it only because `setCorners(...)` is a real `useState` update that forces a re-render, finally recomputing `createHasData`. Plain field edits triggered no such re-render.

**Fix** — one change (plus its explanatory comment) in `property-form.tsx`: compute `createHasData` from `form.watch()` instead of `form.getValues()`. `watch()` subscribes to value changes and re-renders on every keystroke, so the gate recomputes live:
```ts
const watchedValues = form.watch();
const createHasData = mode === "create" && hasFormData(watchedValues, corners);
```
`hasFormData`, `form-schema.ts`, and the Zod schema are untouched. The existing `useUnsavedChangesGuard` already consumes `createHasData`, so it is fixed by the same change — a field-only-filled create form is now correctly recognised as dirty too. Slice #15.10's behaviour is preserved: an untouched all-blank create form still reports `createHasData = false`, so Save stays disabled and navigating away creates no DB row. Edit mode's gate (`form.formState.isDirty || corners !== initialCorners`) is unchanged and out of scope.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual reasoning about the RHF subscription model (getValues vs watch, the create-mode short-circuit on `isDirty`, and the always-valid empty form). **Adrian should run `npm run lint` and manually re-test** (Add new property → type one field → Save enables with no corners; pick only a dropdown → Save enables; open Add new property and navigate away untouched → no unsaved-changes dialog, no blank row; edit an existing property → Save still gated on a real change) before committing.

**Files touched**
- `src/app/properties/_components/property-form.tsx`
- `CLAUDE.md`

Each slice typically lands as multiple small commits, each individually green.

### Slice #15.19 — Property Type & Use Category: enum → Reference-Data FK (detail)

DB migration + schema + validation + query layer + property form UI + i18n + seed + tests. The two reference-data tables (`lookup_property_type`, `lookup_use_category`) already existed and are admin-managed via Administration → Reference Data; this slice just makes `property` reference them by FK instead of using the old hardcoded Postgres enums.

**Why**: Adrian wants property type and use category operator-managed (add/rename/remove rows in Reference Data) rather than baked into a code-side enum. The `property_type` enum had a single placeholder value (`LAND`) and `use_category` had three placeholders (`CATEG1/2/3`) that never mapped to anything real. Both fields are nullable.

**Backfill decision (Adrian)**: no backfill. The old enum values have no canonical lookup-row equivalent, so every existing property starts with `property_type_id` / `use_category_id` = NULL and is re-picked from the new dropdowns.

**DB migration (`src/db/migration_028_property_type_usecat_fk.sql`)**
- `ADD COLUMN IF NOT EXISTS property_type_id uuid REFERENCES lookup_property_type(id) ON DELETE SET NULL` (nullable).
- `ADD COLUMN IF NOT EXISTS use_category_id uuid REFERENCES lookup_use_category(id) ON DELETE SET NULL` (nullable).
- `DROP COLUMN IF EXISTS type` / `DROP COLUMN IF EXISTS use_category`, then `DROP TYPE IF EXISTS property_type` / `DROP TYPE IF EXISTS use_category`. Idempotent throughout. No backfill.

**Schema (`src/db/schema/index.ts`)** — removed both `pgEnum` declarations; `property` gained `propertyTypeId` / `useCategoryId` (nullable FK, `onDelete: "set null"`) in place of the old `type` (was `notNull().default("LAND")`) and `useCategory` columns. Both FKs use forward thunks to `lookupPropertyType` / `lookupUseCategory` (defined later in the file) — same pattern as `naturalPerson.citizenshipId`.

**`supabase_schema_full.sql`** — dropped the two `CREATE TYPE` lines; `property` now declares `property_type_id uuid` / `use_category_id uuid` as plain columns, with the two FK constraints added via `ALTER TABLE` right after the `lookup_use_category` seed (deferred-FK pattern, since the lookup tables are created after `property`). `supabase_reset.sql`'s `DROP TYPE IF EXISTS property_type/use_category CASCADE` lines were left as-is — harmless idempotent guards that also clean up pre-existing cloud DBs on a full reset.

**Validation (`src/lib/properties/validation.ts`)** — removed the now-invalid `.omit({ type: true })` (the column no longer exists); `propertyBase` `.extend(...)` gained `propertyTypeId: z.string().uuid().nullish()` and `useCategoryId: z.string().uuid().nullish()`. Empty selection → null; a non-uuid is rejected with 400.

**Query layer (`src/lib/properties/queries.ts`)** — `createProperty` drops the hardcoded `type: "LAND"` and writes `propertyTypeId` / `useCategoryId`; `updateProperty`'s `propPatch` swaps the `useCategory` line for `propertyTypeId` + `useCategoryId`. `listProperties` dropped the `useCategory` select column and `PropertyListItem` field (the list view never displayed it). `getPropertyById` / `PropertyFull` use a bare `.select()` so the new columns surface automatically.

**Property form (`src/app/properties/_components/`)**
- `form-schema.ts`: `FormValues` gained `propertyTypeId` (string, "" = unset) and renamed `useCategory` → `useCategoryId`; `emptyFormValues`, `PropertyRow`, `fromApiPayload`, `TOP_LEVEL_TEXT_FIELDS`, and `toApiPayload` all updated (the old `as "CATEG1"|...` cast removed; both now pass through `blank(...)`).
- `property-form.tsx`: two `useQuery`s fetch options from `/api/admin/value-lists/property-types` and `/api/admin/value-lists/use-categories`, both keyed `["value-list", <listKey>]` — the SAME key the admin `ValueListModal` invalidates on save/delete, so the dropdowns stay in sync with Reference-Data edits with no extra cross-invalidation (mirrors the Slice #15.07 judicial-person-type dropdown; deliberately avoids the Slice #15.06 document-types stale-dropdown special case). A new **Property Type** `SelectField` was added as the first cadastral field; the existing **Use Category** `SelectField` was re-pointed to `useCategoryId` with options from the lookup. Both prepend a `noneOption` ("— none —") empty choice.
- `list-view.tsx`: dropped the unused `useCategory` field from its local item type.

**i18n** — added `property.fields.propertyType` ("Property Type" / "Tip proprietate") and `property.fields.noneOption` ("— none —" / "— niciunul —") to both message files; trimmed the now-dead `property.useCategories.CATEG1/2/3` keys (kept the unused `empty` dash, harmless). The `property.fields.useCategory` label key was kept — it still labels the same dropdown.

**Seed (`src/db/seed.ts`)** — removed the `UseCategory` type, the `useCategory` field from `SeedPropertyRow`, the `useCategory: "CATEGn"` value on all 30 seed rows, and the `type: "LAND"` / `useCategory` lines from the property insert. Seeded properties now have NULL type and use category (consistent with the no-backfill decision). The seed does not resolve type/category lookup ids — not required.

**Tests** — `property.test.ts`: removed `useCategory` from the populated-form / create-payload cases, updated `fromApiPayload` / `toApiPayload` stubs to `propertyTypeId` / `useCategoryId`, and replaced the "rejects an invalid useCategory" enum test with "rejects a non-uuid useCategoryId" + "rejects a non-uuid propertyTypeId". `properties-api.test.ts`: updated `stubFull.property` (dropped `type: "LAND"`, added `propertyTypeId/useCategoryId: null`) and changed the 400 test to send `{ useCategoryId: "WRONG" }`.

**Manual setup required (not yet run)**
1. Apply `src/db/migration_028_property_type_usecat_fk.sql` to local Docker via `docker cp` + `psql -f` (per the standing migration gotcha — `npm run db:migrate` does not apply it locally):
   ```powershell
   docker cp src/db/migration_028_property_type_usecat_fk.sql ga40prj-postgres:/tmp/m028.sql
   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m028.sql
   ```
2. Apply the same migration to Supabase via the SQL Editor.
3. Ciprian UAT: picked up automatically by the next `build-ciprian-image.ps1` run (Slice #15.15's auto-regenerated `ciprian-schema-update.sql` does a full schema rebuild from the live dev DB).

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit` / `jest` are not reliable here. Verification was a repo-wide grep sweep confirming zero remaining references to `propertyTypeEnum` / `propertyCategoryEnum` / the old `property.useCategory` / `.type "LAND"` / `CATEG[0-9]` in code (only intentional comments and the kept `fields.useCategory` label remain), plus a manual read-through of the end-to-end shape (schema → migration → validation → queries → form-schema → property-form → tests) and a JSON-validity check on both message files. **Adrian should run `npm run lint` + `npx jest` and manually re-test** (open Add new property → both dropdowns populate from Reference Data and default to "— none —"; save with each set/unset; open an existing property → dropdowns reflect the stored ids; add a row in Reference Data → Property Types and confirm it appears in the form dropdown without a reload) before committing.

**Files touched**
- `src/db/migration_028_property_type_usecat_fk.sql` (new)
- `src/db/schema/index.ts`
- `src/db/supabase_schema_full.sql`
- `src/lib/properties/validation.ts`
- `src/lib/properties/queries.ts`
- `src/app/properties/_components/form-schema.ts`
- `src/app/properties/_components/property-form.tsx`
- `src/app/properties/list-view.tsx`
- `src/db/seed.ts`
- `src/__tests__/property.test.ts`
- `src/__tests__/properties-api.test.ts`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.18 — Ciprian UAT bug fixes: Property text-file import 500 (detail)

Two independent bugs, both producing the identical generic "Internal server error" in the browser. Found by Adrian testing the Ciprian package built after Slice #15.16/#15.17, then persisting after the first fix was applied.

**Bug report (Adrian)**: in the Ciprian UAT package, importing a JPG as a Document via Admin Import works fine, but importing a `.txt` file with Stereo70 coordinates as a Property fails with a generic "Internal server error." Error persisted after Bug 1's Dockerfile fix was applied and the image was redelivered.

**Bug 1 root cause**: `src/lib/geo/transdatRO.ts` (the Stereo70 ↔ WGS84 coordinate-transform module, used by `POST /api/properties/parse-text` whenever a `.txt` cadastral file is imported) reads a binary correction-grid file from disk on first use:
```ts
const GRID_PATH = path.join(process.cwd(), 'src', 'lib', 'geo', 'grids', 'ETRS89_KRASOVSCHI42_2DJ.GRD');
...
_gridBuf = fs.readFileSync(GRID_PATH);
```
`Dockerfile`'s runtime stage (`runner`) builds on Next.js's `standalone` output and only ever copies four things into the image: `messages/`, `.next/standalone`, `.next/static`, and `public/` — `src/` itself is never copied. Next's standalone-output file tracer only follows real module imports (`import`/`require`); a raw `fs.readFileSync` call on a path built at runtime from `process.cwd()` isn't statically traceable, so it was never swept in automatically the way `node_modules` dependencies are. The grid file (`src/lib/geo/grids/ETRS89_KRASOVSCHI42_2DJ.GRD`, 61 KB, the only file in that directory) was therefore completely absent from the Ciprian image; `fs.readFileSync` threw `ENOENT` the moment any code path called `stereo70ToWgs84`/`wgs84ToStereo70`, surfacing to the browser as a generic 500.

This is why the JPG-as-Document import worked but the text-file Property import didn't: the Document/file-upload path (already fixed for Ciprian in Slice #15.16) never touches `transdatRO.ts` at all, while the text-file Property import calls `parse-text`, which converts every parsed corner from Stereo70 to WGS84 before returning — guaranteed to hit the missing-file code path on the very first corner. Local dev (`npm run dev`) and Vercel are both unaffected: neither runs from this Dockerfile's `runner` stage, so `process.cwd()` there always resolves to a checkout that still has `src/lib/geo/grids/` on disk.

**Bug 1 fix (`Dockerfile`)** — one new `COPY` line in the `runner` stage, right after the existing `public/` copy:
```dockerfile
# transdatRO.ts reads this binary grid file from disk at runtime via
# fs.readFileSync(path.join(process.cwd(), "src", "lib", "geo", "grids", ...)).
# It is NOT picked up by Next's standalone output tracing (a raw fs.readFileSync
# on a process.cwd()-built path isn't statically traceable), so without this
# explicit copy the file is missing in the runtime image and any Stereo70 <->
# WGS84 conversion (e.g. importing a property from a text file) throws ENOENT,
# surfacing as a generic 500 "Internal server error".
COPY --from=builder /app/src/lib/geo/grids ./src/lib/geo/grids
```
Copies the whole `grids/` directory (not just the one current file) so any future additional grid file needs no further Dockerfile change. The destination path (`./src/lib/geo/grids`, relative to the `runner` stage's `WORKDIR /app`) exactly matches what `GRID_PATH`'s `path.join(process.cwd(), 'src', 'lib', 'geo', 'grids', ...)` resolves to at runtime (`process.cwd()` is `/app` when `node server.js` runs from that `WORKDIR`), so no code change to `transdatRO.ts` was needed — only the missing copy step.

**Bug 2 root cause**: Slice #15.17 added `migration_027_property_corner_original_index.sql`, which adds `property_corner.original_index` (nullable integer) to the DB. The current app code in `src/lib/properties/queries.ts` unconditionally writes `originalIndex: c.originalIndex ?? null` into every `propertyCorner` insert in both `createProperty` (line ~209) and `updateProperty` (line ~287). If Ciprian's database was never updated with this migration — i.e., `migration_027` was never included in a `ciprian-schema-update.sql` that Ciprian applied — every property-corner insert throws a Postgres `column "original_index" of relation "property_corner" does not exist` error. This is an unhandled DB error caught by `dbErrorToResponse`/`unexpectedError` in `POST /api/properties`, returning the same generic 500 as Bug 1. Because both bugs produce identical browser-facing symptoms, Bug 2 was invisible until Bug 1's Dockerfile fix was redelivered and the error still persisted.

The text-file import path calls `POST /api/properties/parse-text` (succeeds — no corner write here) then `POST /api/properties` with the parsed corners. It is the second call that fails at the `INSERT INTO property_corner` step due to the missing column.

**Bug 2 fix**: no code change. `build-ciprian-image.ps1`'s Step 5 assembles `ciprian-schema-update.sql` by doing a fresh `pg_dump --schema-only` from the live `ga40prj-postgres` container, which always reflects the current schema including the `original_index` column (as long as `migration_027` has been applied to Adrian's local Docker — which it must have been, since the app has been running locally with that code since Slice #15.17). When Ciprian applies this file (full wipe + rebuild), his `property_corner` table gains the column automatically.

**Delivery**: this is **UC-C6** (schema change), not UC-C5. Both files must be sent to Ciprian. Confirmed: the earlier guidance in this session to treat this as UC-C5 was incorrect.

1. Ensure `migration_027_property_corner_original_index.sql` has been applied to your local `ga40prj-postgres` (it should have been per Slice #15.17 instructions).
2. Run `.\build-ciprian-image.ps1` — produces both `ga40prj-app.tar` (with the Bug 1 grid-file fix baked in) and `ciprian-schema-update.sql` (with the `original_index` column in the schema, and Bug 2 resolved).
3. Send Ciprian **both files** (replace his existing copies).
4. Ciprian: run `update.bat`, then apply the schema update:
```powershell
docker cp ciprian-schema-update.sql ciprian-ga40prj-postgres:/tmp/ciprian-schema-update.sql
docker exec ciprian-ga40prj-postgres psql -U postgres -d ga40db -v ON_ERROR_STOP=1 -f /tmp/ciprian-schema-update.sql 2>&1 | Tee-Object -FilePath schema-update.log
```

**Verification note**: per the standing project gotcha, the sandbox cannot run Docker, so neither fix was tested end-to-end. Bug 1 was verified by reading `transdatRO.ts` and `Dockerfile` in full. Bug 2 was verified by reading `src/lib/properties/queries.ts` lines 199–213 and 276–291 in full — the `originalIndex` column is present in both insert value maps with no conditional guard — and by confirming via grep that `property_corner.original_index` is defined in `src/db/schema/index.ts` and first appears in `migration_027`. **Adrian should rebuild and redeliver both files, then re-test the exact repro (Admin Import → `.txt` coordinate file → Classify as Property) on Ciprian's machine.**

**Files touched**
- `Dockerfile` (Bug 1)
- `CLAUDE.md`

### Slice #16.UX.03 — Properties Map: click/double-click InfoWindow model (detail)

Pure frontend, single file — no DB, API, or i18n changes.

**Why**: Adrian found the previous hover-triggered InfoWindow (a `mousemove` listener + a 2-second auto-close timer + per-id "already shown" tracking) imprecise on a dense map — moving the mouse near a cluster of overlapping parcels flashed InfoWindows on and off unpredictably as the cursor drifted. He wanted a click model instead: a single click opens an InfoWindow listing every property under the cursor (the existing overlap-aware hit-test from Slice #GIS.13.06, unchanged), and double-clicking a single unambiguous property navigates straight to its detail page, without first flashing an intermediate InfoWindow.

**`src/app/properties/map/property-map.tsx`**
- Removed the entire hover-tracking mechanism: the `document`-level `mousemove` listener, `closeTimerRef`, `shownIdsRef: Set<string>`, and `anchorRef`, plus the effect that wired them together.
- Removed the now-dead `centroid(corners: Corner[]): LatLng` helper — it only existed to anchor the hover InfoWindow at a polygon's centroid; click position is used directly now.
- New `handleMapClick(pos: LatLng | null)`: if `pos` is null, or `findOverlapping` (the unchanged Slice #GIS.13.06 hit-test) finds no match, clears `selected`; otherwise opens the InfoWindow listing every overlapping property, largest area first — same rendering as before.
- New `handleMapDblClick(pos: LatLng | null)`: re-runs the same hit-test. If exactly one property matches **and** the map is not in select mode on the "all" tab (`!(selectMode && activeTabRef.current === "all")`), navigates straight to `/properties/{id}` via `useRouter()` — no InfoWindow shown for the common single-property case. Any ambiguous result (zero or ≥ 2 matches), or a double-click while in select mode, falls back to `handleMapClick(pos)` — i.e. behaves exactly like a single click.
- `<Map>` now wires `onClick={(e) => handleMapClick(e.detail.latLng)}` and `onDblclick={(e) => handleMapDblClick(e.detail.latLng)}` directly — both use the library's plain-literal `MapMouseEvent` shape, per the project's established `event.detail.latLng` convention for `<Map>`-level events (not the `AdvancedMarker` method-call convention).
- `<InfoWindow onCloseClick={() => setSelected(null)}>` is otherwise unchanged — same overlap list and Select/Unselect link logic from Slices #GIS.13.06 and #GIS.13.12.
- New import: `import { useRouter } from "next/navigation";` + `const router = useRouter();`.

**Note on slice numbering**: the code's own header comment self-labels this change "(Slice #15.12)" — that number was already used (and documented above) for the unrelated "Reference Data: new 'Roles' panel" slice, so it is renumbered here as **#16.UX.03** to avoid a collision in this log. No functional significance, just a documentation bookkeeping fix — the in-code comment was left as-is.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual: re-read the full rewritten file to confirm the removed hover-tracking effect had no other consumers (`shownIdsRef`/`anchorRef`/`closeTimerRef` were all local to the deleted effect), confirmed `findOverlapping`/`withGeometryRef`/`activeTabRef` (all pre-existing) are referenced with their established names and shapes, and confirmed `<Map>`'s `onClick`/`onDblclick` both receive the plain-literal `MapMouseEvent` per the project's documented event-type distinction. **Adrian should manually re-test** (single-click an isolated property → InfoWindow opens; double-click it → navigates directly with no InfoWindow flash; click and double-click an overlap area with 2+ properties → InfoWindow opens both times, no navigation) before committing.

**Files touched**
- `src/app/properties/map/property-map.tsx`
- `CLAUDE.md`

### Slice #16.UX.02 — Help Content: Administration screen-help + micro-hints (detail)

DB migration + schema + query/validation layer + 6 new API routes + a new Administration page + two new app-facing components — no changes to any existing CRUD logic beyond two small sidebar-nav additions.

**Why**: Adrian wanted a self-served, admin-editable on-screen help system — a per-screen "Background + How-To" popover (bilingual) plus lighter inline micro-hints for hidden mouse/keyboard behaviour that's easy to miss (e.g. drag-to-select on the Properties Map, wheel-zoom on the Document big-page viewer) — editable entirely from Administration, with no code change needed just to update the wording.

**Code-side registry, not free text**: `screenKey` / `hintKey` values are not arbitrary strings typed into the admin UI — they must match an entry in `src/lib/help/registry.ts`, the single source of truth for which screens/hints exist in the app. A registry entry with no matching DB row simply renders nothing (no Help button, no hint shown) — so adding the *editable content* for a screen/hint is an admin-only step, but adding the *screen/hint itself* is still a code change, by design (the only way to guarantee the right `<HelpButton>`/`<HelpHint>` is actually wired into the right page first).

**DB migration (`src/db/migration_026_help_content.sql`)**
- `help_content` — one row per "screen": `id` (uuid PK), `screen_key` (text, NOT NULL UNIQUE), `background_en`/`background_ro`/`how_to_en`/`how_to_ro` (all nullable text), `created_at`, `updated_at`.
- `help_hint` — one row per micro-hint, scoped to a screen: `id` (uuid PK), `screen_key`/`hint_key` (text, both NOT NULL), `text_en`/`text_ro` (nullable text), `created_at`, `updated_at`, with a unique index on `(screen_key, hint_key)` (`help_hint_screen_hint_unique`) — the same hint key can be reused across different screens, but not duplicated within one.

**Schema (`src/db/schema/index.ts`)** — `helpContent` and `helpHint` tables added exactly per the migration, with the registry relationship spelled out in a header comment.

**Registry (`src/lib/help/registry.ts`)** — the static list of every screen/hint the app actually surfaces help for; `validation.ts` and the query layer cross-check incoming `screenKey`/`hintKey` values against this list rather than trusting the DB or the admin form blindly.

**Query + validation layers (`src/lib/help/queries.ts`, `validation.ts`)** — standard list/get/upsert helpers for both tables, keyed by `screenKey` (and `screenKey`+`hintKey` for hints).

**API routes**
- `GET/POST /api/admin/help-content` — list all screens' content / upsert one.
- `GET /api/admin/help-content/[screenKey]` — fetch one screen's content (admin editor).
- `GET/POST /api/admin/help-hints` — list all hints / upsert one.
- `GET /api/admin/help-hints/[screenKey]/[hintKey]` — fetch one hint.
- `GET /api/help/[screenKey]` — the public, app-facing read used by `<HelpButton>`/`<HelpHint>` to fetch a screen's content/hints at render time.

**Admin UI (`src/app/admin/help-content/page.tsx`, `_components/help-content-hub.tsx`)** — two-tab hub: "Screens" and "Micro-hints". Each tab lists every registry entry with a Complete/Missing status badge, a left-hand picker list, and a right-hand editor form (Background EN/RO + How-To EN/RO for screens; hint text EN/RO for hints) with Save/Saving/Saved/error states and a live preview pane.

**App-facing components (`src/components/help/help-button.tsx`, `help-hint.tsx`, `use-help-data.ts`)** — `<HelpButton screenKey="...">` renders a small help affordance that opens a popover with the screen's Background/How-To content (bilingual, follows the active locale); `<HelpHint screenKey="..." hintKey="...">` renders a lighter inline tip. `use-help-data.ts` is the shared data-fetching hook backing both, reading from `GET /api/help/[screenKey]`.

**Sidebar (`src/components/sidebar/nav-config.ts`, `sidebar-nav.tsx`)** — new "Help Content" item under Administration (`HelpCircle` icon, `href: "/admin/help-content"`); `itemLabels` gained `helpContent: t("items.helpContent")`.

**i18n** — `nav.items.helpContent` ("Help Content" / "Conținut Ajutor") plus a full new `help.*` namespace in both `messages/en-GB.json` and `messages/ro-RO.json`: `buttonLabel`, `title`, `background`, `howTo`, `close`, `hintLabel`, and an `admin.*` sub-namespace (`pageTitle`, `screensTab`, `hintsTab`, `statusComplete`, `statusMissing`, the four `label*` field labels, `save`/`saving`/`saveError`/`saved`, `previewTitle`, `noScreenSelected`, `noHintSelected`).

**Manual setup required (not yet run)**
1. Apply `src/db/migration_026_help_content.sql` to local Docker via `docker cp` + `psql -f` (per the standing migration gotcha).
2. Apply the same migration to Supabase via the SQL Editor.
3. Populate at least one screen's Background/How-To via Administration → Help Content before relying on `<HelpButton>` anywhere — an unpopulated registry entry renders nothing, by design, so an empty Help button is expected until content is added.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual: re-read every new file in full to confirm the registry/DB-row relationship is consistent (a `screenKey`/`hintKey` not in `registry.ts` is never reachable from the admin hub's picker lists), confirmed the unique index covers the right two columns for `help_hint`, and confirmed both message files remain valid JSON after the new `help.*` namespace was added. **Adrian should still run `npm run lint`** and spot-check one `<HelpButton>` and one `<HelpHint>` end-to-end (admin edit → save → reopen the same screen in the app → confirm the new text appears in the active locale) before committing.

**Files touched**
- `src/db/migration_026_help_content.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/help/registry.ts` (new)
- `src/lib/help/queries.ts` (new)
- `src/lib/help/validation.ts` (new)
- `src/app/api/admin/help-content/route.ts` (new)
- `src/app/api/admin/help-content/[screenKey]/route.ts` (new)
- `src/app/api/admin/help-hints/route.ts` (new)
- `src/app/api/admin/help-hints/[screenKey]/[hintKey]/route.ts` (new)
- `src/app/api/help/[screenKey]/route.ts` (new)
- `src/app/admin/help-content/page.tsx` (new)
- `src/app/admin/help-content/_components/help-content-hub.tsx` (new)
- `src/components/help/help-button.tsx` (new)
- `src/components/help/help-hint.tsx` (new)
- `src/components/help/use-help-data.ts` (new)
- `src/components/sidebar/nav-config.ts`
- `src/components/sidebar/sidebar-nav.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.17 — Corner original index + Stereo70 default display (detail)

DB migration + schema + validation + query layer + parse-text route + every client `Corner` type/payload site + `CornersManager` UI. No changes to the OCR scan-image route (it never produced a leading index token).

**Why**: Romanian cadastral text-file exports have a 3-column format — `<index> <X/Northing> <Y/Easting>` — and the importer (`parse-text`/`route.ts`, used by both "Add new property → from a text file/folder" and Administration → Import) previously discarded token 0 entirely. Adrian wants that original index captured and permanently bound to its corner's lat/lon, so that if the file's line order produces a self-intersecting ("bow-tie") polygon and he fixes it by reordering rows with the corners table's ↑/↓ arrows, the original index travels with its corner rather than staying pinned to a table position. The "#" column keeps showing the live sequence position (1, 2, 3, …); a new "Orig. #" column shows the bound original value, or "—" when there isn't one (manual entry, OCR-derived corners, or the legacy 2-column text format). Separately, Adrian wants the corners table's default display format to be Stereo 70 rather than decimal degrees, since that's the format he reads off the source documents.

**DB migration (`src/db/migration_027_property_corner_original_index.sql`)**
- `ALTER TABLE property_corner ADD COLUMN IF NOT EXISTS original_index integer;` — nullable, idempotent. No backfill; existing corners simply have `NULL` (renders as "—").

**Schema (`src/db/schema/index.ts`)**
- `propertyCorner` gained `originalIndex: integer("original_index")` (nullable), between `lon` and `createdAt`.

**Validation (`src/lib/properties/validation.ts`)**
- `cornerInputSchema` gained `originalIndex: z.number().int().nullish()`.

**Query layer (`src/lib/properties/queries.ts`)**
- `createProperty`'s and `updateProperty`'s corner-insert blocks now pass `originalIndex: c.originalIndex ?? null` through to the `propertyCorner` insert values, alongside the existing `lat`/`lon`/`sequenceNo`. Both `getPropertyById`'s and the post-update re-fetch's corner `SELECT`s already use a bare `.select()` against `propertyCorner` (no explicit column projection), so the new column surfaces automatically with zero further query changes.

**Parse-text route (`src/app/api/properties/parse-text/route.ts`)**
- `parseLine`'s 3-column branch now returns `{ northing, easting, originalIndex: idx }` (`idx` is `tokens[0]` parsed as a float, same `< 1_000` guard as before — only the discard-it behaviour changed). The 2-column fallback returns `originalIndex: null`. Corner order is unchanged — still strictly line order, never resorted by this value (per the existing GIS.13.11/15.12 documented behaviour, restated in the route's doc comment).
- Response shape: `{ corners: { lat: number; lon: number; originalIndex: number | null }[] }`.

**Client `Corner` type + every payload builder** — `originalIndex?: number | null` added to the shared type and threaded through unchanged shape everywhere a corners array crosses a client/server boundary:
- `src/app/properties/_components/form-schema.ts` — `Corner` type; `toApiPayload`'s `corners` mapping.
- `src/app/properties/_components/add-property-dialog.tsx` — local `Corner` interface; the text-file/folder import flow's `createProperty` payload mapping.
- `src/app/admin/import/_components/property-classify-panel.tsx` — local `Corner` type (the panel already forwarded the whole corners array as-is from `parse-text`'s response, so no further change needed there).
- `src/app/properties/[id]/page.tsx` — `initialCorners` mapping (server → client hydration on the edit/view page).

**`CornersManager` (`src/app/properties/_components/corners-manager.tsx`)**
- Default display format changed: `useState<DisplayFormat>("DD")` → `useState<DisplayFormat>("S70")`.
- New "Orig. #" column (`t("originalIndex")`) inserted between the "#" (sequence) column and the Latitude/North column, in both the header and every body row. Renders `c.originalIndex ?? "—"`.
- `CornerInputRow`'s add/edit `<tr>` gained a second placeholder `<td>—</td>` (it already rendered one for the "#" column with no live value while adding/editing) so its column count keeps matching the header's now-5-column (4 in read-only mode) layout.
- Empty-state row's `colSpan` updated from `readOnly ? 3 : 4` to `readOnly ? 4 : 5` to match the new column count.
- `handleEdit` fixed to preserve `originalIndex` across an edit: `CornerInputRow.onSave` only ever returns `{ lat, lon }` (the coordinate-input UI has no field for it), so a naive `corners.map((old, i) => i === idx ? c : old)` would silently drop the bound index on every edit. Now reads `{ ...c, originalIndex: old.originalIndex }` — the pre-edit corner's index survives a coordinate edit. `moveUp`/`moveDown` already swap whole `Corner` objects, so reordering was already correct with no changes needed there.

**i18n** — added `property.corners.originalIndex` to both `messages/en-GB.json` ("Orig. #") and `messages/ro-RO.json` ("Nr. orig.").

**Manual setup required (not yet run)**
1. Apply `src/db/migration_027_property_corner_original_index.sql` to local Docker via `docker cp` + `psql -f` (per the standing migration gotcha).
2. Apply the same migration to Supabase via the SQL Editor.
3. When next shipping a schema-update package to Ciprian, this migration becomes part of the auto-regenerated `ciprian-schema-update.sql` (Slice #15.15's process) the next time `build-ciprian-image.ps1` runs — no separate action needed there.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual: re-read every edited file in full after editing to confirm the `Corner`/payload shape change is additive and consistent end-to-end (schema → migration → validation → queries → parse-text route → every client call site → `CornersManager`), confirmed via Grep that `getPropertyById`'s and the update re-fetch's corner selects in `queries.ts` are bare `.select()` calls (no explicit column list) so the new column needs no further query change, and confirmed both message files remain valid JSON after the new key was added in the same position in each file. **Adrian should still run `npm run lint` and manually re-test** (import a text file with a deliberately bow-tie corner order, confirm the "Orig. #" values are correct in file order, reorder corners with ↑/↓, confirm the Orig. # values move with their rows; open an existing property and confirm the corners table now opens in Stereo 70 by default) before committing.

**Files touched**
- `src/db/migration_027_property_corner_original_index.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/properties/validation.ts`
- `src/lib/properties/queries.ts`
- `src/app/api/properties/parse-text/route.ts`
- `src/app/properties/_components/form-schema.ts`
- `src/app/properties/_components/add-property-dialog.tsx`
- `src/app/admin/import/_components/property-classify-panel.tsx`
- `src/app/properties/[id]/page.tsx`
- `src/app/properties/_components/corners-manager.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.16 — Ciprian UAT bug fixes (detail)

Three issues found by Adrian on his first real test of the Slice #15.15 package, all in the Ciprian UAT deployment path only — no changes to local dev, Vercel, or Supabase.

**Bug 1 — Admin Import → Document (JPEG) → "Internal server error"**

Root cause: `src/lib/storage/index.ts` branches purely on `NODE_ENV === "production"` to decide between local-filesystem storage and Supabase Storage. Ciprian's container runs with `NODE_ENV=production` (it's the same app image shipped to him) but has **no real Supabase project at all** — it runs with `UAT_NO_AUTH=true` and no Supabase credentials, by design (see Slice #7.0/#15.15 context). Uploading a page therefore hit the Supabase code path, which calls `createAdminClient()` (`src/lib/supabase/server.ts`), which throws synchronously when `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are unset — surfacing as a generic 500 "Internal server error" with no further detail in the UI.

Fix — a new `LOCAL_FILE_STORAGE` env var override, forcing the local-filesystem code path even when `NODE_ENV=production`:
- `src/lib/storage/index.ts`: `const useLocalStorage = process.env.LOCAL_FILE_STORAGE === "true"; const isProduction = process.env.NODE_ENV === "production" && !useLocalStorage;` — all three exported functions (`uploadFile`, `deleteFile`, `getFileUrl`) already branch on `isProduction`, so this one change reroutes all of them.
- `src/app/api/files/[...path]/route.ts` — this route independently hardcoded its own `NODE_ENV === "production"` guard (returns 404 in prod, since in real production files are served via signed Supabase URLs, not this route). Updated in lockstep with the same `useLocalStorage` flag, otherwise `getFileUrl`'s `/api/files/...` URLs would resolve but 404 when viewed.
- `C:\dev\ga40prj.Ciprian\docker\postgres\docker-compose.yml` — added `LOCAL_FILE_STORAGE: "true"` to the `app` service's `environment:` block, and a new named volume `app_uploads:/app/uploads` (plus the corresponding top-level `volumes:` entry) so uploaded files survive `update.bat`/container recreation — the Dockerfile has no `VOLUME` directive of its own, so without this the next image update would silently wipe every previously uploaded document page.
- `.env.example` — documented the new var (commented out, defaulting to unset — no behavior change for Vercel/Supabase deployments).

This fix is **baked into the application code**, so it requires Adrian to rebuild the Ciprian app image (`.\build-ciprian-image.ps1`) and re-send the resulting `ga40prj-app.tar` — a `docker-compose.yml`-only change is not sufficient on its own for this bug.

**Bug 2 — Vision-extraction "ANTHROPIC_API_KEY is not configured on the server", despite the key being present in `.env`**

Root cause: Docker Compose's `--env-file .env` flag (used by every `start.bat`/`stop.bat`/`update.bat` invocation) only makes `.env` variables available for `${VAR}` substitution *inside the compose YAML itself* — it does **not** automatically inject every `.env` variable into a service's container process environment. Only variables explicitly listed in that service's own `environment:` block become readable as `process.env.X` inside the container. `ANTHROPIC_API_KEY` was present in Ciprian's `.env` file the whole time (confirmed) but had never been added to the `app` service's `environment:` block in `docker-compose.yml`, so `extract-id-card/route.ts`'s `if (!apiKey)` guard correctly (if confusingly) reported it as missing — from the container's point of view, it was.

Fix: added `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}` to the `app` service's `environment:` block in `C:\dev\ga40prj.Ciprian\docker\postgres\docker-compose.yml`, right alongside the new `LOCAL_FILE_STORAGE` line above.

This fix is a **compose-file-only change** — no app-image rebuild needed. Recreating the `app` container (`docker compose ... up -d --force-recreate app`, or just running `update.bat`/`start.bat` again) is enough once the edited `docker-compose.yml` is in place on Ciprian's machine.

**Gap found while investigating (not part of Adrian's original report): missing `update.bat`**

`README-UAT.txt`'s "RECEIVING UPDATES FROM ADRIAN" section and `build-ciprian-image.ps1`'s own console output both reference double-clicking `update.bat` to apply a new app image — but the file did not exist anywhere in the Ciprian package. Created `C:\dev\ga40prj.Ciprian\update.bat`, mirroring `start.bat`/`stop.bat`'s exact invocation pattern (`-f docker\postgres\docker-compose.yml --env-file .env -p ga40prj-ciprian`): `docker load -i docker\app\ga40prj-app.tar` followed by `docker compose ... up -d --force-recreate app` (only the `app` service is recreated — Postgres/pgAdmin and their data are untouched). `README-UAT.txt`'s update section was also extended with the literal two `docker cp` / `docker exec psql` commands for applying an accompanying `ciprian-schema-update.sql`, when Adrian sends one (mirrors UC-C6 in `GA40.Operations.Guide.05.docx`), plus a one-line warning that doing so resets Ciprian's data to match dev's.

**What Adrian needs to do to ship both fixes**

```powershell
# Rebuild and re-export the Ciprian app image (needed for Bug 1's fix —
# storage/index.ts and the files route are baked into the image):
.\build-ciprian-image.ps1
```

Then send Ciprian the refreshed `ga40prj-app.tar` plus the **updated** `docker-compose.yml` and the new `update.bat` (both one-time file replacements in his `C:\...\ga40prj.Ciprian\` folder — not auto-regenerated by the build script, since it never touches the compose file). Ciprian then runs, in order: replace `docker\app\ga40prj-app.tar`, replace `docker\postgres\docker-compose.yml`, add `update.bat` to the folder root if missing, then double-click `update.bat`.

**Verification note**: per the standing project gotcha, the sandbox cannot run Docker or exercise Ciprian's actual container, so none of this was tested end-to-end. Verification here was a careful manual re-read of every edited file after editing: confirmed `storage/index.ts`'s three exported functions all reference the same `isProduction` const (no second hardcoded `NODE_ENV` check hiding elsewhere — grepped the file), confirmed `/api/files/[...path]/route.ts`'s guard now matches the same flag, confirmed the `docker-compose.yml` `environment:` block syntax (`KEY: ${VAR}` and `KEY: "true"` — YAML, not shell, so `${VAR}` is a Compose substitution from `--env-file`/the shell environment, while `"true"` is a literal string), and confirmed the new `app_uploads` volume is both declared top-level and mounted on the `app` service. **Adrian should test locally first** — point his own `.env`/compose setup at the same two new variables, run a Document JPEG import and an ID Card extraction against a local rebuild, before shipping the new image to Ciprian.

**Files touched**
- `src/lib/storage/index.ts`
- `src/app/api/files/[...path]/route.ts`
- `.env.example`
- `C:\dev\ga40prj.Ciprian\docker\postgres\docker-compose.yml`
- `C:\dev\ga40prj.Ciprian\update.bat` (new)
- `C:\dev\ga40prj.Ciprian\README-UAT.txt`
- `CLAUDE.md`

### Slice #15.09 — Sidebar nav cleanup + unified Persons list page (detail)

Pure frontend + one new read-only API route + query-layer addition — no DB schema or migration changes.

**Why**: Adrian wanted the sidebar trimmed down on two fronts — "People" no longer needs its Natural/Judicial accordion now that the same split can live as a filter on a single combined list page (mirroring how "Documents" already dropped its 19-item accordion in Slice #15.08 in favour of an in-page type-filter dropdown), and "Property" no longer needs an accordion at all since removing the disabled "Building" placeholder left only two real sub-items (List / Map) — not worth hiding behind a click. Also folded in two small standalone renames: "People" → "Persons" and "Property" → "Properties" in the sidebar labels.

**Sidebar config (`src/components/sidebar/nav-config.ts`)**
- `property`: dropped its accordion behaviour via a new `alwaysOpen?: boolean` flag on `NavSection` — sub-items (`landList`, `landMap`) always render, no chevron, no toggle. The disabled "Building" `NavItem` was deleted outright (it had no `href` and was permanently "coming soon").
- `people`: converted to a flat-link section — `items: []`, `href: "/persons"` — exactly the same shape `document` adopted in Slice #15.08. The old `naturalPerson`/`judicialPerson` `NavItem`s (and their now-unused `User`/`Building2` icon imports) were removed entirely; that split now lives in the "Person type:" dropdown on the `/persons` page itself.

**Sidebar component (`src/components/sidebar/sidebar-nav.tsx`)** — generalized rather than special-cased a second time
- The Slice #15.08 logic that hardcoded "document is the only flat-link section" (`isDocumentActive` boolean, a `section.key === "document"` ternary in the render loop) was refactored into a reusable, data-driven pattern so a second flat-link section didn't require parallel hardcoding:
  - `FLAT_SECTION_ACTIVE_PREFIXES: Record<string, string[]>` — `{ document: ["/documents"], people: ["/persons", "/natural-persons", "/judicial-persons"] }`. The `people` entry covers the legacy per-type detail routes too, since rows in the new unified list still link out to `/natural-persons/[id]` / `/judicial-persons/[id]`.
  - `isFlatSectionActive(key)` — checks the current pathname against that section's prefixes (exact match or `startsWith(prefix + "/")`).
  - In the render loop, `isFlatLinkSection` is now computed structurally per section (`filteredSection.items.length === 0 && !!filteredSection.href`) rather than checked by key name, so any future flat-link section needs only a `nav-config.ts` entry + a `FLAT_SECTION_ACTIVE_PREFIXES` row — no further `sidebar-nav.tsx` changes.
  - `NavSectionRow` (the accordion renderer) gained `alwaysOpen` handling: when set, the chevron is omitted, the header button is non-interactive (`cursor-default`, `disabled` in expanded mode — collapsed mode still expands the sidebar on click, same as any other section), and sub-items always render regardless of `openSection` state.
  - `itemLabels` map: removed the now-dead `naturalPerson` / `judicialPerson` entries.

**Unified Persons query (`src/lib/persons/queries.ts`, `validation.ts`)**
- `person` is the shared base table (`id`, `code`, `type: "NATURAL"|"JUDICIAL"`, `displayName`, `createdAt`, `updatedAt`, …); `naturalPerson`/`judicialPerson` are satellite tables (`personId` FK, cascade delete). The new `listAllPersons(opts)` is a single query against `person` with both satellite tables **left-joined** (not a UNION) — each row matches at most one satellite table depending on its `type`, so the joins never duplicate rows.
- Search (`q`) matches `person.displayName`/`code` plus every satellite contact field via `ilike` (`naturalPerson.personalEmail1/2`, `workEmail`, `personalPhone1/2`, `workPhone`; `judicialPerson.nickname`, `cuiNumber`).
- `types` filter mirrors the Documents `documentTypeIds` semantics exactly: `undefined` → no `IN` clause (show both); `[]` → short-circuits to `{ items: [], total: 0 }` before hitting the DB (avoids an `IN ()` SQL error); `[...]` → `inArray(person.type, opts.types)`.
- Ordering follows the Slice #16.UX.01 recency convention: `ORDER BY greatest(person.updated_at, person.created_at) DESC`.
- New `allPersonsListQuerySchema`/`AllPersonsListQuery` in `validation.ts` (`q`, `types: z.enum(["NATURAL","JUDICIAL"]).array().optional()`, `limit`, `offset`) — kept separate from the existing Natural-only `listQuerySchema`/`listPersons()`, which are both untouched and still back the legacy `/natural-persons` list page.

**New API route (`src/app/api/persons/route.ts`)**
- `GET /api/persons` — read-only; parses `?q=`, `?personTypes=NATURAL,JUDICIAL` (comma-separated, same absent/empty/populated semantics as the query layer), `?limit=`, `?offset=`. Returns `{ items, total, limit, offset }`. Creation still goes through the existing per-type endpoints (`/api/people`, `/api/judicial-persons`) — there is no unified create flow.

**New page + list-view (`src/app/persons/page.tsx`, `src/app/persons/list-view.tsx`)**
- `page.tsx` (Server Component) parses `?personTypes=` from `searchParams` into `initialPersonTypes: string[] | undefined` using the same three-way semantics as Documents, and renders `<PersonListView>` inside the standard list-page shell (title + `PersonListView`).
- `PersonListView` mirrors `src/app/documents/list-view.tsx`'s structure closely:
  - `PersonTypeFilterDropdown` — a select-all + two-checkbox dropdown (All / Natural Person / Judicial Person, in that order, per Adrian's explicit spec), click-outside-to-close, pushes `?personTypes=` via `router.push` on every toggle (`buildPersonsUrl` encodes the same undefined/empty/populated URL semantics used server-side).
  - Debounced search input (250 ms) with the i18n placeholder already prefixed "OR "/"SAU " per the earlier strings-only change in this same slice.
  - `noTypesSelected` gate: when `?personTypes=` is present-but-empty, the query is disabled (`enabled: false`) and a "select at least one person type" message renders instead of the table — matching the Documents precedent.
  - Header + per-row checkboxes for bulk selection, with `RecencyBadge` rendered next to each row's checkbox (Slice #16.UX.01 component, reused as-is — its `createdAt`/`updatedAt` prop shape already matched the new list's data with no changes needed).
  - Bulk delete reuses the existing **`POST /api/people/batch-delete`** endpoint unchanged — confirmed (by reading the route in full) that it already operates generically on `person.id`/`person.deletedAt`, with an explicit code comment stating it covers both Natural and Judicial, so no new delete endpoint was needed. On success, invalidates the `persons`, `people`, and `judicial-persons` query-cache keys together, so the legacy per-type lists don't show stale rows if visited next.
  - `detailHref(item)` routes each row's "Open" link (and row double-click) to `/judicial-persons/{id}` or `/natural-persons/{id}` depending on `item.type` — the core requirement that lets one table serve both record kinds without a unified detail page.
  - **Toolbar "Add new" treatment**: two separate buttons — "Add new Natural Person" → `/natural-persons/new` and "Add new Judicial Person" → `/judicial-persons/new` — rather than a single dropdown/split-button. **Confirmed by Adrian**: keep both buttons, both styled identically with the brown `bg-cta`/`hover:bg-cta-d` treatment (the app's standard primary-button color). The Judicial button originally rendered with a secondary/outline style; fixed to match the Natural button's classes exactly.

**i18n** — new `person.*` namespace in both `messages/en-GB.json` and `messages/ro-RO.json` (`listTitle`, `searchPlaceholder` — already carrying the "OR "/"SAU " prefix, `open`, `loading`, `error`, `empty`, `counts`, `typeFilterLabel`, `allTypes`, `noTypeSelected`, `typeNatural`, `typeJudicial`, `addNewNatural`, `addNewJudicial`, `table.{code,name,type}`); `nav.sections.people` relabelled "People" → "Persons", `nav.sections.property` relabelled "Property" → "Properties" (both message files).

**Tests (`src/__tests__/sidebar-nav.test.ts`)** — the existing `MOCK_SECTIONS` fixture still modeled `people` as an accordion with Natural/Judicial items and still had `property.items` including the already-removed "Building" entry; both were stale relative to the real `nav-config.ts`. Fixed: `people` → `{ key: "people", items: [] }`; `property.items` → just `landList`/`landMap`. The two tests that previously asserted `getActiveHref`/`getActiveSectionKey` resolved `/natural-persons` to the `people` section now assert `toBeNull()` instead — correct, since those pure helpers only ever resolve sections with actual `items`, and a flat-link section's active state is computed separately in `sidebar-nav.tsx` via `isFlatSectionActive` (not covered by, and not meant to be covered by, these helpers).

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase (phantom errors / no SWC binary access). Verification here was done by manually cross-referencing every schema column, FK name, and enum value used in the new query/UI code against `src/db/schema/index.ts`, by reading `/api/documents/route.ts` and `/api/people/batch-delete/route.ts` in full as side-by-side precedent/reuse checks, and by a repo-wide grep sweep confirming zero stray references remain to the removed `User`/`Building2` sidebar icons or the deleted "Building" nav item. **Adrian should still run `npm run lint` and `npx jest` on his own machine before committing** — that remains the only reliable check for `react-hooks/set-state-in-effect`-class issues and real test regressions in this codebase.

**Resolved follow-ups**
- The now sidebar-orphaned `/natural-persons` and `/judicial-persons` **list** pages — **Adrian's decision: delete them outright** (their detail/`new` sub-pages remain in active use, linked from `/persons`, and were untouched). See "Slice #15.09.1 — Delete orphaned list pages" below for the full change.
- The two-button "Add new" toolbar treatment — **Adrian's decision: keep both buttons**, both styled with the brown `bg-cta` treatment (see fix above).

**Files touched**
- `src/components/sidebar/nav-config.ts`
- `src/components/sidebar/sidebar-nav.tsx`
- `src/lib/persons/queries.ts`
- `src/lib/persons/validation.ts`
- `src/app/api/persons/route.ts` (new)
- `src/app/persons/page.tsx` (new)
- `src/app/persons/list-view.tsx` (new)
- `src/__tests__/sidebar-nav.test.ts`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.09.1 — Delete orphaned `/natural-persons` and `/judicial-persons` list pages (detail)

Pure frontend cleanup, follow-up to #15.09. No DB, API, or i18n changes.

**Why**: with `/persons` now the single entry point for browsing both person types, the old standalone list pages at the bare `/natural-persons` and `/judicial-persons` routes had no remaining sidebar link and were never opened from anywhere in the app except by the two route's own `page.tsx`. Adrian confirmed (after a clarifying round-trip — this is unrelated to the `/persons` type-filter checkboxes, which behave exactly as he expected) that these should be deleted rather than redirected or left reachable by direct URL.

**What was deleted** (zero remaining importers, confirmed via repo-wide grep before deletion):
- `src/app/natural-persons/page.tsx`
- `src/app/natural-persons/list-view.tsx`
- `src/app/judicial-persons/page.tsx`
- `src/app/judicial-persons/list-view.tsx`

The sibling detail/create routes — `src/app/natural-persons/[id]/`, `src/app/natural-persons/new/`, `src/app/judicial-persons/[id]/`, `src/app/judicial-persons/new/` — are untouched and remain the live destinations linked from `/persons`.

**Required follow-on fix (would otherwise have 404'd)**: `natural-person-form.tsx` and `judicial-person-form.tsx` each called `router.push("/natural-persons")` / `router.push("/judicial-persons")` after a successful Save, Delete, or Cancel — three call sites per file. With the bare list route gone, all six were changed to `router.push("/persons")` instead, so Save/Delete/Cancel now land on the live unified list. (`backBase` props used elsewhere, e.g. in the associate-person/-property/-document flows and the detail tabs, were checked too — every other use always appends `/${personId}` or `/${personId}/associate-...`, resolving to the still-live detail routes, so none of those needed changing.)

**Cleanup**: a stale code comment in `src/app/persons/list-view.tsx` that referenced the now-deleted `natural-persons/list-view.tsx` / `judicial-persons/list-view.tsx` file paths by name was reworded to drop the dead reference.

**Not changed**: `messages/en-GB.json` / `messages/ro-RO.json` — the `naturalPerson.*` / `judicialPerson.*` i18n namespaces are shared with the still-live forms, so no keys were removed (a few list-only keys, e.g. table column labels, are now technically unused but harmless to leave in place rather than risk pulling a key the forms still use).

**Files touched**
- `src/app/natural-persons/page.tsx` (deleted)
- `src/app/natural-persons/list-view.tsx` (deleted)
- `src/app/judicial-persons/page.tsx` (deleted)
- `src/app/judicial-persons/list-view.tsx` (deleted)
- `src/app/natural-persons/_components/natural-person-form.tsx`
- `src/app/judicial-persons/_components/judicial-person-form.tsx`
- `src/app/persons/list-view.tsx`
- `src/app/persons/list-view.tsx` (Judicial "Add new" button color fix — `bg-cta` to match Natural)
- `CLAUDE.md`

### Slice #15.10 — Property "Add new" form: no row until there's data (detail)

Pure frontend, single component pair — no DB, API, or i18n changes.

**Bug report (Adrian)**: clicking "Add new property" opens an empty form correctly, but trying to navigate away immediately afterward (e.g. clicking "Persons" in the sidebar) pops the unsaved-changes Save/Discard/Cancel dialog without the user having touched anything. Clicking that dialog's "Save" button persists a fully-empty `property` row. Adrian's stated requirement: **a property should be created only if it has at least one field of data or one corner.**

**Root cause — two compounding bugs, both in the create flow only**

1. `PropertyForm`'s `initialCorners = []` default parameter is a new array reference on every render (the create page, `new-property-shell.tsx`, never passes an `initialCorners` prop). React Hook Form's initial async validation pass (computing `formState.isValid` via the Zod resolver) causes one extra re-render right after mount even with zero user input. On that re-render, `corners !== initialCorners` — comparing the `useState` snapshot against a *freshly allocated* empty array — spuriously evaluates to `true`. The unsaved-changes guard's `isDirty: form.formState.isDirty || corners !== initialCorners` therefore reports a completely untouched create form as dirty.
2. `formSchema` (Zod, in `form-schema.ts`) has no required fields — every field is a plain optional string — so a fully blank form is `isValid: true`. `saveDisabled` for create mode was only `submitting || !isValid`, so nothing blocked an empty-form Save. Combined with bug 1's spurious dirty flag triggering the guard dialog, clicking that dialog's "Save" (a natural reaction to seeing an unsaved-changes prompt) silently created an all-null `property` row.

**Fix — scoped to the frontend only.** Adrian confirmed no server-side backstop is needed at this point (no DB/API/validation-layer changes).

**`form-schema.ts`** — new exported helper:
```ts
const TOP_LEVEL_TEXT_FIELDS = [
  "nickname", "tarlaSola", "parcela", "cadastralNumber",
  "carteFunciara", "useCategory", "surfaceAreaMp", "notes",
] as const satisfies readonly (keyof Omit<FormValues, "address">)[];

const ADDRESS_TEXT_FIELDS = [
  "streetLine", "postalCode", "locality", "county", "country", "notes",
] as const satisfies readonly (keyof AddressBlock)[];

export function hasFormData(values: FormValues, corners: Corner[]): boolean {
  if (corners.length > 0) return true;
  if (TOP_LEVEL_TEXT_FIELDS.some((key) => blank(values[key]) !== null)) return true;
  return ADDRESS_TEXT_FIELDS.some((key) => blank(values.address[key]) !== null);
}
```
Reuses the existing `blank()` helper (trims and treats `""` as unset) — true if any top-level field, any address field, or at least one corner is present.

**`property-form.tsx`**
- `createHasData = mode === "create" && hasFormData(form.getValues(), corners)` computed once per render (the component already re-renders on every keystroke via the `formState` subscription, so `getValues()` is fresh at read time — no extra subscription needed).
- `saveDisabled` gained `(mode === "create" && !createHasData)` — the Save button itself cannot submit a fully-blank create form, independent of the guard dialog.
- `useUnsavedChangesGuard({ isDirty: ... })` now branches three ways instead of the old single `mode !== "view" && (...)` expression: `view` → always `false`; `create` → `createHasData`; `edit` → the original, unchanged `form.formState.isDirty || corners !== initialCorners` reference check (edit mode's corners genuinely start as a stable loaded-record array, so the reference comparison there was never the bug — out of scope for this fix per Adrian's report, which was specific to the create flow).

**Net effect**: opening "Add new property" and immediately navigating away (sidebar, Cancel, browser back) no longer shows the unsaved-changes dialog and creates no DB row. Typing into any field, picking a use-category, or placing one corner correctly flips the form dirty and enables Save, exactly as before for non-empty input.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual: re-read both edited files in full after editing to confirm `hasFormData`'s field list matches `FormValues`/`AddressBlock` exactly (cross-checked against the Zod schema and `toApiPayload`'s own field list), and confirmed `createHasData`/`saveDisabled`/the guard's `isDirty` branch all reference the same single `createHasData` value so there's no drift between what blocks the Save button and what trips the nav guard. **Adrian should still run `npm run lint` and manually re-test the repro (open Add new property → click a sidebar link with zero input) before committing.**

**Files touched**
- `src/app/properties/_components/form-schema.ts`
- `src/app/properties/_components/property-form.tsx`
- `CLAUDE.md`

### Slice #15.11 — Reference Data Person panel: caption rename + button reorder (detail)

Pure i18n string + JSX-order change — no DB, API, schema, or query-layer changes.

**Why**: with "Judicial Person Types" now living alongside "Person Types" in the Reference Data → Person panel (added in Slice #15.07), Adrian wanted the existing "Person Types" caption disambiguated to make clear it covers physical/natural persons only, and wanted the Judicial Person Types button moved up to sit immediately next to it rather than after Person Roles/Citizenship.

**i18n** — `valueList.lists.personTypes` changed in both message files:
- `messages/en-GB.json`: `"Person Types"` → `"Physical Person Types"`.
- `messages/ro-RO.json`: `"Tipuri de Persoană"` → `"Tipuri de Persoană Fizică"`.

No other `valueList.lists.*` keys touched — `judicialPersonTypes` keeps its existing caption ("Judicial Person Types" / "Tipuri de Persoană Juridică") in both files.

**UI (`src/app/admin/value-lists/_components/value-list-hub.tsx`)** — the four `<ListBtn>`s in the Persoană `<Section>` reordered. Old order: Person Types, Person Roles, Citizenships, Judicial Person Types. New order: Person Types, Judicial Person Types, Person Roles, Citizenships. No `ListKey` values, click handlers, or component structure changed — purely a render-order swap of existing JSX lines.

**Files touched**
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `CLAUDE.md`

### Slice #15.14 — Document Pages viewer: wheel-zoom + drag-pan (detail)

Pure frontend, scoped entirely to one component — no DB, API, migration, or i18n changes.

**Why**: Follow-up to Slice #15.13. Once the page viewer could be shown large (the "Show Big Page" right-hand column), Adrian wanted to be able to zoom in/out on the displayed page with the mouse wheel and, once zoomed past the box's bounds, click-and-drag to pan around — the standard image-viewer interaction model (Figma/Google-Photos-style), not standard page scrolling.

**Scope decision**: zoom/pan only applies in `fill === true` ("Show Big Page") mode — the small inline viewer keeps its original fixed-size, non-interactive behaviour, since Adrian's request was specific to the big-page case. Within big-page mode, zoom/pan is further restricted to the two content kinds where it's actually meaningful: images and PDFs. The loading/error/placeholder states and the generic Word/Excel/text "download prompt" fallback are left exactly as before — nothing useful to zoom there.

**`src/app/documents/_components/pages-panel.tsx`** — all changes confined to `PagesViewerBox`:
- New module constants `MIN_SCALE = 1`, `MAX_SCALE = 4`, and `IDENTITY_TRANSFORM = { scale: 1, tx: 0, ty: 0 }`.
- `transform: { scale, tx, ty }` state holds the current zoom level and pan offset. Reset to `IDENTITY_TRANSFORM` whenever a different page is displayed, via the same "adjust state during render when a prop changes" pattern already established in this codebase (Admin Import's `resolvedFor`/`activeName` preview-reset precedent, Slice #15.01/15.02) — a `pageKey` derived from `selectedPageId` + the loaded `viewData.url` is compared against a `resolvedFor` state value; on mismatch, both are updated synchronously during render. This is deliberate: a `useEffect` doing the same reset would call `setState` synchronously at the top of its body, tripping `react-hooks/set-state-in-effect`.
- `handleWheel` — cursor-anchored zoom: converts the mouse position to a point in the content's local (unscaled) coordinate space using the *current* transform, computes the new scale (`Math.exp(-deltaY * 0.0015)` per wheel tick, clamped to `[MIN_SCALE, MAX_SCALE]`), then solves for the `tx`/`ty` that keep that same local point under the cursor at the new scale — the standard "zoom toward cursor" formula. Snaps back to `IDENTITY_TRANSFORM` exactly at `MIN_SCALE` so zooming back out fully re-centers the page rather than leaving a residual pan offset.
- `handleMouseDown` / a `window`-level `mousemove`/`mouseup` pair (registered only while `isDragging` is true, via `useEffect`) — click-and-drag panning, active only once `transform.scale > MIN_SCALE`. Listening on `window` rather than the local element means the drag continues smoothly even if the cursor briefly leaves the viewer's bounds mid-drag. Both `setTransform` calls inside this effect run inside the `mousemove`/`mouseup` event-listener callbacks, never synchronously in the effect body, so this doesn't trip the same lint rule either.
- **Transparent capture overlay** (`<div className="absolute inset-0" onWheel=... onMouseDown=... onDoubleClick=...>`), rendered only when `zoomable` (computed from `fill` + content kind) is true. This was necessary because of a PDF-specific gotcha: the page's PDF preview renders via an `<iframe>`, which hosts a completely separate browsing context with its own document — mouse and wheel events that occur over the iframe's rendered content never bubble out to the parent page's event handlers at all. Without this overlay, zoom/pan would work perfectly over an image but silently stop responding the moment the cursor crossed onto a PDF. The overlay sits on top of both content kinds uniformly, so the same zoom/pan model now applies consistently regardless of file type — the trade-off (communicated to Adrian as the one real limitation of this approach) is that the PDF's own native in-frame scrolling/selection is no longer reachable while in big-page mode, superseded by the custom zoom/pan. Double-clicking the overlay resets to fit-to-box (`IDENTITY_TRANSFORM`) — a small bonus affordance, not explicitly requested, added because there was otherwise no way back to 100% short of scrolling the wheel back out by feel.
- The viewer's outer box gained `relative` (anchor for the overlay's `absolute inset-0`) and a cursor affordance class — `cursor-zoom-in` at `scale === MIN_SCALE`, `cursor-grab`/`cursor-grabbing` (while actively dragging) once zoomed in.
- The actual `<PageViewer>` output (image or iframe) is wrapped in a plain `<div style={{ transform: "translate(...) scale(...)", transformOrigin: "0 0" }}>` — CSS transforms only, no new layout system. `transformOrigin: "0 0"` was required to make the cursor-anchoring math line up: the formula assumes the content's local coordinate space starts at the same top-left corner as the viewer box, which only holds with a top-left transform origin (the CSS default of `50% 50%` would have anchored zoom on the box's center regardless of cursor position).

**No other files touched.** `PagesViewerBox`'s exported signature (`{ state, fill }`) is unchanged, so `document-form.tsx`'s one call site (`<PagesViewerBox state={pagesState} fill />`) needed no edits — confirmed via grep that it's still the only consumer.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual: re-read the full rewritten `PagesViewerBox` function top to bottom to confirm JSX/brace balance, confirmed `useCallback`/`useEffect`/`useRef`/`useState` were already imported at the top of the file (no new imports needed), confirmed the cursor-anchored zoom formula algebraically (treating the CSS `translate(tx,ty) scale(s)` order, which composes as `screenPoint = (tx + s·lx, ty + s·ly)` for a local point `(lx,ly)` — matches the implementation), and confirmed `document-form.tsx`'s call site still matches the unchanged prop signature. **Adrian should still run `npm run lint` and manually re-test (open a saved document with an image and one with a PDF page → Show Big Page → scroll wheel to zoom in/out over each → drag to pan once zoomed → double-click to reset) before committing.**

**Files touched**
- `src/app/documents/_components/pages-panel.tsx`
- `CLAUDE.md`

### Slice #15.15 — Ops: fixed-name, fully-regenerated Ciprian schema-update file (detail)

Process/tooling change, not an app feature. No DB, API, UI, or i18n changes to the GA40 app itself.

**Why**: UC-C6 in the Operations Guide told Adrian to "identify the new migration file(s) in `C:\dev\ga40prj\drizzle\`" — a folder that doesn't exist in this project (migrations are hand-numbered `src/db/migration_NNN_*.sql` files, found by manually scanning for the highest number). Adrian found this error-prone and asked for: one fixed-name file, sent to Ciprian every time, that always brings his DB fully up to dev's current level — with no preservation of Ciprian's existing data required at this stage (operational or reference), and updated automatically whenever dev's schema changes, not manually.

**Design**: `build-ciprian-image.ps1` gained a new Step 5 that assembles `C:\dev\ga40prj.Ciprian\ciprian-schema-update.sql` on every run, from four pieces, all pulled live from `ga40prj-postgres` at build time — no hand-maintained file involved anywhere in this path:
1. `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` — full wipe.
2. Ciprian's own `01-extensions.sql` content (PostGIS/topology), read from his init folder.
3. A fresh `pg_dump --schema-only` (the same dump already produced for `02-schema.sql`, including the existing `CREATE SCHEMA topology` → `IF NOT EXISTS` safety net).
4. A fresh `pg_dump --data-only -t 'lookup_*'` of every lookup table — deliberately *not* `src/db/sync-reference-data.sql`, because that file (and the `npm run export:reference-data` script meant to regenerate it) had already been found stale/broken once (missing `lookup_judicial_person_type` in Ciprian's copy; the export script doesn't exist in `scripts/`). Reading live from Postgres instead removes that entire failure mode — there's no file to forget to update.

**Trade-off, confirmed acceptable by Adrian**: applying `ciprian-schema-update.sql` wipes Ciprian's *entire* database — operational records and reference-data edits alike — every single time, even for changes that don't touch the schema. This replaces UC-C8 (full reset) in the common case; UC-C8 remains useful standalone only when no new app version is being delivered.

**Ciprian's procedure becomes invariant** — same two PowerShell commands, same filenames, every time, no placeholders:
```powershell
docker cp ciprian-schema-update.sql ciprian-ga40prj-postgres:/tmp/ciprian-schema-update.sql
docker exec ciprian-ga40prj-postgres psql -U postgres -d ga40db -v ON_ERROR_STOP=1 -f /tmp/ciprian-schema-update.sql 2>&1 | Tee-Object -FilePath schema-update.log
```

**Bug found on first real run, fixed same slice**: Adrian ran the script and hit `ParserError: UnexpectedToken` at line 240 — Windows PowerShell 5.1 garbled the Unicode box-drawing characters (`─`, U+2500) used as decorative section-separator dashes inside the Step 5 SQL-header strings (`$header` here-string + the `$combined` concatenation), because the `.ps1` file is plain UTF-8 without a BOM and PowerShell 5.1 (unlike PowerShell 7+) parses script source using the system codepage when no BOM is present — multi-byte UTF-8 sequences land as mojibake and break tokenization. Fixed by replacing all four `── N. ─────` separator lines with plain ASCII (`---- N. ... ----`), matching the rest of the file's existing pure-ASCII comment-banner style. Confirmed via grep that no non-ASCII byte remains anywhere in `build-ciprian-image.ps1`.

**Standing gotcha this adds** (see Gotchas section below): never embed non-ASCII decorative characters (box-drawing, smart quotes, em-dashes, etc.) in `.ps1` files — Adrian's Windows PowerShell 5.1 only parses them reliably with a UTF-8 BOM, which this script's write path does not add. Stick to plain ASCII in all PowerShell source going forward.

**Second bug found on the next real run, fixed same slice**: after the ASCII fix above, Adrian re-ran the script and it progressed much further (full Docker build, image export, schema `pg_dump` + `docker cp` all succeeded) before crashing with `DirectoryNotFoundException` from `[System.IO.File]::ReadAllText($schemaDest)`: `Could not find a part of the path 'C:\Windows\ga40prj.Ciprian\docker\postgres\init\02-schema.sql'`. Root cause: `$ciprianRoot` was set via a relative path (`"..\ga40prj.Ciprian"`). PowerShell-native cmdlets and external-process calls (e.g. the `docker cp` that had just succeeded, writing to the correct `C:\dev\ga40prj.Ciprian\...`) resolve relative paths against PowerShell's own session location (`$PWD`, correctly `C:\dev\ga40prj\`). Raw `[System.IO.File]::ReadAllText`/`WriteAllText` static calls instead resolve relative paths against the separate, process-wide `[Environment]::CurrentDirectory` — which on Adrian's machine had drifted to `C:\Windows\` (a known PowerShell/.NET divergence that `Set-Location`/`cd` does not always keep in sync, more common on Windows PowerShell 5.1). The same risk existed for the temp reference-data dump file, referenced via a bare relative literal (`.\ga40prj-refdata-dump.sql`) in three places. Fixed by resolving `$ciprianRoot` to an absolute path immediately after its existence check (`$ciprianRoot = [System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\ga40prj.Ciprian"))`, with `$repoRoot = $PSScriptRoot`), and by anchoring the refdata temp file to the same absolute `$repoRoot` (`$refDataDumpLocal = Join-Path $repoRoot "ga40prj-refdata-dump.sql"`) instead of a bare relative literal. Every path derived from `$ciprianRoot` (`$outputDir`, `$outputTar`, `$schemaDest`, `$extensionsSrc`, `$updateFileDest`) is now absolute, so every downstream `[System.IO.File]` call is immune to `Environment.CurrentDirectory` drift regardless of how the script is launched.

**Standing gotcha this adds** (see Gotchas section below): in any `.ps1` script that mixes native/external commands (`docker cp`, etc.) with raw `[System.IO.File]::ReadAllText`/`WriteAllText` calls, never pass those .NET calls a relative path — resolve every path to absolute (via `$PSScriptRoot` + `[System.IO.Path]::GetFullPath`/`Resolve-Path`) first. PowerShell cmdlets and external processes resolve relative paths against `$PWD`; raw .NET file APIs resolve them against `[Environment]::CurrentDirectory`, which can silently diverge from `$PWD` (confirmed on Adrian's machine — it had drifted to `C:\Windows\`).

**Verification note**: no access to Adrian's machine/Docker from this environment, so the corrected version still could not be run end-to-end here. Re-verified by careful read-through after both fixes: PowerShell here-string/quoting balance, that `pg_dump -t 'lookup_*'` is passed as a single literal argument (not shell-expanded, since `docker exec` here invokes `pg_dump` directly rather than through a shell), that the wipe-then-recreate ordering (extensions → schema → data) matches existing dependency requirements (PostGIS before app tables before lookup-table data), a full non-ASCII-byte grep returning zero matches, and a grep confirming every remaining `[System.IO.File]::` call now reads from a variable ultimately derived from the absolute `$ciprianRoot`/`$repoRoot`, with no bare relative-path literals left anywhere in the file. **Adrian should run `.\build-ciprian-image.ps1` again and confirm it completes end-to-end and the generated `ciprian-schema-update.sql` looks right before sending it to Ciprian** — Step 5's assembly logic has still never been exercised live, since this is the first run to get past Step 4.

**Files touched**
- `build-ciprian-image.ps1`
- `CLAUDE.md`
- `C:\dev.docs\ga40prj\02.Operations.Guides\GA40.Operations.Guide.05.docx` (new; supersedes `...04.docx`)

### Slice #15.13 — Document form: "Show Big Page" toggle (detail)

Pure frontend — no DB schema, API, or migration changes. Two new i18n keys.

**Why**: Adrian wanted the Document form's Pages panel to support a "Show Big Page" toggle, mirroring Property's existing "Show Big Map" (Slice #GIS.13.08) exactly: a button that switches the page into a two-column layout, with the document/page viewer detached into a tall right-hand column beside the form and other panels. Two clarifying questions were resolved before implementation: big-page height matches the left column's height exactly (not pinned to full viewport height — an explicit, deliberate simplification Adrian approved), and there is no new resizable drag handle — the left column keeps a fixed width and Adrian resizes the browser window if more space is needed, exactly as "Show Big Map" already works.

**Root architectural difference from Property, and how it was resolved**: Property's `CornersManager` (table) and `PropertyMiniMap` (map) were already two separate sibling components, with `corners` state owned by the parent `PropertyForm` — switching to a two-column layout was just a matter of relocating where each sibling rendered. The Document Pages panel was not built this way: `PagesPanel` was a single monolithic component owning all of its own state (selected page, viewer data, loading/error, dialogs) with the viewer and table rendered inline as one unit. To mirror Property's mechanism, `pages-panel.tsx` was refactored first: every piece of state and logic was extracted into a new exported hook, `usePagesPanelState(documentId)`, returning a single state object. A new exported component, `PagesViewerBox({ state, fill })`, renders just the viewer (loading/error/placeholder/file preview), reading from that shared state object. `PagesPanel` itself was kept as the table + controls + dialogs, now accepting the shared `state` as a prop instead of owning it. `DocumentForm` (the parent, equivalent to `PropertyForm`) now calls `usePagesPanelState` once and passes the same object to both `PagesPanel` (left column, always rendered) and a standalone `PagesViewerBox` (right column, only rendered in big-page mode) — exactly the same lifted-state pattern `PropertyForm` already uses for `corners`. Confirmed via repo-wide grep that `PagesPanel` was the only export from `pages-panel.tsx` referenced anywhere, and only from `document-form.tsx`, so this refactor required updating exactly one call site.

**`src/app/documents/_components/pages-panel.tsx`** (rewritten)
- `usePagesPanelState(documentId: string | undefined)` — new exported hook holding `pages` (TanStack Query), `selectedPageId`, `viewData`/`viewLoading`/`viewError`, `loadView`, prev/next navigation (`currentIndex`/`canGoPrev`/`canGoNext`/`goToPage`), `handlePrint`, the delete `useMutation`, dialog state, and `nextPageNumber`. The pre-existing auto-display-first-page effect (which schedules its `setState` inside a `Promise.resolve().then(...)` microtask rather than synchronously in the effect body, to satisfy `react-hooks/set-state-in-effect` — see Slice #15.02's identical fix) was carried over unchanged into the hook body.
- `PagesViewerBox({ state, fill })` — new exported component; the viewer-only box (loading/error/placeholder/`PageViewer`). `fill` (default `false`) switches its sizing classes between `h-full w-full` (big-page mode, fills its parent's concrete-pixel bounding box) and `min-h-[320px] flex-1` (normal mode).
- `PagesPanel({ documentId, mode, state, bigPage, onToggleBigPage })` — `state` is now a required prop (the object returned by `usePagesPanelState`) instead of being computed internally. New optional `bigPage`/`onToggleBigPage` props: when `onToggleBigPage` is provided, a header button renders showing `t("showBigPage")` / `t("showSmallPage")` depending on `bigPage`. Body layout branches: `!bigPage` renders the original combined layout (`PagesViewerBox` + table, `lg:flex-row`); `bigPage` renders the table/controls only, full width — the caller is responsible for rendering `PagesViewerBox` separately.
- `PageViewer`, `DownloadPrompt`, `Centred` — all gained a `fill` prop threaded through from `PagesViewerBox`, switching between fixed (`max-h-[600px]`, `h-[600px]`, `min-h-[320px]`) and fill (`max-h-full`, `h-full`, `h-full`) sizing classes for images, PDFs, and the generic download-prompt fallback respectively.

**`src/app/documents/_components/document-form.tsx`**
- New prop `onBigPageChange?: (bigPage: boolean) => void`, called whenever the toggle fires — lets the parent (`DocumentDetailTabs`) widen the page's outer container, mirroring `PropertyForm`'s `onBigMapChange`.
- `pagesState = usePagesPanelState(documentId)` and `bigPage` state are now owned here (lifted up, exactly like `PropertyForm` owns `corners`). `handleToggleBigPage` flips `bigPage` and calls `onBigPageChange`.
- JSX restructured with two new wrapper `<div>`s using the same `"contents"` CSS trick already established for Property's big-map mode: an outer wrapper (`bigPage ? "flex flex-row gap-4 items-stretch" : "contents"`) and an inner left-column wrapper (`bigPage ? "w-[540px] flex-none flex flex-col gap-4" : "contents"`) — both no-ops in normal mode, so the original single-column flow is byte-for-byte unchanged when `bigPage` is `false`. The left column contains the existing `<form>`, the conditional `SuccessionPartiesPanel`, and `PagesPanel` (now passed `state={pagesState}`, `bigPage`, `onToggleBigPage={handleToggleBigPage}`). A new right-column `<div>` — `relative flex-1 min-w-0 overflow-hidden` wrapping an `absolute inset-3` box (Property's mini-map "concrete pixel bounding box" trick, generalized to plain CSS) — renders `<PagesViewerBox state={pagesState} fill />`, only when `bigPage` is true. Action buttons (Save/Delete/Cancel) and the delete-confirm dialog remain outside both wrappers, at the very bottom, full width regardless of mode.

**`src/app/documents/_components/document-detail-tabs.tsx`**
- New `bigPage` state (`useState(false)`), passed to `DocumentForm` as `onBigPageChange={setBigPage}`.
- Root element's className now switches between `"max-w-4xl mx-auto w-full flex flex-col gap-4"` (normal) and `"w-full flex flex-col gap-4"` (big-page) — the same pattern `PropertyDetailTabs` already uses for its own `bigMap` state.

**`src/app/documents/[id]/page.tsx`**
- `<main>` className changed from `"mx-auto w-full max-w-4xl px-6 py-4 flex flex-col gap-4"` to `"w-full px-6 py-4 flex flex-col gap-4"` — removes the page-level width cap so `DocumentDetailTabs`' own internal width-switching takes full effect, exactly matching how `properties/[id]/page.tsx` already delegates width control to `PropertyDetailTabs`.

**i18n** — added `document.pages.showBigPage` / `document.pages.showSmallPage` to both `messages/en-GB.json` ("Show Big Page" / "Show Small Page") and `messages/ro-RO.json` ("Arată Pagina Mare" / "Arată Pagina Mică"). No other keys changed — every other string `pages-panel.tsx` reads (`sectionTitle`, `addPage`, `colNum`/`colName`/`colNotes`/`colActions`, `view`/`print`/`delete`, `viewer.*`, `dialog.*`, `deleteConfirm.*`, `prevPage`/`nextPage`/`pageIndicator`, `empty`, `loadError`, `deleteError`) already existed and were preserved as-is.

**Verification note**: per the standing project gotcha, the sandbox's `tsc --noEmit`/`jest` are not reliable for this codebase. Verification here was manual: re-read all four touched files in full after editing to confirm JSX div nesting balances (outer flex-col → two-col wrapper → left-column wrapper → form/panels closing exactly before the two-col wrapper closes → right-column big-viewer div self-contained between them), confirmed `PagesPanel`/`PagesViewerBox`/`usePagesPanelState`'s prop and return types line up across `pages-panel.tsx` and `document-form.tsx`, confirmed via repo-wide grep that no other file imports from `pages-panel.tsx` (so the prop-signature change needed no other call-site updates), confirmed both message files are still valid JSON, and confirmed the two new i18n keys exist under `document.pages` in both files. **Adrian should still run `npm run lint` and manually re-test the toggle (open a saved document → Show Big Page → resize browser → Show Small Page) before committing.**

**Files touched**
- `src/app/documents/_components/pages-panel.tsx`
- `src/app/documents/_components/document-form.tsx`
- `src/app/documents/_components/document-detail-tabs.tsx`
- `src/app/documents/[id]/page.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.12 — Reference Data: new "Roles" panel (detail)

Pure i18n string + JSX-structure change — no DB, API, schema, or query-layer changes.

**Why**: with three separate "person ↔ X" role-management buttons scattered across the Property, Person, and Document sections (Property Persons, Person Roles, Document Persons), Adrian wanted them consolidated into their own dedicated panel — positioned between Document and Others — so all role-related lists live in one place.

**i18n** — `valueList.sections.roles` added to both message files, inserted between `document` and `others`: `"Roles"` (en-GB) / `"Roluri"` (ro-RO). No `lists.*` keys changed — `personRoles`, `propertyPersons`, `documentPersons` keep their existing captions, only their section placement moved.

**UI (`src/app/admin/value-lists/_components/value-list-hub.tsx`)**
- New `<Section label={t("sections.roles")}>` inserted between the Document section and the Others section.
- `<ListBtn>` for `lists.personRoles` (opens `"person-roles"` via the generic `ValueListModal`) removed from the Persoană section and re-rendered first in the new Roles section.
- `<ListBtn>` for `lists.propertyPersons` (opens `PropertyPersonsModal` via `setShowPropertyPersons(true)`) removed from the Proprietate section and re-rendered second in the new Roles section.
- `<ListBtn>` for `lists.documentPersons` (opens `DocumentPersonsModal` via `setShowDocPersons(true)`) removed from the Document section and re-rendered third in the new Roles section.
- No `ListKey` values, state hooks, or modal components changed — purely a relocation of three existing `<ListBtn>` lines into a new `<Section>` wrapper, in the order Adrian specified (Person Roles first).

**Resulting section order**: Proprietate (Property Types, Tarla, Use Categories) → Persoană (Person Types, Judicial Person Types, Citizenships) → Document (Document Types, Institutions) → **Roles** (Person Roles, Property Persons, Document Persons) → Others.

**Files touched**
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `CLAUDE.md`

### Slice #15.09.2 — Property sidebar: accordion → two flat buttons (detail)

Pure frontend, follow-up to #15.09. No DB, API, or i18n-namespace changes beyond the `nav.sections.*` keys.

**Why**: Slice #15.09 had converted "Property" from a real accordion into an `alwaysOpen` accordion-shaped section — header label + chevron-less always-visible List/Map sub-items, indented under a hairline border. Adrian wanted it to go further, exactly mirroring how "People" became a flat link: remove the "Property" header/shell entirely and replace it with two independent, equally-weighted top-level buttons — "Properties List" and "Properties Map" — with no enclosing accordion at all.

**`nav-config.ts`** — the single `property` section (icon `Landmark`, `alwaysOpen: true`, two items) was replaced with two separate flat-link `NavSection` entries: `propertyList` (icon `List`, `href: "/properties"`) and `propertyMap` (icon `Map`, `href: "/properties/map"`), each with `items: []` — the same shape already used by `people`/`document`. The now-fully-dead `alwaysOpen?: boolean` field was removed from the `NavSection` type entirely (no section uses it any more). The unused `Landmark` icon import was removed.

**`sidebar-nav.tsx`**
- `NavSectionRow` reverted to a plain accordion (the `alwaysOpen`/`effectiveOpen` branching added in #15.09 was deleted) — now only `administration` ever renders through this component, since every other section is flat.
- `FLAT_SECTION_ACTIVE_PREFIXES` gained a `propertyMap: ["/properties/map"]` entry. `isFlatSectionActive` got a special case for `"propertyList"`: since `/properties/map` is nested under the `/properties` prefix, `propertyList`'s match explicitly excludes any path that already matches `propertyMap`, so visiting the map page lights up only the Map button, not both.
- `sectionLabels` map: `property` key replaced with `propertyList`/`propertyMap`.
- `itemLabels` map: removed the now-unused `landList`/`landMap` entries (they were only ever sub-item labels under the old accordion; nothing reads them any more).

**i18n** — `messages/en-GB.json` / `messages/ro-RO.json`: `nav.sections.property` replaced with `nav.sections.propertyList` ("Properties List" / "Proprietăți — Listă") and `nav.sections.propertyMap` ("Properties Map" / "Proprietăți — Hartă"). `nav.items.landList` / `nav.items.landMap` removed (confirmed via grep — no longer referenced anywhere; the identically-named `home.buttons.landList`/`landMap` keys are a separate, untouched namespace used only by the dead pre-Slice-#3 home page).

**Tests (`src/__tests__/sidebar-nav.test.ts`)** — `MOCK_SECTIONS`'s `property` entry (with two items) replaced with two item-less `propertyList`/`propertyMap` entries, matching the real `nav-config.ts` shape. The `getActiveHref`/`getActiveSectionKey` tests that previously asserted `/properties` and `/properties/map` resolved to the `property` section now assert `toBeNull()` instead — same reasoning already established for `people`/`document` in Slice #15.09: these pure helpers only resolve sections with actual `items`, and a flat-link section's active state is computed separately via `isFlatSectionActive`, not covered by these helpers.

**Files touched**
- `src/components/sidebar/nav-config.ts`
- `src/components/sidebar/sidebar-nav.tsx`
- `src/__tests__/sidebar-nav.test.ts`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.07 — Replace `judicial_type` enum with `lookup_judicial_person_type` (detail)

DB schema + query layer + form/UI + admin Reference Data wiring + i18n + seed scripts + tests. Follows the exact precedent set by Slice #15.05 (Document Type enum → lookup table).

**Why**: `judicial_type` was a hardcoded Postgres enum (`SRL`, `SA`, `SRL_D`, `PFA`, `II`, `IF`, `ONG`, `OTHER`) on `judicial_person`. Adrian wants the list operator-managed from Administration → Reference Data — under the Person panel, via a new **"Judicial Person Types"** button — rather than requiring a code change + migration for every new type. The FK uses `ON DELETE SET NULL` (Adrian's choice, matching the optional-tag pattern already used for `property_person.person_role_id` and `person_paperwork.person_role_id`), not `RESTRICT`.

**DB migration (`src/db/migration_022_judicial_person_types.sql`)**
- Creates `lookup_judicial_person_type` (`id` uuid PK, `name` text NOT NULL, `sort_order` int default 0, `created_at`, `updated_at`) + `touch_updated_at` trigger, seeded with 8 rows: `SRL`(1), `SA`(2), `SRL-D`(3), `PFA`(4), `II`(5), `IF`(6), `ONG`(7), `Altele`(8). `ON CONFLICT DO NOTHING` — idempotent.
- Adds `judicial_person.judicial_person_type_id` (uuid, nullable, FK → `lookup_judicial_person_type.id` `ON DELETE SET NULL`).
- Backfills every existing `judicial_person` row by mapping the old enum value to the new table's `name` via a `CASE` expression: `SRL→SRL, SA→SA, SRL_D→SRL-D, PFA→PFA, II→II, IF→IF, ONG→ONG, OTHER→Altele`.
- Drops `judicial_person.judicial_type` and then `DROP TYPE judicial_type` — the enum is fully removed.
- **Not yet applied to any database** — see PowerShell commands below.

**Schema (`src/db/schema/index.ts`)**
- `judicialType` Postgres enum definition removed entirely.
- `judicialPerson.judicialPersonTypeId` (nullable FK → `lookupJudicialPersonType.id`, `onDelete: "set null"`) replaces the old `judicialType` enum column.
- New `lookupJudicialPersonType` table export added to the Persoană lookup-table group, alongside `lookupPersonType` / `lookupPersonRole` / `lookupCitizenship`.

**Validation + queries (`src/lib/judicial-persons/validation.ts`, `queries.ts`)**
- `judicialPersonCreateSchema` / `judicialPersonUpdateSchema`: `judicialPersonTypeId: z.string().uuid().nullish()` replaces the old `judicialType` enum field.
- `createJudicialPerson` / `updateJudicialPerson` thread `judicialPersonTypeId` through unchanged in shape (still a single nullable id field, just pointing at a different kind of value).

**Form (`src/app/judicial-persons/_components/form-schema.ts`, `judicial-person-form.tsx`)**
- `FormValues.judicialType` renamed to `judicialPersonTypeId` (string, `""` = unset). `fromApiPayload` / `toApiPayload` updated accordingly.
- The "Type" dropdown now fetches options from `lookup_judicial_person_type` (same `GET /api/admin/value-lists/judicial-person-types` pattern as every other admin-managed list) instead of a hardcoded enum-derived option array. The field's i18n label key (`fields.judicialType`) was deliberately left unchanged — it still just labels the same dropdown, even though the underlying form field is now `judicialPersonTypeId`.

**Admin Reference Data wiring** — `"judicial-person-types"` added to `src/lib/admin/value-lists/config.ts` (`VALID_LIST_KEYS`, `LIST_META` — `name`-only field), `validation.ts` (`judicialPersonTypeSchema`, name required), `queries.ts` (all four switch-statement cases, list ordered by `sort_order`). `src/app/admin/value-lists/_components/value-list-hub.tsx`: added a "Judicial Person Types" button in the Persoană section, next to Person Types / Person Roles / Citizenship — no new modal component needed, it rides the generic `ValueListModal`.

**i18n** — added `valueList.lists.judicialPersonTypes` to both `messages/en-GB.json` (`"Judicial Person Types"`) and `messages/ro-RO.json` (`"Tipuri Persoană Juridică"`). Removed the now-dead `judicialPerson.options.judicialType.*` enum-label blocks from both files (the dropdown now reads names straight from the DB).

**Seed scripts** — both `scripts/seed-judicial-persons.ts` and `src/db/seed.ts` resolve `lookup_judicial_person_type.name → id` once up front (a `Map`, fetched via a plain `db.select(...)`) and throw a clear error if an expected name is missing, rather than ever auto-creating a lookup row themselves — same standing pattern already used for `lookup_document_type` in `seed.ts`. `seed-judicial-persons.ts`'s `SEED_DATA` entries were updated to use the DB's actual name `"SRL-D"` (not the old enum literal `"SRL_D"`). `seed.ts`'s 40-entry `JUDICIAL_PERSONS` array keeps its existing `judicialType: "SRL_D"`-style labels unchanged (only the type alias, now `JudicialTypeLabel`, was renamed) — a new `JUDICIAL_TYPE_LABEL_TO_NAME` lookup object maps each old-style label to the lookup table's real `name` at insert time, mirroring the migration's own backfill `CASE` mapping exactly.

**Tests (`src/__tests__/judicial-person.test.ts`)** — every `judicialType` reference replaced with `judicialPersonTypeId`; the "valid type" test cases now assert against a sample UUID (`judicialPersonTypeId: z.string().uuid().nullish()` rejects plain enum-style strings), and the "rejects invalid" test keeps the same non-uuid string but now fails for "not a valid uuid" rather than "not a valid enum member".

**`supabase_schema_full.sql`** — `CREATE TYPE judicial_type AS ENUM (...)` removed from the ENUMS section; `judicial_person.judicial_type` column replaced with a plain `judicial_person_type_id uuid` column (no inline FK — the lookup table doesn't exist yet at that point in the script); new `lookup_judicial_person_type` table + trigger + 8-row seed added right after `lookup_person_type`, followed immediately by `ALTER TABLE judicial_person ADD CONSTRAINT ... FOREIGN KEY (judicial_person_type_id) REFERENCES lookup_judicial_person_type(id) ON DELETE SET NULL` — the same deferred-FK pattern already used for `natural_person.citizenship_id` further down the same file (lookup table didn't exist yet when the referencing table was first created).

**`sync-reference-data.sql`** — `lookup_judicial_person_type` added to the junction-tables-first `TRUNCATE` list, and a new seed block (the same 8 rows) added right after `lookup_citizenship`.

**Manual setup — local Docker (done, confirmed by Adrian)**

```powershell
docker cp src/db/migration_022_judicial_person_types.sql ga40prj-postgres:/tmp/m022.sql
docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m022.sql
```

**Supabase**: paste `migration_022_judicial_person_types.sql` directly into the SQL Editor. `supabase_schema_full.sql` is only consulted on a full from-scratch reset; no action needed there unless/until the next full reset.

**Ciprian UAT**: per the standing rule above, this is **not** something Adrian runs directly — `ciprian-ga40prj-postgres` lives on Ciprian's PC. When this slice is ready to ship to UAT, follow **UC-C6** in the Ops Guide: build the app image, then send Ciprian the `ga40prj-app.tar` plus `migration_022_judicial_person_types.sql` (renamed e.g. `schema-update-vN.sql`) with a short note. Ciprian applies both on his own machine (`update.bat`, then the `docker cp` + `psql -f -v ON_ERROR_STOP=1` command already documented in UC-C6). `sync-reference-data.sql` re-exported in this slice is kept current in the repo but is not sent — it's only used under UC-C8 (full reset), not a normal schema-update delivery.

**Files touched**
- `src/db/migration_022_judicial_person_types.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/judicial-persons/validation.ts`
- `src/lib/judicial-persons/queries.ts`
- `src/app/judicial-persons/_components/form-schema.ts`
- `src/app/judicial-persons/_components/judicial-person-form.tsx`
- `src/lib/admin/value-lists/config.ts`
- `src/lib/admin/value-lists/validation.ts`
- `src/lib/admin/value-lists/queries.ts`
- `src/app/admin/value-lists/_components/value-list-hub.tsx`
- `scripts/seed-judicial-persons.ts`
- `src/db/seed.ts`
- `src/__tests__/judicial-person.test.ts`
- `src/db/supabase_schema_full.sql`
- `src/db/sync-reference-data.sql`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.06 — Keep alternate wordings as distinct document types (detail)

Pure data migration — no schema, API, or UI changes. Follow-up to Slice #15.05.

**Why**: Adrian noticed Slice #15.05's enum-to-lookup-table migration had picked one wording per former `paperwork_type` enum value where two wordings existed (the old code-side i18n label vs. the DB name corrected by an earlier diacritics fix), silently dropping the other. He wants both kept as separate, independently selectable document types — they read as different enough documents to not collapse into one.

**Three pairs identified** (by diffing the now-dead `document.types.*` i18n labels in `messages/*.json` — confirmed unused anywhere in code via grep, a leftover from the pre-15.05 enum-driven UI — against the canonical `(key, name)` list `migration_020` actually committed to `lookup_document_type`):

| existing key | existing name | new `_ALT` row added |
|---|---|---|
| `AUTORIZATIE` | Autorizare | `AUTORIZATIE_ALT` → Autorizație |
| `CERTIFICAT_SARCINI` | Certificat de Bunuri | `CERTIFICAT_SARCINI_ALT` → Certificat de Sarcini |
| `EXTRAS_CARTE_FUNCIARA` | Extras din Carte Funciară | `EXTRAS_CARTE_FUNCIARA_ALT` → Extras de Carte Funciară |

Nothing existing is renamed, reordered, or removed — only three new rows added, so no live Document row is affected.

**Migration (`src/db/migration_021_keep_alternate_wordings.sql`)** — three idempotent guarded `INSERT`s, sort order auto-appended via `MAX(sort_order) + 1`.

**`supabase_schema_full.sql`** — the three new rows appended to the `lookup_document_type` seed (sort_order 22–24), right after `UNCLASSIFIED`.

**`sync-reference-data.sql` — also fixed a pre-existing staleness bug found during this work**: this file (the canonical Ciprian-UAT seed script) had never been updated for Slice #15.05 — it was still seeding the old 17-row, no-`key`-column version of `lookup_document_type`. Applying it to Ciprian's container today would have silently reintroduced the dropped enum-era schema mismatch. Rewrote its `lookup_document_type` block to match `supabase_schema_full.sql` exactly: `key` column added, all 21 canonical Slice #15.05 rows present (including `ACT_DONATIE`, `CARTE_IDENTITATE`, `TESTAMENT`, `UNCLASSIFIED`, which this file had also been missing), plus the 3 new `_ALT` rows from this slice. The `lookup_doc_type_person_role` association block further down needed no changes — it resolves by `name`, and no existing name changed.

**Standing-rule reminder this surfaces**: per the comment already in `supabase_schema_full.sql` (added in Slice #15.05) and CLAUDE.md's "Ciprian UAT reference-data sync" gotcha, `sync-reference-data.sql` must be regenerated/updated *alongside* every migration that touches a lookup table — not as an afterthought. This slice is the second time that step was missed and had to be caught later; worth double-checking this file specifically at the end of any future `lookup_document_type` change.

**Follow-up bug fix (same slice, found by Adrian testing right after)**: adding a new Document Type via Administration → Reference Data threw a 500 — `null value in column "key" ... violates not-null constraint`. Root cause: migration_020 (Slice #15.05) added `lookup_document_type.key` as `NOT NULL UNIQUE`, but the generic Value Lists admin CRUD (`src/lib/admin/value-lists/config.ts` / `validation.ts`) was never updated — its form only ever exposed `name`, so `key` was left unset on insert. Fixed in `src/lib/admin/value-lists/queries.ts` only (no form/UI/validation change): `createValue`'s `"document-types"` case now calls a new `generateUniqueDocumentTypeKey(name)` helper before inserting, which folds Romanian diacritics, uppercases, collapses non-alphanumerics to `_`, and appends a numeric suffix on collision — the same approach migration_020 used for its own fallback-slug step. Adrian never types a key by hand; admin-added types simply get an auto-derived one and fall back to `type-config.ts`'s GENERIC styling (already designed for unmapped keys). Confirmed via schema grep that `lookup_document_type.key` is the only `NOT NULL UNIQUE` column among all Value-List-managed lookup tables, so no other list (`property-types`, `tarla`, etc.) has this gap.

**Second follow-up bug fix (same slice, found by Adrian testing the first fix)**: after the 500 fix above, a new Document Type saved successfully but never appeared in the Document form's type dropdown (or the sidebar's dynamic Documents section, or the Admin Import classify panels). Root cause: cache-key mismatch, not a data problem. The admin Reference Data modal (`value-list-modal.tsx`) fetches/invalidates `["value-list", listKey]` (e.g. `["value-list", "document-types"]`) — but four other consumers fetch the same `/api/admin/value-lists/document-types` endpoint under a *different*, bare query key, `["document-types"]`: `document-form.tsx` (the dropdown itself, `staleTime: 5 min`), `sidebar-nav.tsx` (Documents nav section), and the Admin Import `person-classify-panel.tsx` / `document-classify-panel.tsx`. Saving or deleting a type only invalidated the admin modal's own cache, so anyone who'd already loaded one of those four within the last 5 minutes (or within React Query's default unused-cache window) kept seeing the stale list until that cache naturally expired. Fixed in `src/lib/admin/value-lists/_components/value-list-modal.tsx` only: both the add/edit mutation and the delete mutation now also call `qc.invalidateQueries({ queryKey: ["document-types"] })` whenever `listKey === "document-types"`, alongside the existing `["value-list", listKey]` invalidation. Confirmed via grep that no other Value List (`property-types`, `person-roles`, `institutions`, etc.) has a second, differently-keyed consumer elsewhere in the app — `document-types` is the only one, so the fix is intentionally scoped to that one case rather than generalized.

**Files touched**
- `src/db/migration_021_keep_alternate_wordings.sql` (new)
- `src/db/supabase_schema_full.sql`
- `src/db/sync-reference-data.sql`
- `src/lib/admin/value-lists/queries.ts`
- `src/app/admin/value-lists/_components/value-list-modal.tsx`
- `CLAUDE.md`

### Slice #16.UX.01 — Most-recent-first sort + "New!" recency badge (detail)

Pure backend (sort) + new shared frontend component — no DB migration, no schema change. Applies identically to the Person, Property, and Document lists.

**What it does**

- The three list queries (`listPersons`, `listProperties`, `listDocument`) now order results by `GREATEST(updated_at, created_at) DESC` instead of by `code`. This becomes the list's default and only sort for now — none of the three lists had a user-facing sort-by-column control to preserve.
- Every row whose record was created or modified within the last 30 minutes shows a small "New!" (RO: "Nou!") badge immediately to the right of the row's selection checkbox (the per-row checkbox added in the bulk-delete slice). Badge color ages with recency:
  - `#FF0000` — modified ≤ 5 minutes ago
  - `#FF7C80` — modified 5–15 minutes ago
  - `#FFCCCC` — modified 15–30 minutes ago
  - hidden — older than 30 minutes
- Font size is `0.75em` (≈75% of the row's text size), matching the "about 75%" spec.

**Why `GREATEST(updated_at, created_at)`, not a `principal_object` column**

`principal_object` (the shared base table giving Person/Property/Document their `code`) only has `id`, `code`, `objectType`, and `createdAt` — it has no `updatedAt`. The real `createdAt`/`updatedAt` pair lives directly on `person`, `property`, and `document` themselves (each defaults both to `now()` on insert, and `updatedAt` is bumped by application code on every update). `GREATEST(updated_at, created_at)` is used as the single "effective recency" timestamp for both sorting and the badge, even though in this schema `updatedAt` alone would currently be equivalent (it is always ≥ `createdAt`) — `GREATEST` makes that invariant explicit rather than assumed.

**New shared component (`src/components/recency-badge.tsx`)**

`<RecencyBadge createdAt={...} updatedAt={...} />` — a small client component:
- Computes `ageMs = now - max(createdAt, updatedAt)`.
- Re-renders on a 30-second `setInterval` tick so the badge's color/visibility ages live on screen without any refetch.
- Returns `null` once `ageMs` exceeds 30 minutes (or if either timestamp is invalid/in the future).
- Renders the `shared.recency.label` i18n string at `font-size: 0.75em`, colored per the thresholds above.

**Query layer changes**

- `src/lib/persons/queries.ts` — `PersonListItem` gained `createdAt`/`updatedAt`; `listPersons` selects both columns from `person` and orders by `greatest(person.updated_at, person.created_at) desc`.
- `src/lib/properties/queries.ts` — same pattern, `property.updatedAt`/`property.createdAt`.
- `src/lib/documents/queries.ts` — same pattern, `document.updatedAt`/`document.createdAt`.
- No API route changes needed — `GET /api/people`, `GET /api/properties`, `GET /api/documents` already pass the query-layer `items` straight through, so the new fields flow to the client automatically.

**UI changes**

- `src/app/natural-persons/list-view.tsx`, `src/app/properties/list-view.tsx`, `src/app/documents/list-view.tsx`: each row's checkbox `<td>` now wraps the `<input type="checkbox">` and a `<RecencyBadge>` in a `<span className="inline-flex items-center">`; each list's local item type gained `createdAt: string` / `updatedAt: string` (dates arrive as ISO strings over JSON).

**i18n**

- Added `shared.recency.label` to both `messages/en-GB.json` ("New!") and `messages/ro-RO.json` ("Nou!"), alongside the existing `shared.pagination` / `shared.bulkDelete` namespaces.

**Files touched**
- `src/lib/persons/queries.ts`
- `src/lib/properties/queries.ts`
- `src/lib/documents/queries.ts`
- `src/components/recency-badge.tsx` (new)
- `src/app/natural-persons/list-view.tsx`
- `src/app/properties/list-view.tsx`
- `src/app/documents/list-view.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.05 — Project-wide rename: Paperwork → Document (detail)

Full-stack rename touching DB schema, every query/validation/UI layer that referenced "paperwork," the Supabase storage bucket, and both message files. Also eliminates the hardcoded `PAPERWORK_TYPES` Postgres enum, replacing it with the existing admin-managed `lookup_document_type` table (Reference Data) as the single source of truth for document types.

**Why**: "Paperwork" was the working name for the third core domain object; Adrian decided "Document" is the correct long-term name, and the type list should be operator-managed (Administration → Reference Data) rather than a hardcoded enum requiring a code change + migration for every new type.

**DB (`src/db/migration_020_rename_to_document.sql`)**
- Renamed tables: `paperwork`→`document`, `paperwork_page`→`document_page`, `property_paperwork`→`property_document`, `person_paperwork`→`person_document`, `paperwork_paperwork`→`document_document` (self-ref; CHECK constraint renamed too).
- Dropped the `paperwork_type` Postgres enum entirely. `document.documentTypeId` (uuid, NOT NULL) replaces the old `type` enum column — FK → `lookup_document_type.id`, **no `onDelete` clause** (defaults to RESTRICT), so a document type still in use cannot be deleted from Reference Data.
- `lookup_document_type` gained a `key text NOT NULL UNIQUE` column — an immutable slug (e.g. `TITLU_PROPRIETATE`) used by application logic (`getTypeConfig`) instead of a Postgres enum literal. All 21 canonical (key, name) pairs seeded.
- `principal_object_type` enum value `'PAPERWORK'` renamed to `'DOCUMENT'`.
- **Standing rule going forward**: new document types are added only by Adrian via Administration → Reference Data, or by Claude when explicitly directed — never auto-seeded or hardcoded again.

**Application layers renamed in lockstep**
- `src/lib/documents/` (was `src/lib/paperwork/`): `validation.ts` (`documentCreateSchema`/`documentUpdateSchema`/`documentListQuerySchema`, `documentTypeId: uuid` replaces the old `type` enum field), `type-config.ts` (`getTypeConfig(key: string | null | undefined)` now keyed by the `lookup_document_type.key` string slug, with a GENERIC fallback for unmapped/null/unknown keys), `queries.ts`, `pages-queries.ts`.
- `src/app/documents/` (was `src/app/paperwork/`): list/detail pages, `paperwork-form.tsx`→document form, `pages-panel.tsx`, associate-person/associate-party flows.
- Sidebar: `nav-config.ts` + `sidebar-nav.tsx` — the old static 19-item paperwork section replaced by a `DocumentNavSection` that fetches live types from `lookup_document_type` and renders dynamic checkboxes (no more hardcoded type list in nav).
- Person/Property detail tabs, associate-document pickers (natural/judicial/property pairs), admin/import classify panels (document + person branches) — all updated to the new schema shape (`documentTypeId` instead of `type`).
- `src/db/seed.ts`, `src/db/supabase_reset.sql`, `src/db/supabase_schema_full.sql` — rewritten for the new table names, dropped enum, and `lookup_document_type.key` seed data.
- Tests: `src/__tests__/document.test.ts` (was `paperwork.test.ts`) rewritten against the new uuid-FK schema and string-keyed `getTypeConfig`; `src/__tests__/sidebar-nav.test.ts` mock sections updated (`document` section now has an empty static `items` array, matching the dynamic `DocumentNavSection`).
- `messages/en-GB.json` / `messages/ro-RO.json`: `paperwork.*` namespace → `document.*`; dead `home.buttons.paperwork1-6` keys renamed to `document1-6` for consistency (component itself is unused — superseded by the Slice #3 welcome screen).
- `scripts/supabase-sync.ts`: comment/log-string references to "paperwork" updated to "documents" (domain-data step description).

**Storage**
- Supabase Storage bucket `paperwork-pages` → `document-pages`. Supabase does not support renaming a bucket in place, so this was done via a new one-off script, `scripts/storage-migrate-bucket.ts` (`npm run storage:migrate-bucket`): reads the source bucket's settings (public/private, size limit, MIME allowlist), creates the destination bucket with matching settings, then recursively walks and copies every file (download + re-upload — Storage's `copy()`/`move()` only operate within a single bucket). The script never deletes anything; Adrian deleted the old `paperwork-pages` bucket manually from the dashboard after spot-checking the new one. `src/lib/storage/index.ts` already pointed at `"document-pages"` as part of the layer rename above.

**Cleanup**
- Quarantined dead files from the rename (`src/lib/_DELETE_ME_paperwork/` and two top-level `_DELETE_ME_seed*.sql` files) were confirmed to have zero importers, then deleted by Adrian via PowerShell — the Linux sandbox could not delete them itself (`rm`/`unlink`/`mv`/Python all failed with "Operation not permitted" despite the sandbox process owning the files; a mount-level restriction, not a real Unix permission issue — same class as the documented "sandbox file drift from Windows" gotchas).

**Verification note**: the sandbox's `npx tsc --noEmit` and `npx jest` could not be trusted for this slice — `jest` failed outright (tried to download the Next.js SWC binary from the npm registry, which the sandbox cannot reach), and `tsc --noEmit` threw a wide spread of phantom "Invalid character" / "no corresponding closing tag" errors across many already-correct, already-committed files (consistent with the pre-existing documented sandbox file-drift gotcha). Verification was instead done by reading the actual file contents via the Windows-mounted path and cross-checking imports against real exports.

**Files touched**: too numerous to list individually (full-stack rename across ~40+ files) — see the per-area task breakdown above. Key new files: `src/db/migration_020_rename_to_document.sql`, `scripts/storage-migrate-bucket.ts`.

**Still outstanding**: none — migration applied to local Docker, storage bucket migrated and old one deleted, dead files removed. Supabase (cloud) full reset/re-seed via `npm run supabase:sync` is the next natural step whenever Adrian is ready to push this slice to production, since `supabase_schema_full.sql` now reflects the new schema.

### Slice #15.02 — Admin → Import: file-panel + preview-panel polish (detail)

Pure frontend — no DB schema, API contract, or migration changes. Six UI fixes to the Slice #15.01 Import feature, all confined to `ImportBrowser` and its dialog/panel children plus two i18n files.

**1. Classified-state tracking (green filename + Classify/Unclassify toggle)**
- `ImportBrowser` now tracks a `classifiedNames: Set<string>` of files that have completed a Classify flow (Property/Person/Document branch all succeeded and saved).
- File-list rows render the filename in emerald green (`text-emerald-600 dark:text-emerald-400`) when classified — this replaces the active-row blue color for that row, so a classified file stays visibly green even when re-selected.
- When exactly one file is selected and it is already classified, the bottom action button swaps from "Classify (N)" to "Unclassify" (outline style instead of filled) and clicking it removes the name from `classifiedNames`, reverting the filename to black/default and the button back to "Classify".
- `ClassifyDialog` and all three branch panels (`PropertyClassifyPanel`, `PersonClassifyPanel`, `DocumentClassifyPanel`) gained an `onClassified: () => void` prop, called immediately after each branch's save flow succeeds (Property: after `POST /api/properties`; Person: after creating the person + CARTE_IDENTITATE document + link; Document: after the per-page upload loop), before `onClose()`/`router.push(...)`. `ClassifyDialog` forwards this up to `ImportBrowser.markClassified(names)`, passing the one or many filenames involved in that branch.

**2. Context preservation across navigation away and back**
- `FileSystemDirectoryHandle`/`FileSystemFileHandle` objects cannot be serialized into `sessionStorage`/`localStorage`, so a module-level singleton object (`snapshot`, declared outside the component) mirrors `dirHandle`, `folderName`, `entries`, `activeName`, `selectedOrder`, `classifiedNames`, and `rotations` on every change via a `useEffect` that only mutates the plain object — no `setState` calls, so it doesn't trip `react-hooks/set-state-in-effect`.
- All the corresponding `useState` calls switched to lazy initializers reading from `snapshot` (e.g. `useState<Entry[]>(() => snapshot.entries)`).
- Because the JS module is not re-evaluated on a client-side route change (only the component tree unmounts/remounts), navigating away from `/admin/import` and back within the same tab restores the exact prior state — folder, file list, selection, classified marks, and rotations all intact. This does not survive a full page reload (by design — `FileSystemHandle` permissions wouldn't survive that either).

**3. Fit-to-panel preview preserving aspect ratio (images + PDFs)**
- The preview box now uses `style={{ containerType: "size" }}` (CSS Container Queries) and Tailwind's `cqw`/`cqh` arbitrary values instead of a fixed pixel height.
- Images: `max-h-[100cqh] max-w-[100cqw] object-contain` normally; when rotated to a quarter-turn (90°/270°) the constraints swap to `max-h-[100cqw] max-w-[100cqh]` so the rotated image still fills the panel correctly on whichever axis is now the limiting one.
- PDFs: the `<iframe>` switched from a fixed `h-[600px]` to `h-full w-full`, filling the same panel box.
- Required completing the flex height-chain down to the preview box: added `min-h-0` alongside `flex-1`/`flex flex-col` at every level — `page.tsx`'s wrapper `<div>` and `<main>`, `ImportBrowser`'s root, the two-pane row, both pane wrapper `<div>`s, and the file-list `<ul>` (which also dropped its old `max-h-[480px]` cap in favor of `flex-1 min-h-0 overflow-y-auto`). Same root cause as the existing "Google Maps height chain" gotcha, generalized to plain HTML/CSS (no `absolute inset-0` trick needed here since `<img>`/`<iframe>`/`<pre>` resolve percentage/flex heights directly once every ancestor has `min-h-0`).

**4. Word document "open" link**
- `guessMimeFromExt` extended with `.doc` → `application/msword` and `.docx` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document`; new exported `isWordFile(file)` helper checks both extension and MIME type.
- The preview-loading effect now also creates an object URL for Word files (previously only images/PDFs).
- Preview pane renders a Word branch: file glyph + filename + a download link (`<a href={previewUrl} download={file.name}>`) labelled "Open in Word" + a hint string underneath.
- **Known limitation, communicated to Adrian**: the File System Access API never exposes a real OS filesystem path to JS (security sandboxing), so there is no way to launch Word directly from the browser. The link downloads the file via its object URL; opening the downloaded copy from the Downloads folder will launch Word via the OS's normal file association. This is the closest feasible approximation, not a true in-place "open."

**5. Text-file preview**
- New `previewText: string | null` state. The preview-loading effect calls `file.text()` directly on the local `File` object (no upload) for files matching `isTextFile()`, and renders the result in a scrollable `<pre className="h-full w-full overflow-auto whitespace-pre-wrap break-words ...">`.
- The derived-state-during-render reset block (the `resolvedFor`/`activeName` comparison that already existed to avoid `react-hooks/set-state-in-effect`) was extended to also clear `previewText` whenever the active file changes.

**6. Image rotation (90° either way, 180°)**
- New `rotations: Record<string, number>` state, keyed by filename, persisted in the same module-singleton as everything else (rotation is remembered per file, including across navigation away/back).
- Three buttons in the preview-pane header (↺ −90°, ↻ +90°, "180°"), shown only when the active file is an image. `rotateBy(delta)` normalizes the new angle via `((current + delta) % 360 + 360) % 360`.
- The `<img>` gets `style={{ transform: \`rotate(${activeRotation}deg)\` }}`; combined with fix #3's `cqw`/`cqh` swap at quarter-turns, the rotated image always fills the available panel space without distortion.

**7. Hydration error fix (`ImportBrowser` is now client-only, never SSR'd)**
- After Adrian loaded the page in his browser, Next.js threw a "Recoverable Error" hydration mismatch pointing at `ImportBrowser`.
- Root cause: `ImportBrowser`'s `supported` check (`typeof window !== "undefined" && typeof window.showDirectoryPicker === "function"`) is always `false` during SSR (no `window` on the server), but evaluates `true` on the client's first paint in Chrome/Edge — exactly the browsers this feature targets. Server HTML showed the "browser not supported" message; the client immediately swapped in the entire two-pane file-browser UI. Different element trees on each side = hydration mismatch, guaranteed to happen for every user on a supported browser (not an edge case).
- Rejected fixes: `suppressHydrationWarning` only silences same-element text/attribute diffs, not a structurally different subtree; a plain `useEffect(() => setSupported(...), [])` would re-trip the same `react-hooks/set-state-in-effect` rule just fixed in item 1 above (the setState would run synchronously at the top of the effect body).
- Actual fix: `ImportBrowser` is fundamentally a browser-only component (File System Access API has no server equivalent), so it should never be server-rendered at all. New file `import-browser-dynamic.tsx` (`"use client"`) wraps it via `next/dynamic(() => import("./import-browser").then(m => m.ImportBrowser), { ssr: false })`. `page.tsx` (an `async` Server Component using `getTranslations`, so it cannot call `dynamic(..., { ssr: false })` directly — that combination is Server-Component-illegal in the App Router) now imports `ImportBrowserDynamic` from the wrapper instead of `ImportBrowser` directly. With `ssr: false`, the slot renders nothing on both the server pass and the client's first paint (identical — no mismatch), then `ImportBrowser` mounts client-only right after hydration, at which point reading `window` is safe with nothing to compare against.

**8. Sidebar: Documents section no longer auto-expands on document detail pages**
- After classifying a file as a Document, the import flow navigates to the new document's detail page (`/paperwork/[id]`). Adrian noticed the sidebar's "Documents" accordion popped open every time, showing all 19 document-type checkboxes — unwanted on a single-document detail view.
- Root cause: `SidebarNav`'s `activeSectionKey` memo detected the paperwork section by `pathname.startsWith("/paperwork")`, which matches the list page, detail pages, and sub-pages (e.g. `/paperwork/[id]/associate-person`) alike. The derived-state-during-render block then auto-opens whatever section `activeSectionKey` resolves to, so any navigation into a document's detail page reopened the checkbox list.
- Fix: changed the check to an exact match (`pathname === "/paperwork"`) — only the list page itself triggers auto-expand. Detail/sub-pages still show the section header in its active color (that styling uses a separate `isSectionActive` check in `PaperworkNavSection`, untouched), but no longer force the checkbox list open.

**i18n** — added to `adminImport.browser` in both `messages/en-GB.json` and `messages/ro-RO.json`: `unclassifyButton`, `rotateLeft`, `rotateRight`, `rotate180`, `openInWord`, `openInWordHint` (plus the pre-existing `classifyButton`, `noPreview`, `noPreviewType` keys were reused, not added).

**Verification note**: the Linux sandbox's `tsc --noEmit` returned a batch of phantom "unterminated string literal" / "no corresponding closing tag" errors across all touched files immediately after these edits. Investigation (`wc -l` on the sandbox-mounted copies vs. the actual just-written content) confirmed this is the documented "sandbox file drift from Windows" gotcha — the sandbox's bash-mounted view of `ga40prj` was stale/truncated relative to what had just been written (e.g. `page.tsx` showed 17 lines missing its closing tags; `import-browser.tsx` showed 366 of its actual 581 lines). `containerType` was confirmed present in the installed `@types/react`'s `csstype`-derived `CSSProperties` (`@types/react: ^19`), so no TypeScript error was expected there, and none materialized.

Adrian then ran `npm run lint` on his own machine and caught one real `react-hooks/set-state-in-effect` error that the sandbox check had missed: the preview-loading effect called `setPreviewLoading(true)` synchronously at the top of its body, before the first `await`/promise callback — the same category of violation documented in Slice #4.5. Fix: moved `setPreviewLoading(activeName !== null)` into the existing derived-state-during-render block (the `resolvedFor`/`activeName` comparison, which already resets `previewFile`/`previewText`/`previewUrl` on every active-file change), leaving only `setPreviewLoading(false)` inside the effect's `.finally()` callback — safely deferred, since it runs after the promise settles. This is the standing lesson for this codebase: **the sandbox's `tsc --noEmit` cannot be trusted for live-edited files, but it also doesn't run ESLint** — `npm run lint` on Adrian's machine remains the only reliable check for `react-hooks/set-state-in-effect` violations, and should be run before every commit touching effects.

**Files touched**
- `src/app/admin/import/_components/import-browser.tsx` (rewritten)
- `src/app/admin/import/_components/import-browser-dynamic.tsx` (new — client-only dynamic wrapper, fixes hydration mismatch)
- `src/app/admin/import/_components/classify-dialog.tsx`
- `src/app/admin/import/_components/property-classify-panel.tsx`
- `src/app/admin/import/_components/document-classify-panel.tsx`
- `src/app/admin/import/_components/person-classify-panel.tsx`
- `src/app/admin/import/page.tsx`
- `src/components/sidebar/sidebar-nav.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #15.01 — Admin → Import: local-folder browser + Classify (detail)

DB migration + schema + validation + a new vision-API route + a new `/admin/import` page — no changes to any existing list/detail page's core CRUD logic beyond the small ID-link addition on the Person Details tab.

**What it does**

A new "Import" item in the Administration sidebar section (split out of the old single "Import/Export" placeholder — "Export" stays a disabled coming-soon item) opens `/admin/import`: a two-pane local-folder browser. Adrian picks a folder on his own machine (via the browser's File System Access API — Chrome/Edge only, nothing is uploaded until he acts on a file), browses it, multi-selects files (Ctrl/Cmd-click, order remembered), and clicks **Classify (N)**. A dialog then offers up to three paths depending on what's selected:

- **Property** — enabled only when exactly one `.txt` file is selected. Reuses the existing `POST /api/properties/parse-text` (Stereo70 corner parser) + `POST /api/properties` endpoints, exactly like `AddPropertyDialog`'s text-file flow. Filename (minus extension) becomes the nickname (editable before import). Navigates to the new property on success.
- **Person** — enabled only when exactly one image file is selected (a scanned Romanian ID card). Sends the image to a new vision-API route, pre-fills a review form (the same Zod schema/mapping as the main Natural Person form), then on Save: creates the Person (`POST /api/people`), creates a `CARTE_IDENTITATE` Document (`POST /api/paperwork`) with the image as its only page (`POST /api/paperwork/[id]/pages`), and links the two (`POST /api/paperwork/[id]/persons`). No new linking column was needed — the Person Details tab's "ID link" row resolves automatically via `getPersonIdCardLink()`, a derived query over the existing `person_paperwork` ↔ `paperwork.type = 'CARTE_IDENTITATE'` relationship.
- **Document** — always enabled for ≥ 1 file. Creates one new Document of a chosen type (default `UNCLASSIFIED`) via `POST /api/paperwork`, then uploads every selected file as a page via `POST /api/paperwork/[id]/pages`, **in click/selection order** (not alphabetical).

No new "classify" backend orchestration routes were built beyond the vision extraction route — every branch is a client component that calls pre-existing CRUD endpoints in sequence.

**DB migration (`src/db/migration_019_import_classify.sql`)**
- `ALTER TYPE paperwork_type ADD VALUE IF NOT EXISTS 'CARTE_IDENTITATE' AFTER 'AVIZ_INSTITUTIE'` and `'UNCLASSIFIED'`. Each `ALTER TYPE ... ADD VALUE` must run outside an explicit transaction (apply with plain `psql -f`, not wrapped in `BEGIN`/`COMMIT`).
- Adds an `'Unclassified'` row to `lookup_document_type` (guarded with a `NOT EXISTS` check — that table has no unique constraint on `name`).
- Adds seven nullable columns to `natural_person` for fields read off an ID card that had no existing home: `place_of_birth`, `id_issuing_authority`, `id_valid_from` (date), `id_valid_until` (date), `id_card_number`, `id_mrz_raw`, `citizenship_id` (FK → `lookup_citizenship.id`, `ON DELETE SET NULL`).
- Idempotent — safe to re-run.

**Schema / validation / form-schema**
- `src/db/schema/index.ts` — the seven new columns added to `naturalPerson`.
- `src/lib/paperwork/validation.ts` — `CARTE_IDENTITATE` and `UNCLASSIFIED` added to the `PAPERWORK_TYPES` const array.
- `src/lib/persons/queries.ts` — `createNaturalPerson` threads the seven new fields through; new `getPersonIdCardLink(personId)` (see above).
- `src/app/natural-persons/_components/form-schema.ts` — `FormValues` gains `placeOfBirth`, `idIssuingAuthority`, `idValidFrom`, `idValidUntil`, `idCardNumber`, `idMrzRaw`, `citizenshipId` (all plain strings in form state, `""` = unset); `fromApiPayload`/`toApiPayload` map them through (null ↔ `""`).
- `src/app/natural-persons/_components/natural-person-form.tsx` + `person-detail-tabs.tsx` + `[id]/page.tsx` — render the new fields and a read-only "ID link" row (hyperlink to the linked CARTE_IDENTITATE Document) when `getPersonIdCardLink` returns a match.

**Vision extraction route (`src/app/api/admin/import/extract-id-card/route.ts`)**
- `export const runtime = "nodejs"`, `maxDuration = 60`.
- Accepts `multipart/form-data` with an `image` field. Calls the Anthropic Messages API directly via `fetch` (no new npm dependency — raw HTTPS call) with the image as a base64 vision block, asking for the Romanian ID card's printed + MRZ fields as structured JSON.
- Requires `ANTHROPIC_API_KEY` in the environment (added to `.env.example`, not committed with a real value). Optional `ANTHROPIC_VISION_MODEL` override; defaults to `claude-sonnet-4-6` in code.
- Resolves the citizenship free-text the model reads (e.g. "ROU", "Română") against `lookup_citizenship` server-side, returning a matched `citizenshipId` when confident.
- Response shape: `{ fields: { lastName, firstName, gender, dateOfBirth, cnp, idDocumentNumber, idCardNumber, placeOfBirth, idIssuingAuthority, idValidFrom, idValidUntil, idMrzRaw, citizenshipId }, lowConfidenceFields: string[], unmappedRaw: Record<string,string> }`.
- Per Adrian's standing instruction, anything the model read off the card that didn't map cleanly to a known field is returned in `unmappedRaw` (label → raw text) rather than dropped or guessed — the Person-classify review panel renders these read-only under "Found on the card but not auto-filled" so Adrian can decide what to do with them by hand.

**`/admin/import` page + `ImportBrowser` (`src/app/admin/import/_components/import-browser.tsx`)**
- File System Access API (`window.showDirectoryPicker`) — Chrome/Edge only; a plain message is shown on unsupported browsers (Firefox/Safari). Hand-rolled minimal TypeScript types for the API live in `file-system-types.ts` (not in `lib.dom.d.ts`, no `@types` package covers it yet).
- Left pane: flat, alphabetical file list. Click selects (single); Ctrl/Cmd-click adds to a multi-selection and remembers click order (numbered badges) — this order becomes Document page order downstream. Arrow keys move the single-selection focus.
- Right pane: live preview of the focused file — images and PDFs render inline (object URL from the local `File`, nothing uploaded at this stage), other types show a generic file glyph + filename.
- **Preview reset uses "derived state during render," not an effect.** The original draft reset `previewUrl`/`previewFile` synchronously inside the same `useEffect` that kicks off the async `getFile()` fetch, which trips `react-hooks/set-state-in-effect` (the rule flags any setState call that executes synchronously within an effect body, before any promise/microtask boundary — same root cause CLAUDE.md's Slice #4.5 fixes hit). Fixed by tracking `resolvedFor` state and resetting the preview synchronously *during render* (the React-documented "adjust state when a prop changes" exception — gated so it only fires once per `activeName` change) and leaving the effect to only ever call setState inside `.then()`/`.catch()`/`.finally()` callbacks.
- "Classify (N)" button (shown once ≥ 1 file is selected) resolves the selected `FileSystemFileHandle`s to real `File` objects (in click order) and opens `ClassifyDialog`.

**`ClassifyDialog` (`src/app/admin/import/_components/classify-dialog.tsx`)**
- Modal shell + "choice card" pattern copied from `add-property-dialog.tsx` (`fixed inset-0 z-50 bg-black/40` overlay, `rounded-xl border border-card-rim bg-white shadow-xl` panel).
- Eligibility gates: Property needs exactly one `.txt` file (`isTextFile`); Person needs exactly one image file (`isImage`); Document is always enabled for ≥ 1 file. Ineligible cards render disabled with an explanatory hint instead of being hidden, so Adrian always sees all three options and why a given one isn't available for his current selection.
- Escape backs out one level (branch → choice → close).

**`PropertyClassifyPanel`** — nickname input (defaulted from filename) + Import button; calls `parse-text` then `POST /api/properties`; navigates to the new property.

**`DocumentClassifyPanel`** — type `<select>` (maps over the static `PAPERWORK_TYPES` array, default `UNCLASSIFIED`, labelled via the existing `paperwork.types.*` i18n keys — this is not a DB-backed lookup, so no extra API call was needed for the dropdown) + optional title input + numbered read-only file list (selection order); creates the Document then uploads each file as a page sequentially, showing `(done/total)` progress; navigates to the new Document.

**`PersonClassifyPanel`** — the most involved branch:
- "Extract fields from image" is a manual button (not auto-run on mount): sending a personal ID scan to an external vision API is treated as an explicit, opt-in action rather than something that fires the instant a file is focused — this also sidesteps a `react-hooks/set-state-in-effect` violation that a mount-effect calling the same async function would otherwise trip (the function's `setExtracting(true)` runs synchronously before its first `await`, which the lint rule treats identically to the preview-reset case above).
- The image preview URL is derived once via a `useState(() => URL.createObjectURL(file))` lazy initializer (no effect needed to set it) with a separate cleanup-only `useEffect` (returns a revoke function, calls no setState) for the unmount case.
- Review form reuses `formSchema`/`emptyFormValues`/`toApiPayload` from the main Natural Person form-schema module; local re-implementations of `Field`/`SelectField`/`TextAreaField` (those are module-private in `natural-person-form.tsx`) add a `warn` prop that renders a ⚠ badge next to the label for any field listed in the extraction response's `lowConfidenceFields`.
- `unmappedRaw` entries render read-only in an amber callout box under the form — never silently dropped, never auto-mapped to a guessed field.
- Save button disabled until the form passes the same validation as the main Natural Person form (e.g. needs at least one contact field) — ID cards alone rarely satisfy this, so Adrian fills in a phone/email manually before saving, same as creating any other Person.
- On Save: create Person → create `CARTE_IDENTITATE` Document → upload the image as page 1 → link Person to Document → navigate to the new Person.

**i18n** — new `adminImport` namespace in both `messages/en-GB.json` and `messages/ro-RO.json`: `pageTitle`, `browser.*` (folder picker, file list, preview, classify button, hints), `classify.*` (dialog title/choice cards/cancel/back) and three sub-namespaces `classify.property.*`, `classify.document.*`, `classify.person.*` for each branch's labels/buttons/status/error strings. `nav.items.import` / `nav.items.export` replace the old single `nav.items.importExport` key.

**Manual setup required (not yet run — see chat for ready-to-paste PowerShell)**
1. Apply `src/db/migration_019_import_classify.sql` to local Docker via `docker cp` + `psql -f` (per the standard migration gotcha — plain `npm run db:migrate` does not reliably apply it locally).
2. Set `ANTHROPIC_API_KEY` in local `.env` (and in Vercel's project env vars before this reaches production) — get a key at console.anthropic.com. No new npm dependency: the vision call uses raw `fetch` against the Anthropic Messages API.
3. Apply the same migration to Supabase via the SQL Editor, and to Ciprian's UAT container, when those environments are next synced.

**Files touched**
- `src/db/migration_019_import_classify.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/paperwork/validation.ts`
- `src/lib/persons/queries.ts`
- `src/app/natural-persons/_components/form-schema.ts`
- `src/app/natural-persons/_components/natural-person-form.tsx`
- `src/app/natural-persons/_components/person-detail-tabs.tsx`
- `src/app/natural-persons/[id]/page.tsx`
- `src/app/api/admin/import/extract-id-card/route.ts` (new)
- `src/app/admin/import/page.tsx` (new)
- `src/app/admin/import/_components/file-system-types.ts` (new)
- `src/app/admin/import/_components/import-browser.tsx` (new)
- `src/app/admin/import/_components/classify-dialog.tsx` (new)
- `src/app/admin/import/_components/property-classify-panel.tsx` (new)
- `src/app/admin/import/_components/document-classify-panel.tsx` (new)
- `src/app/admin/import/_components/person-classify-panel.tsx` (new)
- `src/components/sidebar/nav-config.ts`
- `src/components/sidebar/sidebar-nav.tsx`
- `.env.example`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #GIS.13.12 — Land map: select/unselect via InfoWindow + tab view (detail)

Pure frontend — no DB schema, API, migration, or i18n namespace changes beyond two message files.

**What it does**

Three related features on the `/properties/map` page:

1. **InfoWindow fork in select mode** — when select mode is active and the user hovers over a property, the "Open →" link is replaced by a coloured action button: red **"Select"** when the property is not selected, green **"Unselect"** when it is. Clicking the button toggles that property's membership in `selectedIds`. The InfoWindow itself (hover detection, delay timer) is unchanged — only the link inside it is swapped.

2. **"Display all selected" button** — rendered beside the existing red "Delete all selected" button in the bottom toolbar (bottom-center of the map), visible whenever `selectedIds.size > 0` and `activeTab === "all"`. Clicking it sets `showTabs = true` and `activeTab = "selected"`.

3. **Tab bar and "Selected Properties" tab** — when `showTabs` is true the page header switches from a plain `<h1>` title to a two-button toggle bar. Left tab = "All Properties" (maps to the i18n key `property.mapTitle`); right tab = "Selected Properties" (`property.map.selectedPropertiesTab`), with a red badge showing the count of selected IDs. The "Selected" tab renders the map filtered to only those properties in `selectedIds`. Properties in the Selected tab render in normal blue (not red) so they don't look like they're flagged for deletion. The drag-to-select overlay and bottom toolbar buttons are hidden on the Selected tab (it is view-only). Switching back to "All Properties" preserves the selection. Exiting select mode (`✕ Cancel select`) resets both `showTabs` and `activeTab`.

**Header ownership moved to `PropertyMap`**

`map/page.tsx` previously rendered the `<header>` (with the page title) as a server component via `getTranslations`. Because the tab bar is driven by client state (`showTabs`, `activeTab`), the header was moved inside `PropertyMap` (client component). `page.tsx` now renders only the flex container + `<MapView>`.

**`FitAllProperties` tab-aware reset**

`FitAllProperties` accepts a `tabKey: string` prop. A `useEffect` resets the `fitted` ref whenever `tabKey` changes, so each tab switch triggers a fresh auto-fit to the visible properties.

**Color logic**

Properties in `selectedIds` render red only when `activeTab === "all"` (same red as before). On the "Selected" tab, `effectiveSelected` is always false, so all polygons render with the standard blue fill.

**Files touched**
- `src/app/properties/map/page.tsx` (server header removed, simplified to container only)
- `src/app/properties/map/property-map.tsx` (rewritten)
- `messages/en-GB.json` (`property.mapTitle` changed; `property.map.*` namespace added)
- `messages/ro-RO.json` (same)
- `CLAUDE.md`

**i18n keys added**
- `property.mapTitle`: "All Properties" / "Toate Proprietățile"
- `property.map.selectedPropertiesTab`: "Selected Properties" / "Proprietăți Selectate"
- `property.map.selectLink`: "Select" / "Selectează"
- `property.map.unselectLink`: "Unselect" / "Deselectează"
- `property.map.displayAllSelected`: "Display all selected" / "Afișează selectate"

### Slice #GIS.13.11 — Text-file parser: first-token range fix + polygon sort (detail)

Pure backend — single file change, no DB schema, API contract, UI, or i18n changes.

**Change 1 — first-token range fix**

Some cadastral text exports use `0` as the first column value on the first line (or any value that happens to be 0). The existing `parseLine` 3-column guard required `idx >= 1`, so lines with `idx = 0` fell through to the 2-column fallback. There `parseFloat("0")` is not a Stereo70 value, so the fallback also rejected the line — silently dropping a corner.

**New format spec (GIS.13.11)**

Each line has exactly three tokens:
- Token 0: an arbitrary numeric label, always **< 1 000** — must be **ignored** (it is NOT the corner's sequential position).
- Token 1: Stereo70 Northing (X column, Romanian convention).
- Token 2: Stereo70 Easting (Y column, Romanian convention).

Corner order is determined solely by **line order** (first line → corner 1, second → corner 2, etc.).

In `parseLine`, the 3-column entry condition was changed from:
```typescript
const idx = parseInt(tokens[0], 10);
if (!isNaN(idx) && idx >= 1 && idx <= 9_999) {
```
to:
```typescript
const idx = parseFloat(tokens[0].replace(",", "."));
if (Number.isFinite(idx) && idx < 1_000) {
```

Key differences:
- Uses `parseFloat` instead of `parseInt` to handle decimal labels if they appear.
- Removes the `>= 1` lower bound — now accepts 0 (and any negative value, which won't appear in practice but is harmless).
- Tightens the upper bound from 9 999 → 999 (exclusive `< 1_000`) to match the spec.
- The existing 2-column fallback is unchanged — still handles files with no leading token.

**Verification (node -e)**

| Input line | Result |
|---|---|
| `0 321762.117 579601.957` | ✓ northing/easting parsed |
| `42 321762.117 579601.957` | ✓ northing/easting parsed |
| `999 321762.117 579601.957` | ✓ northing/easting parsed |
| `1000 321762.117 579601.957` | null (≥ 1 000, correctly rejected) |
| `321762.117 579601.957` | ✓ 2-column fallback |
| `Corner X Y` | null (header, correctly rejected) |

**Change 2 — automatic simple-polygon sort**

When corners arrive in an arbitrary file order, connecting them sequentially can produce a self-intersecting (bow-tie) polygon. Added `sortToSimplePolygon()` which sorts corners by polar angle around their centroid before the response is returned. This produces a simple (non-self-intersecting) polygon for any convex or near-convex parcel. The original file order is not preserved — per spec this is acceptable.

```typescript
function sortToSimplePolygon(corners) {
  const centLat = average(corners.lat);
  const centLon = average(corners.lon);
  return [...corners].sort((a, b) =>
    Math.atan2(a.lat - centLat, a.lon - centLon) -
    Math.atan2(b.lat - centLat, b.lon - centLon)
  );
}
```

Called at the end of the POST handler: `return Response.json({ corners: sortToSimplePolygon(corners) })`.

**Files touched**
- `src/app/api/properties/parse-text/route.ts`
- `CLAUDE.md`

### Slice #GIS.13.10 — OCR parser: fix first-corner-skipped bug (detail)

Pure backend — single file change, no DB schema, API contract, UI, or i18n changes.

**Root cause (confirmed by adding `console.log(rawText)` to the route)**

Tesseract read the first data row as:

```
SE A 11321762.117 | 579601.957 8.950
```

The label text `SE A` in the left margin of the scanned table merged with the corner-index digit `1`, producing the token `11321762.117` — **two** extra leading digits prepended to the real Northing `321762.117`. The integer part `11321762` is an 8-digit number, outside the `[1_000_000, 9_999_999]` range that both `trySplitMergedToken` and rescue-2b checked. Both rescues returned null; the corner was silently dropped. Corners 2–6 had no fused label characters so they parsed correctly, producing the one-off shift symptom (corners 2–6 saved as corners 1–5).

**Fix — three independent changes, all in `parseTableFormat`**

**1. Removed `SKIP_LINE_RE` line-skip guard.**  
The original code skipped entire lines matching `/suprafat|perimetr|\barea\b|\bperim\b/i` to avoid picking up area/perimeter summary rows. This is safe in theory (those rows don't contain coordinate-range numbers), but dangerous in practice: OCR sometimes merges the column-header row (which may contain "Suprafata" in a combined header) with the first data row, making the whole merged line match `SKIP_LINE_RE` and causing corner 1 to be discarded. The guard was removed; coordinate-range checks are sufficient to reject area/perimeter values on their own.

**2. Added `fixOcrDigits` pre-processing.**  
OCR frequently confuses `l` (lowercase L) with `1` and `O` (uppercase letter O) with `0`. If the Northing for corner 1 is read as `"32l762.117"`, `parseFloat` stops at `'l'` and returns `32` — outside all coordinate ranges. `fixOcrDigits` applies `.replace(/[lI]/g, "1").replace(/O/g, "0")` to each raw token before any numeric parsing.

**3. Multi-digit strip in `trySplitMergedToken` and rescue-2b.**  
Both were changed from "strip exactly one leading digit" to "try stripping 1, 2, or 3 leading digits until the remainder is a valid 6-digit Stereo70 value." For `"11321762.117"`:
- strip 1 → `"1321762"` → 1321762, not a 6-digit number in `[100k, 999k]` → continue
- strip 2 → `"321762"` → 321762 ∈ `[100k, 999k]` → candidate `321762.117` → `isProjectNorthing` → ✓

The loop in rescue-2b also checks `isProjectNorthing(candidate) || isProjectEasting(candidate)` before committing, so a stripped value that passes the 6-digit range check but falls outside the project area is still rejected.

**How to diagnose future OCR parsing failures**

Add these two lines at the top of `parseOcrText` temporarily:

```typescript
console.log("=== OCR RAW TEXT START ===");
console.log(rawText);
console.log("=== OCR RAW TEXT END ===");
console.log("=== Pass 0 corners ===", JSON.stringify(tableCorners));
```

Run `npm run dev`, scan the image, and inspect the terminal output. The raw text shows exactly what Tesseract produced; comparing it to the Pass 0 corners immediately reveals which lines were skipped and why. Remove the logs once the issue is understood.

**Files touched**
- `src/app/api/properties/scan-image/route.ts`
- `CLAUDE.md`

### Slice #GIS.13.08 — Property form: Show Big Map toggle (detail)

Pure frontend — no DB schema, API, or migration changes.

**What it does**

Adds a **"Show Big Map"** / **"Show Small Map"** toggle button in the corners section footer (to the right of "Add Corner"). When toggled:

- The form switches from a stacked single-column layout to a **two-column side-by-side layout**: left panels (45% width) + right map (remaining width, stretching to the full height of the left column via `items-stretch`).
- The mini-map that was previously below the corners table moves to the right column and fills the full available height (via `relative` + `absolute inset-0` bounding box pattern).
- The Cadastral section switches from 4-col to 2-col grid (`Code/Nickname`, `Tarla-Sola/Parcela`, `Cadastral No./Carte Funciara`, `Use Category/Surface Area`, `Notes` full-width).
- The Address section switches from the normal 2+4 row layout to a stacked 1-1-2-2 layout (Street line full-width, Notes full-width, Postal Code/Locality pair, County/Country pair).
- The toggle button works in all modes (view, create, edit) since seeing a bigger map is useful in all three.

**Layout implementation**

- `className="contents"` CSS trick: wrapper divs with `display: contents` are invisible in the flex layout — their children become direct flex items of the parent. This means no field/section JSX is duplicated; the same fields render in both modes via a single conditional wrapper.
- In normal mode: outer `<div className="contents">` + inner `<div className="contents">` → all three sections appear as direct `flex-col` items of the `<form>`.
- In big-map mode: outer `<div className="flex flex-row gap-4 items-stretch">` + inner `<div className="w-[45%] flex-none flex flex-col gap-4">` → classic two-column layout.
- Right map column: `flex-1 min-w-0 relative` with `<div className="absolute inset-0">` to give the `<Map>` component a concrete pixel bounding box (required by `@vis.gl/react-google-maps`).

**`bigMap` state location**: `PropertyForm` (controls layout); `CornersManager` receives `bigMap` and `onToggleBigMap` as optional props only to render the toggle button.

**i18n**
- Added `property.corners.showBigMap` and `property.corners.showSmallMap` to both `messages/en-GB.json` and `messages/ro-RO.json`.

**Files touched**
- `src/app/properties/_components/property-form.tsx`
- `src/app/properties/_components/corners-manager.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #GIS.13.06 — Land map: overlap-aware InfoWindow (detail)

Pure frontend — no DB schema, API, or i18n changes.

**Problem**: When two or more property polygons overlap (e.g. a small inner parcel inside a larger surrounding parcel), clicking the shared area only showed the topmost polygon's InfoWindow — the other overlapping properties were silently ignored.

**Fix**: Client-side hit-testing against every loaded property, so the InfoWindow always lists all geometrically-matching properties at the click position.

**New helpers (added after `propertyInRect` in `property-map.tsx`)**

- `polygonAreaDeg(corners)` — Shoelace formula in lat/lon deg² units. Used only for relative sorting (largest area first = outermost / surrounding parcel at top of the list). No conversion to real-world metres needed.

- `pointInPolygon(pt, corners)` — standard ray-casting algorithm in lat/lon space. Accurate enough for the ~1° × 1° area the project covers.

- `propertyContainsPoint(prop, pt)` — combines the above two:
  - ≥ 3 corners → `pointInPolygon` test.
  - < 3 corners (point / 2-corner edge) → proximity check: any corner within 0.001° (~100 m) of `pt`, wider than the 25 m `<Circle>` drawn on screen.

- `findOverlapping(props, pt)` — filters `withGeometry` to only those passing `propertyContainsPoint`, then sorts descending by `polygonAreaDeg`.

**`Selected` type replaced**

Old (single property):
```tsx
type Selected = { id: string; position: LatLng; label: string };
```
New (multiple properties):
```tsx
type SelectedItem = { id: string; label: string };
type Selected     = { position: LatLng; items: SelectedItem[] };
```

**`handlePropClick` callback** (replaces inline `setSelected` calls in Polygon/Circle onClick and CornerMarker onSelect):
- Calls `findOverlapping(withGeometry, pos)` to build the hit list.
- Guarantees the directly-clicked property (`ownId`) is in the list even if the ray-cast misses a boundary edge — inserts it at the correct sorted position by area.
- Sets `selected` with `{ position: pos, items: overlapping.map(…) }`.

**Updated click triggers**
- `<Polygon onClick>` and `<Circle onClick>`: call `handlePropClick(prop.id, e.detail.latLng ?? centroid(…))`.
- `<CornerMarker onSelect>`: calls `handlePropClick(prop.id, { lat: corner.lat, lng: corner.lon })` — uses the corner's exact coordinates as the click position.

**Updated InfoWindow**
- Iterates `selected.items` (all overlapping properties, largest first).
- Each entry shows the property's nickname (or code fallback) as a bold label + an "Open →" link to `/properties/{id}`.
- Entries after the first are separated by a `border-t border-zinc-200` hairline divider.
- Minimum width `min-w-[160px]` to keep single-property InfoWindows tidy.

**Files touched**
- `src/app/properties/map/property-map.tsx` (rewritten)
- `CLAUDE.md`

### Slice #GIS.13.05 — Land map enhancements + batch delete (detail)

Pure frontend + new API route — no DB schema changes.

**Auto-fit to all properties (`FitAllProperties` inner component)**
- On first load the map viewport fits the smallest bounding box that contains ALL property corners, padded 5 % outward on every edge.
- Implemented as an inner `FitAllProperties` component (must live inside `<Map>` to use `useMap()` + `useMapsLibrary("core")`).
- Uses `new core.LatLngBounds()`, extends it with every corner, computes `latPad = span * 0.05` and `lngPad = span * 0.05`, constructs a `paddedBounds`, then calls `map.fitBounds(paddedBounds, 0)`.
- A `useRef(false)` guard ensures fitBounds runs only once per map mount.
- Falls back to the hardcoded `DEFAULT_CENTER / DEFAULT_ZOOM` (Bragadiru) when there are no properties.

**`mapId` added to `<Map>`**
- Required for `AdvancedMarker` (see CLAUDE.md gotcha). Uses `process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID ?? "DEMO_MAP_ID"`.

**Red corner markers on every property**
- A `CornerMarker` component renders an `AdvancedMarker` with a 10 × 10 px red circle (white 2 px border, drop shadow) at each corner of every property.
- `AdvancedMarker` is a DOM element overlay — its pixel size is **constant at all zoom levels** so even a tiny parcel is always visible as a cluster of red dots.
- Clicking a corner marker opens the same `InfoWindow` as clicking the polygon.
- Rendered in a separate `flatMap` pass so each marker gets its own `key` without needing `Fragment`.

**Selection mode**
- Toolbar button "⬚ Select" (top-right, alongside STR/SAT toggle). Clicking toggles selection mode on/off.
- Active state: button turns red and reads "✕ Cancel select". `gestureHandling="none"` is passed to `<Map>` to disable map panning/zooming during selection.
- Toggling always clears `selectedIds`.

**Drag-to-select rectangle**
- A transparent `div` (class `absolute inset-0 z-10`) sits over the map.
- `pointer-events: none` in pan mode → map works normally. `pointer-events: all` in select mode → captures `onMouseDown/Move/Up`.
- `onMouseDown`: records start pixel relative to the container.
- `onMouseMove`: updates current pixel, draws a live dashed red rectangle.
- `onMouseUp`: converts the four pixel corners to LatLng (via `pixelToLatLng()` — linear interpolation against `map.getBounds()`), finds all properties with at least one corner inside the rect, stores their IDs in `selectedIds`.
- `MapRefCapture` (inner component) writes the `google.maps.Map` instance into an outer ref so `handleMouseUp` can call `mapRef.current.getBounds()`.

**Selection highlighting**
- Properties in `selectedIds` render with `strokeColor / fillColor = "#ef4444"` (red).
- `fillOpacity` rises from 0.15 → 0.30 for polygons, 0.35 → 0.55 for circles.

**"Delete all selected" button**
- Floats bottom-center (`z-20`), visible only when `selectedIds.size > 0`.
- Label: `"Delete all selected (N)"`.

**Confirmation dialog**
- Full-screen semi-transparent overlay (`z-30`), white card, message: `"This [N] of properties will be erased from the system."`.
- Buttons: **Cancel** (dismisses dialog, preserves selection) and **Approve** (calls `POST /api/properties/batch-delete`, then invalidates all `["properties"]` queries, clears selection, exits select mode).
- Error message shown in the dialog on failure. "Deleting…" spinner on Approve while in-flight.

**New API route (`src/app/api/properties/batch-delete/route.ts`)**
- `POST /api/properties/batch-delete`
- Body validated with Zod v4: `{ ids: string[] }` — array of UUIDs, 1–1000 items.
- Single drizzle UPDATE: `SET deleted_at = now() WHERE id IN (...) AND deleted_at IS NULL`.
- Returns `{ deleted: number }` — count of rows actually updated.

**Files touched**
- `src/app/properties/map/property-map.tsx` (rewritten)
- `src/app/api/properties/batch-delete/route.ts` (new)
- `CLAUDE.md`

### Slice #GIS.13.03 — Add Property from text file / text folder (detail)

Pure frontend + new API route — no DB schema changes.

**Entry point change (`src/app/properties/_components/add-property-dialog.tsx`)**
- "choice" step expanded from 2 cards to 4: Manual data entry | From a scanned image | From a text file | From a text folder.
- New steps added to the step machine: `"upload-text"`, `"upload-folder"`.
- `"saving"` step now driven by a `savingLabel` string state — shared across all save paths (scan, text, folder).
- `createProperty` helper updated: accepts optional `nickname` parameter, included in the POST body when provided.

**Text file flow (`"upload-text"` step)**
- File input `accept=".txt,text/plain"`. "Import" button enabled once a file is selected.
- On "Import": calls `POST /api/properties/parse-text` → gets WGS84 corners → calls `POST /api/properties` with corners + nickname from filename (extension stripped). Navigates to the created property on success.
- Errors surface in-step with a Back button to return to choice.

**Folder flow (`"upload-folder"` step)**
- File input with `webkitdirectory` attribute — opens a native folder picker.
- After folder is selected, `.txt` files are filtered from `e.target.files` and listed in a scrollable preview box.
- "Import all" button processes each `.txt` file sequentially: parse → save. Files that yield zero corners or encounter errors are skipped (counted silently). Progress shown as "Importing… (N / Total)".
- After all imports complete, shows `folderImportDone` message briefly, then navigates to each saved property in sequence (1 500 ms apart).

**New API route (`src/app/api/properties/parse-text/route.ts`)**
- `export const runtime = 'nodejs'` (stereo70ToWgs84 needs fs).
- Accepts `multipart/form-data` with a `file` field (text file).
- Reads file as UTF-8 text. Skips first 3 lines unconditionally (header / title lines).
- Remaining lines: split on whitespace/comma/tab/semicolon/pipe. Accepts lines where token 0 is an index (1–9 999), token 1 (X column) is a Stereo70 Northing (100 000–999 999), token 2 (Y column) is a Stereo70 Easting (100 000–999 999).
- Column mapping: X [m] → Northing → `north`; Y [m] → Easting → `east` (Romanian geodetic convention — see Gotchas).
- Returns `{ corners: { lat, lon }[] }`. Empty array = no valid rows.

**i18n**
- Added `property.addDialog.choiceTextFile`, `choiceTextFileDesc`, `choiceTextFolder`, `choiceTextFolderDesc`, `uploadTextTitle`, `uploadTextLabel`, `uploadTextHint`, `uploadFolderTitle`, `uploadFolderLabel`, `uploadFolderHint`, `uploadFolderFilesFound`, `uploadFolderNoFiles`, `importButton`, `importAllButton`, `processingText`, `processingFolder`, `noCoordinatesFound`, `folderImportDone` to both `messages/en-GB.json` and `messages/ro-RO.json`.

**CLAUDE.md**
- Added "Coordinate axis order in Romanian cadastral text files" gotcha (X = Northing, Y = Easting).
- Added "Slice #GIS.13.03" to slice progress list.

**Files touched**
- `src/app/properties/_components/add-property-dialog.tsx`
- `src/app/api/properties/parse-text/route.ts` (new)
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #GIS.13.02 — Add Property from scanned image (detail)

Pure frontend + new API route — no DB schema changes.

**Entry point change (`src/app/properties/list-view.tsx`)**
- The `<Link href="/properties/new">` "Add new Property" button replaced with a `<button>` that opens `<AddPropertyDialog />`.
- Dialog state (`showAddDialog`) lives in `PropertyListView`.

**New component (`src/app/properties/_components/add-property-dialog.tsx`)**

Multi-step modal with these states:

- **"choice"**: Two large clickable cards — "Manual data entry" (navigates to `/properties/new`, closes the dialog) and "From a scanned image".
- **"upload"**: Drag-target file input accepting all image formats (`image/*`). "Process image" button calls the OCR API.
- **"processing"**: Spinner while the API works.
- **"select"**: Shown only when ≥2 property corner-groups are detected. Radio buttons let the user choose how many to save (1 … N). Each option shows the detected corner count.
- **"saving"**: Spinner + progress counter while `POST /api/properties` runs for each selected group.

After all saves complete, the dialog closes and `router.push` navigates to each saved property's detail page in sequence (1 500 ms apart for subsequent ones).

All labels found in the image are joined with three spaces (`   `) and written into every saved property's `notes` field.

**New API route (`src/app/api/properties/scan-image/route.ts`)**
- `export const runtime = 'nodejs'` and `maxDuration = 60`.
- Accepts `multipart/form-data` with an `image` field (any image file).
- Runs `tesseract.js` (`createWorker(["ron", "eng"])`) on the uploaded buffer.
- Parses OCR output line by line: lines with ≥2 tokens in the Stereo70 integer range (100 000–999 999) are treated as corner rows (first = North, second = East). All other tokens are labels.
- Consecutive coordinate rows form one corner group; a blank/non-coordinate line closes it (minimum 3 corners required to form a valid group).
- Converts each group's corners Stereo70 → WGS84 using `stereo70ToWgs84` from `src/lib/geo/transdatRO.ts` (server-side — has grid-file access). Groups that fall outside grid coverage are silently dropped.
- Returns `{ properties: { corners: {lat, lon}[] }[], labels: string[] }`.

**Form schema change (`src/app/properties/_components/form-schema.ts`)**
- `notes` max raised from 300 → 2 000 characters to accommodate OCR label strings.

**New npm dependency**
- `tesseract.js ^5.1.1` added to `package.json`. Run `npm install` after pulling.

**i18n**
- Added `property.addDialog.*` namespace to both `messages/en-GB.json` and `messages/ro-RO.json`.

**Files touched**
- `src/app/properties/list-view.tsx`
- `src/app/properties/_components/add-property-dialog.tsx` (new)
- `src/app/api/properties/scan-image/route.ts` (new)
- `src/app/properties/_components/form-schema.ts`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `package.json`
- `CLAUDE.md`

### Slice #11.vercel.02 — Vercel/Supabase full reset + re-seed (detail)

Full sync of the cloud environment to match local dev after 16+ unpushed commits had accumulated.

**What changed**

**Git / deployment**
- Pushed 16 unpushed commits (Slices 10.07 → 12.01) to `origin/main`; Vercel auto-deployed.
- Fixed and committed 26 source files that had been corrupted on disk (trailing null bytes or mid-line truncation). Root cause: the Linux sandbox mount reads stale file sizes; the actual Windows disk content was correct for most, but `property-persons-tab.tsx` and `associate-person-view.tsx` genuinely had corruption that had to be reconstructed. A full scan (`git ls-files | wc -c vs git show HEAD | wc -c`) is the reliable detection method.
- Fixed 3 stale TypeScript references to the old `judicial_person` text columns (`contactPerson1` / `contactPerson2`) that were not updated when Slice 12.01 replaced them with FK columns. Files: `src/__tests__/judicial-person.test.ts`, `scripts/seed-judicial-persons.ts`. These caused `next build` to fail TypeScript checking.

**Supabase**
- Added `src/db/supabase_reset.sql` — drops all application objects cleanly (use before re-applying schema).
- Added `src/db/supabase_schema_full.sql` — complete schema from scratch in one file; combines all drizzle migrations (0000–0007) and src/db migrations (008–018). Fixes `lookup_document_type` row 6 name (`'Certificat de Moștenitor'`, not the typo from migration 0002). PostGIS index uses `CAST(... AS geography)` not `::geography` (Supabase rejects `::` in functional index expressions).
- Applied both SQL files in Supabase SQL Editor to reset and recreate the schema.
- Ran `npm run seed:admin` via the session pooler URL (port 5432) — the pooler supports prepared statements, unlike transaction mode (port 6543).

**Supabase connection strings (important)**
- The project ref is the alphanumeric ID in the dashboard URL: `supabase.com/dashboard/project/[PROJECT_REF]`. It is NOT the project name.
- Connection strings are found via the **Connect** button at the top of the Supabase project dashboard (UI changed — no longer under Project Settings → Database).
- Session pooler (port 5432): `postgres://postgres.[REF]:[password]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres` — supports both IPv4/IPv6 and prepared statements; use for seeding.
- Transaction pooler (port 6543): used by the live Vercel app (`DATABASE_URL`).
- Direct connection (port 5432 at `db.[REF].supabase.co`): IPv6 only by default; not usable on most Windows machines without the IPv4 add-on.

**Seed**
- Re-seeded via `$env:DATABASE_URL = "..."` + `$env:NODE_ENV = "production"` + `npx tsx src/db/seed.ts`.
- Re-created admin user via `npm run seed:admin` (loads `.env` for Supabase credentials automatically).

**Files touched**
- `src/db/supabase_reset.sql` (new)
- `src/db/supabase_schema_full.sql` (new)
- `src/__tests__/judicial-person.test.ts`
- `scripts/seed-judicial-persons.ts`
- `src/app/properties/_components/property-persons-tab.tsx` (null bytes removed)
- `src/app/paperwork/[id]/associate-person/associate-person-view.tsx` (truncation reconstructed)
- `src/app/paperwork/_components/paperwork-persons-tab.tsx` (null bytes removed)
- `CLAUDE.md`

### Slice #12.01 — Judicial Person form refactor (detail)

Pure frontend + DB schema + query layer. No new pages or routes beyond a small extension to the existing people search API.

**What changed**

**DB migration (`src/db/migration_018_judicial_contact_persons.sql`)**
- `DROP COLUMN contact_person_1` and `DROP COLUMN contact_person_2` — these were explicitly marked as "temporary free-text placeholders" in the schema comment.
- `ADD COLUMN contact_person_1_id uuid REFERENCES person(id) ON DELETE SET NULL` — nullable FK to a natural person row. ON DELETE SET NULL means deleting the linked person clears the reference without cascading.
- `ADD COLUMN contact_person_2_id uuid REFERENCES person(id) ON DELETE SET NULL` — same, for the second contact.
- `ADD COLUMN correspondence_same_as_hq boolean NOT NULL DEFAULT false` — when true, no CORRESPONDENCE address row is stored; the UI hides the correspondence fields.

**Schema (`src/db/schema/index.ts`)**
- Replaced `contactPerson1: text` + `contactPerson2: text` with FK uuid columns and the boolean flag in `judicialPerson`.

**Query layer (`src/lib/judicial-persons/queries.ts`)**
- `JudicialPersonFull` type extended: added `contactPerson1Name: string | null` and `contactPerson2Name: string | null`.
- `getJudicialPersonById`: resolves display names for the two contact person FKs via two separate single-row selects (using aliased `person` table). Returns names alongside the main record so the UI can render them without a second fetch.
- `createJudicialPerson` / `updateJudicialPerson`: thread `contactPerson1Id`, `contactPerson2Id`, `correspondenceSameAsHq` through.

**Person search (`src/lib/persons/queries.ts` + `src/app/api/people/search/route.ts`)**
- `searchPersonsAll` gains an optional `type?: "NATURAL" | "JUDICIAL"` parameter that filters results to a single type.
- The `GET /api/people/search` route exposes this as an optional `?type=` query param.
- The contact-person picker passes `?type=NATURAL` to ensure only natural persons are shown.

**Validation (`src/lib/judicial-persons/validation.ts`)**
- Removed `contactPerson1` / `contactPerson2` string fields.
- Added `contactPerson1Id: z.string().uuid().nullish()`, `contactPerson2Id: z.string().uuid().nullish()`, `correspondenceSameAsHq: z.boolean().default(false)`.

**Form schema (`src/app/judicial-persons/_components/form-schema.ts`)**
- `FormValues`: replaced `contactPerson1/2` strings with `contactPerson1Id/2Id` (string, empty = not linked) and `contactPerson1Name/2Name` (display-only, never sent to API). Added `correspondenceSameAsHq: boolean`.
- `fromApiPayload`: populates the new fields from the enriched `JudicialPersonFull` response (including `contactPerson1Name` / `contactPerson2Name`).
- `toApiPayload`: maps `contactPerson1Id` empty string → null; when `correspondenceSameAsHq` is true, omits the CORRESPONDENCE address from the payload.
- Correspondence address validation refinement only fires when `correspondenceSameAsHq` is false.

**Page (`src/app/judicial-persons/[id]/page.tsx`)**
- `fromApiPayload` call extended to pass `contactPerson1Name` and `contactPerson2Name` from the enriched query result.

**Form component (`src/app/judicial-persons/_components/judicial-person-form.tsx`)**

*Contact Persons panel* — single `<section>` titled "Contact Persons" replacing the two old single-field sections:
- `ContactPersonRow`: for each slot, shows either a hyperlink to `/natural-persons/{id}` (when linked) + a Remove button, or an "+ Add contact person" button (when empty). View mode suppresses buttons.
- `ContactPersonPickerDialog`: inline modal with name+code search, paginated table (15/page), radio-select, filtered to `type=NATURAL`. Confirms with a "Select" button. Has a note: "If the person is not in the system, they must be entered first using the Natural Person functionality." ESC closes the modal.
- Translation hooks (`useAddressTranslations`, `useContactPickerTranslations`) called at the top of the component and passed as props — not called inside JSX (Rules of Hooks).

*Office Address panel* — single `<section>` titled "Office Address" replacing the two `<AddressBlock>` cards:
- "Registered Address" subsection label + inline fields (6 fields, same layout as AddressBlock).
- "Correspondence Address" subsection label with "Same as registered address" checkbox inline on the right. When checked: the correspondence fields are hidden entirely (not just disabled); `correspondenceSameAsHq = true` is written to form state. When unchecked: fields render and validate normally.
- `AddressFields` helper renders the 3-row field grid; replaces use of the shared `AddressBlock` component (which renders its own `<section>` card — unsuitable here since both blocks share one card).

**i18n** (both `messages/en-GB.json` and `messages/ro-RO.json`)
- `judicialPerson.sections`: removed `contactPerson1`, `contactPerson2`, `headquartersAddress`; added `contactPersons`, `officeAddress`, `registeredAddress`.
- `judicialPerson.fields`: added `sameAsRegistered`.
- `judicialPerson.actions`: added `addContactPerson`, `removeContactPerson`.
- `judicialPerson.contactPersonPicker`: full namespace for the picker modal.
- `judicialPerson.hints`: added `contactPersonNotInSystem`.

**Files touched**
- `src/db/migration_018_judicial_contact_persons.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/judicial-persons/queries.ts`
- `src/lib/judicial-persons/validation.ts`
- `src/lib/persons/queries.ts`
- `src/app/api/people/search/route.ts`
- `src/app/judicial-persons/_components/form-schema.ts`
- `src/app/judicial-persons/_components/judicial-person-form.tsx`
- `src/app/judicial-persons/[id]/page.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #10.07 — Role on Document ↔ Person association (detail)

DB + schema + query layer + API + UI + i18n.

**What changed**

**DB migration (`src/db/migration_017_person_paperwork_role.sql`)**
- `ALTER TABLE person_paperwork ADD COLUMN IF NOT EXISTS person_role_id uuid REFERENCES lookup_person_role(id) ON DELETE SET NULL;`
- Nullable — role is optional on every association.
- `ON DELETE SET NULL` — if the role is removed from `lookup_person_role`, the association keeps the person but loses the role tag.

**Schema (`src/db/schema/index.ts`)**
- Added `personRoleId` (nullable FK → `lookupPersonRole.id`, `onDelete: "set null"`) to `personPaperwork`.

**Query layer (`src/lib/paperwork/queries.ts`)**
- `PaperworkPersonItem` type: added `roleName: string | null`.
- `listPaperworkPersons`: added `leftJoin(lookupPersonRole, ...)` to pull the role name. Returns `null` when no role is set.
- `associatePersonsToPaperwork`: added optional `personRoleId: string | null = null` fourth argument. Included in the insert values.
- `PAPERWORK_TYPE_TO_DOC_TYPE_NAME`: static map from paperwork type enum values to `lookup_document_type.name` strings (used to filter the role dropdown by document type). All 19 types are mapped; `CERTIFICAT_SARCINI` maps to `"Certificat de Bunuri"` (confirmed via `SELECT name FROM lookup_document_type WHERE sort_order = 7`). `ACT_DONATIE` and `TESTAMENT` have no seed associations and return empty lists.
- `listPersonRolesForPaperwork(paperworkId)`: resolves the document's type, finds its `lookup_document_type` entry by name, then returns person roles from `lookup_doc_type_person_role` for that document type. Returns `[]` when the type has no associations.

**New API (`src/app/api/paperwork/[id]/valid-person-roles/route.ts`)**
- `GET /api/paperwork/[id]/valid-person-roles` → `{ items: [{ id, name }] }`.
- Returns roles valid for this document's type; empty array for types with no associations.

**API (`src/app/api/paperwork/[id]/persons/route.ts`)**
- POST body schema extended: `personRoleId: z.string().uuid().nullable().optional()`.
- Passes `personRoleId` through to `associatePersonsToPaperwork`.

**Document Persons tab (`src/app/paperwork/_components/paperwork-persons-tab.tsx`)**
- `AssociatedPerson` type: added `roleName: string | null`.
- Table 3rd column: replaced `colType` (Natural/Judicial) → `colRole` (role name or `—`).
- Removed `typeNatural` / `typeJudicial` translation usage from this component.

**Associate Person page (`src/app/paperwork/[id]/associate-person/`)**
- `page.tsx`: passes `paperworkType={record.type}` to `AssociatePersonView`.
- `associate-person-view.tsx`: added `paperworkType` prop, `RoleItem` type, `fetchValidRoles()` calling `GET /api/paperwork/[id]/valid-person-roles`, `selectedRoleId` state. Role `<select>` dropdown rendered between the pagination controls and action buttons — only shown when the document type has at least one valid role defined. POST body includes `personRoleId: selectedRoleId || null`. The person picker table retains its `colType` column (Natural/Judicial) — only the Persons tab list column was replaced.

**i18n**
- `paperwork.persons`: removed `colType`, `typeNatural`, `typeJudicial`; added `colRole`.
- `paperwork.associatePerson`: added `labelRole`, `rolePlaceholder` (EN: "— no role —" / RO: "— fără rol —").

**Note on CERTIFICAT_SARCINI**: Confirmed as `"Certificat de Bunuri"` in `lookup_document_type` (sort_order = 7). The mapping is included in `PAPERWORK_TYPE_TO_DOC_TYPE_NAME`.

**Git commits already tagged 10.07 (pre-existing)**
- `96ac0ba` / `d162969`: Role column + dropdown on the *Person* detail page's Properties tab (person-properties-tab.tsx + associate-property-view.tsx from the person side) — reverse direction, done separately.

**Files touched**
- `src/db/migration_017_person_paperwork_role.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/paperwork/queries.ts`
- `src/app/api/paperwork/[id]/valid-person-roles/route.ts` (new)
- `src/app/api/paperwork/[id]/persons/route.ts`
- `src/app/paperwork/_components/paperwork-persons-tab.tsx`
- `src/app/paperwork/[id]/associate-person/associate-person-view.tsx`
- `src/app/paperwork/[id]/associate-person/page.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

### Slice #10.06 — Role on Property ↔ Person association (detail)

DB + schema + query layer + API + UI + i18n.

**What changed**

**DB migration (`src/db/migration_016_property_person_role.sql`)**
- `ALTER TABLE property_person ADD COLUMN IF NOT EXISTS person_role_id uuid REFERENCES lookup_person_role(id) ON DELETE SET NULL;`
- Nullable — role is optional on every association.
- `ON DELETE SET NULL` — if the role is removed from `lookup_person_role`, the association keeps the person but loses the role tag.

**Schema (`src/db/schema/index.ts`)**
- Added `personRoleId` (nullable FK → `lookupPersonRole.id`, `onDelete: "set null"`) to `propertyPerson`.

**Query layer (`src/lib/properties/queries.ts`)**
- `PropertyPersonItem` type: added `roleName: string | null`.
- `listPropertyPersons`: added `leftJoin(lookupPersonRole, ...)` to pull the role name. Returns `null` when no role is set.
- `associatePersonsToProperty`: added optional `personRoleId: string | null = null` third argument. Included in the insert values when provided.

**API (`src/app/api/properties/[id]/persons/route.ts`)**
- POST body schema extended: `personRoleId: z.string().uuid().nullable().optional()`.
- Passes `personRoleId` through to `associatePersonsToProperty`.

**Property Persons tab (`src/app/properties/_components/property-persons-tab.tsx`)**
- `AssociatedPerson` type: added `roleName: string | null`.
- Table 3rd column: replaced `colType` (Natural/Judicial) → `colRole` (role name or `—`).
- Removed `typeNatural` / `typeJudicial` translation usage from this component.

**Associate Person page (`src/app/properties/[id]/associate-person/associate-person-view.tsx`)**
- Added `RoleItem` type and `fetchRoles()` helper fetching `GET /api/admin/property-person-roles`.
- Added `selectedRoleId: string` state (empty string = no role).
- Role `<select>` dropdown rendered between the pagination controls and the action buttons. Options: blank "— no role —" + whitelist items from `lookup_property_person_role`. The selected role applies to all persons being associated in that batch.
- POST body now includes `personRoleId: selectedRoleId || null`.
- The person picker table retains its `colType` column (Natural/Judicial) — only the Persons tab list column was replaced.

**i18n**
- `property.persons`: removed `colType`, `typeNatural`, `typeJudicial`; added `colRole`.
- `property.associatePerson`: added `labelRole`, `rolePlaceholder` (EN: "— no role —" / RO: "— fără rol —").

**Files touched**
- `src/db/migration_016_property_person_role.sql` (new)
- `src/db/schema/index.ts`
- `src/lib/properties/queries.ts`
- `src/app/api/properties/[id]/persons/route.ts`
- `src/app/properties/_components/property-persons-tab.tsx`
- `src/app/properties/[id]/associate-person/associate-person-view.tsx`
- `messages/en-GB.json`
- `messages/ro-RO.json`
- `CLAUDE.md`

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
- **Sandbox file drift from Windows.** Occasionally the Linux sandbox shows files as deleted/added when Adrian's Windows side is clean. Don't react to it — verify on his side. `tsc --noEmit` in the sandbox also shows phantom JSX parse errors on perfectly valid files that are already committed; these are sandbox artefacts, not real errors. Always verify with `git diff` on Adrian's side.
- **Outputs-scratchpad sync lag (Windows-tool writes → bash reads), one-directional.** When editing a large file in the temporary outputs scratchpad (e.g. a docx `document.xml` during an unpack → edit → pack cycle), edits made via the Read/Edit/Write tools can take a long time (confirmed 40+ minutes, not resolved by `sleep`/`sync` retries) to become visible to bash `cat`/`wc` on the same nominal path — bash sees a stale, truncated snapshot. The reverse direction is reliable: anything written via bash is visible to the Windows-side tools immediately. Symptom: `pack.py` (which runs in bash) reports a premature/truncated XML error even though the Windows-side `Read` tool shows the file as complete and well-formed — this is the scratchpad lag, not a real XML mistake. Workaround: pull the correct content via `Read` (in chunks if the file is long) and write it into the bash-mounted path using a bash-native command (e.g. `cat >> file << 'EOF' ... EOF`) instead of the Edit/Write tools, then re-run the bash-side step. This is specific to the outputs scratchpad, not the `ga40prj` mounted folders.
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
- **Coordinate axis order in Romanian cadastral text files**: The file columns are labeled `X [m]` (= Northing, ~300 000–850 000) and `Y [m]` (= Easting, ~200 000–800 000). This is the local Romanian geodetic convention where X points North — **opposite** to GDAL/PostGIS standard (X = Easting, Y = Northing). When calling `stereo70ToWgs84(north, east)`: pass the X column as `north` and the Y column as `east`. Valid Stereo70 range for the project area (Bragadiru, Ilfov): Northing ~320 000–325 000, Easting ~575 000–585 000.
- **`pg_dump` schema dump includes PostGIS `topology` schema — causes init conflict.** A schema-only `pg_dump` captures `CREATE SCHEMA topology;`. When this is used as a `docker-entrypoint-initdb.d` init script alongside `01-extensions.sql` (which creates `postgis_topology` and thus the `topology` schema first), psql hits `ERROR: schema "topology" already exists` at that line and aborts the entire script with `ON_ERROR_STOP=on` — no tables are created. Fix: change `CREATE SCHEMA topology;` → `CREATE SCHEMA IF NOT EXISTS topology;` in the dump file before shipping it in the Ciprian package.
- **`pg_dump` on Windows → UTF-16LE corruption.** PowerShell's `>` redirection saves files as UTF-16LE with BOM (`FF FE`). PostgreSQL's `psql` expects UTF-8; when it processes a UTF-16LE init file, the null bytes between each character corrupt SQL parsing and diacritics. **Never use `docker exec ... pg_dump > file.sql`.** Always let pg_dump write to the container filesystem, then copy out:
    ```powershell
    docker exec ga40prj-postgres pg_dump -U postgres ga40db -f /tmp/dump.sql
    docker cp ga40prj-postgres:/tmp/dump.sql ./dump.sql
    ```
    If you already have a suspect file, detect and fix encoding with:
    ```bash
    file 02-schema.sql   # "Unicode text, UTF-16" → bad; "ASCII text" or "UTF-8" → good
    iconv -f UTF-16LE -t UTF-8 02-schema.sql -o 02-schema-fixed.sql
    sed -i 's/\r//' 02-schema-fixed.sql          # strip CRLF
    sed -i '1s/^\xEF\xBB\xBF//' 02-schema-fixed.sql  # strip UTF-8 BOM if present
    ```
- **Non-ASCII characters in `.ps1` files break under Windows PowerShell 5.1.** Adrian's environment is Windows PowerShell 5.1 (not PowerShell 7+), which parses a `.ps1` file using the system codepage whenever the file has no UTF-8 BOM — and the file-writing tools used in this project save plain UTF-8 without a BOM. Any decorative non-ASCII character (box-drawing `─`/`│`, smart quotes, em-dashes, etc.) embedded in a script string or comment comes out as mojibake and can break tokenization entirely (`ParserError: UnexpectedToken`) — this hit `build-ciprian-image.ps1` in Slice #15.15 (see detail below). **Stick to plain ASCII in every `.ps1` file** — use `----`/`====` for decorative dividers (already the established style elsewhere in this script), not Unicode line-drawing characters.
- **Relative paths break raw `[System.IO.File]` calls in `.ps1` scripts, even when native commands in the same script work fine.** PowerShell cmdlets and external processes (`docker cp`, `docker exec`, etc.) resolve relative paths against PowerShell's own session location (`$PWD`). Raw .NET static calls — `[System.IO.File]::ReadAllText`/`WriteAllText`, etc. — instead resolve relative paths against the separate, process-wide `[Environment]::CurrentDirectory`, which can silently diverge from `$PWD` (confirmed on Adrian's machine, where it had drifted to `C:\Windows\`, even though `$PWD` and every `docker` call were correctly anchored at `C:\dev\ga40prj\`). This hit `build-ciprian-image.ps1` in Slice #15.15 (see detail below) — a `docker cp` succeeded against the right path moments before a `[System.IO.File]::ReadAllText` call on a path derived the same way threw `DirectoryNotFoundException`. **Always resolve to an absolute path first** (`$repoRoot = $PSScriptRoot`; `[System.IO.Path]::GetFullPath((Join-Path $repoRoot "..\relative\path"))`) before handing any path to a raw `[System.IO.File]` call.
- **Ciprian UAT schema + reference-data delivery (rewritten — see UC-C6, `GA40.Operations.Guide.05.docx`).** Every DB schema change of any kind, no matter how small, is delivered to Ciprian as a single fixed-name file: `ciprian-schema-update.sql`, placed at the root of `C:\dev\ga40prj.Ciprian\`. It is **fully regenerated, never hand-edited**, every time `build-ciprian-image.ps1` runs (its Step 5). There is nothing for Adrian to "identify" before sending it — same filename every time, contents always complete and current.
    **What the file contains, assembled automatically from the live `ga40prj-postgres` container at build time:** (1) `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` — a full wipe; (2) Ciprian's own `01-extensions.sql` content (PostGIS/topology); (3) a fresh `pg_dump --schema-only` of the current dev schema (same dump used for `02-schema.sql`); (4) a fresh `pg_dump --data-only -t 'lookup_*'` of every lookup table, pulled live from dev — **not** from `src/db/sync-reference-data.sql` or any other file in the repo. There is no hand-maintained seed file in this path at all, so it cannot drift out of sync the way `sync-reference-data.sql` / the (still-missing) `npm run export:reference-data` script previously did.
    **This means every schema update wipes Ciprian's entire UAT database** — operational data and reference data alike — and rebuilds it to exactly match dev. Confirmed acceptable by Adrian: at this stage Ciprian's UAT data does not need to survive between rounds.
    **Adrian never runs commands against `ciprian-ga40prj-postgres` himself** — that container lives on Ciprian's PC, not Adrian's. Delivery to Ciprian's UAT environment always goes through `C:\dev.docs\ga40prj\02.Operations.Guides\GA40.Operations.Guide.05.docx`:
    - **Any slice with a schema or reference-data change** (the common case): follow **UC-C6** — Adrian runs `.\build-ciprian-image.ps1`, which produces both `ga40prj-app.tar` and `ciprian-schema-update.sql`; sends both to Ciprian. Ciprian replaces both files, runs `update.bat`, then applies `ciprian-schema-update.sql` with the two literal `docker cp` / `docker exec psql` commands in UC-C6 — no placeholders, same commands every time.
    - **Code-only slice, no DB change**: follow **UC-C5** — only `ga40prj-app.tar` is sent; the database is untouched.
    - **Full database reset with no new app version to deliver** (UAT data corrupt / clean slate, but nothing else changed): follow **UC-C8**.
    - `src/db/sync-reference-data.sql` and `npm run export:reference-data` are **not** part of the Ciprian flow anymore. `sync-reference-data.sql` is still in the repo as a general-purpose seed script (e.g. for Supabase or a fresh teammate's Docker volume) but is no longer Ciprian's source of truth and does not need to be kept current for Ciprian's sake.
- **Docker Compose `--env-file` does NOT inject every `.env` variable into a container.** `--env-file .env` (used by every `start.bat`/`stop.bat`/`update.bat` in Ciprian's package) only makes `.env` values available for `${VAR}` substitution *inside the compose YAML itself* — e.g. to fill in `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}` in a service's `environment:` block. It does **not** automatically forward every `.env` key into `process.env` inside the running container. A variable that's only present in `.env` but never referenced in the service's own `environment:` block (by name, as `KEY: ${KEY}` or a literal) is invisible to the app, even though it's "right there in the .env file" — confirmed as the root cause of Ciprian seeing "ANTHROPIC_API_KEY is not configured" in Slice #15.16 despite the key being present in his `.env` the whole time. **Whenever a new env var is added to `.env.example` that the running app needs to read, also add a matching line to the relevant `environment:` block in every `docker-compose.yml` that runs that app** — local dev's `docker/postgres/docker-compose.yml` and Ciprian's `C:\dev\ga40prj.Ciprian\docker\postgres\docker-compose.yml` are two separate files and both need the addition independently.
- **Ciprian's UAT container runs with `NODE_ENV=production` but no real Supabase project.** Code that branches purely on `NODE_ENV === "production"` to decide "use the real cloud backend" (e.g. the original `src/lib/storage/index.ts`) will try to call Supabase in Ciprian's environment and fail, since he intentionally has no Supabase credentials configured (`UAT_NO_AUTH=true` is the existing precedent for this same gap on the auth side). As of Slice #15.16, document-page file storage has its own override: `LOCAL_FILE_STORAGE=true` in a service's `environment:` block forces the local-filesystem code path in `src/lib/storage/index.ts` and `src/app/api/files/[...path]/route.ts` even with `NODE_ENV=production`. If a future feature adds another "real backend required" code path, check whether it needs the same kind of override for Ciprian's stack rather than assuming `NODE_ENV` alone is a safe signal.
- **OCR (Tesseract) — label text fuses with coordinate tokens.** When a scanned cadastral table has row-label text in the left margin (e.g. `"SE A"`, parcel names, or decorative characters), Tesseract reads the label and the first numeric token on that row as one fused string — e.g. `"SE A 1 321762.117"` becomes `"11321762.117"`. This is always the **first data row** (corner 1) because subsequent rows have only a small corner-index digit in the margin, not a word. The extra characters add multiple leading digits to the coordinate, not just one. The parser handles this via `trySplitMergedToken` (tries stripping 1–3 leading digits) + rescue-2b in `parseTableFormat`. If a future scan skips corner 1 again: add `console.log(rawText)` at the top of `parseOcrText` and `console.log("Pass 0:", JSON.stringify(parseTableFormat(rawText)))` below it, run `npm run dev`, scan the image, and inspect the terminal. The raw text immediately shows what Tesseract produced.
- **OCR (Tesseract) — common digit confusions.** Tesseract confuses `l` (lowercase L) with `1`, `I` (uppercase i) with `1`, and `O` (uppercase letter O) with `0`. The `fixOcrDigits` helper in `scan-image/route.ts` corrects these before any numeric parsing. If a coordinate still doesn't parse, check the raw OCR text for these substitutions.
- **OCR (Tesseract) — do not pre-filter lines by keyword.** Removing lines that contain "Suprafata", "Perimetru", etc. before parsing is tempting (those are area/perimeter rows, not corners). Don't do it: OCR sometimes merges the column-header row (which may contain those words) with the first data row, and the keyword filter discards the entire merged line including the real corner coordinates. Let the coordinate-range checks reject out-of-range values naturally.

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
