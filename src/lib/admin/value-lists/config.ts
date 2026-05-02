/**
 * Configuration for the eight admin value lists.
 *
 * `VALID_LIST_KEYS` is the canonical set of URL-safe slugs used in
 * /api/admin/value-lists/[list] and the UI.
 *
 * `LIST_META` provides field metadata consumed by the API validation layer
 * and the UI's add/edit form — it is the single place to add a new column.
 */

export const VALID_LIST_KEYS = [
  "property-types",
  "tarla",
  "use-categories",
  "person-types",
  "citizenships",
  "document-types",
  "institutions",
  "service-interests",
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
};

export type ListMeta = {
  /** i18n key inside `valueList.lists` — display name of the list */
  titleKey: string;
  fields: FieldMeta[];
};

export const LIST_META: Record<ListKey, ListMeta> = {
  "property-types": {
    titleKey: "propertyTypes",
    fields: [{ key: "name", labelKey: "name", required: true }],
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
  citizenships: {
    titleKey: "citizenships",
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
  "service-interests": {
    titleKey: "serviceInterests",
    fields: [
      { key: "name",     labelKey: "name",     required: true  },
      { key: "category", labelKey: "category", required: false },
    ],
  },
};
