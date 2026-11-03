-- migration_126_notary_link_from_issuer.sql
-- Slice 41.53 - the notary office chosen on „Identificarea actului" is a link in „Legături", role „Notar".
--
-- WHY
--   Adrian, 2026-11-02: „On the document identification tile of a document If the user updates the notary office this
--   update should reflect on the links tile under juridical persons".
--
-- WHAT THIS DOES
--   1. person_document.from_issuer (new, boolean NOT NULL DEFAULT false): the link was made by the document's issuer,
--      not by hand. The sync (src/lib/documents/queries.ts, syncIssuerNotaryLink) only ever removes a row it marked, so
--      a „Notar" link made by hand is never taken away.
--   2. „Notar" is offered on Act Adițional, Act de Donație and Testament (rows added when missing, none changed) — the
--      three types labelled „Notariat" that did not offer it. The other two, Certificat de Moștenitor and Contract de
--      Vânzare, already do.
--   3. Backfill: every document of the five „Notariat" types (ACT_ADITIONAL, ACT_DONATIE, CERTIFICAT_MOSTENITOR,
--      CONTRACT_VANZARE, TESTAMENT) whose issuer is set gets the issuer's „Notar" link, marked from_issuer — only where
--      that person has no „Notar" link on it yet. Inserts only.
--
-- NOT DESTRUCTIVE
--   A column with a default, rows added. Nothing is deleted or rewritten.

BEGIN;

ALTER TABLE person_document ADD COLUMN IF NOT EXISTS from_issuer boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN person_document.from_issuer IS
  'Slice 41.53: the link the document''s issuer made („Notariat" on „Identificarea actului"), kept in step with it. Never set on a link made by hand.';

INSERT INTO lookup_doc_type_person_role (document_type_id, person_role_id)
SELECT d.id, r.id
  FROM lookup_document_type d
  JOIN lookup_person_role r ON r.name = 'Notar'
 WHERE d.key IN ('ACT_ADITIONAL', 'ACT_DONATIE', 'TESTAMENT')
   AND NOT EXISTS (SELECT 1 FROM lookup_doc_type_person_role x WHERE x.document_type_id = d.id AND x.person_role_id = r.id);

INSERT INTO person_document (person_id, document_id, person_role_id, from_issuer)
SELECT doc.issuer_person_id, doc.id, r.id, true
  FROM document doc
  JOIN lookup_document_type t ON t.id = doc.document_type_id
  JOIN lookup_person_role r ON r.name = 'Notar'
 WHERE doc.issuer_person_id IS NOT NULL
   AND t.key IN ('ACT_ADITIONAL', 'ACT_DONATIE', 'CERTIFICAT_MOSTENITOR', 'CONTRACT_VANZARE', 'TESTAMENT')
   AND NOT EXISTS (
     SELECT 1 FROM person_document pd
      WHERE pd.document_id = doc.id AND pd.person_id = doc.issuer_person_id AND pd.person_role_id = r.id);

COMMIT;
