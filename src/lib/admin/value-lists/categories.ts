/**
 * „Date de referință" as one page: the categories on the left.  (Slice #38.35)
 *
 * Every list the old hub opened is reached from exactly one category, in the
 * hub's order. A list added to `VALID_LIST_KEYS` and named in no category is
 * not lost: it lands under „Altele" (`listsByCategory`), and the jest suite
 * pins that today there is none.
 *
 * PURE — no React, no DB.
 */
import { VALID_LIST_KEYS, type ListKey } from "./config";

export type ValueListCategoryId = "property" | "person" | "document" | "roles" | "links" | "other";

/** The categories, top to bottom, and their lists, in the order the hub showed them. */
export const VALUE_LIST_CATEGORIES: readonly { id: Exclude<ValueListCategoryId, "other">; lists: readonly ListKey[] }[] = [
  { id: "property", lists: ["property-types", "tarla", "use-categories"] },
  { id: "person", lists: ["person-types", "judicial-person-types", "citizenships"] },
  { id: "document", lists: ["document-types", "institutions"] },
  { id: "roles", lists: ["person-roles"] },
  // „Tip legătură": a link between two objects of the same kind, not a role a person plays.
  { id: "links", lists: ["property-property-roles", "document-document-roles"] },
];

/** The categories with their lists, „Altele" last and only when some list is in no category. */
export function listsByCategory(): { id: ValueListCategoryId; lists: ListKey[] }[] {
  const named = new Set<ListKey>(VALUE_LIST_CATEGORIES.flatMap((c) => c.lists));
  const other = VALID_LIST_KEYS.filter((k) => !named.has(k));
  return [
    ...VALUE_LIST_CATEGORIES.map((c) => ({ id: c.id as ValueListCategoryId, lists: [...c.lists] })),
    ...(other.length > 0 ? [{ id: "other" as const, lists: other }] : []),
  ];
}

/** The category a list is under. */
export function categoryOfList(key: ListKey): ValueListCategoryId {
  return listsByCategory().find((c) => c.lists.includes(key))?.id ?? "other";
}

/**
 * The rows of a list in the order the panel draws them: in use first, as the
 * list orders them, then every value nothing uses (Ask first 2 — „nefolosit",
 * greyed, last: the clean-up's first candidates). Rows whose count has not
 * arrived yet keep their place.
 */
export function usedFirst<T extends { id: string }>(rows: readonly T[], usage: Readonly<Record<string, number>> | undefined): T[] {
  if (!usage) return [...rows];
  const unused = (r: T) => (usage[r.id] ?? 0) === 0 && r.id in usage;
  return [...rows.filter((r) => !unused(r)), ...rows.filter(unused)];
}
