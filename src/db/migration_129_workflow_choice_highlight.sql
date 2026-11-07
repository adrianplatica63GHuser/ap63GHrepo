-- migration_129_workflow_choice_highlight.sql
-- Slice 41.98 - „Cum lucrezi cu …": a choice pressed stands on the beige note box for a few seconds — how many, in „Setări".
--
-- WHY
--   Adrian, 2026-11-06: „When a radio button is clicked on the tile “How you work with groups” the entire item must show
--   that it was selected by having a beige box as a background for a few seconds which can be set in the settings; for
--   the same duration and starting at the same moment The instructions that show up under the divider will be displayed
--   in a similar beige box".
--
-- WHAT THIS DOES
--   Adds one setting to „Praguri de timp" → „Fișe":
--     workflow_choice_highlight - how long the choice and its steps stand on the note box, in MILLISECONDS (migration_117's
--     unit), 3000 - 3 s. The screen types it in seconds, 0 (no highlight) to 10 s; the API accepts 0..10000 for this key.
--   Ștampile's wizard (Slice 41.99) reads the same row.
--
--   Adds a row, changes no row and drops nothing - NOT DESTRUCTIVE. ON CONFLICT DO NOTHING: re-running it, or running it
--   on a database whose row already exists (rebuilt through supabase_repair_missing_tables.sql, which seeds the same
--   row), leaves a value a user saved untouched.

BEGIN;

INSERT INTO time_frame_setting (key, value, unit, label_en, label_ro, description_en, description_ro) VALUES
  ('workflow_choice_highlight', 3000, 'milliseconds', 'Highlight of a choice in „How you work with …”', 'Evidențierea alegerii în „Cum lucrezi cu …”', 'How long a choice pressed in „How you work with groups” (or stamps), and the steps it shows, stand on the note''s beige box; 0 turns it off', 'Cât timp o alegere apăsată în „Cum lucrezi cu grupurile” (sau ștampilele), și pașii pe care îi arată, stau pe fondul bej al unei note; 0 o oprește')
ON CONFLICT (key) DO NOTHING;

COMMIT;
