-- Slice #19.02 — Property type seed rows (additional types)
--
-- Adds the remaining known property types as seeded rows with their fixed
-- `key` slugs.  These slugs match the pre-wired entries in
-- `src/lib/properties/type-config.ts` and therefore get the correct profile
-- (URBAN / AGRICULTURAL / FOREST) automatically.
--
-- Types not listed here (Water / Special) are rare enough to use the GENERIC
-- fallback — they can be added via Reference Data → Property Types at any
-- time; the auto-generated slug will fall through to GENERIC until
-- type-config.ts is explicitly extended.
--
-- Idempotent: INSERT ... ON CONFLICT (key) DO NOTHING, so re-running is safe.
-- sort_order continues from the six seed rows (max = 6) in migration_039.

INSERT INTO lookup_property_type (name, key, sort_order) VALUES
  -- Urban / Built
  ('Garaj',               'GARAJ',                7),
  ('Spațiu Comercial',    'SPATIU_COMERCIAL',      8),
  ('Birou',               'BIROU',                 9),
  -- Agricultural / Rural
  ('Vie',                 'VIE',                  10),
  ('Livadă',              'LIVADA',               11),
  ('Fâneață',             'FANATA',               12),
  -- Forest / Vegetation
  ('Pădure',              'PADURE',               13),
  ('Vegetație Forestieră','VEGETATIE_FORESTIERA',  14)
ON CONFLICT (key) DO NOTHING;
