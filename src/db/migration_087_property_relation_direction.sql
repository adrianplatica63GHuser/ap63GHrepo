-- migration_087_property_relation_direction.sql
-- Slice #37.10 - a property_property role can say WHICH WAY it reads (FU-220).
--
-- WHAT THIS DOES
--   `property_property.role_reads_a_to_b boolean NOT NULL DEFAULT true`, the
--   same column, type and default `document_document` got in migration_086.
--   Existing rows are counted first, so the run PRINTS how many take that
--   default and therefore carry a direction nobody verified.
--   No row's data is changed. No index is dropped. No table is created.
--
-- ---------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------
--
-- `property_property` is `(property_id_a, property_id_b, relationship_role_id)`
-- with `uniqueIndex property_property_unique` on (a, b) and a CHECK that
-- `property_id_a < property_id_b`. **THAT ORDERING IS BY UUID** - a
-- canonicalisation trick so one pair cannot be stored twice, produced by a
-- literal `[propertyId, otherId].sort()` in `associatePropertiesToProperty`.
-- It carries no meaning. Three of migration_055's seven roles are directional
-- in their wording - „Inclus în", „Subdiviziune a", „Acces prin" - so on a pair
-- whose uuids sort the other way „Inclus în" read backwards, and both
-- properties showed the same bare chip, so one of them always said the
-- opposite of what was chosen (TC-ASSOC-08, red since Slice #36.19).
--
-- The reasoning migration_086 gives for a boolean rather than a from/to
-- reshape applies word for word: the tidy schema needs every existing row's
-- direction, and for an existing row that is not knowable from the database.
-- On the local database on 2026-09-27 there were NO property_property rows
-- (a read-only count of every property's references through the API, Slice
-- #37.10), so the default is a guess about nothing there; the count below says
-- so on any database it runs on.
--
-- ⚠️ THE UNIQUE INDEX AND THE CHECK ARE LEFT EXACTLY AS THEY ARE. One pair
-- still stores one row; the flag is about how that row READS.
--
-- ⚠️ `true`, NOT NULL, because every reader must get a direction without a
-- branch. Rows written from Slice #37.10 on set it deliberately
-- (`manualPairDirection`, src/lib/associations/pair-direction.ts).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS, and the count is a NOTICE.

BEGIN;

DO $$
DECLARE
  n_total integer;
  n_roled integer;
BEGIN
  SELECT count(*) INTO n_total FROM property_property;
  -- „Has a role at all", not a list of the three directional names, for the
  -- reason migration_086 gives: a role renamed on Date de referință would make
  -- a name list under-report. This over-reports by the undirected roles' rows,
  -- the safe direction.
  SELECT count(*) INTO n_roled FROM property_property WHERE relationship_role_id IS NOT NULL;
  RAISE NOTICE 'migration_087: % existing property_property row(s), % of them carrying a role. Every one of the % takes role_reads_a_to_b = true UNVERIFIED - the pair order is by uuid and means nothing. Rows with „Adiacent", „Contiguu", „Suprapus cu" or „Alipit de" read the same both ways and need no look. List the rest with:  SELECT pp.property_id_a, pp.property_id_b, r.name FROM property_property pp JOIN lookup_property_property_role r ON r.id = pp.relationship_role_id ORDER BY r.name;',
    n_total, n_roled, n_roled;
END $$;

ALTER TABLE property_property
  ADD COLUMN IF NOT EXISTS role_reads_a_to_b boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN property_property.role_reads_a_to_b IS
  'Which way relationship_role_id reads. TRUE (the default) means the role reads A to B - "property_id_a <role> property_id_b". FALSE means it reads B to A. The pair order is canonicalised by UUID (CHECK property_property_order) only so one pair cannot be stored twice, and carries no meaning; three seeded roles ("Inclus în", "Subdiviziune a", "Acces prin") are directional, so without this a pair whose uuids sorted the other way read backwards (FU-220, Slice #37.10). Rows written from #37.10 on set it from the screen the link was made on; rows that predate it took the default, and migration_087 prints how many. Same column and reasoning as document_document.role_reads_a_to_b (migration_086).';

COMMIT;

-- Check after running:
--
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM   information_schema.columns
--   WHERE  table_name = 'property_property' AND column_name = 'role_reads_a_to_b';
--
-- And the rows whose direction is a guess - the number printed above:
--
--   SELECT pp.property_id_a, pp.property_id_b, r.name, pp.role_reads_a_to_b
--   FROM   property_property pp
--   JOIN   lookup_property_property_role r ON r.id = pp.relationship_role_id
--   ORDER  BY r.name;
