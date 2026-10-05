/**
 * The Documents list's „Tip document:" filter: what its button says, and when
 * „Câmp specific" works.                                        (Slice #38.07)
 *
 * THE BUTTON. Every type ticked: „Toate tipurile", as before. Exactly one: that
 * type's full name (the screen cuts it with an ellipsis, the name as its
 * tooltip). Two or more but not all: „{count} tipuri afișate", in italics.
 * None: „Niciun tip", in italics. It used to read „n/N" for anything short of
 * all. While the types are still loading it says „Toate tipurile".
 *
 * „CÂMP SPECIFIC". Enabled only when exactly one type is ticked and that type
 * has a form with at least one closed-list field — the only fields the control
 * offers (#37.73, `customFieldOptionsOf`). Otherwise it is drawn disabled and
 * offers nothing, so a chosen key the screen no longer allows is cleared by the
 * list's existing reconciliation. This replaces #37.83's „drawn only when the
 * types on screen have a field", which offered the fields of every type at
 * once.
 *
 * PURE — no React; `document-type-filter.test.ts` covers it.
 */
import { customFieldOptionsOf, type CustomFieldOption } from "@/lib/documents/custom-field-options";

export type TypeFilterTrigger =
  | { kind: "all" }
  | { kind: "one"; name: string }
  | { kind: "several"; count: number }
  | { kind: "none" };

/** `checked === undefined` means every type — the list's convention for a URL with no `documentTypeIds`. */
export function typeFilterTrigger(
  types: readonly { id: string; name: string }[],
  checked: readonly string[] | undefined,
): TypeFilterTrigger {
  if (types.length === 0 || checked === undefined) return { kind: "all" };
  const on = types.filter((t) => checked.includes(t.id));
  if (on.length === types.length) return { kind: "all" };
  if (on.length === 0) return { kind: "none" };
  if (on.length === 1) return { kind: "one", name: on[0].name };
  return { kind: "several", count: on.length };
}

/** „Câmp specific": its fields, and whether it works — exactly one type, with a closed-list field. */
export function customFieldFilter(
  types: readonly { id: string; templateFields?: unknown }[],
  checked: readonly string[] | undefined,
): { enabled: boolean; options: CustomFieldOption[] } {
  if (checked === undefined || checked.length !== 1) return { enabled: false, options: [] };
  const options = customFieldOptionsOf(types, checked);
  return { enabled: options.length > 0, options };
}
