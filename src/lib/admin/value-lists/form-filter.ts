/**
 * Document types: „Cu formular" and „Fără formular".             (Slice #38.51)
 *
 * Adrian: „we have one checkbox for filters which says „only those awaiting a
 * form"; we should have 2: has form and no form". Two independent checkboxes
 * above the document types' list (#38.51's Ask first 2: not a radio): one
 * ticked shows the types that have a form, or the types that have none; both,
 * or neither, show the whole list — so the two always add up to it.
 *
 * „FĂRĂ FORMULAR" COUNTS EVERY TYPE WHOSE FORM IS EMPTY (#38.51's Ask first 1),
 * the catch-all and the identity card included: their status cell still says
 * why they need none. The old „Doar cele care așteaptă un formular" left those
 * two out (`documentTypeAwaitsForm` plus two vetoes); that rule stays where it
 * decides something else — the status, the editor that opens clear-only, and
 * the banner that says the backlog is empty.
 *
 * „Has a form" is the status's own rule, `documentTypeHasForm` (status.ts) —
 * never a second derivation.
 *
 * PURE — `document-type-form-filter.test.ts` covers it.
 */

export interface FormFilter {
  /** „Cu formular" ticked. */
  withForm: boolean;
  /** „Fără formular" ticked. */
  withoutForm: boolean;
}

/** What the address may ask for: `?form=with` or `?form=without` (the import's link). */
export function formFilterFrom(param: string | null | undefined): FormFilter {
  return { withForm: param === "with", withoutForm: param === "without" };
}

/** Is the list narrowed at all? Both, or neither, is the whole list. */
export function formFilterNarrows(f: FormFilter): boolean {
  return f.withForm !== f.withoutForm;
}

/** Does the filter keep a type that has (or has not) a form? */
export function formFilterKeeps(f: FormFilter, hasForm: boolean): boolean {
  if (!formFilterNarrows(f)) return true;
  return f.withForm ? hasForm : !hasForm;
}
