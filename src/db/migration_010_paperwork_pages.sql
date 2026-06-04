-- ---------------------------------------------------------------------------
-- Migration 010 — paperwork_page table
-- ---------------------------------------------------------------------------
-- Stores uploaded file pages associated with a paperwork record.
-- One row per uploaded file; file content lives on the filesystem (dev)
-- or in Supabase Storage bucket "paperwork-pages" (production).
-- Cascade-deletes when the parent paperwork row is deleted.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS paperwork_page (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paperwork_id uuid        NOT NULL REFERENCES paperwork(id) ON DELETE CASCADE,
  page_number  integer     NOT NULL,
  page_name    text,
  page_notes   text,
  -- Original filename as uploaded by the user, e.g. "scan001.pdf"
  file_name    text        NOT NULL,
  -- Storage path/key, e.g. "paperwork-pages/{paperworkId}/{pageId}.pdf"
  file_path    text        NOT NULL,
  file_size    integer,
  mime_type    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT paperwork_page_paperwork_number_unique
    UNIQUE (paperwork_id, page_number)
);

-- Reuse the existing touch_updated_at() trigger function (created in migration 001).
CREATE TRIGGER touch_updated_at_paperwork_page
  BEFORE UPDATE ON paperwork_page
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
