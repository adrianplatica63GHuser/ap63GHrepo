/**
 * „Câmp specific" on the Documents list: which fields it offers, and how a
 * value reads.                                                  (Slice #37.73)
 *
 * ONLY FIELDS WITH A CLOSED LIST OF VALUES. A field is offered when its type
 * is `select`: each value it can hold then names a set of documents that share
 * it — „Stare plată: Achitat integral" — which is what a filter is for. Text,
 * textarea, number and date fields hold a value per document (a CNP, a sum, a
 * date), so a filter on one finds one document, which the search box does
 * better; and the prose a wrong parse once turned into fields („suma de",
 * „Anul", „luna" — the Antecontract's 14, see Slice #37.73's handover) is never
 * offered.
 *
 * LABELS, NOT CODES. A value is shown by its option's `labelRo` from the
 * field's template; a value the options no longer list is shown as stored. The
 * value sent to the API is unchanged.
 *
 * PURE — no React; `custom-field-options.test.ts` covers it.
 */
import { parseTemplateFields } from "@/lib/documents/template-fields";

export type CustomFieldOption = {
  key: string;
  label: string;
  /** value → its Romanian label, from the first type on screen that defines the key. */
  labels: Readonly<Record<string, string>>;
};

/**
 * The select fields the types on screen define, deduped by key in the types'
 * order, labelled in Romanian. `wanted === undefined` means every type (the
 * Documents list's convention for „Toate tipurile").
 */
export function customFieldOptionsOf(
  types: readonly { id: string; templateFields?: unknown }[],
  wanted: readonly string[] | undefined,
): CustomFieldOption[] {
  const seen = new Map<string, CustomFieldOption>();
  for (const type of types) {
    if (wanted !== undefined && !wanted.includes(type.id)) continue;
    for (const field of parseTemplateFields(type.templateFields)) {
      if (field.type !== "select" || seen.has(field.key)) continue;
      const labels: Record<string, string> = {};
      for (const o of field.options ?? []) labels[o.value] = o.labelRo;
      seen.set(field.key, { key: field.key, label: field.labelRo || field.labelEn || field.key, labels });
    }
  }
  return [...seen.values()];
}

/** How a stored value reads: its option's label, or the value itself when the options no longer list it. */
export function customFieldValueLabel(option: CustomFieldOption | undefined, value: string): string {
  return option?.labels[value] ?? value;
}
