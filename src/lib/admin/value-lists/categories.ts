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

export type ValueListCategoryId = "objectTypes" | "rolesLinks" | "valueLists" | "other";

/**
 * The categories, top to bottom, and their lists — Slice #38.61, Adrian's three groups, in his order:
 * the kinds of object, then how objects are tied to each other, then the plain lists of values.
 * #38.35 had five („Proprietăți", „Persoane", „Acte", „Roluri", „Legături între obiecte"), grouped by
 * the object a list belonged to. The list keys — and so every `?list=` link — do not change.
 */
export const VALUE_LIST_CATEGORIES: readonly { id: Exclude<ValueListCategoryId, "other">; lists: readonly ListKey[] }[] = [
  { id: "objectTypes", lists: ["person-types", "judicial-person-types", "property-types", "document-types"] },
  // A role a person plays, and „Tip legătură": a link between two objects of the same kind.
  { id: "rolesLinks", lists: ["person-roles", "property-property-roles", "document-document-roles"] },
  // Slice #39.66: „Categorii Folosință" left this group for the page of „Tipuri de proprietate și folosințe".
  { id: "valueLists", lists: ["tarla", "citizenships", "institutions"] },
];

/**
 * Lists that are shown on another list's page rather than on their own.                              (Slice #39.66)
 *
 * „Categorii Folosință" is the second tile of „Tipuri de proprietate și folosințe" (Adrian: „one page, Property types
 * and uses, with two tiles"). It has no line in the column and is not „Altele"; `?list=use-categories` — every old
 * link — opens the page it is on. The list key, its API and its table do not change.
 */
export const LIST_PAGE_OF: Partial<Record<ListKey, ListKey>> = { "use-categories": "property-types" };

/** The list whose page shows this list: itself, or the page it is a tile of. */
export function pageListOf(key: ListKey): ListKey {
  return LIST_PAGE_OF[key] ?? key;
}

/** The lists one page shows, in order: the page's own list, then the lists that are its tiles. */
export function listsOnPage(key: ListKey): ListKey[] {
  const page = pageListOf(key);
  return [page, ...(Object.entries(LIST_PAGE_OF) as [ListKey, ListKey][]).filter(([, host]) => host === page).map(([k]) => k)];
}

/** The categories with their lists, „Altele" last and only when some list is in no category. */
export function listsByCategory(): { id: ValueListCategoryId; lists: ListKey[] }[] {
  const named = new Set<ListKey>([...VALUE_LIST_CATEGORIES.flatMap((c) => c.lists), ...(Object.keys(LIST_PAGE_OF) as ListKey[])]);
  const other = VALID_LIST_KEYS.filter((k) => !named.has(k));
  return [
    ...VALUE_LIST_CATEGORIES.map((c) => ({ id: c.id as ValueListCategoryId, lists: [...c.lists] })),
    ...(other.length > 0 ? [{ id: "other" as const, lists: other }] : []),
  ];
}

/** The category a list is under. */
export function categoryOfList(key: ListKey): ValueListCategoryId {
  const page = pageListOf(key);
  return listsByCategory().find((c) => c.lists.includes(page))?.id ?? "other";
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
