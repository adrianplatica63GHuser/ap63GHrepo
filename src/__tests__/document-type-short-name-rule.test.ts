/**
 * The short-name rule — what the Documents list's „Tip" shows for a type
 * whose short name is blank.                                    (Slice #37.95)
 *
 * Read on every name in the reference-data catalogue
 * (src/db/sync-reference-data.sql), so a type added there is held to it too.
 */
import fs from "node:fs";
import path from "node:path";
import { derivedShortName, documentTypeShortName, shortNameClash, shortNameKey } from "@/lib/documents/type-short-name";

const SQL = fs.readFileSync(path.join(process.cwd(), "src/db/sync-reference-data.sql"), "utf8");
const BLOCK = SQL.slice(SQL.indexOf("INSERT INTO lookup_document_type (key, name, sort_order) VALUES"), SQL.indexOf("-- ── lookup_document_type.template_fields"));
const CATALOGUE = [...BLOCK.matchAll(/\('([A-Z_]+)',\s+'([^']+)',\s+\d+\)/g)].map((m) => ({ key: m[1], name: m[2] }));

describe("the short-name rule (#37.95)", () => {
  it("reads the whole catalogue", () => {
    expect(CATALOGUE.length).toBeGreaterThan(40);
  });

  it('drops a leading „Contract de", „Act de", „Încheiere de", „Certificat de"…, and keeps the rest', () => {
    expect(derivedShortName("Contract de Vânzare")).toBe("Vânzare");
    expect(derivedShortName("Act de Adjudecare")).toBe("Adjudecare");
    expect(derivedShortName("Încheiere de Intabulare")).toBe("Intabulare");
    expect(derivedShortName("Certificat de Urbanism")).toBe("Urbanism");
    expect(derivedShortName("Cerere de Despăgubire")).toBe("Despăgubire");
    expect(derivedShortName("Dovadă de Expropriere")).toBe("Expropriere");
    expect(derivedShortName("contract de  închiriere")).toBe("Închiriere");
  });

  it('leaves a name with no such phrase as it is — „Act Adițional", „Testament", „Plan Parcelar"', () => {
    for (const name of ["Act Adițional", "Act Cadastru", "Testament", "Plan Parcelar", "Certificat Fiscal", "Antecontract"]) {
      expect(derivedShortName(name)).toBe(name);
    }
    // A phrase alone is not stripped to nothing.
    expect(derivedShortName("Act de")).toBe("Act de");
  });

  it("gives every catalogue name a non-empty short name no longer than the name", () => {
    for (const { name } of CATALOGUE) {
      const short = derivedShortName(name);
      expect([name, short.length > 0 && short.length <= name.length]).toEqual([name, true]);
    }
  });

  it("prefers a stored short name, and falls back to the rule on a blank", () => {
    expect(documentTypeShortName({ name: "Contract de Vânzare", shortName: "CVC" })).toBe("CVC");
    expect(documentTypeShortName({ name: "Contract de Vânzare", shortName: "  " })).toBe("Vânzare");
    expect(documentTypeShortName({ name: "Contract de Vânzare", shortName: null })).toBe("Vânzare");
    expect(documentTypeShortName({ name: "Contract de Vânzare" })).toBe("Vânzare");
  });

  it("tells two short names apart regardless of case, spacing and Unicode form", () => {
    expect(shortNameKey(" CVC ")).toBe(shortNameKey("cvc"));
    expect(shortNameKey("Extras  CF")).toBe(shortNameKey("extras cf"));
    expect(shortNameKey("Moștenitor".normalize("NFD"))).toBe(shortNameKey("Moștenitor"));
  });

  it("finds the other type a short name would read as — derived names included — but never the type itself", () => {
    const types = [
      { id: "1", name: "Contract de Partaj", shortName: null },
      { id: "2", name: "Act de Partaj", shortName: "Act partaj" },
      { id: "3", name: "Contract de Vânzare", shortName: "CVC" },
    ];
    // „Partaj" is type 1's derived name.
    expect(shortNameClash({ id: "4", name: "Partaj nou", shortName: "partaj" }, types)?.id).toBe("1");
    expect(shortNameClash({ id: null, name: "X", shortName: "CVC" }, types)?.id).toBe("3");
    expect(shortNameClash({ id: "3", name: "Contract de Vânzare", shortName: "CVC" }, types)).toBeNull();
    expect(shortNameClash({ id: "5", name: "Procură", shortName: null }, types)).toBeNull();
  });
});
