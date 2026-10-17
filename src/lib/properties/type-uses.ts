/**
 * The use categories a property type allows.                                             (Slice #39.66, migration_111)
 *
 * `lookup_property_type_use` pairs a type with its allowed uses — „Teren extravilan" with the agricultural ones, a
 * building with „Curți-construcții". ⚠️ A TYPE WITH NO PAIRS ALLOWS EVERY USE: an empty list is „no restriction",
 * so a type added in „Date de referință" is usable before anybody pairs it, and „Teren intravilan" — which may be
 * anything — needs no rows at all.
 *
 * Pure and client-safe: the property form and the reference-data page both read it.
 */

export type TypeUsePair = { propertyTypeId: string; useCategoryId: string };

/** The cache key every reader of the pairs shares. */
export const TYPE_USES_QUERY_KEY = ["property-type-uses"] as const;

/** The ids of the uses this type allows, or null when it allows every use (no pairs, or no type chosen). */
export function allowedUseIds(pairs: readonly TypeUsePair[] | undefined, propertyTypeId: string | null | undefined): Set<string> | null {
  if (!propertyTypeId || !pairs) return null;
  const ids = pairs.filter((p) => p.propertyTypeId === propertyTypeId).map((p) => p.useCategoryId);
  return ids.length > 0 ? new Set(ids) : null;
}

/**
 * The uses to offer for a type, in the list's order. ⚠️ `keep` — the value the record already holds — is always
 * offered, even when the type does not allow it: a select that drops the current value would blank it on the next
 * save without anybody choosing that. The form says so beside the field instead (`useNotAllowed`).
 */
export function usesForType<T extends { id: string }>(
  uses: readonly T[],
  pairs: readonly TypeUsePair[] | undefined,
  propertyTypeId: string | null | undefined,
  keep?: string | null,
): T[] {
  const allowed = allowedUseIds(pairs, propertyTypeId);
  if (!allowed) return [...uses];
  return uses.filter((u) => allowed.has(u.id) || (keep && u.id === keep));
}

/** True when the use is outside what the type allows — a value kept from before the pairs, or from another type. */
export function useNotAllowed(
  pairs: readonly TypeUsePair[] | undefined,
  propertyTypeId: string | null | undefined,
  useCategoryId: string | null | undefined,
): boolean {
  if (!useCategoryId) return false;
  const allowed = allowedUseIds(pairs, propertyTypeId);
  return allowed !== null && !allowed.has(useCategoryId);
}

/** GET /api/properties/type-uses. Throws on a failed read, so a cache never holds an empty list it did not read. */
export async function fetchTypeUses(): Promise<TypeUsePair[]> {
  const res = await fetch("/api/properties/type-uses");
  if (res.redirected || !res.ok) throw new Error(`Failed to load the allowed uses (HTTP ${res.status})`);
  return ((await res.json()) as { items: TypeUsePair[] }).items;
}

/** PUT /api/admin/property-type-uses — allow or stop allowing one use for one type. */
export async function setTypeUse(input: TypeUsePair & { allowed: boolean }): Promise<void> {
  const res = await fetch("/api/admin/property-type-uses", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok && res.status !== 204) throw new Error(`Failed to save (HTTP ${res.status})`);
}
