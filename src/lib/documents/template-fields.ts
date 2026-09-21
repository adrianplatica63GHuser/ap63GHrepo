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

export type DocumentTemplateFieldType = "text" | "textarea" | "date" | "number" | "select";

/**
 * One choice on a `select` field.                                (Slice #36.01)
 *
 * ⚠️ **`value` IS WHAT IS STORED, AND IT IS A STRING LIKE EVERY OTHER CUSTOM
 * FIELD'S.** `document.custom_fields` stays `Record<string, string | null>`,
 * `customFieldsEqual` stays exactly as it is, and `DocumentSnapshot` needs no
 * change — which is the whole reason a new TYPE was added rather than a new
 * value shape. A select is a `text` field whose input happens to be a
 * dropdown.
 *
 * ⚠️ **A STORED VALUE THAT IS NO LONGER AN OPTION IS RENDERED, NEVER BLANKED.**
 * An option list is authored and can be edited; a document read in 2026 under
 * an option removed in 2027 still holds what the deed said, and the form shows
 * it (see `document-form.tsx`, which appends the stored value as its own
 * choice when it matches none). Blanking it would be this codebase silently
 * rewriting a captured fact.
 *
 * Both labels, per option, for the same reason `labelRo`/`labelEn` are a pair
 * on the field itself: the option list is DATA on the type row, it never goes
 * near `messages/*.json`, and the Romanian is what everyone sees.
 */
export type DocumentTemplateFieldOption = {
  /** Stored in `document.custom_fields`. Non-empty. */
  value: string;
  labelRo: string;
  labelEn: string;
};

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
  /**
   * Optional sub-panel grouping (e.g. "Financiar" / "Financial") — fields
   * sharing the same group render together under their own titled section
   * instead of one flat "type-specific fields" block. Purely a display
   * concern: grouped or not, all fields still write to the same flat
   * `document.custom_fields` record keyed by `key`. Fields with no group
   * (null on both) fall into a single ungrouped section, so older/simpler
   * templates keep working unchanged.
   */
  groupRo?: string | null;
  groupEn?: string | null;
  /**
   * Optional NOTEBOOK TAB.                                       (Slice #36.01)
   *
   * A panel (`groupRo`/`groupEn`) is a titled box; a tab is a page of panels.
   * When at least one field on a type carries a tab, the document form renders
   * its Details tab as a notebook; when none does, it renders exactly as it did
   * before this slice — one column of sections, no notebook chrome. That
   * compatibility is the guarantee every existing type depends on and it is
   * what `templateTabsOf` returning `[]` means (see
   * `@/lib/documents/template-tabs`).
   *
   * ⚠️ **TAB ORDER, PANEL ORDER AND FIELD ORDER ARE ONE ORDER, AND IT IS
   * `order`.** A tab's position is the `order` of its first field, exactly as a
   * panel's is. There is no fourth ordering to store and therefore no way for
   * the three to disagree.
   *
   * A field with a tab and no panel is a panel of one on that tab; a field with
   * a panel and no tab goes on the FIRST tab. Neither is guessable, so the Form
   * editor says both in its help text.
   */
  tabRo?: string | null;
  tabEn?: string | null;
  /**
   * The authored choices, for `type: "select"` only. Null/empty on every other
   * type — and a `select` that somehow reaches the form with no options renders
   * as a plain text input rather than as a dropdown of nothing.
   */
  options?: DocumentTemplateFieldOption[] | null;
};

const VALID_TYPES: readonly DocumentTemplateFieldType[] = ["text", "textarea", "date", "number", "select"];

/**
 * Parse an `options` jsonb value. Never throws — same contract as
 * `parseTemplateFields` itself, and for the same reason: a bad row must not be
 * able to break the form or the extraction prompt. An entry with no usable
 * `value` is dropped; a missing label falls back to the other locale, then to
 * the value, never to "" (which would render a choice with no caption).
 */
function parseFieldOptions(raw: unknown): DocumentTemplateFieldOption[] | null {
  if (!Array.isArray(raw)) return null;
  const out: DocumentTemplateFieldOption[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const o = entry as Record<string, unknown>;
    const value = typeof o.value === "string" ? o.value.trim() : "";
    if (!value || seen.has(value)) continue;
    seen.add(value);
    const labelRo = typeof o.labelRo === "string" ? o.labelRo.trim() : "";
    const labelEn = typeof o.labelEn === "string" ? o.labelEn.trim() : "";
    out.push({
      value,
      labelRo: labelRo || labelEn || value,
      labelEn: labelEn || labelRo || value,
    });
  }
  return out.length > 0 ? out : null;
}

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
      groupRo: typeof f.groupRo === "string" ? f.groupRo : null,
      groupEn: typeof f.groupEn === "string" ? f.groupEn : null,
      tabRo:   typeof f.tabRo === "string" ? f.tabRo : null,
      tabEn:   typeof f.tabEn === "string" ? f.tabEn : null,
      options: parseFieldOptions(f.options),
    }))
    .filter((f) => f.key.length > 0)
    .sort((a, b) => a.order - b.order);
}

/**
 * The choices to render for a `select`, given what is stored. (Slice #36.01)
 *
 * ⚠️ **A STORED VALUE THAT MATCHES NO OPTION IS APPENDED, AS ITSELF.** A
 * `<select>` whose value matches no `<option>` does not render empty — the
 * browser falls back to the first entry — so without this the form would show
 * one answer while `document.custom_fields` held another, with nothing on
 * screen saying so. An option list is editable and a document read under an
 * option somebody later removed is exactly the case this exists for: the
 * captured fact is what the deed said, and the form's job is to show it, not
 * to quietly correct it.
 *
 * Pure and here rather than inline in the form so it can be asserted: this is
 * the one decision on the select path that can misrepresent stored data.
 *
 * @param stored the current value — "" / null / undefined all mean unset, and
 *   an unset field appends nothing.
 */
export function selectOptionsForValue(
  options: readonly DocumentTemplateFieldOption[] | null | undefined,
  stored: string | null | undefined,
): { value: string; label: string }[] {
  const list = (options ?? []).map((o) => ({
    value: o.value,
    label: o.labelRo || o.labelEn || o.value,
  }));
  const value = stored?.trim() ?? "";
  if (!value || list.some((o) => o.value === value)) return list;
  // Labelled with the raw value, deliberately: there is no caption for it, and
  // inventing one would hide that this answer is off the list.
  return [...list, { value, label: value }];
}

/** Format hint appended to each custom field's line in the AI-extraction prompt. */
export function templateFieldFormatHint(type: DocumentTemplateFieldType): string {
  switch (type) {
    case "date":     return "ISO yyyy-mm-dd date string";
    case "number":   return "numeric string only (digits + decimal separator), no units";
    case "textarea": return "free text, may be multi-line";
    // Slice #36.01: the allowed values themselves are appended by
    // `buildExtractSystemPrompt`, which has the field and therefore the list;
    // this function only has the type.
    case "select":   return "one of the allowed values below, copied exactly";
    default:         return "free text";
  }
}

/**
 * Field-by-field equality of two customFields records — used by the version
 * snapshot no-op backstop (queries.ts) and the client edit-dirty check
 * (form-schema.ts). Treats null/undefined/"no key present" as equivalent, and
 * normalises key order, since Postgres jsonb does not preserve it.
 *
 * ⚠️ **AN EMPTY STRING IS ALSO UNSET, and that is not cosmetic** (Slice
 * #26.11). React Hook Form writes `""` into its values for every input that
 * mounts without a default, so the moment a document type gains a template
 * field, every already-saved document of that type acquires a `key: ""` its
 * baseline snapshot does not have. Comparing raw would make `editDirty` true
 * on a document nobody touched — the unsaved-changes banner, version arrows
 * locked, and a save offered on the next navigation. Trimming and treating ""
 * as null is the same rule `normVal` (src/lib/versioning/field-diff.ts) and
 * the forms' own `blank` helper already apply to every flat field; custom
 * fields were the one place it was missing.
 */
export function customFieldsEqual(
  a: Record<string, string | null> | null | undefined,
  b: Record<string, string | null> | null | undefined,
): boolean {
  const norm = (v: string | null | undefined): string | null => {
    if (v == null) return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };
  const av = a ?? {};
  const bv = b ?? {};
  const keys = new Set([...Object.keys(av), ...Object.keys(bv)]);
  for (const k of keys) {
    if (norm(av[k]) !== norm(bv[k])) return false;
  }
  return true;
}
