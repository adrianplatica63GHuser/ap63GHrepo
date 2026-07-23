/**
 * Document type templates — Slice #21.03.Import
 *
 * A document type may optionally define a set of type-specific fields beyond
 * the generic baseline every document type shows (title, nr. document, date,
 * subject). Templates are stored as JSONB on
 * `lookup_document_type.template_fields` — pure data, so adding a new
 * document type's full template is a DB row, never a schema migration or a
 * code deploy (see migration_066_document_templates.sql).
 *
 * The values captured for a document's template fields live in
 * `document.custom_fields` (jsonb), keyed by the field's `key`.
 *
 * Kept pure / framework-free so it is safe to import from both server code
 * (AI-extraction prompt building, the query layer) and client code (dynamic
 * form rendering).
 */

export type DocumentTemplateFieldType = "text" | "textarea" | "date" | "number";

export type DocumentTemplateField = {
  /** Stable key — used as the customFields JSON key and the AI-extraction field key. */
  key: string;
  labelRo: string;
  labelEn: string;
  type: DocumentTemplateFieldType;
  /** Display / extraction order within the type-specific section. */
  order: number;
  /** Optional hint shown to the AI extractor (what to look for / expected format). */
  aiHint?: string | null;
};

const VALID_TYPES: readonly DocumentTemplateFieldType[] = ["text", "textarea", "date", "number"];

/**
 * Parse a raw jsonb value (lookup_document_type.template_fields) into a
 * field-def array. Never throws — malformed/missing entries are dropped so a
 * bad row can never break the form or the AI-extraction prompt.
 */
export function parseTemplateFields(raw: unknown): DocumentTemplateField[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f): DocumentTemplateField => ({
      key:     typeof f.key === "string" ? f.key : "",
      labelRo: typeof f.labelRo === "string" ? f.labelRo : String(f.key ?? ""),
      labelEn: typeof f.labelEn === "string" ? f.labelEn : String(f.key ?? ""),
      type:    VALID_TYPES.includes(f.type as DocumentTemplateFieldType)
        ? (f.type as DocumentTemplateFieldType)
        : "text",
      order:   typeof f.order === "number" ? f.order : 0,
      aiHint:  typeof f.aiHint === "string" ? f.aiHint : null,
    }))
    .filter((f) => f.key.length > 0)
    .sort((a, b) => a.order - b.order);
}

/** Format hint appended to each custom field's line in the AI-extraction prompt. */
export function templateFieldFormatHint(type: DocumentTemplateFieldType): string {
  switch (type) {
    case "date":     return "ISO yyyy-mm-dd date string";
    case "number":   return "numeric string only (digits + decimal separator), no units";
    case "textarea": return "free text, may be multi-line";
    default:         return "free text";
  }
}

/**
 * Field-by-field equality of two customFields records — used by the version
 * snapshot no-op backstop (queries.ts) and the client edit-dirty check
 * (form-schema.ts). Treats null/undefined/"no key present" as equivalent, and
 * normalises key order, since Postgres jsonb does not preserve it.
 */
export function customFieldsEqual(
  a: Record<string, string | null> | null | undefined,
  b: Record<string, string | null> | null | undefined,
): boolean {
  const av = a ?? {};
  const bv = b ?? {};
  const keys = new Set([...Object.keys(av), ...Object.keys(bv)]);
  for (const k of keys) {
    if ((av[k] ?? null) !== (bv[k] ?? null)) return false;
  }
  return true;
}
