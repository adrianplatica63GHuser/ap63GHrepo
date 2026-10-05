/**
 * „Câmpuri afișate" on the four lists: where each browser keeps its choice,
 * and what a browser that has none sees.                        (Slice #37.94)
 *
 * The Properties list starts with Tarla/Solă and Parcelă; Documents, Natural
 * Persons and Judicial Persons start with nothing ticked — only their fixed
 * columns. Which fields each list offers, and in what order, stay in the
 * list views (#37.72).
 *
 * ⚠️ **#37.94 moved every key to its next version, once** (its Ask first), so
 * every browser opens on these defaults whatever it had stored; from then on a
 * person's own choice is kept under the new key as before (`useFieldChooser`).
 * Moving a key again resets every browser again — it is a decision, not a
 * refactor.
 */
export const LIST_COLUMN_CHOICE = {
  property: { storageKey: "ga40-col-property-v3", defaults: ["tarlaSola", "parcela"] },
  document: { storageKey: "ga40-col-document-v3", defaults: [] },
  person:   { storageKey: "ga40-col-person-v3",   defaults: [] },
  company:  { storageKey: "ga40-col-company-v2",  defaults: [] },
} as const satisfies Record<string, { storageKey: string; defaults: readonly string[] }>;
