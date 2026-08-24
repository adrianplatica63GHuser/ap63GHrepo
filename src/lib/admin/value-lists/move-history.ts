/**
 * What a bulk re-point writes besides the rows themselves.      (Slice #29.14)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   `reassignDependents` rewrote its rows with one raw UPDATE per dependent
 *   ref and did nothing else — no version row, no `updated_by` — and the
 *   columns it rewrites live INSIDE the version snapshots
 *   (`propertyTypeId` / `useCategoryId` / `tarlaSola`, `documentTypeId` /
 *   `institutionId`, `citizenshipId` / `physicalPersonTypeId`,
 *   `judicialPersonTypeId`; see src/lib/versioning/snapshot-registry.ts).
 *   Nothing was lost — but `updateProperty` and `updateDocument` insert a
 *   version only when a fresh snapshot differs from the latest stored one, so
 *   the NEXT ordinary edit to a moved object wrote a version whose diff
 *   contained the type change, under whoever made that edit. Meanwhile the
 *   row's own `updated_by` kept the previous writer while the
 *   `touch_updated_at` trigger moved `updated_at`, so the row read "changed
 *   just now, by someone who did not change it". #29.05 named the defect in
 *   the header above `reassignDependents`; this module is the fix it pointed
 *   at.
 *
 * WHY A REGISTRY RATHER THAN A BRANCH IN THE MOVER
 *   The mover is generic over `LIST_DEPENDENCIES` and has to stay that way: a
 *   twelfth list must be an entry in that map, not a twelfth `case`. So the
 *   ref declares WHICH entity records it (`versioned` in ./dependents.ts, a
 *   plain string) and this module says WHAT that means. The split is not
 *   tidiness — ./dependents.ts is imported by a test that has no database, and
 *   the four writers below pull in modules that build a `pg.Pool` at load, so
 *   the string is the only thing that may cross.
 *
 * ⚠️ **ONE VERSION ROW PER OBJECT, AND THERE IS NO OTHER SHAPE AVAILABLE.**
 * Moving forty properties writes forty version rows. `version_number` is
 * unique per object (`property_version_property_number_unique` and its two
 * siblings), so "one version for the batch" is not something the schema can
 * hold, and the forty are exactly the forty an administrator editing those
 * properties one at a time would have left.
 *
 * ⚠️ **THE ROW COUNT IS PER OBJECT; THE STATEMENT COUNT IS NOT, AND AN
 * ADVERSARIAL ROUND IS WHY.** The first draft rebuilt one snapshot at a time.
 * A property costs three reads to snapshot (the row, its address, its
 * corners), plus the latest-version read, plus the insert — five statements
 * each, so a 5 000-property move was ~25 000 sequential round trips inside one
 * transaction holding two lookup rows locked: minutes against a remote
 * Postgres, past any serverless function timeout, and blocking every
 * concurrent save that references either lookup row for the whole of it, on a
 * screen whose previous behaviour was a single UPDATE. It is now a fixed
 * number of statements per BATCH — six for a property batch, four for a
 * document batch — so the same move is ~60 statements. `VERSION_BATCH` in
 * src/lib/versioning/append.ts is the knob, and it is a parameter-count bound
 * rather than a tuning choice.
 *
 * ⚠️ **WHAT DOES NOT GET CHEAPER IS THE WRITING.** Five thousand moved
 * properties are five thousand full snapshots, each carrying the property's
 * complete corner polygon, stored forever. For ordinary parcels that is single
 * -digit megabytes; for the OCR'd plans with hundreds of vertices it is tens of
 * kilobytes each, and the WAL behind it is the real number. That cost is
 * inherent in "one version per object" and is the price of the decision, not
 * an implementation detail — see the handover for Slice #29.14.
 *
 * ⚠️ **`updated_by` IS STAMPED IN A SECOND STATEMENT, NOT FOLDED INTO THE
 * MOVE'S OWN UPDATE.** For `property` and `document` it could have been, and
 * for the two person satellites it could not: `natural_person` and
 * `judicial_person` carry no `updated_by` at all — it lives on `person`, one
 * table over — so a uniform second statement is the only form that covers all
 * four. It is one statement per batch, not one per row.
 *
 * ⚠️ **IN UAT MODE THIS WRITES `updated_by = NULL`, AND THAT IS THE ANSWER,
 * not an oversight.** `getCurrentUser()` returns the synthetic UAT identity on
 * Ciprian's box, whose email is deliberately null (see `UAT_USER` in
 * src/lib/auth/current-user.ts), so a move there blanks the column. An
 * adversarial round proposed skipping the stamp instead, to avoid overwriting
 * a real address with nothing. It was rejected because `updatePropertyIn` and
 * `updateNaturalPerson` already write that same null over that same address on
 * every ordinary save — their patch always carries `updatedBy` — and the whole
 * claim of this slice is that a move leaves the trail an ordinary edit leaves.
 *
 * A SECOND round then found the hole in that argument, and it is closed one
 * file over rather than here: an ordinary edit can only reach null THROUGH
 * UAT, because its route refuses the request when there is no session, whereas
 * `reassignDependents` used to resolve the email a second time after
 * authorisation and would have written null on a transient Supabase failure —
 * "changed just now, by nobody", on however many rows the move touched. It now
 * resolves the IDENTITY and refuses when there is none, so a null arriving
 * here means UAT and only UAT.
 *
 * ⚠️ **LOCK-ORDER CYCLES REMAIN, AND THEY ARE NAMED RATHER THAN FIXED.** For
 * the two person lists this module locks `natural_person` / `judicial_person`
 * (the move's own UPDATE) and then `person` (the stamp). `deletePersons` goes
 * the other way — `DELETE FROM person` first, its `ON DELETE CASCADE` second —
 * so a move racing a person delete over the same person can deadlock, and
 * Postgres aborts one of them. Moving the stamp before the UPDATE is not
 * available: the move's `RETURNING` is what says which persons to stamp.
 * Separately, two moves over two lists that rewrite the SAME table
 * (`property-types` / `use-categories` / `tarla` all rewrite `property`) hold
 * no lookup lock in common and can cycle inside `moveRef`'s own bulk UPDATE,
 * where the lock order is whatever the planner scans. Neither is reachable by
 * sorting anything in JavaScript, and an adversarial round is why this
 * paragraph no longer claims otherwise: **the `.sort()` below buys dedupe and
 * identical batch membership between two movers over overlapping sets, not
 * deadlock freedom.** The move is a single transaction, so a deadlock's loser
 * rolls back whole and the user sees an error rather than half a move; both
 * cycles are in the handover.
 */

import { inArray } from "drizzle-orm";
import { batched } from "@/lib/versioning/append";
// ⚠️ **`import type`, and it has to stay one** — the value handle would drag a
// `pg.Pool` into every importer. The four query modules below DO build one;
// they are imported here rather than in ./dependents.ts for exactly that
// reason, and this module is imported only by ./queries.ts, which already has
// the pool.
import type { DbTransaction } from "@/db";
import { document, person, property } from "@/db/schema";
import { recordPropertyVersionsIfChanged } from "@/lib/properties/queries";
import { recordDocumentVersionsIfChanged } from "@/lib/documents/queries";
import { recordNaturalPersonVersionsIfChanged } from "@/lib/persons/queries";
import { recordJudicialPersonVersionsIfChanged } from "@/lib/judicial-persons/queries";
import type { DependentRef, VersionedEntityKey } from "./dependents";

type MoveHistoryWriter = {
  /**
   * Stamp `updated_by` on the rows these ids identify — ONE statement per
   * batch, not one per row.
   *
   * For the two person subtypes the column is on `person`, not on the
   * satellite row the move rewrote; the ids are person ids either way, because
   * `natural_person.person_id` and `judicial_person.person_id` ARE
   * `person.id`.
   */
  touchUpdatedBy: (
    tx: DbTransaction,
    ids: string[],
    updatedBy: string | null,
  ) => Promise<void>;
  /**
   * Append versions for these objects where a fresh snapshot really differs
   * from the latest stored one — the same comparison the entity's own update
   * makes, because it is literally that function. Returns how many were
   * written.
   */
  recordVersions: (
    tx: DbTransaction,
    ids: readonly string[],
    updatedBy: string | null,
  ) => Promise<number>;
};

const WRITERS: Record<VersionedEntityKey, MoveHistoryWriter> = {
  property: {
    touchUpdatedBy: async (tx, ids, updatedBy) => {
      await tx.update(property).set({ updatedBy }).where(inArray(property.id, ids));
    },
    recordVersions: recordPropertyVersionsIfChanged,
  },
  document: {
    touchUpdatedBy: async (tx, ids, updatedBy) => {
      await tx.update(document).set({ updatedBy }).where(inArray(document.id, ids));
    },
    recordVersions: recordDocumentVersionsIfChanged,
  },
  "natural-person": {
    touchUpdatedBy: async (tx, ids, updatedBy) => {
      await tx.update(person).set({ updatedBy }).where(inArray(person.id, ids));
    },
    recordVersions: recordNaturalPersonVersionsIfChanged,
  },
  "judicial-person": {
    touchUpdatedBy: async (tx, ids, updatedBy) => {
      await tx.update(person).set({ updatedBy }).where(inArray(person.id, ids));
    },
    recordVersions: recordJudicialPersonVersionsIfChanged,
  },
};

/**
 * Everything a move owes the objects behind one ref's rewritten rows.
 *
 * `ids` are the values the UPDATE returned from `ref.versioned.idColumn` — one
 * per rewritten ROW, which is one per object for all eight versioned refs
 * today (eight refs over four tables).
 *
 * They are de-duplicated (a future ref whose table holds several rows per
 * object would otherwise try to write the same `(object, version_number)`
 * twice and take the whole move down with a 23505) and SORTED (two
 * administrators moving overlapping sets at the same time would otherwise take
 * the same row locks in `RETURNING` scan order, which is whatever the planner
 * chose — a deadlock that depends on the plan is a deadlock nobody can
 * reproduce).
 *
 * Returns how many version rows were actually written, which is at most
 * `ids.length` and is legitimately fewer — a snapshot that did not change
 * writes nothing, exactly as an ordinary save that changed nothing does.
 *
 * ⚠️ **Runs on the caller's `tx`.** A version written outside the move's
 * transaction is a history that a rollback would leave disagreeing with its
 * own rows.
 */
export async function recordMoveHistory(
  tx: DbTransaction,
  ref: DependentRef,
  ids: string[],
  updatedBy: string | null,
): Promise<number> {
  const versioned = ref.versioned;
  if (!versioned || ids.length === 0) return 0;

  const writer = WRITERS[versioned.entity];
  const unique = [...new Set(ids)].sort();

  // `batched` rather than one statement: `inArray` binds one parameter per id
  // and the wire protocol counts them in an Int16, so a move of 70 000 rows
  // would otherwise be rejected outright. Same helper, same boundary, as the
  // version writer uses — one bound, one place.
  //
  // Sequential rather than Promise.all: the batches share one connection inside
  // the transaction, so concurrency buys nothing and only complicates the
  // failure. What made this affordable was the size of a batch, not running
  // several at once.
  for (const batch of batched(unique)) {
    await writer.touchUpdatedBy(tx, batch, updatedBy);
  }

  // Not batched here: `recordVersions` does its own, on the same boundary, so
  // that the bound holds for every caller of it rather than only for this one.
  return writer.recordVersions(tx, unique, updatedBy);
}
