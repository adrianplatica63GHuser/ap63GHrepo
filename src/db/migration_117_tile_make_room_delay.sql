-- migration_117_tile_make_room_delay.sql
-- Slice 39.92 - the make-room delay in „Setări": seconds, with decimals.
--
-- WHY
--   Adrian, 2026-10-19: „... stopping on top for more than a time interval that I can set in Settings (seconds with
--   decimals), that tile should slide down ...". Slice 39.91 built the behaviour with a built-in 1,0 s; this row is
--   where „Setări" keeps the value from now on.
--
-- WHAT THIS DOES
--   Adds one setting, `tile_make_room_delay`, seeded at 1000. It is stored in MILLISECONDS under a new unit,
--   'milliseconds', so the integer `value` column holds a value typed with decimals: 1,5 s is 1500. The `unit` column
--   has no check constraint, so nothing else changes. The screen types and shows it in seconds; the API accepts
--   200..10000 for this key only.
--
--   Adds a row, changes no row and drops nothing. ON CONFLICT DO NOTHING: re-running it, or running it on a database
--   whose row already exists (rebuilt through supabase_repair_missing_tables.sql, which seeds the same row), leaves
--   the value a user saved untouched.

BEGIN;

INSERT INTO time_frame_setting (key, value, unit, label_en, label_ro, description_en, description_ro) VALUES
  ('tile_make_room_delay', 1000, 'milliseconds', 'Hold time over another tile', 'Timp de ținere peste altă fișă', 'How long a dragged tile is held over another before that one slides down to make room', 'Cât timp e ținută o fișă trasă peste alta până când aceea alunecă în jos ca să-i facă loc')
ON CONFLICT (key) DO NOTHING;

COMMIT;
