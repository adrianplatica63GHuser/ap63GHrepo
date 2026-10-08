-- migration_097_cvc_data_continut_date.sql
-- Slice #38.32 - „Data conținutului" becomes a real date.
--
-- WHAT THIS DOES
--   The contract de vânzare's „Data conținutului" (custom_fields.dataContinut)
--   was a text field; since #38.32 it is a date field (<input type="date">),
--   which shows only an ISO yyyy-mm-dd value. Every stored value is converted:
--     - dd.mm.yyyy (also dd/mm/yyyy, dd-mm-yyyy)          -> yyyy-mm-dd
--     - yyyy-mm-dd                                         -> kept
--     - „12 martie 2020" — a Romanian month name, with or
--       without diacritics, „mart." / „sept." abbreviations -> yyyy-mm-dd
--   and only when the result is a real calendar day.
--
-- NOTHING IS DROPPED
--   A value that does not read as a date is appended to the document's „Note"
--   (document.notes) as „Data conținutului (text): <value>" and the key is
--   removed from custom_fields, since a date box cannot show it. The handover
--   lists those documents by DOC code (on the local database there were none:
--   no contract de vânzare carried a value, read 2026-10-07).
--
-- THE HISTORY
--   document_version snapshots keep what they recorded; a past version viewed
--   on screen shows a text value as an empty date box, as any old text value in
--   a date field already does.
--
-- WHICH ROWS
--   Every document whose custom_fields has a non-empty dataContinut, whatever
--   its type: the key belongs to the contract de vânzare's form, and a value
--   under it on another type is the same field copied across.

BEGIN;

CREATE TEMP TABLE _m097 ON COMMIT DROP AS
SELECT d.id,
       btrim(d.custom_fields->>'dataContinut') AS raw,
       NULL::date AS parsed
FROM document d
WHERE d.custom_fields ? 'dataContinut'
  AND coalesce(btrim(d.custom_fields->>'dataContinut'), '') <> '';

-- A tolerant day builder: NULL instead of an error for 31.02.2020.
CREATE OR REPLACE FUNCTION pg_temp.m097_day(y int, m int, d int) RETURNS date
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF y IS NULL OR m IS NULL OR d IS NULL OR y < 1800 OR y > 2200 THEN RETURN NULL; END IF;
  RETURN make_date(y, m, d);
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.m097_month(name text) RETURNS int
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE translate(lower(rtrim(name, '.')), 'ăâîșşțţ', 'aaissstt')
    WHEN 'ianuarie' THEN 1  WHEN 'ian' THEN 1
    WHEN 'februarie' THEN 2 WHEN 'feb' THEN 2  WHEN 'febr' THEN 2
    WHEN 'martie' THEN 3    WHEN 'mar' THEN 3  WHEN 'mart' THEN 3
    WHEN 'aprilie' THEN 4   WHEN 'apr' THEN 4
    WHEN 'mai' THEN 5
    WHEN 'iunie' THEN 6     WHEN 'iun' THEN 6
    WHEN 'iulie' THEN 7     WHEN 'iul' THEN 7
    WHEN 'august' THEN 8    WHEN 'aug' THEN 8
    WHEN 'septembrie' THEN 9 WHEN 'sep' THEN 9 WHEN 'sept' THEN 9
    WHEN 'octombrie' THEN 10 WHEN 'oct' THEN 10
    WHEN 'noiembrie' THEN 11 WHEN 'noi' THEN 11 WHEN 'nov' THEN 11
    WHEN 'decembrie' THEN 12 WHEN 'dec' THEN 12
  END
$$;

-- dd.mm.yyyy, dd/mm/yyyy, dd-mm-yyyy
UPDATE _m097 SET parsed = pg_temp.m097_day(
    (regexp_match(raw, '^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$'))[3]::int,
    (regexp_match(raw, '^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$'))[2]::int,
    (regexp_match(raw, '^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$'))[1]::int)
WHERE parsed IS NULL AND raw ~ '^\d{1,2}[./-]\d{1,2}[./-]\d{4}$';

-- yyyy-mm-dd
UPDATE _m097 SET parsed = pg_temp.m097_day(
    (regexp_match(raw, '^(\d{4})-(\d{1,2})-(\d{1,2})$'))[1]::int,
    (regexp_match(raw, '^(\d{4})-(\d{1,2})-(\d{1,2})$'))[2]::int,
    (regexp_match(raw, '^(\d{4})-(\d{1,2})-(\d{1,2})$'))[3]::int)
WHERE parsed IS NULL AND raw ~ '^\d{4}-\d{1,2}-\d{1,2}$';

-- „12 martie 2020", „12 mart. 2020"
UPDATE _m097 SET parsed = pg_temp.m097_day(
    (regexp_match(raw, '^(\d{1,2})\s+([[:alpha:]]+\.?)\s+(\d{4})$'))[3]::int,
    pg_temp.m097_month((regexp_match(raw, '^(\d{1,2})\s+([[:alpha:]]+\.?)\s+(\d{4})$'))[2]),
    (regexp_match(raw, '^(\d{1,2})\s+([[:alpha:]]+\.?)\s+(\d{4})$'))[1]::int)
WHERE parsed IS NULL AND raw ~ '^\d{1,2}\s+[[:alpha:]]+\.?\s+\d{4}$';

-- Read as a date: store the ISO day.
UPDATE document d
SET custom_fields = jsonb_set(d.custom_fields, '{dataContinut}', to_jsonb(to_char(m.parsed, 'YYYY-MM-DD')))
FROM _m097 m
WHERE d.id = m.id AND m.parsed IS NOT NULL;

-- Not a date: kept in „Note", and the key removed.
UPDATE document d
SET notes = CASE WHEN coalesce(btrim(d.notes), '') = ''
                 THEN 'Data conținutului (text): ' || m.raw
                 ELSE d.notes || E'\n' || 'Data conținutului (text): ' || m.raw END,
    custom_fields = d.custom_fields - 'dataContinut'
FROM _m097 m
WHERE d.id = m.id AND m.parsed IS NULL;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT d.code, m.raw FROM _m097 m JOIN document d ON d.id = m.id WHERE m.parsed IS NULL ORDER BY d.code LOOP
    RAISE NOTICE 'migration_097: % kept „Data conținutului" as text in Note: %', r.code, r.raw;
  END LOOP;
END $$;

COMMIT;
