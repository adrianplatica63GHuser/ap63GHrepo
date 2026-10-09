/**
 * Slice #37.74 — the „Antecontract" type loses the 14 fields „discover" made
 * from one scanned document's prose: no form locally (the forms file holds
 * none for it), and `npm run supabase:forms` brings Supabase level — a
 * read-only check, and a clear that touches the type's form and nothing else.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFormsFile } from "@/lib/documents/document-type-forms-file";
import { CLEAR_FORM_SQL, FORMS_SQL, KEY_COUNTS_SQL, TYPE_COUNTS_SQL, clearRefusal, formKeys } from "@/lib/documents/forms-on-supabase";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const FILE = parseFormsFile(read("src", "db", "document-type-forms.json"));
const SCRIPT = read("scripts", "supabase-forms.ts");
const PACKAGE = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

const THE_FOURTEEN = [
  "cnp_1", "ci_seria_if_nr", "nr_cad", "cnp_2", "actul_de_lotizare_aut_sub_nr", "nr_cadastral", "ci_seria_if_nr_2",
  "contractul_de_vanzare_cumparare_aut_sub", "suma_de", "diferenta_de", "incheiere_de_autentificare_nr", "anul", "luna",
  "s_a_perceput_onorariul_de",
];

describe("the Antecontract has no form (Slice #37.74)", () => {
  it("the forms file holds no ANTECONTRACT entry — template_fields NULL, as before „discover”", () => {
    expect(FILE.forms.map((f) => f.key)).not.toContain("ANTECONTRACT");
    for (const form of FILE.forms) {
      for (const k of THE_FOURTEEN) expect([form.key, k, formKeys(form.fields).includes(k)]).toEqual([form.key, k, false]);
    }
  });

  // Slice #38.49 (migration_102): 54 — #37.74 had „the CVC's 53 fields".
  it("the other five forms are still there, the CVC's 54 fields among them", () => {
    expect(FILE.forms.map((f) => f.key)).toEqual(["ACT_ADITIONAL", "CONTRACT_VANZARE", "FISA_CORPULUI_PROPRIETATE", "PLAN_AMPLASAMENT_DELIMITARE", "PLAN_PARCELAR"]);
    expect(FILE.forms.find((f) => f.key === "CONTRACT_VANZARE")!.fields).toHaveLength(54);
  });
});

describe("npm run supabase:forms (Slice #37.74)", () => {
  it("is an npm script that loads .env, as supabase:migrate does", () => {
    expect(PACKAGE.scripts["supabase:forms"]).toBe("node --env-file=.env node_modules/tsx/dist/cli.mjs scripts/supabase-forms.ts");
  });

  it("clears only a type the forms file holds no form for, and only a type key", () => {
    expect(clearRefusal("ANTECONTRACT", FILE.forms)).toBeNull();
    expect(clearRefusal("CONTRACT_VANZARE", FILE.forms)).toMatch(/holds a form for CONTRACT_VANZARE/);
    expect(clearRefusal("x; DROP TABLE document", FILE.forms)).toMatch(/not a document-type key/);
  });

  it("its one write is a type's form to NULL — never `document`, never `custom_fields`", () => {
    expect(CLEAR_FORM_SQL).toBe("UPDATE lookup_document_type SET template_fields = NULL WHERE key = $1 AND template_fields IS NOT NULL");
    for (const sql of [TYPE_COUNTS_SQL, KEY_COUNTS_SQL, FORMS_SQL]) expect(sql).not.toMatch(/\b(UPDATE|DELETE|INSERT|DROP|ALTER|TRUNCATE)\b/i);
    expect(SCRIPT).not.toMatch(/DELETE|TRUNCATE|DROP|INSERT INTO/);
    expect((SCRIPT.match(/CLEAR_FORM_SQL/g) ?? []).length).toBe(2); // the import and the one use
  });

  it("counts, never values: a value is only ever tested for being empty", () => {
    expect(KEY_COUNTS_SQL).toMatch(/count\(d\.id\) FILTER \(WHERE coalesce\(btrim\(d\.custom_fields ->> k\.key\), ''\) <> ''\)/);
    // The one `->>` in it is inside that FILTER: no value is ever selected.
    expect(KEY_COUNTS_SQL.match(/->>/g)).toHaveLength(1);
    expect(TYPE_COUNTS_SQL).toMatch(/SELECT count\(\*\)::int AS documents/);
  });

  it("`check` runs in a read-only transaction, the clear in one transaction, and the password is never printed", () => {
    expect(SCRIPT).toMatch(/await client\.query\("BEGIN READ ONLY"\)/);
    expect(SCRIPT).toMatch(/await client\.query\("BEGIN"\);[\s\S]*CLEAR_FORM_SQL[\s\S]*await client\.query\("COMMIT"\)/);
    expect(SCRIPT).toMatch(/return `\$\{u\.hostname\}\$\{u\.pathname\}`;/);
    expect(SCRIPT).not.toMatch(/console\.(log|error)\([^)]*URL_ENV\b(?!!)/);
  });
});
