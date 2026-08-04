---
name: add-entity-versioning
description: Add full-snapshot version history to an entity (version table, v0 backfill, diff helpers, version-nav UI, highlight frames). Use when a slice asks to version a new entity, or when changing how Property/Person/Document versioning behaves.
---

# Adding versioning to an entity

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

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
9. **Sandbox toolchain limits — see the authoritative gotcha below, not this line.** This pitfall used to say `tsc`/`jest`/`tsx` all fail in the sandbox. That is wrong about `tsc`, which is pure JavaScript and unaffected by the Windows-only native binaries. The current, correct statement lives in "The sandbox CAN run `tsc` …" under **Gotchas we've learned**; read it there, including the case where even `tsc` is out of reach. **Adrian still runs `npm run e2e` (dev server running separately) then `npm run lint` + `npx jest`** on his machine before committing — that has not changed.

## Harvested from the slice log

- **New-entity data travels in the `POST` body so it lands in version 0 — never create-then-patch.** This includes a Property's corners and its `tarla` / `parcela` values: creating the row first and PATCHing the rest in afterwards opens the entity's history with an edit nobody made. `propertyCreateSchema` derives from the Drizzle table and already accepts these fields, so there is nothing to add — put every known value in the create body.
