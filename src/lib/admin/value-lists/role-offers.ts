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
 * rule here — since Slice #34.16 a single one, the document type's own ticks
 * and nothing else — would put that rule in two places, and the first time the
 * copies disagreed the picker would offer a role this door refused. A second
 * copy of a whitelist is exactly the divergence #34.05 was written to remove,
 * arrived at from the write side. (Until #34.16 the rule had two stages, the
 * second of which widened the answer to every role ticked for SOME type when
 * the document's own type had none; D-16(b) removed it, and that function's
 * header carries the argument.)
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
 * ⚠️ **It has no fallback — and since Slice #34.16 neither does the document
 * side, so there is no longer an asymmetry here to defend.** A role ticked for
 * no type at all is offered nowhere and is therefore attachable nowhere —
 * which is `role-whitelists.ts`'s `roleWhitelistPending` case, reported to the
 * administrator rather than guessed at. What D-16(b) changed is that a role
 * ticked for SOME OTHER type is now equally unattachable on a type that has
 * none of its own, instead of being offered there by a fallback nobody had
 * configured.
 *
 * ⚠️ **THIS IS THE WIDER OF THE TWO LISTS THOSE SCREENS SHOW, AND IT HAS TO
 * BE.** „Asociază document" offers the SELECTED document type's whitelist when
 * exactly one document is ticked and this list otherwise — and the narrower one
 * is a subset of this one either way, because it reads
 * `lookup_doc_type_person_role` for one type and this counts the same table
 * distinctly across all of them. #34.16 made that containment tighter, not
 * looser: the stage it removed was the one that could return roles from OTHER
 * types, and even that stage read this same table. So the door never refuses a
 * role that picker offered. Checking the narrower list instead would be
 * stricter than the screen, and it could not be answered at all for the
 * ordinary multi-document write, where one role is attached to documents of
 * several types at once.
 *
 * ⚠️ **AND THAT WIDTH NOW HAS A CONSEQUENCE ON THE WRITE SIDE THAT D-16(b)
 * CREATED AND DID NOT CLOSE. NAMED HERE RATHER THAN LEFT TO BE FOUND.** Tick
 * „Contract de vânzare" (configured) and „Plan cadastral" (no ticks at all) on
 * „Asociază document", pick Vânzător, save: this list offered it, this door
 * allows it, and two `person_document` rows are written. On the Plan cadastral
 * row, `listPersonRolesForDocument` now answers nothing, so Vânzător can never
 * be chosen for that document again — until Slice #34.16 the fallback offered
 * it there. That is the state `role-whitelists.ts` raises
 * `roleWhitelistPending` for when an ADMINISTRATOR moves rows into it, reached
 * by an ordinary user on a create screen with nothing said. #34.05's union
 * still covers the display: the row renders its role, marked
 * „(nu mai este disponibil)". What is missing is anything at the moment of
 * WRITING, and every fix has a cost worth deciding rather than guessing —
 * narrowing this list per selected document is the one this paragraph has
 * already refused, and warning at save time is a new sentence on a screen that
 * currently promises the role is optional. It is in the handover as its own
 * decision.
 */
export async function personRoleIdsAcrossDocumentTypes(): Promise<string[]> {
  const rows = await listDistinctDocPersonRoles();
  return rows.map((r) => r.id);
}
