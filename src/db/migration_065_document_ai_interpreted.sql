-- migration_065_document_ai_interpreted.sql
--
-- Adds ai_interpreted_at to the document table.
-- This timestamp is set by the AI-interpret action (server-side extraction)
-- and is NOT versioned — it is operational metadata only.

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS ai_interpreted_at TIMESTAMPTZ;

-- The column is `filename`, not `name`, and the value carries the .sql suffix --
-- every other migration that records itself (057, 060, 062, 063) does it this
-- way. As written this statement could never have run: the table has no `name`
-- column, so replaying the chain dies here with `column "name" of relation
-- "schema_migrations" does not exist`. It went unnoticed because psql did not
-- get ON_ERROR_STOP until Slice #26.12, so the ALTER TABLE above applied, this
-- INSERT failed silently, psql exited 0 and Apply-Migration.ps1 recorded the
-- migration itself. (Found by scripts/verify-rebuild.ts, Slice #31.01.)
INSERT INTO schema_migrations (filename)
VALUES ('migration_065_document_ai_interpreted.sql')
ON CONFLICT DO NOTHING;
