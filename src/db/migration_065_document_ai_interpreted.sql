-- migration_065_document_ai_interpreted.sql
--
-- Adds ai_interpreted_at to the document table.
-- This timestamp is set by the AI-interpret action (server-side extraction)
-- and is NOT versioned — it is operational metadata only.

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS ai_interpreted_at TIMESTAMPTZ;

INSERT INTO schema_migrations (name)
VALUES ('migration_065_document_ai_interpreted')
ON CONFLICT DO NOTHING;
