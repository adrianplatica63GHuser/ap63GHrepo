-- migration_066_document_templates.sql
-- Slice #21.03.Import — dynamic per-type document templates.
--
-- Adds:
--   lookup_document_type.template_fields jsonb
--     Array of type-specific field defs: [{ key, labelRo, labelEn, type,
--     order, aiHint }, ...]. NULL/empty = this type has no template yet
--     (the form and the AI-extraction prompt fall back to the generic
--     baseline fields only — title / nrDocument / dateDocument / subject).
--     Shape + parsing lives in src/lib/documents/template-fields.ts.
--     Adding a brand-new document type with a full custom template is pure
--     data from here on — a lookup_document_type row + this JSON array — no
--     further schema migration and no code change.
--
--   document.custom_fields jsonb
--     The actual captured values for whatever template applies to this
--     document's type, keyed by the template field's `key`. NULL/empty = no
--     custom data captured. Folds into the existing full-snapshot versioning
--     (document_version.snapshot) like every other document field — see
--     DocumentSnapshot.customFields in src/lib/documents/validation.ts.
--
-- No backfill needed — both columns are nullable and new; every existing row
-- reads as NULL ("no template" / "no custom data").

ALTER TABLE lookup_document_type
  ADD COLUMN IF NOT EXISTS template_fields jsonb;

ALTER TABLE document
  ADD COLUMN IF NOT EXISTS custom_fields jsonb;
