-- Slice #19.03 — seed four new document types
-- Keys must match the entries in type-config.ts exactly.
-- ON CONFLICT DO NOTHING = idempotent (safe to re-run).
--
-- Apply locally:
--   docker cp src\db\migration_035_seed_doc_types.sql ga40prj-postgres:/tmp/m035s.sql
--   docker exec ga40prj-postgres psql -U postgres -d ga40db -f /tmp/m035s.sql
--
-- Apply to Supabase: paste this file's contents into the Supabase SQL Editor.

INSERT INTO lookup_document_type (id, key, name, sort_order, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'HOTARARE_JUDECATOREASCA', 'Hotărâre Judecătorească',   100, now(), now()),
  (gen_random_uuid(), 'HOTARARE_ADMINISTRATIVA', 'Hotărâre Administrativă',   110, now(), now()),
  (gen_random_uuid(), 'DOCUMENTATIE_CADASTRALA', 'Documentație Cadastrală',   120, now(), now()),
  (gen_random_uuid(), 'AUTORIZATIE_CONSTRUIRE',  'Autorizație De Construire', 130, now(), now())
ON CONFLICT (key) DO NOTHING;
