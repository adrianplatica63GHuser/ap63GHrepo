/**
 * The forms file's format, its SQL and its drift line.     (Slice #37.05, FU-019)
 *
 * Pure: `src/lib/documents/document-type-forms-file.ts` reads no file and no
 * database. The file itself — does it parse, do its keys follow the rules, is
 * every type seeded — is `document-type-forms-file.test.ts`.
 */
import {
  FORMS_FILE_ABOUT,
  canonicalJson,
  formsDrift,
  formsDriftLine,
  formsFileToSql,
  parseFormsFile,
  serializeFormsFile,
  type StoredForm,
} from "@/lib/documents/document-type-forms-file";

const A: StoredForm = {
  key: "ACT_B",
  fields: [
    { key: "nr", type: "text", order: 0, labelEn: "No.", labelRo: "Nr." },
    { key: "data", type: "date", order: 1, labelEn: "Date", labelRo: "Dată" },
  ],
};
const B: StoredForm = { key: "ACT_A", fields: [{ key: "x", type: "text", order: 0, labelEn: "X", labelRo: "X" }] };
const EMPTY: StoredForm = { key: "ACT_C", fields: [] };

describe("the file's text", () => {
  it("is the same bytes for the same forms, whatever order they arrive in", () => {
    expect(serializeFormsFile([A, B, EMPTY])).toBe(serializeFormsFile([EMPTY, B, A]));
  });

  it("sorts the types by key and keeps each form's fields, and each field's keys, as given", () => {
    const text = serializeFormsFile([A, B]);
    expect(text.indexOf('"ACT_A"')).toBeLessThan(text.indexOf('"ACT_B"'));
    // One field per line, in stored order, with the field's own key order.
    expect(text).toContain('      {"key":"nr","type":"text","order":0,"labelEn":"No.","labelRo":"Nr."},\n');
    expect(text.indexOf('"nr"')).toBeLessThan(text.indexOf('"data"'));
  });

  it("round-trips through the parser to the same forms and the same header", () => {
    const parsed = parseFormsFile(serializeFormsFile([A, B, EMPTY]));
    expect(parsed.about).toEqual([...FORMS_FILE_ABOUT]);
    expect(parsed.forms.map((f) => f.key)).toEqual(["ACT_A", "ACT_B", "ACT_C"]);
    expect(parsed.forms.find((f) => f.key === "ACT_B")?.fields).toEqual(A.fields);
    expect(parsed.forms.find((f) => f.key === "ACT_C")?.fields).toEqual([]);
  });

  it("says in its header that it is the source of truth over migration_085", () => {
    expect(FORMS_FILE_ABOUT.join(" ")).toMatch(/SOURCE OF TRUTH/);
    expect(FORMS_FILE_ABOUT.join(" ")).toContain("migration_085_seed_cvc_templates.sql");
  });

  it("refuses a file that is not the shape", () => {
    expect(() => parseFormsFile("{")).toThrow(/not JSON/);
    expect(() => parseFormsFile("[]")).toThrow(/not an object/);
    expect(() => parseFormsFile('{"about":[],"forms":{},"x":1}')).toThrow(/unknown top-level keys: x/);
    expect(() => parseFormsFile('{"about":[],"forms":{"A":{}}}')).toThrow(/form of A is not an array/);
  });
});

describe("the SQL a rebuild runs", () => {
  const sql = formsFileToSql({ about: [], forms: [A, B] });

  it("is one UPDATE per type, by key, never an INSERT", () => {
    expect(sql.match(/^UPDATE lookup_document_type SET template_fields = /gm)).toHaveLength(2);
    expect(sql).not.toMatch(/INSERT/i);
    expect(sql).toContain("WHERE key = 'ACT_A';");
    expect(sql).toContain("WHERE key = 'ACT_B';");
  });

  it("carries each form as the exact JSON, dollar-quoted, cast to jsonb", () => {
    expect(sql).toContain(`$form$${JSON.stringify(A.fields)}$form$::jsonb`);
  });

  it("fails the load when a key names no type, rather than dropping the form", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'document-type forms: no type with key %/);
    expect(sql).toContain("ARRAY['ACT_A', 'ACT_B']");
  });

  it("writes an unseeded type's form, and only NOTES it when the type is missing", () => {
    // The real list is empty since FU-244 was settled (Slice #37.10), so the
    // path is exercised with a stand-in list of one.
    const unseeded = "ACT_UNSEEDED";
    const out = formsFileToSql(
      { about: [], forms: [A, { key: unseeded, fields: [] }] },
      { [unseeded]: "a stand-in for a type no seed creates, kept for its form" },
    );
    expect(out).toContain(`WHERE key = '${unseeded}';`);
    expect(out).toContain(`RAISE NOTICE 'document-type forms: % is not seeded; its form is kept in the file only', '${unseeded}'`);
    expect(out).toContain("ARRAY['ACT_B']");
  });

  it("picks a different quote tag when a form contains the default one", () => {
    const tricky: StoredForm = { key: "ACT_D", fields: [{ key: "k", aiHint: "a $form$ b" }] };
    const out = formsFileToSql({ about: [], forms: [tricky] });
    expect(out).toContain("$form_$");
  });

  it("refuses a key that is not a type key, so nothing reaches SQL unquoted", () => {
    expect(() => formsFileToSql({ about: [], forms: [{ key: "X'; DROP", fields: [] }] })).toThrow(/not a type key/);
  });
});

describe("drift between the file and the database", () => {
  it("is nothing when the forms are equal, whatever the object key order", () => {
    const reordered: StoredForm = {
      key: "ACT_B",
      fields: A.fields.map((f) => Object.fromEntries(Object.entries(f as object).reverse())),
    };
    expect(canonicalJson(reordered.fields)).toBe(canonicalJson(A.fields));
    const d = formsDrift([A, B], [reordered, B]);
    expect(d).toEqual({ onlyInDatabase: [], onlyInFile: [], changed: [] });
    expect(formsDriftLine(d, 2)).toMatch(/^in step: the database's 2 form\(s\) match/);
  });

  it("names every type that moved, and only by key", () => {
    const edited: StoredForm = { key: "ACT_B", fields: [...A.fields].reverse() };
    const d = formsDrift([A, B], [edited, EMPTY]);
    expect(d).toEqual({ onlyInDatabase: ["ACT_C"], onlyInFile: ["ACT_A"], changed: ["ACT_B"] });
    const line = formsDriftLine(d, 2);
    expect(line).toBe(
      "drift — 1 changed (ACT_B); 1 only in the database (ACT_C); 1 only in the file (ACT_A); request forms-export to catch the file up",
    );
    expect(line).not.toContain("Nr.");
  });
});
