-- migration_127_map_expand_durations.sql
-- Slice 41.75 - „Hartă extinsă" opens as an animation, in two parts, each its own length in „Setări".
--
-- WHY
--   Adrian, 2026-11-03: „I would like to make this transition as an animation that will take a time interval which I
--   can set in the settings under administration and which has a default value of three seconds … Now we should start
--   zooming out during another time interval which is originally 3 seconds".
--
-- WHAT THIS DOES
--   Adds two settings, stored in MILLISECONDS under the unit 'milliseconds' (migration_117's), seeded at 3000:
--     map_expand_grow      - part 1, the „Hartă" tile grows into the expanded map;
--     map_expand_zoom_out  - part 2, the expanded map zooms out to the property at a tenth of its height.
--   The screen types and shows them in seconds; the API accepts 0..10000 for these two keys (0 skips that part).
--
--   Adds rows, changes no row and drops nothing - NOT DESTRUCTIVE. ON CONFLICT DO NOTHING: re-running it, or running it
--   on a database whose rows already exist (rebuilt through supabase_repair_missing_tables.sql, which seeds the same
--   rows), leaves a value a user saved untouched.

BEGIN;

INSERT INTO time_frame_setting (key, value, unit, label_en, label_ro, description_en, description_ro) VALUES
  ('map_expand_grow',     3000, 'milliseconds', 'Expanded map — the tile grows', 'Hartă extinsă — mărirea fișei', 'How long the „Map” tile takes to grow into the expanded map, the property travelling to the middle', 'Cât durează până când fișa „Hartă” se mărește până la harta extinsă, iar proprietatea ajunge la mijloc'),
  ('map_expand_zoom_out', 3000, 'milliseconds', 'Expanded map — zooming out', 'Hartă extinsă — depărtarea', 'How long the expanded map then takes to zoom out, until the property is a tenth of its height', 'Cât durează apoi depărtarea hărții extinse, până când proprietatea are o zecime din înălțimea ei')
ON CONFLICT (key) DO NOTHING;

COMMIT;
