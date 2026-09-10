/**
 * Configuration for the admin value lists.
 *
 * `VALID_LIST_KEYS` is the canonical set of URL-safe slugs used in
 * /api/admin/value-lists/[list] and the UI.
 *
 * `LIST_META` provides field metadata consumed by the API validation layer
 * and the UI's add/edit form — it is the single place to add a new column.
 *
 * NOTE: lookup_others (formerly used for Services, Interests, and Stamps) was
 * dropped entirely in migration_052. Services and Interests had no UI replacement;
 * Stamps are now managed via the dedicated stamps/stamp_member tables (Slice #19.09).
 *
 * NOTE (Slice #18.07): "groups" was removed from this generic list flow —
 * Groups is now a first-class feature with its own tables (groups /
 * group_member) and a dedicated screen at /admin/groups.
 *
 * NOTE (Slice #29.13): the nine became ELEVEN. `property-property-roles` and
 * `document-document-roles` — the two lists under "Relație între obiecte" —
 * had their own modals, their own routes and a bare `db.delete` with no count,
 * so deleting a role that forty associations carried blanked forty
 * relationship tags and exited 204. That is precisely the failure #29.05
 * exists to prevent, one modal over.
 *
 * ⚠️ **They JOINED rather than gaining a second guard, and the reason is that
 * their tables are the same table.** `lookup_property_property_role` and
 * `lookup_document_document_role` are `id / name / description / sort_order` —
 * column for column what `lookup_person_role` is — so an entry here plus one
 * in LIST_DEPENDENCIES buys the refusal, the live count, the offer, the
 * Romanian and the 409 outright. The alternative was duplicating the
 * dependents route, the reassign route and the whole DeleteDialog for two
 * lists that need nothing the nine do not. What it costs is that the two
 * buttons under "Relație între obiecte" now open the generic modal; what it
 * removes is `property-property-modal.tsx`, `document-document-modal.tsx` and
 * their write routes.
 */

export const VALID_LIST_KEYS = [
  "property-types",
  "tarla",
  "use-categories",
  "person-types",
  "person-roles",
  "citizenships",
  "judicial-person-types",
  "document-types",
  "institutions",
  // Slice #29.13 — the two under "Relație între obiecte". See the header.
  "property-property-roles",
  "document-document-roles",
] as const;

export type ListKey = (typeof VALID_LIST_KEYS)[number];

export function isValidListKey(key: string): key is ListKey {
  return VALID_LIST_KEYS.includes(key as ListKey);
}

// ── Per-field metadata used by the UI ───────────────────────────────────────

export type FieldMeta = {
  key: string;
  /** i18n key inside the `valueList.fields` namespace */
  labelKey: string;
  required: boolean;
  /** When true, renders a <textarea> instead of <input> in the edit form */
  multiline?: boolean;
  /** When "checkbox", renders a checkbox instead of a text input */
  type?: "text" | "checkbox";
  /**
   * Optional literal label string that overrides the i18n `labelKey` lookup.
   * Used for domain-specific Romanian-only labels (e.g. panel names on the
   * Property Type form) without adding extra i18n keys.
   */
  labelText?: string;
  /**
   * Rendered in the ADD form and not in the EDIT form.            (Slice #34.09)
   *
   * ⚠️ **THE FIRST TIME THIS LAYER HAS HAD THE CONCEPT, AND THE SERVER HAS HAD
   * IT SINCE #26.12.** `origin` on document types is create-only and is kept so
   * by two zod schemas plus a strip — `documentTypeSchema` has it,
   * `documentTypeUpdateSchema` omits it, and `stripDocumentTypeOrigin` removes
   * it again for callers that are not the route, on top of the unconditional
   * `stripLookupOrigin` that Slice #34.14 put above `updateValue`'s switch for
   * every list. What did not exist was any
   * way to SAY it on the form, because `value-list-modal.tsx` has one
   * `EditForm` for both verbs and branches on `state.id === null` in exactly
   * two places (the heading, and the URL). So a create-only field had nowhere
   * to live but here.
   *
   * ⚠️ **It governs the FORM, not the TABLE.** A `createOnly` field is still a
   * column in the list — an immutable value you set once and can never see
   * again is a value you cannot verify, and verifying it is the entire point of
   * D-03: the whole reason the key field exists is that Adrian was previously
   * reduced to typing `CONTRACT_VANZARE` as the NAME and renaming the row
   * afterwards, to find out what key he had been given. That costs
   * `document-types` a fourth column (name / key / status / actions) against
   * the budget `value-list-modal.tsx` states for its `max-w-2xl` panel; keys
   * are short and it is one list.
   *
   * ⚠️ **`startEdit` must not seed it either.** The PUT body is the form's
   * `values` object verbatim, so a `createOnly` field seeded from the row would
   * put `key` back on the wire — where `documentTypeUpdateSchema` strips it,
   * but `updateValue` is `.set(values)` over whatever a DIRECT caller hands it
   * and reads `values.key` in its identity-card and catch-all guards. Not
   * sending it keeps those guards judging the STORED key, which is what their
   * tests say they do.
   */
  createOnly?: boolean;
};

export type ListMeta = {
  /** i18n key inside `valueList.lists` — display name of the list */
  titleKey: string;
  fields: FieldMeta[];
};

export const LIST_META: Record<ListKey, ListMeta> = {
  "property-types": {
    titleKey: "propertyTypes",
    fields: [
      { key: "name", labelKey: "name", required: true },
      // Slice #19.02: panel-visibility checkboxes — Romanian-only labels per
      // domain convention (same as "Tarla/Sola", "Carte Funciară" etc.).
      {
        key: "showTarlaParcela",
        labelKey: "showTarlaParcela",
        labelText: "Tarla / Parcelă",
        required: false,
        type: "checkbox",
      },
      {
        key: "showAddress",
        labelKey: "showAddress",
        labelText: "Adresă",
        required: false,
        type: "checkbox",
      },
      {
        key: "showStreetView",
        labelKey: "showStreetView",
        labelText: "Street View",
        required: false,
        type: "checkbox",
      },
    ],
  },
  tarla: {
    titleKey: "tarla",
    fields: [
      { key: "indicativ", labelKey: "indicativ", required: true },
      { key: "descriere", labelKey: "descriere", required: false },
    ],
  },
  "use-categories": {
    titleKey: "useCategories",
    fields: [{ key: "name", labelKey: "name", required: true }],
  },
  "person-types": {
    titleKey: "personTypes",
    fields: [{ key: "name", labelKey: "name", required: true }],
  },
  // ── Slice #34.04: the two whitelists that were tables ──────────────────────
  //
  // „Persoană → Proprietate" and „Persoană → Persoană" were two buttons on the
  // hub, each opening a modal over a table whose only content was a UNIQUE
  // NOT NULL FK back to this list — one bit per role, wearing a costume.
  // migration_079 made them `lookup_person_role.valid_for_property` /
  // `.valid_for_person`, and this entry is the whole of the UI for them: the
  // generic modal already renders a `type: "checkbox"` field as a checkbox in
  // the edit form and as ✓ / – in the row, exactly as it has for
  // `lookup_property_type`'s three `show*` flags since Slice #19.02.
  //
  // ⚠️ **`labelKey`, not `labelText`, and the two i18n keys MOVED rather than
  // being copied.** The words are the ones the deleted hub buttons said, so
  // they are the same Romanian and there must be one copy of it: they moved
  // from `valueList.lists.personToProperty` / `.personToPerson` — where they
  // named a panel that no longer exists — to `valueList.fields`, where they
  // name a column. ⚠️ **`personToDocument` has since gone the same way, in
  // Slice #34.10, but for the other of the two reasons.** It did not collapse
  // into a checkbox — it cannot, being unique over the document-type/role PAIR
  // — it MOVED: the panel now opens from the „Tipuri de document" list's own
  // toolbar, beside the Form editor, under its real name „Roluri pe Document"
  // (`valueList.documentPersons.title`). So `valueList.lists.personToDocument`
  // is gone too, for the same single-copy reason as the two above.
  //
  // ⚠️ **There is deliberately no third checkbox.** See the ⚠️ on
  // `lookupPersonRole` in `src/db/schema/index.ts`.
  "person-roles": {
    titleKey: "personRoles",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
      { key: "validForProperty", labelKey: "validForProperty", required: false, type: "checkbox" },
      { key: "validForPerson",   labelKey: "validForPerson",   required: false, type: "checkbox" },
    ],
  },
  citizenships: {
    titleKey: "citizenships",
    fields: [{ key: "name", labelKey: "name", required: true }],
  },
  "judicial-person-types": {
    titleKey: "judicialPersonTypes",
    fields: [{ key: "name", labelKey: "name", required: true }],
  },
  // ── Slice #34.09: the key that is forever, chosen rather than inherited ────
  //
  // ⚠️ **THIS LIST AND NO OTHER, AND THAT IS D-03 ANSWERED NARROWLY ON
  // PURPOSE.** `lookup_document_type.key` is the immutable slug every document
  // match, every `type-config` carve-out and the whole classifier catalogue run
  // on. The other ten lists mint a `key` that NOTHING READS — `lookup_property_
  // type.key` has been dead since #34.03 (D-23) and the remaining nine have no
  // such column at all — so a key field on them would be a permanent, immutable
  // value asked of an administrator for no reader. When D-23 lands and says
  // what those keys are for, this is the entry to copy.
  //
  // ⚠️ **`required: false`, and it is not a hedge.** An absent key still gets
  // the slug of the name, exactly as every type created before this slice did;
  // the field offers a choice, it does not impose one. It also has to be
  // `false` for a mechanical reason worth knowing: `value-list-ordering.test.ts`
  // asserts every list has EXACTLY ONE required field, because that is the
  // field its `ORDER BY` must end on, and a second required field on this list
  // would fail that test with a message about sorting.
  //
  // ⚠️ **AFTER `name`, not before it.** `EditForm` attaches its autofocus ref to
  // the field at index 0. Putting the key first would open the add form with
  // the cursor in the field a user usually leaves alone.
  "document-types": {
    titleKey: "documentTypes",
    fields: [
      { key: "name", labelKey: "name", required: true },
      { key: "key",  labelKey: "key",  required: false, createOnly: true },
    ],
  },
  institutions: {
    titleKey: "institutions",
    fields: [
      { key: "name",            labelKey: "name",            required: true  },
      { key: "institutionType", labelKey: "institutionType", required: false },
    ],
  },

  // ── Slice #29.13: the two relationship-role lists ──────────────────────────
  //
  // Identical to `person-roles` above, because the tables are identical. The
  // `titleKey`s are the ones the HUB BUTTON already uses — `propertyToProperty`
  // / `documentToDocument` — so the modal header and the button that opened it
  // say the same words. (Their old modals said "Tipuri relație
  // Proprietate–Proprietate" while the button said "Proprietate → Proprietate";
  // one of the two had to go and it is the one nothing else references.)
  "property-property-roles": {
    titleKey: "propertyToProperty",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
    ],
  },
  "document-document-roles": {
    titleKey: "documentToDocument",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
    ],
  },
};
