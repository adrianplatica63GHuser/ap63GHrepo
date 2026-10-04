/**
 * Bringing Supabase's document-type forms level with the forms file — the
 * pure half of `scripts/supabase-forms.ts`.                     (Slice #37.74)
 *
 * Local forms are the source of truth (Adrian, 2026-10-03: nobody edits a form
 * on the cloud app). `src/db/document-type-forms.json` holds every form the
 * local database has; a type with no form is simply not in it. The file's SQL
 * (`document-type-forms.ts sql`) can only UPDATE the forms it holds, so a form
 * taken OFF a type locally never reaches Supabase that way: this is the step
 * that clears one there, and the check that says whether the two agree.
 *
 * PURE — no `pg`, no process; `supabase-forms.test.ts` covers it.
 */
import type { StoredForm } from "./document-type-forms-file";

/** A type key, as the forms file and `lookup_document_type.key` spell it. */
export const TYPE_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

/**
 * Why clearing `key`'s form on Supabase is refused, or null when it may go
 * ahead. Only a type the forms file holds NO form for may be cleared — the
 * file is what the local database has, so this never clears a form that
 * exists locally — and only a key that looks like one.
 */
export function clearRefusal(key: string, file: readonly StoredForm[]): string | null {
  if (!TYPE_KEY_PATTERN.test(key)) return `„${key}" is not a document-type key`;
  if (file.some((f) => f.key === key)) {
    return `the forms file holds a form for ${key}; clear it locally and export the file first`;
  }
  return null;
}

/**
 * The read-only counts for one type: its documents, and per form key how many
 * of them hold a non-empty value. Counts only — the values may be real CNPs
 * and ID numbers, so none is ever selected.
 */
export const TYPE_COUNTS_SQL = `
SELECT count(*)::int AS documents
  FROM document d JOIN lookup_document_type t ON t.id = d.document_type_id
 WHERE t.key = $1`;

export const KEY_COUNTS_SQL = `
SELECT k.key, count(d.id) FILTER (WHERE coalesce(btrim(d.custom_fields ->> k.key), '') <> '')::int AS filled
  FROM unnest($2::text[]) AS k(key)
  LEFT JOIN (document d JOIN lookup_document_type t ON t.id = d.document_type_id AND t.key = $1) ON true
 GROUP BY k.key
 ORDER BY k.key`;

/** The one write: a type's form to NULL. Never `document`, never `custom_fields`. */
export const CLEAR_FORM_SQL = `UPDATE lookup_document_type SET template_fields = NULL WHERE key = $1 AND template_fields IS NOT NULL`;

/** Every form the database holds, by key — the same SELECT the local export makes. */
export const FORMS_SQL = `SELECT key, template_fields AS fields FROM lookup_document_type WHERE template_fields IS NOT NULL ORDER BY key`;

/** The keys a stored form names, in its order; [] for anything that is not an array of fields. */
export function formKeys(fields: unknown): string[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((f) => (f && typeof f === "object" && typeof (f as { key?: unknown }).key === "string" ? (f as { key: string }).key : ""))
    .filter(Boolean);
}
