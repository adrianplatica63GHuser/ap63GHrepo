/**
 * The forms file keeps itself honest.                      (Slice #37.05, FU-019)
 *
 * `src/db/document-type-forms.json` is every document type's form, and the only
 * copy outside Adrian's database. The runner's `forms-export` writes it; this
 * guard is what stops a written file from being a wrong one:
 *
 *   1. it parses, and it is byte-for-byte what the export would write for its
 *      own content — so a hand edit that reformats or reorders shows up here;
 *   2. every form passes the same field shape both write doors validate, keeps
 *      every field through `parseTemplateFields`, and fits the ceiling;
 *   3. every key follows the form-key rules: the one `SAFE_KEY` invariant the
 *      prompt and `custom_fields` depend on, and one field per normalised key;
 *   4. every type it names is created by the seed (`sync-reference-data.sql`),
 *      or is argued for by name in `FORMS_OF_UNSEEDED_TYPES` — and that list
 *      is exactly the unseeded ones, so a new one is red, not invisible;
 *   5. it holds no form for a type that may never have one: an identity-card
 *      type or the catch-all. The file is a writer of `template_fields` too
 *      (its SQL runs on every rebuild), and those two refusals bind every
 *      writer (`id-card-type-single-source.test.ts`, `catch-all-form-guard`).
 *
 * Whether the file matches the DATABASE is not a jest question — jest cannot
 * reach it. That is the `forms-drift` line at the end of the runner's `full`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { documentTemplateFieldSchema } from "@/lib/admin/value-lists/validation";
import {
  MAX_TEMPLATE_FIELDS,
  SAFE_KEY,
  normaliseKeyForComparison,
} from "@/lib/documents/discover-to-template";
import {
  FORMS_FILE_ABOUT,
  FORMS_FILE_REL,
  FORMS_OF_UNSEEDED_TYPES,
  TYPE_KEY_RE,
  parseFormsFile,
  serializeFormsFile,
} from "@/lib/documents/document-type-forms-file";
import { UNCLASSIFIED_DOCUMENT_TYPE_KEY } from "@/lib/documents/document-type-match";
import { parseTemplateFields } from "@/lib/documents/template-fields";
import { ID_CARD_TYPE_KEYS } from "@/lib/import/id-card";

const ROOT = process.cwd();
const TEXT = readFileSync(join(ROOT, FORMS_FILE_REL), "utf8");
const FILE = parseFormsFile(TEXT);

/** The keys `sync-reference-data.sql` inserts into lookup_document_type, comments stripped first. */
function seededTypeKeys(): string[] {
  const sql = readFileSync(join(ROOT, "src", "db", "sync-reference-data.sql"), "utf8")
    .split("\n")
    .filter((l) => !/^\s*--/.test(l))
    .join("\n");
  const start = sql.indexOf("INSERT INTO lookup_document_type (key, name, sort_order) VALUES");
  expect(start).toBeGreaterThan(-1);
  const block = sql.slice(start, sql.indexOf(";", start));
  return [...block.matchAll(/\('([A-Z0-9_]+)',\s*'[^']*',\s*\d+\)/g)].map((m) => m[1]);
}

describe("the file is what the export writes", () => {
  it("parses, and carries the header that says it is the source of truth", () => {
    expect(FILE.about).toEqual([...FORMS_FILE_ABOUT]);
    expect(FILE.forms.length).toBeGreaterThan(0);
  });

  it("is byte-for-byte the export's own formatting of its content", () => {
    // Line endings aside: git on Windows may check the file out with CRLF.
    expect(TEXT.replace(/\r\n/g, "\n")).toBe(serializeFormsFile(FILE.forms));
  });
});

describe.each(FILE.forms.map((f) => [f.key, f.fields] as const))("the form of %s", (key, fields) => {
  it("is a type key", () => {
    expect(key).toMatch(TYPE_KEY_RE);
  });

  it("passes the field shape both write doors validate", () => {
    const refused = fields
      .map((f, i) => [i, documentTemplateFieldSchema.safeParse(f)] as const)
      .filter(([, r]) => !r.success)
      .map(([i, r]) => `#${i}: ${r.success ? "" : r.error.issues.map((x) => x.path.join(".") + " " + x.message).join("; ")}`);
    expect(refused).toEqual([]);
  });

  it("keeps every field through parseTemplateFields, and fits the ceiling", () => {
    expect(parseTemplateFields(fields)).toHaveLength(fields.length);
    expect(fields.length).toBeLessThanOrEqual(MAX_TEMPLATE_FIELDS);
  });

  it("follows the form-key rules: a safe key, and one field per normalised key", () => {
    const keys = parseTemplateFields(fields).map((f) => f.key);
    expect(keys.filter((k) => !SAFE_KEY.test(k))).toEqual([]);
    const seen = new Map<string, string>();
    const twins: string[] = [];
    for (const k of keys) {
      const n = normaliseKeyForComparison(k);
      if (seen.has(n)) twins.push(`${seen.get(n)} / ${k}`);
      else seen.set(n, k);
    }
    expect(twins).toEqual([]);
  });

  it("is not a form on a type that may never hold one", () => {
    expect([...ID_CARD_TYPE_KEYS, UNCLASSIFIED_DOCUMENT_TYPE_KEY]).not.toContain(key);
  });
});

describe("every type the file names is one a rebuild creates", () => {
  const seeded = new Set(seededTypeKeys());
  const unseeded = FILE.forms.map((f) => f.key).filter((k) => !seeded.has(k)).sort();

  it("is seeded, or argued for by name — and the list of exceptions is exactly the unseeded ones", () => {
    expect(unseeded).toEqual(Object.keys(FORMS_OF_UNSEEDED_TYPES).sort());
  });

  it("gives every exception a reason", () => {
    for (const reason of Object.values(FORMS_OF_UNSEEDED_TYPES)) expect(reason.length).toBeGreaterThan(40);
  });
});
