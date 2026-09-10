/**
 * The ticks a moved association needs on its NEW role.          (Slice #29.13)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   Moving forty Proprietate–Persoană associations from role A to role B does
 *   not move A's whitelist ticks — deliberately, see `configuration` in
 *   ./dependents.ts — and the association screens build their role dropdown
 *   from the WHITELIST (`/api/documents/[id]/valid-person-roles`,
 *   `/api/admin/doc-type-person-roles/distinct-roles`, and — since Slice
 *   #34.04, where two of these were tables and are now two booleans on
 *   `lookup_person_role` — `valid_for_property` / `valid_for_person`
 *   filtered out of `/api/admin/value-lists/person-roles`) while the display
 *   path joins `lookup_person_role` DIRECTLY. So a row moved onto a role that is not
 *   ticked in that panel reads correctly on screen and can never be
 *   re-selected: the user sees the role, cannot find it in the list, and there
 *   is nothing on the association screen that explains why.
 *
 *   #29.05 shipped a SENTENCE about it — `valueList.confirm.roleWhitelistNote`
 *   — which asked the administrator to go and tick the role in up to three
 *   other panels afterwards. This module is that sentence's replacement, and
 *   the note is deleted in the same commit.
 *
 * ⚠️ **ONLY WHERE ROWS REALLY MOVED — NEVER FOR A BARE TICK, AND THAT
 * DISTINCTION IS THE WHOLE SAFETY ARGUMENT.** #29.05's first draft "moved"
 * whitelist rows and an adversarial round killed it: a role ticked in one panel
 * and used by no association at all would have handed the target an
 * eligibility nobody asked for, in a panel the user was not looking at. That
 * objection is exactly as good today, and this module does not meet it by
 * being careful — it meets it by asking a different question. It never reads
 * the source role's ticks. It asks whether real ASSOCIATIONS are about to land
 * on the target, and grants only the tick those associations need in order to
 * remain selectable. A source role with ticks and no associations grants
 * nothing.
 *
 * ⚠️ **The Document Persons grant is SCOPED TO THE DOCUMENT TYPES THAT MOVED,
 * not to the role.** `lookup_doc_type_person_role` is unique over
 * `(document_type_id, person_role_id)` — a tick says "this role is valid for
 * THIS type" — and the document-side dropdown
 * (`/api/documents/[id]/valid-person-roles` → `listPersonRolesForDocument`)
 * filters by the document's own type. Ticking the target for one arbitrary
 * type would satisfy the person-side `distinct-roles` list and still leave the
 * role unselectable on the document itself. So the types are read from the
 * documents the moved rows actually point at, and each gets its own row.
 *
 * ⚠️ **…AND A TYPE THAT HAS NO TICKS AT ALL IS SKIPPED, WHICH USED TO BE THE
 * OPPOSITE OF WHAT IT LOOKS LIKE. An adversarial round found the first version
 * here TAKING eligibility away.** `listPersonRolesForDocument`
 * (src/lib/documents/queries.ts) was two-stage: the roles ticked for the
 * document's own type, and — when that type had NO rows in
 * `lookup_doc_type_person_role` at all — a fallback returning every role ticked
 * for SOME type. An unconfigured type is the ordinary case, and on one of those
 * every ticked role was already selectable. Insert a single row for it and
 * stage one started returning results, the fallback never ran, and the picker
 * collapsed from that whole set to "the one role this move just granted" —
 * silently, in a panel the administrator was not looking at, which is exactly
 * the harm the paragraph above swears off.
 *
 * ⚠️ **SLICE #34.16 REMOVED THAT FALLBACK (D-16(b)) AND THE COLLAPSE ARGUMENT
 * WENT WITH IT — BUT THE FILTER STAYS, FOR A STRONGER REASON THAN THE ONE THAT
 * PUT IT HERE.** With one answer everywhere an unconfigured type offers
 * NOTHING, so inserting a row for it can no longer collapse an offer. On that
 * reading the filter looks like caution that has outlived its argument, and the
 * first draft of this paragraph said exactly that and pointed a later slice at
 * removing it.
 *
 * ⚠️ **THEN THE NUMBERS ARRIVED, AND THEY SAY THE OPPOSITE.
 * `lookup_doc_type_person_role` IS EMPTY: 48 document types, 48 of them with no
 * ticks at all** (measured on the development database the day #34.16 shipped;
 * #34.10's „23 unconfigured" either counted a smaller catalogue or a different
 * population). So there is no such thing here as „a whitelist that already
 * exists" to top up — and a filter
 * removed on that data would make an administrator RENAMING OR MERGING A ROLE
 * the thing that first configures a document type. Configuration created as a
 * side effect of a value-list edit, in a panel nobody was looking at, is
 * precisely the harm the two paragraphs above swear off, arriving from the
 * other direction. **Keep the filter.** Deciding which roles belong to
 * CONTRACT_VANZARE is an afternoon with the business user, not a consequence of
 * a rename.
 *
 * **What the filter costs meanwhile is bounded and visible:** the moved rows
 * still render their role, marked „(nu mai este disponibil)" (#34.05), and
 * `roleWhitelistPending` tells the administrator to go and tick it in
 * „Roluri pe Document". On today's data that warning fires on every role move
 * that touches a document — which is loud, and correct, and stops being either
 * the moment the first type is configured.
 *
 * So the grant is a TOP-UP of a whitelist that already exists, never the
 * creation of one — and on an archive with no whitelists yet, that means it
 * grants nothing and says so.
 *
 * ⚠️ **WHAT THIS CANNOT REPAIR IS REPORTED RATHER THAN GUESSED AT — AND SLICE
 * #34.16 CHANGED BOTH HOW MANY SUCH CASES THERE ARE AND HOW THEY ARE
 * DETECTED.** Every document type the filter above SKIPS is a type on which the
 * moved rows now carry a role no picker offers, so this returns
 * `roleWhitelistPending` and the dialog asks the administrator to tick it in
 * „Roluri pe Document" — which is what the deleted `confirm.roleWhitelistNote`
 * said to EVERY user of the move, narrowed to the cases where it is true.
 *
 * Until #34.16 the test was „is the target ticked NOWHERE at all", and that was
 * enough: the fallback made a target ticked SOMEWHERE selectable on every
 * unconfigured type anyway, so one tick anywhere really did repair all of them.
 * With the fallback gone it repairs only the type it names, and the old test
 * would have reported a clean success over rows stranded on the others. The
 * question was always „was a type left out"; it is now asked that way.
 *
 * The reasoning behind the case itself moved too. It used to rest on there
 * being no safe third option: ticking an unconfigured type collapsed that
 * type's offer to one role, and ticking an unrelated configured type granted an
 * eligibility in a panel nobody was looking at. The first of those is no longer
 * true — with the fallback gone, ticking an unconfigured type no longer
 * collapses anything. What still makes it the wrong thing for THIS module to do
 * is the paragraph above: on an archive whose junction table is empty, a role
 * move would be writing a document type's first configuration. So the warning
 * is not a placeholder waiting for a slice to delete it. It is what this module
 * says instead of configuring the archive on the administrator's behalf, and it
 * goes away when the types are configured rather than when the code changes.
 *
 * ⚠️ **`granted` AND `warnings` CAN NOW BOTH CARRY THE DOCUMENT BRANCH, WHICH
 * THEY COULD NOT BEFORE.** A move whose rows come from a mix of configured and
 * unconfigured types tops the first lot up (`docTypePersonRoleWhitelist`) and
 * reports the second lot as pending. The dialog renders both blocks and reads
 * correctly — „ticked here, still to do there".
 *
 * Note what is NOT new, because an adversarial round corrected this paragraph
 * on exactly that point: `granted` and `warnings` were never mutually
 * exclusive. `granted` is one array fed by three branches, and the two
 * `lookup_person_role` ones say nothing about document types — a move that
 * ticked `valid_for_property` and warned about pending document ticks was
 * always reachable. What changed is only that the DOCUMENT entry can now sit
 * beside the warning.
 *
 * ⚠️ **Called BEFORE the move, on purpose.** The rows still carry the SOURCE
 * value at that point, which is what makes "are there any?" answerable without
 * separating the rows this move brought from rows the target already had. It
 * runs inside the caller's transaction, so a rolled-back move takes its grants
 * with it.
 *
 * The return value is `DependentCount[]` keyed by the SAME
 * `valueList.dependents.classes.*` labels the dialog already renders for the
 * "La ștergere se elimină și:" list — no new vocabulary, and the sentence that
 * introduces them is one key (`confirm.roleWhitelistGranted`) replacing one
 * key (`confirm.roleWhitelistNote`).
 */

import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "@/db";
import {
  document,
  lookupDocTypePersonRole,
  lookupPersonRole,
  personDocument,
  personPerson,
  propertyPerson,
} from "@/db/schema";
import type { DependentCount } from "./dependents";

/** What the grant did, and what it could not do. */
export type WhitelistGrantOutcome = {
  /** One entry per panel in which a tick was actually created. */
  granted: DependentCount[];
  /**
   * i18n keys under `valueList.confirm` — repairs this could not make.
   * An array rather than a boolean so a second case is a key, not a field.
   */
  warnings: string[];
};

/**
 * Grant the target role whatever ticks the rows about to move onto it need.
 *
 * Returns one entry per panel in which a tick was actually CREATED. A panel
 * where the target was already ticked contributes nothing — `ON CONFLICT DO
 * NOTHING` returns no row — which is the honest answer: nothing changed there.
 */
export async function grantPersonRoleWhitelists(
  tx: DbTransaction,
  fromRoleId: string,
  toRoleId: string,
): Promise<WhitelistGrantOutcome> {
  const granted: DependentCount[] = [];
  const warnings: string[] = [];

  // ── „Persoană → Proprietate" ───────────────────────────────────────────────
  //
  // ⚠️ **A CONDITIONAL UPDATE, AND THE CONDITION IS WHAT KEEPS `granted`
  // HONEST.**                                                  (Slice #34.04)
  // This was an INSERT into `lookup_property_person_role` with
  // `.onConflictDoNothing().returning()`, whose whole point was that a target
  // already ticked returned NO ROW and so contributed nothing to `granted` —
  // "nothing changed there" said by saying nothing. migration_079 made the
  // tick a boolean, and the flag test in the WHERE is the same sentence: the
  // UPDATE matches only a row this call is really about to
  // change, so `rows.length` is 1 when a tick was created and 0 when it was
  // already there. A bare `.set({ validForProperty: true })` would return one
  // row every time and report a grant that did not happen.
  //
  // ⚠️ **`IS NOT TRUE`, not `= false`, and an adversarial round is why.** The
  // column is `NOT NULL` in migration_079 — but `supabase_repair_missing_tables.sql`
  // says in its own comments that a nullable copy is reachable (a hand-add, or
  // a partial `drizzle-kit push`, over which `ADD COLUMN IF NOT EXISTS` is a
  // no-op). Against a NULL, `= false` is UNKNOWN, so the UPDATE would match
  // nothing, `granted` would stay empty, no warning would fire, and the moved
  // associations would land on a role that is unselectable on every screen.
  // `IS NOT TRUE` is true for both FALSE and NULL, which is the question
  // actually being asked: is this tick missing?
  const propertyRows = await tx
    .select({ id: propertyPerson.id })
    .from(propertyPerson)
    .where(eq(propertyPerson.personRoleId, fromRoleId))
    .limit(1);
  if (propertyRows.length > 0) {
    const rows = await tx
      .update(lookupPersonRole)
      .set({ validForProperty: true })
      .where(and(
        eq(lookupPersonRole.id, toRoleId),
        sql`${lookupPersonRole.validForProperty} IS NOT TRUE`,
      ))
      .returning({ id: lookupPersonRole.id });
    if (rows.length > 0) {
      granted.push({ labelKey: "propertyPersonRoleWhitelist", count: rows.length });
    }
  }

  // ── „Persoană → Persoană" ──────────────────────────────────────────────────
  const personRows = await tx
    .select({ id: personPerson.id })
    .from(personPerson)
    .where(eq(personPerson.relationshipRoleId, fromRoleId))
    .limit(1);
  if (personRows.length > 0) {
    const rows = await tx
      .update(lookupPersonRole)
      .set({ validForPerson: true })
      .where(and(
        eq(lookupPersonRole.id, toRoleId),
        sql`${lookupPersonRole.validForPerson} IS NOT TRUE`,
      ))
      .returning({ id: lookupPersonRole.id });
    if (rows.length > 0) {
      granted.push({ labelKey: "personPersonRoleWhitelist", count: rows.length });
    }
  }

  // ── Roluri pe Document, one row per document type that actually moved ──────
  //
  // `selectDistinct` rather than a `GROUP BY`: the set is what matters and it
  // is small — a person-role is carried by documents of a handful of types at
  // most.
  const types = await tx
    .selectDistinct({ documentTypeId: document.documentTypeId })
    .from(personDocument)
    .innerJoin(document, eq(document.id, personDocument.documentId))
    .where(eq(personDocument.personRoleId, fromRoleId));
  if (types.length > 0) {
    // The second query is the guard the header argues for: only types that
    // ALREADY have a whitelist get topped up. Two statements rather than a
    // correlated `EXISTS`, because the set is tiny and this is the one part of
    // this module a reader has to be able to check by eye.
    const configured = await tx
      .selectDistinct({ documentTypeId: lookupDocTypePersonRole.documentTypeId })
      .from(lookupDocTypePersonRole)
      .where(
        inArray(
          lookupDocTypePersonRole.documentTypeId,
          types.map((t) => t.documentTypeId),
        ),
      );
    const needed = new Set(configured.map((c) => c.documentTypeId));
    const skipped = types.filter((t) => !needed.has(t.documentTypeId));
    const values = types
      .filter((t) => needed.has(t.documentTypeId))
      .map((t) => ({ documentTypeId: t.documentTypeId, personRoleId: toRoleId }));
    // `.values([])` is a syntax error, not an empty write.
    if (values.length > 0) {
      const rows = await tx
        .insert(lookupDocTypePersonRole)
        .values(values)
        .onConflictDoNothing()
        .returning({ id: lookupDocTypePersonRole.id });
      if (rows.length > 0) {
        granted.push({ labelKey: "docTypePersonRoleWhitelist", count: rows.length });
      }
    }

    // ⚠️ **THE CASE THIS CANNOT REPAIR — AND SINCE SLICE #34.16 IT IS ASKED AS
    // „WAS A TYPE LEFT OUT", NOT AS „IS THE TARGET TICKED ANYWHERE".** The old
    // test was `anyTick.length === 0`, a second SELECT asking whether the
    // target had a row for any type at all. An adversarial round built the case
    // it misses: forty rows move onto a target that IS ticked for some
    // unrelated type, from documents whose own type has no ticks. The filter
    // above skips that type, the old test found the unrelated row and said
    // NOTHING — while the fallback that used to make the role selectable there
    // anyway had just been removed. Success reported, forty rows stranded.
    //
    // ⚠️ **AND `anyTick` IS NOT KEPT AS A SECOND DISJUNCT, BECAUSE IT COULD
    // NEVER FIRE.** Inside this branch `skipped.length === 0` means every moved
    // type is in `needed`, so `values` is non-empty, so the insert runs and —
    // `onConflictDoNothing` or not — a row exists for each moved type
    // afterwards. `anyTick.length === 0` therefore implies `skipped.length > 0`
    // and the query only cost a round trip. Removing it also removes the
    // „ask after the insert" ordering it needed: `skipped` is decided by the
    // filter, not by what the insert did.
    if (skipped.length > 0) warnings.push("roleWhitelistPending");
  }

  return { granted, warnings };
}
