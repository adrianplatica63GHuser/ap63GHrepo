/**
 * The ticks a moved association needs on its NEW role.          (Slice #29.13)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   Moving forty Proprietate–Persoană associations from role A to role B does
 *   not move A's whitelist ticks — deliberately, see `configuration` in
 *   ./dependents.ts — and the association screens build their role dropdown
 *   from the WHITELIST (`/api/admin/property-person-roles`,
 *   `/api/documents/[id]/valid-person-roles`,
 *   `/api/admin/doc-type-person-roles/distinct-roles`,
 *   `/api/admin/person-person-roles`) while the display path joins
 *   `lookup_person_role` DIRECTLY. So a row moved onto a role that is not
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
 * ⚠️ **…AND A TYPE THAT HAS NO TICKS AT ALL IS SKIPPED, WHICH IS THE OPPOSITE
 * OF WHAT IT LOOKS LIKE. An adversarial round found the first version here
 * TAKING eligibility away.** `listPersonRolesForDocument`
 * (src/lib/documents/queries.ts) is two-stage: the roles ticked for the
 * document's own type, and — when that type has NO rows in
 * `lookup_doc_type_person_role` at all — a fallback returning every role ticked
 * for SOME type. (Not every role in the archive: a role ticked nowhere is in
 * neither stage, which is the whole of the `roleWhitelistPending` paragraph
 * below.) An unconfigured type is the ordinary case, and on one of those every
 * ticked role is already selectable. Insert a single row for it and stage one
 * starts returning results, the fallback never runs, and the picker collapses
 * from that whole set to "the one role this move just granted" — silently, in
 * a panel the administrator was not looking at, which is exactly the harm the
 * paragraph above swears off. `listPersonRolesForDocumentType` (no fallback,
 * used to decide whether AI party extraction runs at all) would flip the same
 * type from "not configured, skip" to "configured, one role".
 *
 * So the grant is a TOP-UP of a whitelist that already exists, never the
 * creation of one.
 *
 * ⚠️ **THAT LEAVES EXACTLY ONE CASE THIS CANNOT REPAIR, AND IT IS REPORTED
 * RATHER THAN GUESSED AT.** The fallback is not "every role" — it is every
 * role ticked for SOME document type (`listPersonRolesForDocument` stage 2b,
 * and `listDistinctDocPersonRoles` behind the person-side picker, which has no
 * fallback at all). So when EVERY document type the rows moved from is
 * unconfigured AND the target is ticked for no type anywhere, the target is in
 * neither picker and nothing safe can put it there: ticking an unconfigured
 * type collapses that type's offer to one role, and ticking an unrelated
 * configured type grants an eligibility in a panel nobody was looking at.
 * There is no third option, so this returns `roleWhitelistPending` and the
 * dialog asks the administrator to tick it in Roluri pe Document — which is
 * what the deleted `confirm.roleWhitelistNote` said to EVERY user of the move,
 * narrowed to the one case where it is true.
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

import { eq, inArray } from "drizzle-orm";
import type { DbTransaction } from "@/db";
import {
  document,
  lookupDocTypePersonRole,
  lookupPersonPersonRole,
  lookupPropertyPersonRole,
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

  // ── Roluri pe Proprietate ──────────────────────────────────────────────────
  const propertyRows = await tx
    .select({ id: propertyPerson.id })
    .from(propertyPerson)
    .where(eq(propertyPerson.personRoleId, fromRoleId))
    .limit(1);
  if (propertyRows.length > 0) {
    const rows = await tx
      .insert(lookupPropertyPersonRole)
      .values({ personRoleId: toRoleId })
      .onConflictDoNothing()
      .returning({ id: lookupPropertyPersonRole.id });
    if (rows.length > 0) {
      granted.push({ labelKey: "propertyPersonRoleWhitelist", count: rows.length });
    }
  }

  // ── Persoană → Persoană ────────────────────────────────────────────────────
  const personRows = await tx
    .select({ id: personPerson.id })
    .from(personPerson)
    .where(eq(personPerson.relationshipRoleId, fromRoleId))
    .limit(1);
  if (personRows.length > 0) {
    const rows = await tx
      .insert(lookupPersonPersonRole)
      .values({ personRoleId: toRoleId })
      .onConflictDoNothing()
      .returning({ id: lookupPersonPersonRole.id });
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

    // The case above cannot repair — asked AFTER the insert, so a top-up that
    // did land counts. One row anywhere is enough: it puts the target into
    // `listDistinctDocPersonRoles` and into stage 2b's fallback, which is what
    // makes it selectable on the unconfigured types too.
    const anyTick = await tx
      .select({ id: lookupDocTypePersonRole.id })
      .from(lookupDocTypePersonRole)
      .where(eq(lookupDocTypePersonRole.personRoleId, toRoleId))
      .limit(1);
    if (anyTick.length === 0) warnings.push("roleWhitelistPending");
  }

  return { granted, warnings };
}
