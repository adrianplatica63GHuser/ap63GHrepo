-- migration_075_property_corner_order_self_intersects.sql
-- Slice #32.14 - a polygon that crosses itself says so.
--
-- WHAT THIS DOES
--   Adds `property.corner_order_self_intersects`, a server-computed boolean
--   saying that the property's corners, IN THE ORDER THEY ARE STORED, trace a
--   ring that is not a simple polygon.
--
--   It is NOT user-editable and there is no UI that sets it. It is a
--   measurement of the corner rows, recomputed every time they are written.
--
-- ⚠️ **ON THE DAY THIS MIGRATION IS APPLIED, NOTHING WRITES THIS COLUMN.** The
--   working contract stops a migration slice HERE, at the migration file and
--   the matching schema/index.ts change, and waits for confirmation before
--   anything is built against them - so this file is deliberately ahead of its
--   own wiring, and an adversarial round caught an earlier draft describing
--   that wiring in the present tense.
--
--   What WILL write it, in the rest of Slice #32.14 and in the same push: the
--   detector `polygonSelfIntersects` (src/lib/properties/area.ts - committed,
--   tested, and calling nothing), invoked from the two functions every
--   APPLICATION path routes its corner writes through, `createPropertyIn` and
--   `updatePropertyIn` in src/lib/properties/queries.ts. Hooking those two
--   rather than the four routes above them is what makes the property form
--   save, the import, the document process route and the calculation commit all
--   set it without any of them knowing the column exists.
--
--   One writer is NOT under them, and it is worth knowing rather than
--   discovering: `src/db/seed.ts` inserts `property_corner` rows directly, so a
--   seeded dev property is never marked. `calculated_area_mp` has exactly the
--   same hole for exactly the same reason, so this is the existing behaviour
--   rather than a new gap - but "the only two functions that insert corner
--   rows" would have been wrong, and an adversarial round said so.
--
--   Until that lands the column is inert and every row reads false, which is
--   exactly what it would read anyway - see NOT NULL DEFAULT false below.
--
-- WHY A COLUMN EXISTS AT ALL
--   PROP01444 was imported with its corners in file order. That order
--   self-intersects, so the parcel - whose own name says 2000 - reported a
--   calculated area of 0.21 m2. Nothing anywhere said the polygon was a
--   bow-tie. The only symptom was a number that was wrong by four orders of
--   magnitude, sitting in a field a user has no reason to distrust, and it took
--   a manuals run to notice.
--
--   The condition has to be visible from the LIST, without opening each
--   property, or the archive can only be audited one row at a time. That means
--   a stored column: the detector needs the corner rows projected to Stereo 70,
--   which is TypeScript, so it cannot be a generated column or an index
--   expression.
--
-- THE PRECEDENT IS `calculated_area_mp`, NOT ANY OF THE EXISTING BOOLEANS
--   `property` has no boolean column today. The booleans that exist elsewhere -
--   `correspondence_same_as_home`, `correspondence_same_as_hq`, the three
--   `lookup_property_type` panel flags, `email_sent` - are all user intent or
--   process state, and none of them badges a list row.
--
--   `calculated_area_mp` (migration_033, Slice #18.09) is the right model and
--   this column deliberately copies its shape: server-computed from the
--   corners, not user-editable, written on create and on update, surfaced as an
--   optional list column. Anyone changing one should look at the other.
--
-- NOT NULL DEFAULT false, AND WHAT THAT COSTS
--   A three-state column - true / false / not yet determined - was considered
--   and rejected: every read site would have to decide what to render for the
--   third state, and the honest answer for "not yet determined" is the same as
--   for false, which is "show nothing".
--
--   So the cost is stated plainly instead: ON THE DAY THIS SHIPS, EVERY
--   EXISTING PROPERTY READS false, INCLUDING ANY THAT IS ACTUALLY A BOW-TIE.
--   Once the wiring above lands, a property is marked when its corners are next
--   written - by a save, an import, the document process route, or the
--   calculation commit; until it lands, by nothing at all. PROP01444
--   itself was corrected by hand during the manuals run, so the archive's one
--   known case is already straight; what is unknown is whether there are
--   others.
--
-- THERE IS NO BACKFILL IN THIS FILE, AND THE REASON IS NOT LAZINESS
--   Detecting the condition means projecting each corner from WGS84 to
--   Stereo 70 (`wgs84ToStereo70`, a TypeScript implementation of the national
--   grid transformation) and then running a segment-intersection scan over the
--   ring. Writing that scan in plpgsql would put a SECOND copy of an algorithm
--   in the repository - one that took three adversarial review rounds to get
--   right, and whose collinearity test is a normalised sine precisely because a
--   raw cross product is wrong at Stereo 70 magnitudes. Two copies of that in
--   two languages is a divergence waiting to happen, and the divergence would
--   show up as a marker that appears and disappears depending on which side
--   last wrote the row.
--
--   The backfill therefore belongs in a script that calls the SAME function -
--   scripts/, TypeScript, one algorithm - and it is listed in the rest of this
--   slice rather than written here. This file's job is the column, and as of
--   this file that script does not exist yet.
--
-- Idempotent: IF NOT EXISTS. Safe to re-run.

BEGIN;

-- 1. The column --------------------------------------------------------------

ALTER TABLE public.property
  ADD COLUMN IF NOT EXISTS corner_order_self_intersects boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.property.corner_order_self_intersects IS
  'True when the stored corner ORDER traces a self-intersecting (bow-tie) ring, which makes calculated_area_mp meaningless. Server-computed, never user-editable: it is written by polygonSelfIntersects (src/lib/properties/area.ts) from the two corner-write choke points in src/lib/properties/queries.ts once the rest of Slice #32.14 lands - as of this migration nothing writes it and every row is false. There is no backfill; see the migration file header. Slice #32.14.';

-- 2. Say what happened --------------------------------------------------------
--
-- A result set and not a RAISE NOTICE, for the reason migration_073 measured:
-- the Supabase SQL Editor renders result sets and not notices, so a NOTICE is
-- invisible on the path the cloud project is applied through.
--
-- Nothing here is an assertion. Every count is legitimately zero on an empty
-- database, and `marked` being zero is the expected and correct state
-- immediately after this migration, on any database.
--
-- ⚠️ THERE IS DELIBERATELY NO `not_yet_measured` COLUMN HERE, AND AN EARLIER
-- DRAFT HAD ONE. Because the column is NOT NULL DEFAULT false there is no value
-- that means "never measured" - so any such count could only be `count(*)`
-- wearing a label it cannot support, and it would go on reporting the whole
-- table as unmeasured long after the app had begun marking rows.
-- migration_074's equivalent line can make that distinction honestly only
-- because its column is nullable. This one says what it can count.
SELECT
  (SELECT count(*) FROM public.property)                                         AS properties,
  (SELECT count(*) FROM public.property WHERE corner_order_self_intersects)      AS marked,
  'nothing writes this column until the rest of #32.14 lands - see the header'   AS note;

COMMIT;
