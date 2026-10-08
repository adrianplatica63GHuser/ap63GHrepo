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
 * WHY, FOR THE SIGN (Slice #38.18). `customFieldState` says the same thing with
 * its reason: every type ticked, none, several, the one type has no form, or
 * its form has no closed-list field — and, when it works, which type's fields
 * it offers. The green or red sign between „Tip document:" and „Câmp
 * specific:" says it in its tooltip and its name.
 *
 * PURE — no React; `document-type-filter.test.ts` covers it.
 */
import { customFieldOptionsOf, type CustomFieldOption } from "@/lib/documents/custom-field-options";
import { parseTemplateFields } from "@/lib/documents/template-fields";

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

/** Why „Câmp specific" cannot be used now (#38.18). */
export type CustomFieldReason = "all" | "none" | "several" | "noForm" | "noClosedList";

export interface CustomFieldState {
  enabled: boolean;
  /** Set exactly when `enabled` is false. */
  reason: CustomFieldReason | null;
  /** The one type ticked, when there is one — the type whose fields it offers, or that has none. */
  typeName: string | null;
  /** How many types are ticked, for „several". */
  count: number;
}

/**
 * „Câmp specific" with its reason (#38.18) — the same rule as
 * `customFieldFilter`, which it agrees with on `enabled` for every input
 * (`document-type-filter.test.tsx`).
 */
export function customFieldState(
  types: readonly { id: string; name?: string; templateFields?: unknown }[],
  checked: readonly string[] | undefined,
): CustomFieldState {
  const off = (reason: CustomFieldReason, typeName: string | null = null, count = 0): CustomFieldState => ({ enabled: false, reason, typeName, count });
  if (checked === undefined) return off("all", null, types.length);
  const on = types.filter((t) => checked.includes(t.id));
  if (checked.length > 1) return on.length === types.length && types.length > 1 ? off("all", null, on.length) : off("several", null, checked.length);
  if (on.length === 0) return off("none");
  const one = on[0];
  const name = one.name ?? null;
  if (parseTemplateFields(one.templateFields).length === 0) return off("noForm", name, 1);
  if (customFieldOptionsOf(types, [one.id]).length === 0) return off("noClosedList", name, 1);
  return { enabled: true, reason: null, typeName: name, count: 1 };
}

/**
 * THE SEARCH BOX IN THE DROPDOWN (Slice #38.48). Adrian: „It is difficult to
 * pick because there are so many and I need to do a lot of scrolling". A box
 * under „Toate tipurile", above the divider: typing narrows the checklist to
 * the types whose name CONTAINS what was typed, ignoring case and diacritics —
 * „mostenitor" finds „Certificat de moștenitor".
 *
 * The fold is `normaliseDocumentTypeName`'s NFD-and-strip-the-marks, so both
 * spellings of „ș"/„ț" (comma-below and cedilla) fold to „s"/„t" — never a
 * `\b` regex, which is ASCII-only — but it keeps the spaces (runs of them
 * collapsed), so „de vanzare" matches „Contract de vânzare" and not
 * „Contractdevânzare". An empty or blank search matches every type.
 *
 * Searching only hides rows: what is ticked is never changed by it (#38.48's
 * Ask first 1).
 */
export function foldForSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** The types whose name contains `query`, folded; all of them for a blank query. In their own order. */
export function typesMatching<T extends { name: string }>(types: readonly T[], query: string): T[] {
  const q = foldForSearch(query);
  if (!q) return [...types];
  return types.filter((ty) => foldForSearch(ty.name).includes(q));
}
