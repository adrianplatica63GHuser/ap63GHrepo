/**
 * A document's issuer is a juridical person — picked, read by the AI, proposed, never applied. (Slice #39.72)
 *
 * The pure part (src/lib/documents/issuer.ts): the public-body type a name suggests, the match of the AI's reading
 * among the listed persons, and the select's options. The files part: migration_116, the schema, the rebuild, the
 * repair file, the Supabase sync and Ciprian's package agree that „Instituții" and document.institution_id are gone;
 * the AI is asked for the issuer and its answer is stored as a proposal (`issuerRead`), never as the issuer.
 */
import fs from "fs";
import path from "path";
import {
  issuerSelectOptions,
  matchIssuer,
  publicBodyTypeIdFor,
  publicBodyTypeNameFor,
  sortIssuers,
  type IssuerOption,
} from "@/lib/documents/issuer";
import { GENERIC_EXTRACT_FIELD_DESCRIPTIONS } from "@/lib/import/classify-prompts";
import { VALID_LIST_KEYS, LIST_META } from "@/lib/admin/value-lists/config";

const opt = (id: string, displayName: string, publicBody = true, code = `JPERS${id}`): IssuerOption => ({
  id, code, displayName, typeName: null, publicBody, cuiNumber: null,
});

describe("the public-body type a name suggests", () => {
  it.each([
    ["Judecătoria Cornetu", "Instanță"],
    ["Tribunalul Ilfov", "Instanță"],
    ["Curtea de Apel București", "Instanță"],
    ["Biroul Individual Notarial Popescu Ion", "Birou notarial"],
    ["Societatea Profesională Notarială Lex", "Birou notarial"],
    ["Biroul Executorului Judecătoresc Ionescu", "Birou de executor judecătoresc"],
    ["Cabinet de avocat Marin", "Cabinet sau societate de avocatură"],
    ["OCPI Ilfov", "Instituție publică teritorială"],
    ["O.C.P.I. Ilfov", "Instituție publică teritorială"],
    ["Instituția Prefectului Ilfov", "Instituție publică teritorială"],
    ["ANAF", "Autoritate publică centrală"],
    ["Ministerul Agriculturii", "Autoritate publică centrală"],
    ["Primăria Orașului Bragadiru", "Autoritate locală"],
    ["Consiliul Județean Ilfov", "Autoritate locală"],
    ["SPCLEP Bragadiru", "Autoritate locală"],
  ] as const)("„%s” → %s", (name, type) => {
    expect(publicBodyTypeNameFor(name)).toBe(type);
  });

  it("is nothing for a name that says none of them, and for nothing", () => {
    expect(publicBodyTypeNameFor("Agro Invest SRL")).toBeNull();
    expect(publicBodyTypeNameFor("")).toBeNull();
    expect(publicBodyTypeNameFor(null)).toBeNull();
  });

  it("is the archive's own type row, matched on the fold — or none when the archive lacks it", () => {
    const types = [{ id: "t-inst", name: "Instanță" }, { id: "t-loc", name: "Autoritate locala" }];
    expect(publicBodyTypeIdFor("Judecătoria Buftea", types)).toBe("t-inst");
    expect(publicBodyTypeIdFor("Primăria Chiajna", types)).toBe("t-loc");
    expect(publicBodyTypeIdFor("OCPI Ilfov", types)).toBeNull();
  });
});

describe("the AI's reading, among the listed issuers", () => {
  const listed = [opt("1", "Judecătoria Cornetu"), opt("2", "OCPI"), opt("3", "Notariat")];

  it("names a listed person — exactly, contained as a word, or through an alias", () => {
    expect(matchIssuer("Judecătoria Cornetu", listed)).toBe("1");
    expect(matchIssuer("O.C.P.I. Ilfov", listed)).toBe("2");
    expect(matchIssuer("Birou notarial", listed)).toBe("3");
  });

  it("is null for a body the list does not hold — an instruction to ask, never to create", () => {
    expect(matchIssuer("Judecătoria Buftea", [opt("2", "OCPI")])).toBeNull();
    expect(matchIssuer(null, listed)).toBeNull();
  });
});

describe("the select's options", () => {
  it("public-body persons first, by name; then the value's own person and those picked by search, once each", () => {
    const listed = [opt("b", "Tribunalul Ilfov"), opt("a", "Judecătoria Cornetu"), opt("c", "Agro SRL", false)];
    expect(sortIssuers(listed).map((o) => o.id)).toEqual(["a", "b", "c"]);
    expect(
      issuerSelectOptions(listed, [{ id: "z", displayName: "Firma X" }, { id: "a", displayName: "dup" }, { id: "", displayName: "" }]),
    ).toEqual([
      { value: "a", label: "Judecătoria Cornetu" },
      { value: "b", label: "Tribunalul Ilfov" },
      { value: "c", label: "Agro SRL" },
      { value: "z", label: "Firma X" },
    ]);
  });
});

describe("the files agree: the issuer is a person, the list is gone", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
  const migration = read("src", "db", "migration_116_issuer_person_institutions_retired.sql");
  const schema = read("src", "db", "schema", "index.ts");
  const sync = read("src", "db", "sync-reference-data.sql");
  const repair = read("src", "db", "supabase_repair_missing_tables.sql");
  const supabaseSync = read("scripts", "supabase-sync.ts");
  const ciprian = read("build-ciprian-image.ps1");
  const run = read("src", "lib", "import", "ai-interpret-run.ts");
  const form = read("src", "app", "documents", "_components", "document-form.tsx");
  const sqlCode = (s: string) => s.replace(/--[^\n]*/g, " ");

  it("migration_116 marks the public bodies, keeps the reading apart, renames the versions' key and drops the list", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS public_body boolean NOT NULL DEFAULT false");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS issuer_read text");
    expect(migration).toMatch(/\(v\.snapshot - 'institutionId'\)\s*\|\| jsonb_build_object\('issuerPersonId'/);
    expect(migration).toContain("ALTER TABLE document DROP COLUMN IF EXISTS institution_id;");
    expect(migration).toContain("DROP TABLE IF EXISTS lookup_institution;");
    expect(migration).toContain("DROP FUNCTION IF EXISTS ga40_institution_juridical_person(uuid);");
  });

  it("the schema, the rebuild, the repair file, the sync and Ciprian's package hold no institution list", () => {
    expect(schema).not.toMatch(/pgTable\("lookup_institution"/);
    expect(schema).not.toContain('uuid("institution_id")');
    expect(schema).toContain('publicBody: boolean("public_body").notNull().default(false)');
    expect(schema).toContain('issuerRead: text("issuer_read")');
    for (const [name, text] of [["sync-reference-data", sync], ["ciprian", ciprian]] as const) {
      expect([name, /lookup_institution/.test(sqlCode(text).replace(/#[^\n]*/g, " "))]).toEqual([name, false]);
    }
    // The repair file's pre-flight still NAMES the table — a database older than migration_070 has it — and writes it
    // nowhere.
    expect(sqlCode(repair)).not.toMatch(/(ALTER TABLE|REFERENCES|FROM|UPDATE) lookup_institution/);
    expect(supabaseSync).not.toContain("lookup_institution");
    expect(sync).toMatch(/\('Instanță',\s*24, true\)/);
    expect(sync).toMatch(/\('Altele', 100, false\)/);
    expect(repair).toContain("ADD COLUMN IF NOT EXISTS public_body boolean NOT NULL DEFAULT false");
  });

  it("„Instituții” is not a list any more; a judicial-person type carries the public-body tick", () => {
    expect(VALID_LIST_KEYS as readonly string[]).not.toContain("institutions");
    expect(LIST_META["judicial-person-types"].fields.map((f) => f.key)).toEqual(["name", "publicBody"]);
  });

  it("the AI is asked for the issuer, and its answer is a proposal — `issuerRead`, never `issuerPersonId`", () => {
    expect(Object.keys(GENERIC_EXTRACT_FIELD_DESCRIPTIONS)).toContain("issuer");
    expect(run).toContain("patch.issuerRead = fields.issuer.trim()");
    expect(run).not.toMatch(/patch\.issuerPersonId\s*=/);
  });

  it("the form's issuer field is the person, with the search and the AI's proposal beside it", () => {
    expect(form).toMatch(/name="issuerPersonId"/);
    expect(form).toContain("<IssuerSearchButton");
    expect(form).toMatch(/issuerRead && !watchedValues\.issuerPersonId \? \(\s*<IssuerProposal/);
    expect(form).not.toContain("/api/admin/value-lists/institutions");
  });
});
