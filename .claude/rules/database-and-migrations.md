---
paths:
  - "src/db/**"
  - "drizzle/**"
  - "drizzle.config.ts"
  - "scripts/**/*.ps1"
  - "src/lib/**/queries.ts"
  - "docker/postgres/**"
---

# Database, schema & migrations

<!-- Extracted verbatim from CLAUDE.md (Slice 24.01.optimization). Original line numbers in brackets. -->

- **Drizzle `sql` template: a column object interpolated into a *correlated subquery* renders UNQUALIFIED.** Inside a `sql`` ` fragment used as a correlated subquery, `${someTable.id}` emits a bare `"id"` (not `"table"."id"`). If the subquery's own FROM exposes an `id` (e.g. it joins `group_member` + `property`), Postgres either rejects it as `column reference "id" is ambiguous` (SQLSTATE 42702) or — worse — silently binds it to the wrong table. Fix: reference the outer column as a **literal qualified name** in the template (e.g. `WHERE gm.group_id = groups.id`, not `= ${groups.id}`). Hit in Slice #18.07 (`listGroups` member-count + `getGroupDetail` candidate `otherGroupCount`/`NOT EXISTS`).

- **Migration file workflow — Claude follows these steps every time:**
  1. **Claude saves** the migration file to `src/db/<filename>.sql` (never just pastes SQL into chat).
  2. **Claude tells Adrian** to run `scripts\Apply-Migration.ps1` — that script compares `schema_migrations` against the files in `src/db/` and applies anything pending. Claude never provides manual `docker cp` + `psql -f` commands for a normal migration; just say "run `scripts\Apply-Migration.ps1`".
  3. **Claude states the filename** (e.g. `src/db/migration_035_seed_doc_types.sql`) so Adrian knows exactly which file to open.
  4. **Adrian pastes** that file's contents into the Supabase SQL Editor to apply it to the cloud database.

  **Exception — manual apply only when the script can't help:** if `schema_migrations` already has a false entry for a migration that was never actually run (the migration_056 backfill bug, hit in Slice #19.28), the script will skip it. In that case apply the specific file(s) directly:
  ```powershell
  docker cp src/db/migration_NNN_name.sql ga40prj-postgres:/tmp/mNNN.sql
  docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/mNNN.sql
  ```

- **Entity code prefixes are `DOC` / `JPERS` / `PPERS` / `PROP`, never `PERS`.** `src/db/schema/index.ts` said "PERS00001" in three places (the header comment, `principal_object.code`, `person.code`). The real expressions are `'PPERS' || lpad(nextval('principal_object_code_seq')::text, 5, '0')` and friends in `src/lib/{documents,judicial-persons,persons,properties}/queries.ts`. Fixed in the comments themselves — they are code, not an applied migration. Their **lexicographic order (DOC < JPERS < PPERS < PROP) is load-bearing**, which is how the global-search truncation bug picked documents to keep.

- **`migration_053_full_text_search.sql` does not create full-text search.** It enables `pg_trgm` and creates GIN **trigram** indexes so `ILIKE '%term%'` stays fast; there is no `tsvector` anywhere in `src/`. Its header comment also still points at `/admin/complex-query`, a route that only redirects. ⚠️ **Both are recorded here rather than fixed in the file, deliberately.** `scripts/Apply-Migration.ps1` records an MD5 of each migration at apply time (`Get-FileHash -Algorithm MD5` → `schema_migrations.checksum`, inserted `ON CONFLICT DO NOTHING`). Editing an already-applied migration leaves a recorded checksum that no longer matches its contents — harmless today because nothing compares them, but it converts a verification mechanism into a lie, which is precisely the class of problem the migration_056 backfill created (see the gotcha below). **Never edit an applied migration file to fix a comment.** Correct the record here, or add a new migration if the indexes themselves need to change.

- **`schema_migrations` can lie — "up to date" does not mean the tables exist.** `migration_056_schema_migrations.sql` created the tracking table and backfilled filenames 008–055 **by assertion** (a hardcoded `INSERT` list), not by inspecting the database. Any migration in that range that was never actually applied is nonetheless recorded as applied, so `Apply-Migration.ps1` finds nothing pending and reports success while the table is absent. The failure is silent until an API route 500s with `relation "..." does not exist`. Hit in Slice #21.09.help.error (`help_content` / `help_hint`, missing since Slice #16.UX.02). **Always run `scripts\Verify-Schema.ps1` after `Apply-Migration.ps1`** — it compares the `pgTable` declarations in `src/db/schema/index.ts` against `information_schema.tables` and is the only check that catches this. When it reports a missing table, apply that migration directly with `docker cp` + `psql -f` (the runner will keep skipping it) and then correct the `schema_migrations` row.

- **`supabase_schema_full.sql` is GENERATED — never hand-edit it.** A hand-maintained copy drifts, and every from-scratch cloud rebuild is then broken. Regenerate with `scripts\Export-SupabaseSchema.ps1` (dumps the live local DB) after any migration, and commit the result. For repairing an **existing** database additively — including production, which is safe because every statement is `IF NOT EXISTS` — use `src/db/supabase_repair_missing_tables.sql` instead; the full file assumes an empty schema.

- **When generating DDL for a table from its migration history, use the FINAL shape, not the creating migration.** Several tables are reshaped by later migrations: `migration_051` swapped `group_member`/`stamp_member`'s nullable `(person_id, property_id, document_id)` triple for a single `principal_object_id`; `entity_metadata` gained columns in 046 and 050, dropped `provenance_history` in 047, and had its provenance CHECK value set replaced in 067; `groups`/`stamps` gained `deleted_at` in 057. Lifting the `CREATE TABLE` out of the original migration reproduces a shape that no longer matches `schema/index.ts`.

- **DB migration reminders — display these at the start of any migration step:**
  - *Local Docker:* **Do NOT use `npm run db:migrate`** — it exits silently without applying the file (confirmed repeatedly). Use `scripts\Apply-Migration.ps1` instead (see above).
  - *Supabase:* Paste the migration SQL directly into the Supabase SQL Editor. If using `db:migrate`, first set `DIRECT_URL` to the direct connection string (port 5432, `?sslmode=require`): `DIRECT_URL=postgresql://postgres.[ref]:[password]@db.[ref].supabase.co:5432/postgres?sslmode=require`. Remove it again afterwards.

- **`pg_dump` schema dump includes PostGIS `topology` schema — causes init conflict.** A schema-only `pg_dump` captures `CREATE SCHEMA topology;`. When this is used as a `docker-entrypoint-initdb.d` init script alongside `01-extensions.sql` (which creates `postgis_topology` and thus the `topology` schema first), psql hits `ERROR: schema "topology" already exists` and aborts with `ON_ERROR_STOP=on`. Fix: change `CREATE SCHEMA topology;` → `CREATE SCHEMA IF NOT EXISTS topology;` in the dump before shipping it.

## Harvested from the slice log

- **Soft-delete is the DELETE for all 13 lookup/reference tables, `groups` and `stamps`.** The 13 are `lookup_property_type`, `lookup_tarla`, `lookup_use_category`, `lookup_person_type`, `lookup_person_role`, `lookup_judicial_person_type`, `lookup_citizenship`, `lookup_document_type`, `lookup_institution`, `lookup_property_property_role`, `lookup_document_document_role`, `groups`, `stamps` — each carries `deleted_at` (`migration_057_soft_delete_lookups.sql`). An API DELETE handler on any of them sets `deleted_at = NOW()`; it never issues a real `DELETE`.

- **Every list/dropdown query over those tables needs `WHERE deleted_at IS NULL`.** A new query function that forgets it resurrects retired rows into a picker. Historical associations are meant to keep resolving their label, which is exactly why the row is still there.

- **Soft-delete does not cascade.** M:M junctions keep their `ON DELETE SET NULL` FKs but those never fire, so a historical association preserves its role tag. Do not "fix" this by nulling role columns on soft-delete.

- **Whitelist junctions and all M:M entity junctions stay HARD-delete:** `lookup_property_person_role`, `lookup_doc_type_person_role`, `lookup_person_person_role`. Do not add `deleted_at` to them.

- **`natural_person.cnp` is immutable once written — a `migration_025` trigger enforces it.** Correct a misread digit in the review form BEFORE the `POST /api/people`; fixing it afterwards is a data migration, not an edit.

- **Never copy a CNP (or any other person field read off an ID card) onto a Document.** `cnp`, `dateOfBirth`, `placeOfBirth`, `gender` and `idMrzRaw` describe the PERSON and are already written to `natural_person`; a second, freely-editable copy on the document is a second source of truth for the one field the schema goes out of its way to protect.

- **Never hardcode a time threshold.** All of them live in the `time_frame_setting` table (`migration_063`) and are read through `src/lib/time-frames/config.ts` (`toMs` / `getDays` / `getMs`), `src/lib/time-frames/queries.ts`, `GET`+`PATCH /api/time-frames` and the `useTimeFrames()` hook (`src/hooks/use-time-frames.ts`, with `tfDays` / `tfMs` selectors). Server-side consumers take the day count as a parameter injected by their route (`/api/dashboard` into the dashboard queries, `/api/documents` into `listDocument`'s `expiringSoonDays`); client components call `useTimeFrames()`.

- **A property may belong to at most 3 groups**, enforced server-side — candidates already in 3 other groups are filtered out of the picker.

- **Group codes and member positions are never reused.** The two-letter group code (AA, AB … skipping **I** and **O**) is drawn from `group_code_seq` and encoded in `src/lib/groups/code.ts`; a member's per-group `position` is allocated from `groups.last_position`, a high-water counter, so removing a member leaves a permanent gap. Never recycle either.

- **Group membership is NOT versioned.** It is an M:M association, like the other associations, and stays out of the version snapshots.
