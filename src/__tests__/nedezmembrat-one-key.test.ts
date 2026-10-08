/**
 * Slice #38.34 (Ask first 1) — the „nedezmembrat" clause has one key on the
 * contract de vânzare and on the act adițional: nedezmembratContrar, worded the
 * contract's way; migration_098 moved the act adițional's stored values to it
 * and ticked „Deține cotă" for the act adițional's sellers and buyers.
 */
import fs from "fs";
import path from "path";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
type Field = { key: string; labelRo: string; labelEn: string; options: { value: string }[] | null };
const FORMS = (JSON.parse(read("src", "db", "document-type-forms.json")) as { forms: Record<string, Field[]> }).forms;
const clause = (type: string) => FORMS[type].find((f) => f.key === "nedezmembratContrar");

describe("one key for the clause", () => {
  it("is nedezmembratContrar on both forms, worded the contract's way, with the same three values", () => {
    for (const type of ["CONTRACT_VANZARE", "ACT_ADITIONAL"]) {
      expect([type, clause(type)?.labelRo, clause(type)?.labelEn]).toEqual([type, "Nedezmembrat contrar extrasului", "Not subdivided contrary to the extract"]);
      expect(clause(type)?.options?.map((o) => o.value)).toEqual(["AFIRMAT", "NEMENTIONAT", "EXCEPTIE"]);
    }
    expect(Object.values(FORMS).flat().some((f) => f.key === "nedezmembratNealipit")).toBe(false);
  });
});

describe("migration_098", () => {
  const sql = read("src", "db", "migration_098_addendum_nedezmembrat_and_parties.sql");
  it("moves the stored values, keeps a clashing one in „Note”, and names it", () => {
    expect(sql).toContain("|| jsonb_build_object('nedezmembratContrar', m.old_value)");
    expect(sql).toContain("'Nedezmembrat și nealipit (vechea cheie): '");
    expect(sql).toContain("RAISE NOTICE 'migration_098: % kept");
  });
  it("renames the act adițional's field in its form, and only there", () => {
    expect(sql).toMatch(/WHERE t\.key = 'ACT_ADITIONAL'\s+AND jsonb_typeof\(t\.template_fields\) = 'array'/);
  });
  it("ticks „Deține cotă” for the act adițional's Vânzător and Cumpărător, nothing else", () => {
    expect(sql).toMatch(/SET holds_share = true[\s\S]*t\.key = 'ACT_ADITIONAL'[\s\S]*r\.name IN \('Vânzător', 'Cumpărător'\)/);
  });
});
