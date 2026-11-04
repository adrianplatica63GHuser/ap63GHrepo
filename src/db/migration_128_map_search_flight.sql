-- migration_128_map_search_flight.sql
-- Slice 41.76 - „Caută pe hartă"'s flight on a parabola: its length and its coefficient „a" in „Setări".
--
-- WHY
--   Adrian, 2026-11-03: „the observer of the map moves on a parabola up from the current location (zoom out) and
--   towards the new location and then zooms in to the new location; this transition should be also set up in the
--   settings under administration, and I mean setup the duration of the transition and “a” coefficient of the parabola".
--
-- WHAT THIS DOES
--   Adds two settings to „Praguri de timp" → „Hărți":
--     map_search_flight - the flight's length, in MILLISECONDS (migration_117's unit), 4000 - 41.70's 4 s;
--     map_search_arc    - the parabola's coefficient a, in HUNDREDTHS under a new unit 'hundredths', 100 - a = 1,00.
--   The `value` column is an integer, so a is stored ×100; the `unit` column has no check constraint, so nothing else
--   changes. The screen types a with two decimals; the API accepts 0..15000 and 0..300 for these two keys.
--
--   Adds rows, changes no row and drops nothing - NOT DESTRUCTIVE. ON CONFLICT DO NOTHING: re-running it, or running it
--   on a database whose rows already exist (rebuilt through supabase_repair_missing_tables.sql, which seeds the same
--   rows), leaves a value a user saved untouched.

BEGIN;

INSERT INTO time_frame_setting (key, value, unit, label_en, label_ro, description_en, description_ro) VALUES
  ('map_search_flight', 4000, 'milliseconds', 'Map search — flight time', 'Căutare pe hartă — durata zborului', 'How long the big map takes to fly to a place found with „Search the map”', 'Cât durează zborul hărții mari până la locul găsit cu „Caută pe hartă”'),
  ('map_search_arc',     100, 'hundredths',   'Map search — the parabola''s coefficient a', 'Căutare pe hartă — coeficientul a al parabolei', 'How high the flight rises, as a share of the height from which both places show: 0 glides straight', 'Cât de sus urcă zborul, față de înălțimea de la care se văd ambele locuri: 0 alunecă drept')
ON CONFLICT (key) DO NOTHING;

COMMIT;
