---
paths:
  - "**/src/db/**"
  - "**/drizzle/**"
  - "**/drizzle.config.ts"
  - "**/src/lib/**/queries.ts"
---

# One database, several codebases

> **⚠️ THIS FILE EXISTS TWICE, AND THE COPY YOU ARE READING MAY NOT BE THE ONE TO EDIT.**
> The versioned original is `ga40prj\docs\claude\shared\rules\shared-database.md`. The copy Claude
> actually **loads** is `C:\dev\.claude\rules\shared-database.md`, deployed above every repo so that
> every project inherits it — which puts it outside git's reach. **Edit the repo copy and
> commit it; deploying is Adrian's** (`ga40prj\scripts\Sync-SharedClaude.ps1`), so it goes in
> the handover next to the push.
>
> Both halves have gone wrong in real sessions. A commit without a deploy is a rule that is
> **not in effect** — Slice #32.14 opened with `sandbox-and-toolchain.md` 33 lines behind its
> source, missing two bullets about failures that session could have hit. An edit made
> directly to the deployed copy is **discarded by the next deploy** — the same slice did that
> too. `src\__tests__\shared-claude-deploy.test.ts` now fails when the two drift, so
> `npx jest` catches both.


More than one app under `C:\dev\` talks to the same PostgreSQL/PostGIS database. That makes
the schema a **shared contract**, not a private implementation detail of whichever repo you
happen to be in. Before changing anything under `src/db/`, apply these rules.

## The schema has exactly one owner

- **`ga40prj` owns the schema.** It holds the canonical `src/db/schema/index.ts`, the
  numbered `migration_NNN_*.sql` files and the `schema_migrations` table.
- **Every other app is a consumer.** A consumer repo may hold a *copy* of the Drizzle schema
  so its own `tsc` passes, but it must never author a migration, never run
  `Apply-Migration.ps1`, and never `ALTER` anything.
- If a consumer app needs a new column or table, the change is authored as a migration in the
  owner repo, applied there, and only then propagated to the consumer's schema copy. Say this
  out loud when a slice in a consumer repo implies a schema change — do not quietly add the
  column locally.

## Changes are additive while more than one app is live

A migration that drops or renames a column breaks every consumer that has not been redeployed.
Unless Adrian has explicitly confirmed that every consumer is going down together:

- Add columns, don't rename them. Add a new one, backfill, deprecate the old one in a later
  slice once no app reads it.
- New columns are `NULL`able or have a default. A `NOT NULL` column with no default fails
  every insert coming from an app that doesn't know about it yet.
- Don't drop a table, a view or an enum value in the same slice that stops using it.

## Never trust a local schema file about the live database

A consumer's copy of `schema/index.ts` says what that repo *believes*. It can be stale by
several migrations. When behaviour disagrees with the schema file, the database wins — check
`schema_migrations` in the owner repo, and remember that `schema_migrations` can itself lie
about migrations that were marked applied but never ran.

## Row ownership

Rows created by different apps land in the same tables. Whatever distinguishes them — a
tenant column, a source column, a code prefix — is load-bearing:

- Never write a query that assumes every row in a table came from the app you're editing.
- Never widen a `DELETE` or an `UPDATE` past that discriminator "to keep it simple".
- Sequences and generated codes are global across apps. Two apps must not both compute
  "the next code" client-side.
