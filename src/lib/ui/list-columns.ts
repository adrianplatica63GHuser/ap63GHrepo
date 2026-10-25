/**
 * „Câmpuri afișate" on the four lists: where each browser keeps its choice,
 * and what a browser that has none sees.            (Slices #37.94, #38.02)
 *
 * The Properties list starts with Tip proprietate (#38.02; it was Tarla/Solă
 * and Parcelă, which stay offered, unticked); Documents, Natural
 * Persons and Judicial Persons start with nothing ticked — only their fixed
 * columns. Which fields each list offers, and in what order, stay in the
 * list views (#37.72).
 *
 * ⚠️ **#37.94 moved every key to its next version, once** (its Ask first), so
 * every browser opens on these defaults whatever it had stored; from then on a
 * person's own choice is kept under the new key as before (`useFieldChooser`).
 * Moving a key again resets every browser again — it is a decision, not a
 * refactor.
 *
 * **#38.02 moved the Properties key once more** (`-v3` → `-v4`, its Ask first),
 * so every browser opens that list on Tip proprietate; the other three keys
 * stayed as #37.94 left them.
 *
 * **Slice 40.66 moved all four once more** (Adrian: „please pick the best default yourself"), so every browser opens
 * each list on the columns a person scans it for — the most „Câmpuri afișate" holds, `MAX_OPT`, 4:
 *  - Proprietăți: Tarla, Parcelă, Tip proprietate, Localitate — what a field is found by. „Modificat la" has no room.
 *  - Persoane fizice: CNP, Născut pe, Tip profesional, Modificat la.
 *  - Persoane juridice: Tip, CUI, Localitate, Modificat la.
 *  - Acte: Nr. document, Data, Instituție, Modificat la.
 * „Modificat la" stands where there is room because it is the column every list opens sorted by (40.46, 40.55).
 * Each list draws them in the order its chooser offers them; a choice made afterwards is kept as before.
 */
export const LIST_COLUMN_CHOICE = {
  property: { storageKey: "ga40-col-property-v5", defaults: ["tarlaSola", "parcela", "propertyType", "locality"] },
  document: { storageKey: "ga40-col-document-v4", defaults: ["nrDocument", "dateDocument", "institution", "changed"] },
  person:   { storageKey: "ga40-col-person-v4",   defaults: ["cnp", "dateOfBirth", "professionalType", "changed"] },
  company:  { storageKey: "ga40-col-company-v3",  defaults: ["judicialPersonType", "cuiNumber", "locality", "changed"] },
} as const satisfies Record<string, { storageKey: string; defaults: readonly string[] }>;

/**
 * Slice 40.25 — each list's column order, as dragged (`src/lib/ui/column-order.ts`): a key of its own beside the
 * chooser's ticks and the widths, in this browser.
 */
export const LIST_COLUMN_ORDER = {
  property: "ga40-colorder-property-v1",
  document: "ga40-colorder-document-v1",
  person:   "ga40-colorder-person-v1",
  company:  "ga40-colorder-company-v1",
} as const satisfies Record<keyof typeof LIST_COLUMN_CHOICE, string>;
