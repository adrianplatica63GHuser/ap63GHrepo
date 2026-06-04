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
 * "interests". Both filter the same underlying lookup_service_interest table
 * by category ('Serviciu' vs 'Interes'). The category field is injected
 * automatically by the query layer and is never exposed in the UI form.
 */

export const VALID_LIST_KEYS = [
  "property-types",
  "tarla",
  "use-categories",
  "person-types",
  "citizenships",
  "document-types",
  "institutions",
  "services",
  "interests",
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
  // "services" and "interests" both read from lookup_service_interest,
  // filtered by category. The category value is injected by the query layer;
  // the form only exposes the name field.
  services: {
    titleKey: "services",
    fields: [{ key: "name", labelKey: "name", required: true }],
  },
  interests: {
    titleKey: "interests",
    fields: [{ key: "name", labelKey: "name", required: true }],
  },
};
