/**
 * The document-type forms file: every `lookup_document_type.template_fields`,
 * kept in the repository.                                  (Slice #37.05, FU-019)
 *
 * A document type's FORM is data — `template_fields` on its row, written on
 * screens (Reference Data's form editor, DocTypeEngine, the AI-Discovery
 * review). Until this slice no file held those forms: migration_085 carried two
 * of them and Adrian's dev database carried the rest, so losing that database
 * lost every form, and `build-ciprian-image.ps1` could only copy them live from
 * it. `src/db/document-type-forms.json` is now the copy that survives:
 *
 *   WRITTEN BY  the runner's `forms-export` sequence
 *               (`scripts/document-type-forms.ts export`), which READS the local
 *               database and writes this one file. Nobody edits it by hand —
 *               forms are edited on screens, and the export is how the file
 *               catches up.
 *   READ BY     `scripts/verify-rebuild.ts` (both rebuilt databases finish by
 *               loading it), `build-ciprian-image.ps1` (the forms reach Ciprian
 *               from the file, not from the dev database), and
 *               `scripts/document-type-forms.ts sql`, the load step of a real
 *               rebuild.
 *   CHECKED BY  `src/__tests__/document-type-forms-file.test.ts` (it parses,
 *               every key follows the form-key rules, every type is seeded)
 *               and the `forms-drift` step of the runner's `full`, which says
 *               in one line whether the database has moved on since the last
 *               export. Drift is a line, never a red: it is the normal state
 *               between an edit on a screen and the next export.
 *
 * ⚠️ **THIS FILE IS PURE.** No `fs`, no database, no process — the script does
 * the I/O. That is what lets a jest suite pin the format and the SQL without
 * Docker.
 *
 * ⚠️ **FAITHFUL, NOT NORMALISED.** Each field object is written exactly as the
 * database's jsonb text gave it (jsonb's own key order), one field per line, in
 * stored array order; only the TYPES are sorted, by key. Loading a field back
 * with `::jsonb` gives the identical jsonb value, and a diff of the file shows
 * exactly the fields that changed.
 */

export const FORMS_FILE_REL = "src/db/document-type-forms.json";

/** What the file says about itself. Written into it, so the header travels with the data. */
export const FORMS_FILE_ABOUT: readonly string[] = [
  "Every document type's form: lookup_document_type.template_fields, by type key.",
  "THIS FILE IS THE SOURCE OF TRUTH for the forms of a rebuilt database. It supersedes the two forms in migration_085_seed_cvc_templates.sql and in src/db/sync-reference-data.sql, which are history: both rebuild paths load this file after them.",
  "Do not edit it by hand. Forms are edited on screens; the test runner's forms-export sequence rewrites this file from the local database, read-only.",
  "Types whose template_fields is NULL are not listed.",
];

/** One stored form: the type's key and its `template_fields` array, as stored. */
export interface StoredForm {
  key: string;
  /** The parsed jsonb array. Never re-shaped. */
  fields: unknown[];
}

export interface FormsFile {
  about: string[];
  forms: StoredForm[];
}

/** Code-point order, so the file does not depend on a locale's collation. */
function byKey(a: { key: string }, b: { key: string }): number {
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/**
 * The file's text. Deterministic: the same forms always give the same bytes.
 * One field per line inside a type, one type per block, types sorted by key.
 */
export function serializeFormsFile(forms: readonly StoredForm[]): string {
  const sorted = [...forms].sort(byKey);
  const lines: string[] = [];
  lines.push("{");
  lines.push(`  "about": [`);
  FORMS_FILE_ABOUT.forEach((a, i) => lines.push(`    ${JSON.stringify(a)}${i < FORMS_FILE_ABOUT.length - 1 ? "," : ""}`));
  lines.push("  ],");
  lines.push(`  "forms": {`);
  sorted.forEach((form, i) => {
    const last = i === sorted.length - 1;
    if (form.fields.length === 0) {
      lines.push(`    ${JSON.stringify(form.key)}: []${last ? "" : ","}`);
      return;
    }
    lines.push(`    ${JSON.stringify(form.key)}: [`);
    form.fields.forEach((f, j) => lines.push(`      ${JSON.stringify(f)}${j < form.fields.length - 1 ? "," : ""}`));
    lines.push(`    ]${last ? "" : ","}`);
  });
  lines.push("  }");
  lines.push("}");
  return lines.join("\n") + "\n";
}

/** Parse the file. Throws with a sentence naming what is wrong. */
export function parseFormsFile(text: string): FormsFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new Error(`${FORMS_FILE_REL} is not JSON: ${(e as Error).message}`);
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${FORMS_FILE_REL} is not an object`);
  const o = raw as Record<string, unknown>;
  const extra = Object.keys(o).filter((k) => k !== "about" && k !== "forms");
  if (extra.length > 0) throw new Error(`${FORMS_FILE_REL} has unknown top-level keys: ${extra.join(", ")}`);
  if (!Array.isArray(o.about) || !o.about.every((a) => typeof a === "string")) {
    throw new Error(`${FORMS_FILE_REL}: "about" must be an array of strings`);
  }
  if (!o.forms || typeof o.forms !== "object" || Array.isArray(o.forms)) {
    throw new Error(`${FORMS_FILE_REL}: "forms" must be an object keyed by type key`);
  }
  const forms: StoredForm[] = [];
  for (const [key, fields] of Object.entries(o.forms as Record<string, unknown>)) {
    if (!Array.isArray(fields)) throw new Error(`${FORMS_FILE_REL}: the form of ${key} is not an array`);
    forms.push({ key, fields });
  }
  return { about: o.about as string[], forms };
}

/** A type key as the catalogue writes them. Also what keeps the SQL below literal-safe. */
export const TYPE_KEY_RE = /^[A-Z0-9_]{1,64}$/;

/**
 * The file as SQL: one UPDATE per type, by key, each form a dollar-quoted jsonb
 * literal. What a rebuild runs after `sync-reference-data.sql`, and what
 * `build-ciprian-image.ps1` appends to Ciprian's package.
 *
 * ⚠️ **UPDATE, never INSERT.** The file holds forms, not types: a type the seed
 * does not create is refused by the jest guard before this runs, and the
 * trailing DO block fails the load if any UPDATE matched no row — a form that
 * silently went nowhere is FU-019 again, one file later.
 */
export function formsFileToSql(file: FormsFile): string {
  const out: string[] = [
    `-- Generated from ${FORMS_FILE_REL} by src/lib/documents/document-type-forms-file.ts. Do not edit.`,
    "-- Every document type's form (lookup_document_type.template_fields), by key.",
    "BEGIN;",
  ];
  const sorted = [...file.forms].sort(byKey);
  for (const form of sorted) {
    if (!TYPE_KEY_RE.test(form.key)) throw new Error(`not a type key: ${JSON.stringify(form.key)}`);
    const json = JSON.stringify(form.fields);
    let tag = "form";
    while (json.includes(`$${tag}$`)) tag += "_";
    out.push(`UPDATE lookup_document_type SET template_fields = $${tag}$${json}$${tag}$::jsonb WHERE key = '${form.key}';`);
  }
  const keys = sorted.map((f) => `'${f.key}'`).join(", ");
  if (sorted.length > 0) {
    out.push(
      "DO $check$",
      "DECLARE missing text;",
      "BEGIN",
      `  SELECT string_agg(k, ', ' ORDER BY k) INTO missing FROM unnest(ARRAY[${keys}]) AS k`,
      "   WHERE NOT EXISTS (SELECT 1 FROM lookup_document_type t WHERE t.key = k);",
      "  IF missing IS NOT NULL THEN",
      `    RAISE EXCEPTION 'document-type forms: no type with key %; its form was not loaded', missing;`,
      "  END IF;",
      "END",
      "$check$;",
    );
  }
  out.push("COMMIT;");
  return out.join("\n") + "\n";
}

/** Order-insensitive for object keys, order-sensitive for arrays: jsonb equality. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export interface FormsDrift {
  /** In the database with a form, not in the file. */
  onlyInDatabase: string[];
  /** In the file, but the database has no form (NULL) or no such type. */
  onlyInFile: string[];
  /** In both, with different forms. */
  changed: string[];
}

export function formsDrift(file: readonly StoredForm[], database: readonly StoredForm[]): FormsDrift {
  const f = new Map(file.map((x) => [x.key, canonicalJson(x.fields)]));
  const d = new Map(database.map((x) => [x.key, canonicalJson(x.fields)]));
  const sort = (a: string[]) => a.sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  return {
    onlyInDatabase: sort([...d.keys()].filter((k) => !f.has(k))),
    onlyInFile: sort([...f.keys()].filter((k) => !d.has(k))),
    changed: sort([...f.keys()].filter((k) => d.has(k) && d.get(k) !== f.get(k))),
  };
}

/** The one line `full` reports. Counts and type keys only — no form content. */
export function formsDriftLine(drift: FormsDrift, fileCount: number): string {
  const parts: string[] = [];
  if (drift.changed.length) parts.push(`${drift.changed.length} changed (${drift.changed.join(", ")})`);
  if (drift.onlyInDatabase.length) parts.push(`${drift.onlyInDatabase.length} only in the database (${drift.onlyInDatabase.join(", ")})`);
  if (drift.onlyInFile.length) parts.push(`${drift.onlyInFile.length} only in the file (${drift.onlyInFile.join(", ")})`);
  return parts.length === 0
    ? `in step: the database's ${fileCount} form(s) match ${FORMS_FILE_REL}`
    : `drift — ${parts.join("; ")}; request forms-export to catch the file up`;
}
