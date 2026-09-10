/**
 * The OFFERED role ids, read from the same source each picker filters on.
 *                                                              (Slice #34.15)
 *
 * `role-attachment.ts` holds the rule and is pure; this is the database half,
 * split for the same reason `carried-roles-merge.ts` and `carried-roles.ts` are
 * split — so the rule can be driven from a test without a connection.
 *
 * ⚠️ **FOUR OF THE FIVE KINDS ARE HERE, AND THE FIFTH IS ABSENT ON PURPOSE.**
 * `document-person` is offered `listPersonRolesForDocument(documentId)`, which
 * lives in `src/lib/documents/queries.ts` — in the same module as
 * `associatePersonsToDocument`, the only caller that needs it. Re-reading its
 * two-stage rule here (the document type's own ticks, falling back to every
 * role ticked for SOME type when that type has none) would put that rule in two
 * places, and the first time the copies disagreed the picker would offer a role
 * this door refused. A second copy of a whitelist is exactly the divergence
 * #34.05 was written to remove, arrived at from the write side.
 *
 * ⚠️ **`eq(…, true)` rather than `IS NOT TRUE`, and it is the opposite question
 * to the one `role-whitelists.ts` asks.** That module asks „is this tick
 * MISSING", where a NULL — reachable through a hand-add or a partial
 * `drizzle-kit push`, as `supabase_repair_missing_tables.sql` says in its own
 * comments — must count as missing. This one asks „is this tick PRESENT", where
 * a NULL must count as absent. Both are `NOT NULL` in migration_079; both
 * spellings are chosen so that a nullable copy answers safely rather than
 * silently. It is also what the picker already does: `use-lookup-options.ts`
 * filters with `rows.filter((r) => r.validForProperty)`, and a NULL is falsy
 * there.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lookupPersonRole } from "@/db/schema";
import { listDistinctDocPersonRoles } from "@/lib/admin/doc-type-person-roles/queries";

/**
 * `lookup_person_role.valid_for_property` — the three Proprietate ↔ Persoană
 * screens, read from either end (`property-person` and `person-property` are
 * two doors onto one table, so they share one offer).
 */
export async function personRoleIdsValidForProperty(): Promise<string[]> {
  const rows = await db
    .select({ id: lookupPersonRole.id })
    .from(lookupPersonRole)
    .where(eq(lookupPersonRole.validForProperty, true));
  return rows.map((r) => r.id);
}

/** `lookup_person_role.valid_for_person` — „Persoană ↔ Persoană". */
export async function personRoleIdsValidForPerson(): Promise<string[]> {
  const rows = await db
    .select({ id: lookupPersonRole.id })
    .from(lookupPersonRole)
    .where(eq(lookupPersonRole.validForPerson, true));
  return rows.map((r) => r.id);
}

/**
 * Every role ticked for SOME document type — the list behind „Persoană →
 * Document", where the document type is not known until a document is picked.
 *
 * ⚠️ **Delegated rather than re-queried.** `listDistinctDocPersonRoles` is what
 * `/api/admin/doc-type-person-roles/distinct-roles` serves and what those two
 * screens render when 0 or 2+ documents are selected; calling it is what keeps
 * the door and the picker the same list rather than two lists that agree today.
 *
 * ⚠️ **It has NO fallback, unlike the document side, and that asymmetry is the
 * shipped one.** A role ticked for no type at all is offered nowhere and is
 * therefore attachable nowhere — which is `role-whitelists.ts`'s
 * `roleWhitelistPending` case, reported to the administrator rather than
 * guessed at.
 *
 * ⚠️ **THIS IS THE WIDER OF THE TWO LISTS THOSE SCREENS SHOW, AND IT HAS TO
 * BE.** „Asociază document" offers the SELECTED document type's whitelist when
 * exactly one document is ticked and this list otherwise — and the narrower one
 * is a subset of this one either way, because both stages of
 * `listPersonRolesForDocument` read `lookup_doc_type_person_role`, which is
 * what this counts distinctly. So the door never refuses a role that picker
 * offered. Checking the narrower list instead would be stricter than the
 * screen, and it could not be answered at all for the ordinary multi-document
 * write, where one role is attached to documents of several types at once.
 */
export async function personRoleIdsAcrossDocumentTypes(): Promise<string[]> {
  const rows = await listDistinctDocPersonRoles();
  return rows.map((r) => r.id);
}
