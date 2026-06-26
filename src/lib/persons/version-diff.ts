/**
 * Person versioning — shared pure diff primitives  (Slice #18.05)
 *
 * These field-key-driven helpers are reused by BOTH the natural-person and
 * judicial-person form-schema modules so the diff logic lives in one tested
 * place. They operate on flat string maps (Record<key, string|null>) — each
 * subtype flattens its own snapshot into such a map and supplies its field-key
 * list. Pure (no React, no I/O) so they unit-test directly.
 *
 * Highlight semantics (mirrors Property / Slice #18.02, minus corners):
 *   green = a value was ADDED   (null -> value)
 *   red   = a value was MODIFIED or DELETED (value -> other, or value -> null)
 * The version label is green for version 0 and for additions-only edits; red
 * as soon as any field was modified or deleted.
 */

export type HighlightColor = "green" | "red";

/** Trim, treat "" as unset — same semantics as the forms' `blank` helper. */
export function normVal(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Frame colour for one field: green = added, red = modified or deleted. */
export function fieldFrame(
  prev: string | null,
  curr: string | null,
): HighlightColor | null {
  const p = normVal(prev);
  const c = normVal(curr);
  if (p === null && c === null) return null;
  if (p === null) return "green"; // null -> value : addition
  if (c === null) return "red";   // value -> null : deletion
  return p === c ? null : "red";  // value -> other value : modification
}

/**
 * Per-field highlight frames for `curr` relative to `prev`, over `keys`.
 * `prev === null` (version 0) yields an empty map — nothing to compare against.
 */
export function diffFieldMap<K extends string>(
  prev: Record<K, string | null> | null,
  curr: Record<K, string | null>,
  keys: readonly K[],
): Partial<Record<K, HighlightColor>> {
  const out: Partial<Record<K, HighlightColor>> = {};
  if (!prev) return out;
  for (const k of keys) {
    const f = fieldFrame(prev[k] ?? null, curr[k] ?? null);
    if (f) out[k] = f;
  }
  return out;
}

/** True when two flat field maps are equal (normalised) over `keys`. */
export function fieldMapsEqual<K extends string>(
  a: Record<K, string | null>,
  b: Record<K, string | null>,
  keys: readonly K[],
): boolean {
  for (const k of keys) {
    if (normVal(a[k] ?? null) !== normVal(b[k] ?? null)) return false;
  }
  return true;
}

/**
 * Version label colour from already-computed highlight groups. Version 0
 * (`hadPrev === false`) is always green; otherwise red if ANY group contains a
 * red (a modification or deletion), green if every change was an addition.
 */
export function labelColorFromHighlights(
  hadPrev: boolean,
  ...groups: Partial<Record<string, HighlightColor>>[]
): HighlightColor {
  if (!hadPrev) return "green";
  for (const g of groups) {
    if (Object.values(g).some((c) => c === "red")) return "red";
  }
  return "green";
}
