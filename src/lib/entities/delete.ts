/**
 * The one rule every entity delete obeys: the `principal_object` row goes too.
 *
 * WHY THIS FILE EXISTS
 *   `person`, `property` and `document` each carry a `principal_object_id` FK
 *   with NO ON DELETE clause. Deleting the entity therefore leaves its
 *   principal_object row alive — still holding the entity's code under a
 *   UNIQUE constraint, and still parenting `entity_tag`, `entity_metadata`
 *   and `entity_cross_reference`, all of which cascade from IT rather than
 *   from the entity. So a delete that stops at the entity row leaves the
 *   code, the tags, the metadata and the cross-references of a thing that no
 *   longer exists. Slice #29.04's whole point is that what is on the screen
 *   is what is in the database, and that is not true until this row goes.
 *
 * ORDER IS NOT OPTIONAL
 *   Entity first, principal_object second. The other way round is a
 *   foreign-key violation (23503) on `person_principal_object_id_fkey` and
 *   friends, every time. Both halves run inside ONE transaction so a failure
 *   between them cannot leave a code without an owner.
 *
 * WHAT GOES WITH IT, DELIBERATELY AND SILENTLY
 *   Everything below cascades and nothing warns:
 *     - the whole version history — person_version / property_version /
 *       document_version, plus entity_metadata_version and
 *       entity_provenance_log via entity_metadata;
 *     - every junction row (property_person, person_document,
 *       property_document, and the three self-referential ones);
 *     - group_member and stamp_member, so the entity leaves every group and
 *       stamp it belonged to;
 *     - calculation_run_output, so a run loses the record that it produced
 *       this row;
 *     - entity_cross_reference on BOTH sides. A link pointing AT the deleted
 *       entity disappears exactly as a link pointing FROM it does, and the
 *       entity at the other end is not told: it simply has one fewer
 *       cross-reference than it had.
 *   There is no archive table and no undo. This is the agreed behaviour, not
 *   an oversight — see the migration_070 header.
 *
 * AND THREE COLUMNS ON ROWS THAT ARE NOT BEING DELETED AT ALL
 *   These are ON DELETE SET NULL, so they are blanked on LIVE rows belonging
 *   to other entities, silently:
 *     - document.surveyor_id — every document that named the deleted person
 *       as its surveyor loses the name;
 *     - judicial_person.contact_person_1_id / _2_id — every organisation that
 *       named them as a contact loses it.
 *   Both currently RENDER on screen (getDocumentWithSurveyor and
 *   getJudicialPersonById resolve them with a plain eq(person.id, …)), so a
 *   user watching an unrelated record will see a value disappear. Deleting a
 *   person is therefore not only destructive to that person.
 *
 * WHAT DOES NOT COME BACK
 *   The code. `principal_object.code` is drawn from
 *   `principal_object_code_seq` and `nextval()` never rolls back, so deleting
 *   PPERS00112 does not free PPERS00112 — the next person is PPERS00113. That
 *   is the opposite of the rule for lookup KEYS, which a delete does free
 *   immediately, and the two must not be collapsed into one sentence by a
 *   later reader.
 */

import { inArray } from "drizzle-orm";
import { principalObject } from "@/db/schema";
import type { DbTransaction } from "@/db";

/**
 * Delete the principal_object rows an entity delete has just orphaned.
 *
 * Call this INSIDE the same transaction as the entity delete, and only after
 * it — see the ordering note above. A caller with nothing to delete passes an
 * empty array and this is a no-op rather than a `DELETE ... IN ()`.
 */
export async function deletePrincipalObjects(
  tx: DbTransaction,
  principalObjectIds: string[],
): Promise<void> {
  if (principalObjectIds.length === 0) return;
  await tx
    .delete(principalObject)
    .where(inArray(principalObject.id, principalObjectIds));
}
