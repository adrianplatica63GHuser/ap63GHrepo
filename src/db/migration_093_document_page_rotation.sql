-- migration_093_document_page_rotation.sql
-- Slice #38.17 - a page turned to the right, a quarter at a time, and remembered.
--
-- WHAT THIS DOES
--   Adds document_page.rotation (smallint, NOT NULL, DEFAULT 0) with a CHECK
--   that it is 0, 90, 180 or 270: how far to the right the viewer turns the
--   page's image when it draws it - in the document's „Pagini" tile, in
--   „Pagini extinse" and in a document's preview. „Rotește la dreapta" turns
--   the page shown by 90 degrees; „Salvează rotirea" stores the turn here
--   (PATCH /api/documents/[id]/pages/[pageId]).
--
-- THE FILE IS NEVER CHANGED
--   The stored bytes are not rewritten or re-encoded: the turn is a CSS rotate
--   the viewer applies. „Tipărire" opens the file as stored, and the import's
--   reading of pages (OCR, classification, the AI) reads the file, not this.
--
-- EVERY EXISTING PAGE IS 0
--   The default fills every row: a page nobody turned is drawn as before. A
--   saved turn is not a new version of the document (it changes how a page is
--   shown, not what the document says), so nothing here touches
--   document_version.

BEGIN;

ALTER TABLE document_page
  ADD COLUMN IF NOT EXISTS rotation smallint NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'document_page_rotation_check') THEN
    ALTER TABLE document_page
      ADD CONSTRAINT document_page_rotation_check CHECK (rotation IN (0, 90, 180, 270));
  END IF;
END $$;

COMMIT;
