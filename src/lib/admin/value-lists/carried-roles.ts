/**
 * The person roles an entity's association rows ALREADY CARRY.   (Slice #34.05)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   Display and selection read different sources. Every display path is a bare
 *   `leftJoin(lookupPersonRole, …)` on the association's own `person_role_id`
 *   and renders whatever the row carries; every picker path starts from a
 *   permission table — `lookup_doc_type_person_role`, or, since Slice #34.04,
 *   `valid_for_property` / `valid_for_person` on `lookup_person_role` — and can
 *   therefore only OFFER a ticked role. `./role-whitelists.ts` states that
 *   split at length. The two diverge exactly where an association carries a
 *   role that has no tick: the row reads correctly on screen, the role is
 *   absent from the dropdown, so it cannot be re-selected, and nothing says
 *   why.
 *
 *   This module is the second source. The picker unions what the whitelist
 *   OFFERS with what this entity's rows CARRY, and marks the difference
 *   „(nu mai este disponibil)" — the state on screen instead of an empty
 *   select beside a filled row.
 *
 * ⚠️ **SCOPED TO ONE ENTITY, AND THAT IS THE WHOLE SAFETY ARGUMENT.** This
 * answers "which roles do THIS property's / THIS person's / THIS document's own
 * rows carry", never "which roles does some association somewhere carry". The
 * distinction is the same one `role-whitelists.ts` makes and for the same
 * reason: a global answer would put a role that this entity never had into a
 * picker the administrator was not looking at, which is granting eligibility
 * nobody asked for. An entity-scoped answer grants nothing — it re-offers only
 * what is already on the screen the user came from, so the worst it can do is
 * let them put back what they can already see.
 *
 * ⚠️ **IT RETURNS EVERY CARRIED ROLE, TICKED OR NOT, AND THE CALLER SUBTRACTS.**
 * It would be shorter to filter the ticked ones out here, and it would be
 * wrong: there is no single answer to "is this role offered". The three
 * Proprietate ↔ Persoană screens ask `valid_for_property`, „Persoană ↔
 * Persoană" asks `valid_for_person`, and the two document screens ask a list
 * that depends on the DOCUMENT SELECTED IN THE FORM — per type when one is
 * selected, `listDistinctDocPersonRoles` when none or many are. Only the
 * picker knows which list it is showing, so only the picker can say what is
 * missing from it. `withCarriedRoles` (src/hooks/use-lookup-options.ts) is that
 * subtraction, and it is a pure function so it can be tested without a browser.
 *
 * ⚠️ **NOT A WRITE, AND DELIBERATELY NOT A REPAIR.** A role that lost its tick
 * stays unticked here — nothing in this module ticks anything back. Restoring
 * one is a tick in Reference Data, which is the one place that can do it.
 *
 * ⚠️ **AND SINCE SLICE #34.16 THIS MODULE IS WHAT MADE THAT DECISION
 * AFFORDABLE.** Where these lines used to point at D-16(b) as somebody else's
 * question, the answer is now in: the unconfigured-document-type FALLBACK in
 * `listPersonRolesForDocument` is gone, so on a type with no ticks the offered
 * list is empty and the picker's ONLY entries are the ones this module returns,
 * each marked „(nu mai este disponibil)". That is the whole reason the fallback
 * could go — the union already covers the row that has a role, so removing it
 * takes away the CHOICE on a new association and never blanks a row that reads
 * correctly. Before #34.05 those were the same thing. The empty case is not
 * left silent: all three screens that read a document type's whitelist render
 * `components/forms/no-roles-for-type-note.tsx`, which prints
 * `shared.noRolesForType` beside the picker.
 */

import { asc, eq, or } from "drizzle-orm";
import { db } from "@/db";
import {
  lookupPersonRole,
  personDocument,
  personPerson,
  propertyPerson,
} from "@/db/schema";

/**
 * Which association, read from which side.
 *
 * The name is `<the entity the screen is about>-<what it is being joined to>`,
 * which is also the direction the association screen's URL runs in. The first
 * two read the same table from its two ends — that is not a duplicate: the
 * property screen offers what THIS property's rows carry, the person screen
 * what THIS person's do. `person_document` has one end here rather than two,
 * and the comment on that branch says why.
 */
export const CARRIED_ROLE_KINDS = [
  "property-person",
  "person-property",
  "person-person",
  "document-person",
] as const;

export type CarriedRoleKind = (typeof CARRIED_ROLE_KINDS)[number];

export type CarriedRole = { id: string; name: string };

/**
 * The distinct person roles carried by `entityId`'s rows of this association,
 * ordered by name — the same order every picker already renders.
 *
 * An entity with no rows, or whose rows all have a null role, returns `[]`:
 * `person_role_id` is nullable (`ON DELETE SET NULL`) and the INNER join drops
 * those, which is right — a row carrying no role has nothing to re-offer.
 */
export async function listCarriedPersonRoles(
  kind: CarriedRoleKind,
  entityId: string,
): Promise<CarriedRole[]> {
  const selection = { id: lookupPersonRole.id, name: lookupPersonRole.name };
  const order = asc(lookupPersonRole.name);

  switch (kind) {
    case "property-person":
    case "person-property":
      return db
        .selectDistinct(selection)
        .from(propertyPerson)
        .innerJoin(lookupPersonRole, eq(propertyPerson.personRoleId, lookupPersonRole.id))
        .where(
          kind === "property-person"
            ? eq(propertyPerson.propertyId, entityId)
            : eq(propertyPerson.personId, entityId),
        )
        .orderBy(order);

    // ⚠️ Both ends. `person_person` is stored once per pair — `person_id_a` and
    // `person_id_b` — and the references tab reads it from whichever end the
    // person is on (`listPersonReferences`). Filtering on `person_id_a` alone
    // would answer "no carried role" for every reference this person did not
    // create, which is the empty select this module exists to remove.
    case "person-person":
      return db
        .selectDistinct(selection)
        .from(personPerson)
        .innerJoin(lookupPersonRole, eq(personPerson.relationshipRoleId, lookupPersonRole.id))
        .where(or(eq(personPerson.personIdA, entityId), eq(personPerson.personIdB, entityId)))
        .orderBy(order);

    // ⚠️ **THE DOCUMENT END ONLY, AND THERE IS NO `person-document` TWIN.**
    // `person_document` is read from the document side because that is the one
    // side where a picker's OFFERED list is scoped to the same thing: the
    // document's own type whitelist. The person-side „Asociază document"
    // screens deliberately do not union at all — their offered list changes
    // with the document selected in the form, so no carried scope makes the
    // mark a true sentence; the reason is written out on both of those screens.
    // A `person-document` kind would be live surface answering exactly the
    // question those screens refuse to ask.
    case "document-person":
      return db
        .selectDistinct(selection)
        .from(personDocument)
        .innerJoin(lookupPersonRole, eq(personDocument.personRoleId, lookupPersonRole.id))
        .where(eq(personDocument.documentId, entityId))
        .orderBy(order);
  }
}
