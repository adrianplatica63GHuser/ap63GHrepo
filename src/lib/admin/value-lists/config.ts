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
  // name a column. `personToDocument` stays in `lists`: „Persoană → Document"
  // does not collapse (it is unique over the document-type/role PAIR) and its
  // button is still there until Slice #34.10.
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
  "document-types": {
    titleKey: "documentTypes",
    fields: [{ key: "name", labelKey: "name", required: true }],
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
