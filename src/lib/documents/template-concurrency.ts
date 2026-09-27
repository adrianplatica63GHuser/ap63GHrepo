/**
 * Optimistic concurrency for a document type's form.        (Slice #37.05, FU-018)
 *
 * Two doors write `lookup_document_type.template_fields`:
 *
 *   PUT /api/document-types/[id]/template-fields   ADDITIVE (AI Discovery,
 *       DocTypeEngine). Has always taken `knownKeys` and answered 409
 *       `template_changed` with the stored fields (its route, „Optimistic
 *       concurrency").
 *   PUT /api/admin/value-lists/document-types/[id] a FULL REPLACE (Reference
 *       Data → Formular). Its check was client-side only, against the list
 *       row's cached copy — the same stale copy it opened with — so a field
 *       another writer added meanwhile was silently deleted by the save.
 *
 * This module is the second door's half of the first door's contract, with
 * the same compare: the ORDERED key list, because order is what the form
 * renders and what the prompt lists, so a reordering is a change the writer
 * did not see either. Pure; `updateValue` does the locking.
 */
import { parseTemplateFields, type DocumentTemplateField } from "./template-fields";

/** The 409's `code`, the same string the template-fields route sends. */
export const TEMPLATE_CHANGED_CODE = "template_changed";

/** The stored form's keys, in the order the form renders them. */
export function templateKeysOf(stored: unknown): string[] {
  return parseTemplateFields(stored).map((f) => f.key);
}

/** True when the stored form still has exactly the keys, in the order, the writer saw. */
export function sameTemplateKeys(stored: unknown, knownKeys: readonly string[]): boolean {
  const current = templateKeysOf(stored);
  return current.length === knownKeys.length && current.every((k, i) => k === knownKeys[i]);
}

/** Thrown by the query layer; the route turns it into the 409. */
export class TemplateChangedError extends Error {
  readonly fields: DocumentTemplateField[];
  constructor(fields: DocumentTemplateField[]) {
    super("The form for this document type changed while it was being edited.");
    this.name = "TemplateChangedError";
    this.fields = fields;
  }
}

export function asTemplateChanged(err: unknown): TemplateChangedError | null {
  return err instanceof TemplateChangedError ? err : null;
}
