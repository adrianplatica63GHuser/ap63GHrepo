/**
 * „May this role be attached here?" — asked once, for every association kind.
 *                                                              (Slice #34.15)
 *
 * WHAT WAS WRONG, IN ONE SENTENCE
 *   Five POST routes accepted any `uuid` as a person role and no route
 *   anywhere read a whitelist, so the only thing standing between a withdrawn
 *   role and the archive was a `<select>` — and since Slice #34.05 that select
 *   PRINTS the withdrawn role, disabled, carrying the real
 *   `lookup_person_role.id` in the DOM. That `disabled` is the right call for
 *   the DOM (`carried-roles-merge.ts` says why at length) and it is client-side
 *   enforcement: devtools now reaches a withdrawn role in one step, where
 *   before the role was simply absent from the page.
 *
 * ⚠️ **THIS MODULE IS PURE, AND THAT IS THE WHOLE OF ITS DESIGN.** It never
 * reads the database and never imports anything that does, so „is this role
 * attachable" is answerable in a test without a browser, a server or a
 * connection. The five call sites in the query layer each hand it the offered
 * set they already have — see the next paragraph for why that is not a
 * shortcut.
 *
 * ⚠️ **THERE IS NO SINGLE ANSWER TO „WHICH ROLES ARE OFFERED", AND PRETENDING
 * OTHERWISE IS HOW THE DOOR WOULD REFUSE WHAT THE PICKER OFFERS.** The
 * Proprietate ↔ Persoană screens read `lookup_person_role.valid_for_property`,
 * „Persoană ↔ Persoană" reads `valid_for_person`, the document side reads the
 * document type's own whitelist (with a fallback), and „Persoană → Document"
 * reads the distinct roles across all types (with none). `use-lookup-options.ts`
 * states the same thing from the picker's side. So the KIND decides which
 * source answers, the caller supplies that source's ids, and this module holds
 * the one rule they share. A gate that re-derived the offered set from its own
 * query would be a second copy of a rule that already exists five times — and
 * the first time the two disagreed, the picker would offer a role the door
 * refused, which is worse than the hole this closes.
 *
 * ⚠️ **A NULL ROLE IS ALWAYS ATTACHABLE AND IS NEVER A QUESTION.** The role is
 * optional on every one of these screens — that is what
 * `shared.roleListUnavailable` promises the user in as many words („Rolul este
 * oricum opțional") — so `null` returns allowed without the caller reading
 * anything. That is also why the common path costs no extra query.
 *
 * ⚠️ **THE AI PARTY LINKER NEEDS NO EXEMPTION, AND THAT IS A FACT ABOUT THE
 * DATA RATHER THAN A COURTESY.** `ai-party-linker-dialog.tsx` POSTs to the same
 * document route, and its `party.personRoleId` comes from
 * `listPersonRolesForDocumentType(documentTypeId)` (see the `partyRoles` read
 * in `api/documents/[id]/ai-interpret/route.ts`) — which is exactly STAGE 1 of
 * `listPersonRolesForDocument`, the set this door uses for `document-person`.
 * Stage 1 is what the door offers whenever it is non-empty, and when it is
 * empty party extraction does not run at all (`partyRolesConfigured: false`).
 * So every role the model can propose is already inside the offered set, and
 * the door refuses it in exactly one case: the tick was removed between the
 * paid read and the admin pressing the dialog's link button. That case is REFUSED rather than
 * exempted, deliberately: the stepper recognises the refusal by its `code` and
 * names the role in a Romanian sentence of its own — `roleMissingBody` on the
 * link path, `roleMissingAfterCreate` on the one that has already written a
 * person — so nothing is discarded silently. A caller-declared exemption would
 * instead be a flag any hand-made request could also set, which is the one
 * thing this module exists to stop.
 */

/**
 * Which association is being written, named as the screen and the route name
 * it: `<the entity being written from>-<what is being attached>`.
 *
 * Deliberately NOT `CarriedRoleKind` (`carried-roles.ts`), even though four of
 * the names coincide. That type answers „which rows may this entity re-offer a
 * role from" and has no `person-document` member ON PURPOSE — the comment on
 * its `document-person` branch spends a paragraph on why. This one answers
 * „which whitelist governs this write" and must cover all five routes,
 * `person-document` included. One type serving both questions would make the
 * missing member look like an oversight in whichever file was read second.
 */
export const ROLE_ATTACHMENT_KINDS = [
  /** POST /api/documents/[id]/persons     → `person_document.person_role_id` */
  "document-person",
  /** POST /api/properties/[id]/persons    → `property_person.person_role_id` */
  "property-person",
  /** POST /api/people/[id]/properties     → `property_person.person_role_id` */
  "person-property",
  /** POST /api/people/[id]/documents      → `person_document.person_role_id` */
  "person-document",
  /** POST /api/people/[id]/references     → `person_person.relationship_role_id` */
  "person-person",
] as const;

export type RoleAttachmentKind = (typeof ROLE_ATTACHMENT_KINDS)[number];

/**
 * Which list answers for each kind, as prose the caller has to match.
 *
 * ⚠️ **Documentation with a type behind it, not a lookup table.** Nothing
 * dispatches on this — the caller passes the ids — so it cannot drift into
 * being a second source of truth. What it buys is that the five readers are
 * named in ONE place, so a sixth route added later has to say which list it
 * belongs to before it compiles.
 */
export const ROLE_OFFER_SOURCE: Record<RoleAttachmentKind, string> = {
  "document-person": "listPersonRolesForDocument(documentId) — the document type's whitelist, with the all-types fallback",
  "property-person": "lookup_person_role.valid_for_property",
  "person-property": "lookup_person_role.valid_for_property",
  "person-document": "listDistinctDocPersonRoles() — every role ticked for some document type, no fallback",
  "person-person":   "lookup_person_role.valid_for_person",
};

export type RoleAttachmentVerdict =
  | { allowed: true }
  | { allowed: false; kind: RoleAttachmentKind; roleId: string };

/**
 * The rule, and the only place it is written.
 *
 * `offeredRoleIds` is whatever the caller's own picker filters on. An EMPTY set
 * is a real answer — „this whitelist offers nothing" — and refuses every
 * non-null role, which is correct: a screen whose offered list is empty renders
 * no select at all, so any role arriving on that route came from somewhere
 * other than the screen.
 *
 * ⚠️ **An unreadable list is not an empty one, and this function cannot tell
 * them apart — so the CALLER must not ask it to.** On the read side a failed
 * whitelist GET is `listState === "failed"` and the screen says so; on the
 * write side a failed query throws before it reaches here. What must never
 * happen is a caller catching that failure, passing `[]`, and turning „the
 * database is down" into „that role is not valid here".
 */
export function mayAttachRole(
  kind: RoleAttachmentKind,
  roleId: string | null | undefined,
  offeredRoleIds: Iterable<string>,
): RoleAttachmentVerdict {
  if (roleId === null || roleId === undefined) return { allowed: true };
  for (const offered of offeredRoleIds) {
    if (offered === roleId) return { allowed: true };
  }
  return { allowed: false, kind, roleId };
}

/**
 * The refusal, as an error the routes can recognise without string-matching.
 *
 * ⚠️ **A named class rather than a `code` on a plain Error**, because the five
 * routes all funnel their `catch` into `unexpectedError`, which answers 500.
 * `instanceof` is what lets `roleNotOfferedToResponse` pick this one out and
 * answer 400 while every other throw keeps the 500 it had.
 */
export class RoleNotOfferedError extends Error {
  readonly kind: RoleAttachmentKind;
  readonly roleId: string;

  constructor(kind: RoleAttachmentKind, roleId: string) {
    super(
      `Role ${roleId} is not offered for ${kind} associations ` +
        `(source: ${ROLE_OFFER_SOURCE[kind]})`,
    );
    this.name = "RoleNotOfferedError";
    this.kind = kind;
    this.roleId = roleId;
  }
}

/**
 * `mayAttachRole`, as the guard the query layer actually writes.
 *
 * ⚠️ **`readOffered` is a THUNK, and the laziness is the point.** The role is
 * optional and usually absent, so on the common path this runs no query at all
 * — the door costs one extra SELECT only on the writes that actually carry a
 * role.
 */
export async function assertRoleMayBeAttached(
  kind: RoleAttachmentKind,
  roleId: string | null | undefined,
  readOffered: () => Promise<readonly string[]>,
): Promise<void> {
  if (roleId === null || roleId === undefined) return;
  const verdict = mayAttachRole(kind, roleId, await readOffered());
  if (!verdict.allowed) throw new RoleNotOfferedError(verdict.kind, verdict.roleId);
}
