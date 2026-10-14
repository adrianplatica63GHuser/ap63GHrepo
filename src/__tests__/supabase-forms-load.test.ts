/**
 * Slice #39.31 — `npm run supabase:forms -- load TYPE_KEY`: a form edited
 * locally (Form editor, then the runner's forms-export) reaches Supabase as
 * one UPDATE of that type's form, from the forms file, in one transaction —
 * without a migration and without a full `supabase:sync`.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFormsFile } from "@/lib/documents/document-type-forms-file";
import { LOAD_FORM_SQL, formJsonOf, loadRefusal } from "@/lib/documents/forms-on-supabase";

const ROOT = join(__dirname, "..", "..");
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), "utf8");
const FILE = parseFormsFile(read("src", "db", "document-type-forms.json"));
const SCRIPT = read("scripts", "supabase-forms.ts");

describe("npm run supabase:forms -- load (Slice #39.31)", () => {
  it("loads only a type the forms file holds a form for, and only a type key", () => {
    expect(loadRefusal("ACT_ADITIONAL", FILE.forms)).toBeNull();
    expect(loadRefusal("ANTECONTRACT", FILE.forms)).toMatch(/holds no form for ANTECONTRACT; to take a form off Supabase, use clear/);
    expect(loadRefusal("x; DROP TABLE document", FILE.forms)).toMatch(/not a document-type key/);
  });

  it("writes the file's form, exactly, and nothing for a type the file does not hold", () => {
    const act = FILE.forms.find((f) => f.key === "ACT_ADITIONAL");
    expect(JSON.parse(formJsonOf("ACT_ADITIONAL", FILE.forms) ?? "null")).toEqual(act?.fields);
    expect(formJsonOf("ANTECONTRACT", FILE.forms)).toBeNull();
  });

  it("its one write is one type's form — never `document`, never `custom_fields`", () => {
    expect(LOAD_FORM_SQL).toBe("UPDATE lookup_document_type SET template_fields = $2::jsonb WHERE key = $1");
    expect((SCRIPT.match(/LOAD_FORM_SQL/g) ?? []).length).toBe(2); // the import and the one use
  });

  it("runs in one transaction, refuses before it begins, and rolls back when Supabase has no such type", () => {
    expect(SCRIPT).toMatch(
      /loadRefusal\(typeKey!, file\.forms\)[\s\S]*await client\.query\("BEGIN"\);[\s\S]*LOAD_FORM_SQL[\s\S]*rowCount !== 1[\s\S]*ROLLBACK[\s\S]*await client\.query\("COMMIT"\)/,
    );
  });
});
