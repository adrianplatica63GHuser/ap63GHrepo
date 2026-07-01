/**
 * Configuration for the admin value lists.
 *
 * `VALID_LIST_KEYS` is the canonical set of URL-safe slugs used in
 * /api/admin/value-lists/[list] and the UI.
 *
 * `LIST_META` provides field metadata consumed by the API validation layer
 * and the UI's add/edit form — it is the single place to add a new column.
 *
 * NOTE: "service-interests" was replaced in Slice 9.7 by "services" and
 * "interests". Both filter the same underlying lookup_others table (renamed
 * from lookup_service_interest in Slice 9.8) by category ('Serviciu' vs
 * 'Interes'). "stamps" ('Stampila') was added in Slice 9.8 and uses the same
 * table + pattern. The category field is injected automatically by the query
 * layer and is never exposed in the UI form.
 *
 * NOTE (Slice #18.07): "groups" was removed from this generic list flow —
 * Groups is now a first-class feature with its own tables (groups /
 * group_member) and a dedicated screen at /admin/groups.
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
  "services",
  "interests",
  "stamps",
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
  "person-roles": {
    titleKey: "personRoles",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
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
  // "services", "interests", and "stamps" all read from lookup_others,
  // filtered by category. The category value is injected by the query layer;
  // the form exposes name + description. (Groups moved to its own feature in
  // Slice #18.07 — see /admin/groups.)
  services: {
    titleKey: "services",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
    ],
  },
  interests: {
    titleKey: "interests",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
    ],
  },
  stamps: {
    titleKey: "stamps",
    fields: [
      { key: "name",        labelKey: "name",        required: true  },
      { key: "description", labelKey: "description", required: false, multiline: true },
    ],
  },
};
