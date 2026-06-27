-- Slice #18.06 — Document versioning (full-snapshot history)
--
-- Every Document keeps a complete version history. Version 0 is the state at
-- creation; every saved edit appends the next version. Each version stores a
-- FULL snapshot (the document's own editable fields) as JSONB, so
-- reconstructing "version N" is a direct lookup — no delta replay. The label
-- colour and per-field highlights shown in the UI are derived at display time
-- by diffing snapshot N against snapshot N-1 (snapshots are the single source
-- of truth; nothing derived is persisted).
--
-- Versioned scope = the document's own form fields ONLY. NOT the M:M
-- associations (persons / properties / documents) and NOT the uploaded
-- document_page files — those are separate lifecycles, out of scope.
--
-- Snapshot JSON shape (kept identical between this backfill and the app's
-- write path in src/lib/documents/queries.ts) — a flat object of all 21
-- editable fields, all string|null:
--   {
--     documentTypeId, title, nrDocument, dateDocument, institution,
--     emitent, bazaLegala, uatProprietate, uatProprietar, suprafata,
--     nrDosarSuccesoral, dataDecesului, ultimulDomiciliu, nrCertificatDeces,
--     dateStart, dateEnd, titularText, defunctText, partiesAText,
--     partiesBText, notes
--   }
-- `suprafata` is a numeric column → cast ::text so it matches drizzle's
-- string read of the numeric column.
--
-- Idempotent: CREATE ... IF NOT EXISTS, and the backfill skips any document
-- that already has a version 0.

CREATE TABLE IF NOT EXISTS document_version (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id    uuid        NOT NULL REFERENCES document(id) ON DELETE CASCADE,
  version_number integer     NOT NULL,
  snapshot       jsonb       NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS document_version_document_number_unique
  ON document_version (document_id, version_number);

-- Backfill: give every existing document a version 0 from its current state.
-- (Soft-deleted documents are included too — harmless, and keeps the invariant
-- "every document has at least one version" total.)
INSERT INTO document_version (document_id, version_number, snapshot)
SELECT
  d.id,
  0,
  jsonb_build_object(
    'documentTypeId',    d.document_type_id,
    'title',             d.title,
    'nrDocument',        d.nr_document,
    'dateDocument',      d.date_document,
    'institution',       d.institution,
    'emitent',           d.emitent,
    'bazaLegala',        d.baza_legala,
    'uatProprietate',    d.uat_proprietate,
    'uatProprietar',     d.uat_proprietar,
    'suprafata',         d.suprafata::text,
    'nrDosarSuccesoral', d.nr_dosar_succesoral,
    'dataDecesului',     d.data_decesului,
    'ultimulDomiciliu',  d.ultimul_domiciliu,
    'nrCertificatDeces', d.nr_certificat_deces,
    'dateStart',         d.date_start,
    'dateEnd',           d.date_end,
    'titularText',       d.titular_text,
    'defunctText',       d.defunct_text,
    'partiesAText',      d.parties_a_text,
    'partiesBText',      d.parties_b_text,
    'notes',             d.notes
  )
FROM document d
WHERE NOT EXISTS (
  SELECT 1 FROM document_version v
  WHERE v.document_id = d.id AND v.version_number = 0
);
