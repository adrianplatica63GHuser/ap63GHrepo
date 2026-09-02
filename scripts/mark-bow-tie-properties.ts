/**
 * mark-bow-tie-properties.ts — Slice #32.14
 *
 * The backfill migration_075 deliberately does not contain.
 *
 * WHY IT IS A SCRIPT AND NOT SQL
 *   Detecting a self-intersecting corner order needs the corners projected to
 *   Stereo 70 (`wgs84ToStereo70`, a TypeScript port of the national grid
 *   transformation) and then a segment-intersection scan whose collinearity
 *   test is a normalised sine rather than a raw cross product. A plpgsql copy
 *   would be a second implementation of an algorithm that took five adversarial
 *   rounds to settle, in a second language, free to disagree with the first —
 *   and the disagreement would show as a marker that appears and disappears
 *   depending on which side last wrote the row. This calls the SAME function
 *   the application calls: src/lib/properties/corner-geometry.ts.
 *
 * WHY IT IS NEEDED AT ALL
 *   `corner_order_self_intersects` is NOT NULL DEFAULT false, so on the day
 *   migration_075 is applied every existing property reads false — including
 *   any that really is a bow-tie. A property is otherwise marked only when its
 *   corners are next written. This walks the archive once and settles them all.
 *
 * WHAT IT TOUCHES
 *   `property.corner_order_self_intersects` and nothing else. It does NOT
 *   touch `calculated_area_mp`, does NOT reorder a single corner, and does NOT
 *   write a version snapshot — it is a measurement catching up with rows that
 *   already existed, not an edit anyone made. Reordering is the user's to do,
 *   from the property form, one press at a time; that is the whole design of
 *   this slice and a script is the last place to undo it.
 *
 * ⚠️ **AND KEEPING `updated_at` OUT OF IT TAKES REAL WORK, WHICH AN EARLIER
 * DRAFT OF THIS FILE DID NOT DO.** It claimed `updated_at` was left alone and
 * then issued plain UPDATEs. There is a BEFORE UPDATE trigger on `property` —
 * `property_touch_updated_at`, drizzle/0001_slim_black_bolt.sql:55, running
 * `touch_updated_at()` whose whole body is `NEW.updated_at = now()`. It is
 * unconditional, so it also overwrites an explicit `updated_at` in the SET
 * clause: there is no way to write this column through an ordinary UPDATE
 * without bumping it.
 *
 *   The consequence is not cosmetic. `getProperties` orders by
 *   `greatest(updated_at, created_at) desc`, and `RecencyBadge` lights on
 *   `Math.max(created, updated)` inside the recency window — so a plain
 *   backfill would reorder the whole property list and put a "New!" badge on
 *   every marked property at once, which is a worse lie than the flag it is
 *   fixing.
 *
 *   So the writes run inside one transaction with the trigger disabled:
 *   ALTER TABLE ... DISABLE TRIGGER, two set-based UPDATEs, ENABLE TRIGGER.
 *   Postgres makes DDL transactional, so a failure anywhere rolls the
 *   disablement back with everything else — the trigger cannot be left off.
 *   DISABLE TRIGGER takes an ACCESS EXCLUSIVE lock on `property`, which is why
 *   the measuring is all done first and the transaction holds nothing but two
 *   statements: seconds, not the length of the scan.
 *
 *   It requires ownership of `property`. If the role in DATABASE_URL is not the
 *   owner this fails with `must be owner of relation property`, the transaction
 *   rolls back, and nothing is written — which is the right failure, and the
 *   dry-run listing above it is still the useful half.
 *
 * Idempotent: it writes only rows whose stored flag disagrees with the
 * measurement, so a second run reports 0 changed. Safe to re-run.
 *
 * Usage:
 *   npm run properties:mark-bow-ties            # report only, writes nothing
 *   npm run properties:mark-bow-ties -- --apply # write the changes
 *
 * The default is a DRY RUN on purpose: the first thing anyone wants to know is
 * how many properties in the archive are affected, and that answer should not
 * cost a write.
 */

import { asc, inArray, sql } from "drizzle-orm";
import { db, pool } from "@/db";
import { property, propertyCorner } from "@/db/schema";
import { computeCornerGeometry } from "@/lib/properties/corner-geometry";

const APPLY = process.argv.includes("--apply");

/** Ids per UPDATE. See the chunking note at the write. */
const ID_CHUNK = 1000;

async function main() {
  // Two queries, not one per property. `propertyFullsIn`'s own header argues
  // against the N+1 shape at this table's scale, and it is right: a per-row
  // corner fetch over a 5,000-property archive is 5,001 sequential round trips.
  const properties = await db
    .select({
      id: property.id,
      code: property.code,
      stored: property.cornerOrderSelfIntersects,
    })
    .from(property)
    .orderBy(asc(property.code));

  const cornerRows = await db
    .select({
      propertyId: propertyCorner.propertyId,
      lat: propertyCorner.lat,
      lon: propertyCorner.lon,
    })
    .from(propertyCorner)
    .orderBy(asc(propertyCorner.propertyId), asc(propertyCorner.sequenceNo));

  const cornersByProperty = new Map<string, { lat: number; lon: number }[]>();
  for (const row of cornerRows) {
    const list = cornersByProperty.get(row.propertyId);
    if (list) list.push({ lat: row.lat, lon: row.lon });
    else cornersByProperty.set(row.propertyId, [{ lat: row.lat, lon: row.lon }]);
  }

  console.log(
    `${properties.length} propert${properties.length === 1 ? "y" : "ies"} to measure` +
      (APPLY ? "" : "  (DRY RUN — pass --apply to write)"),
  );

  const toMark: string[] = [];
  const toClear: string[] = [];
  let unchanged = 0;
  let tooFewCorners = 0;
  let measurable = 0;
  let measured = 0;

  for (const p of properties) {
    const corners = cornersByProperty.get(p.id) ?? [];
    if (corners.length < 3) tooFewCorners++;
    else measurable++;

    const { selfIntersects, calculatedAreaMp } = computeCornerGeometry(corners);
    if (calculatedAreaMp != null) measured++;

    if (selfIntersects === p.stored) {
      unchanged++;
      continue;
    }

    if (selfIntersects) {
      toMark.push(p.id);
      console.log(
        `  ${p.code}  ->  CROSSES   ${corners.length} corners, ` +
          `calculated area ${calculatedAreaMp ?? "—"} m²`,
      );
    } else {
      toClear.push(p.id);
      console.log(`  ${p.code}  ->  cleared   (stored flag was stale)`);
    }
  }

  // Three counts over the same population, on their own lines rather than
  // nested in one sentence. An earlier draft wrote "Unchanged: N (of which K
  // have fewer than 3 corners)", which is only true while no <3-corner property
  // is stored as marked — not reachable through the app today, but a claim the
  // numbers do not support is a claim that will one day be wrong in silence.
  console.log(
    `\n${APPLY ? "Written" : "Would write"}: ${toMark.length} marked, ${toClear.length} cleared.\n` +
      `Already correct: ${unchanged}.\n` +
      `Fewer than 3 corners, so never marked: ${tooFewCorners} of ${properties.length}.`,
  );

  if (toMark.length + toClear.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!APPLY) {
    console.log("\nNothing was written. Re-run with --apply to write it.");
    return;
  }

  // ⚠️ REFUSE TO WRITE A MASS CLEAR THAT IS ACTUALLY A BROKEN GRID FILE.
  // `computeCornerGeometry` catches everything and answers "no area, no
  // marker" — right on the save path, where a save must never be refused,
  // and dangerous here. `wgs84ToStereo70` reads the grid through
  // `process.cwd()`, so running this from the wrong directory makes EVERY
  // property measure as not-a-bow-tie: `toMark` empty, `toClear` every marked
  // row in the archive, wiped inside the trigger-disabled transaction, with no
  // `updated_at` change left behind to show what happened.
  //
  // The tell is unmistakable and free: a property with 3+ corners that
  // projects cannot have a null area.
  if (measurable > 0 && measured === 0) {
    console.error(
      `\n❌  Refusing to write. ${measurable} propert${measurable === 1 ? "y has" : "ies have"} ` +
        `3 or more corners and NOT ONE produced an area, which means the projection ` +
        `failed for all of them — almost certainly the Stereo 70 grid file at ` +
        `src/lib/geo/grids/ETRS89_KRASOVSCHI42_2DJ.GRD, resolved from the current ` +
        `working directory. Run this from the repository root.`,
    );
    process.exitCode = 1;
    return;
  }

  await db.transaction(async (tx) => {
    // See the header: without this the backfill bumps updated_at on every row
    // it touches, reorders the property list and lights the recency badge
    // across the archive. DDL is transactional, so a failure below re-enables
    // the trigger by rolling back.
    await tx.execute(
      sql`ALTER TABLE ${property} DISABLE TRIGGER property_touch_updated_at`,
    );

    // Chunked: `inArray` emits one bind parameter per id and Postgres' extended
    // protocol caps at 65535 of them. Unreachable at this table's scale and
    // cheap to make impossible.
    for (const [ids, flag] of [
      [toMark, true],
      [toClear, false],
    ] as const) {
      for (let i = 0; i < ids.length; i += ID_CHUNK) {
        await tx
          .update(property)
          .set({ cornerOrderSelfIntersects: flag })
          .where(inArray(property.id, ids.slice(i, i + ID_CHUNK)));
      }
    }

    await tx.execute(
      sql`ALTER TABLE ${property} ENABLE TRIGGER property_touch_updated_at`,
    );
  });

  console.log("Done. updated_at was not touched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
