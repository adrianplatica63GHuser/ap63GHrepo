/**
 * Property types and uses — the allowed pairs, the form's list, and the migration that made them. (Slice #39.66)
 *
 * The pure part (src/lib/properties/type-uses.ts): a type with no pairs allows every use; the form offers only the
 * allowed uses, but never drops the value a record already holds. The files part: migration_111 and
 * sync-reference-data.sql agree on the nine agreed types, the two new uses and the pairs, so a rebuilt database is
 * the migrated one (verify-rebuild compares the rows).
 */
import fs from "fs";
import path from "path";
import { allowedUseIds, useNotAllowed, usesForType, type TypeUsePair } from "@/lib/properties/type-uses";

const USES = [
  { id: "u-arabil", name: "Arabil" },
  { id: "u-pasune", name: "Pășune" },
  { id: "u-curti", name: "Curți-construcții" },
  { id: "u-drumuri", name: "Drumuri" },
];
const PAIRS: TypeUsePair[] = [
  { propertyTypeId: "t-extravilan", useCategoryId: "u-arabil" },
  { propertyTypeId: "t-extravilan", useCategoryId: "u-pasune" },
  { propertyTypeId: "t-casa", useCategoryId: "u-curti" },
];

describe("the uses a type allows", () => {
  it("are its pairs; a type with none, or no type, allows every use", () => {
    expect([...allowedUseIds(PAIRS, "t-extravilan")!].sort()).toEqual(["u-arabil", "u-pasune"]);
    expect(allowedUseIds(PAIRS, "t-intravilan")).toBeNull();
    expect(allowedUseIds(PAIRS, null)).toBeNull();
    expect(allowedUseIds(undefined, "t-extravilan")).toBeNull();
  });

  it("are what the form offers, in the list's order", () => {
    expect(usesForType(USES, PAIRS, "t-extravilan").map((u) => u.name)).toEqual(["Arabil", "Pășune"]);
    expect(usesForType(USES, PAIRS, "t-casa").map((u) => u.name)).toEqual(["Curți-construcții"]);
    expect(usesForType(USES, PAIRS, "t-intravilan")).toEqual(USES);
    // the pairs not read yet: everything, never nothing
    expect(usesForType(USES, undefined, "t-casa")).toEqual(USES);
  });

  it("never drop the value the record already holds, and say it is outside the type", () => {
    expect(usesForType(USES, PAIRS, "t-casa", "u-arabil").map((u) => u.name)).toEqual(["Arabil", "Curți-construcții"]);
    expect(useNotAllowed(PAIRS, "t-casa", "u-arabil")).toBe(true);
    expect(useNotAllowed(PAIRS, "t-casa", "u-curti")).toBe(false);
    expect(useNotAllowed(PAIRS, "t-intravilan", "u-arabil")).toBe(false);
    expect(useNotAllowed(PAIRS, "t-casa", null)).toBe(false);
  });
});

describe("migration_111 and the rebuild agree", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");
  const migration = read("src", "db", "migration_111_property_types_and_uses.sql");
  const sync = read("src", "db", "sync-reference-data.sql");
  const schema = read("src", "db", "schema", "index.ts");
  const TYPES = [
    "Teren extravilan", "Teren intravilan", "Teren construit", "Liniară", "Casă", "Apartament", "Garaj", "Spațiu comercial", "Birou",
  ];

  it.each(TYPES.map((t) => [t] as const))("both name the type „%s”", (name) => {
    expect(migration).toContain(`'${name}'`);
    expect(sync).toContain(`'${name}'`);
  });

  it.each([["Curți-construcții"], ["Drumuri"]] as const)("both add the use „%s”", (name) => {
    expect(migration).toContain(`'${name}'`);
    expect(sync).toContain(`'${name}'`);
  });

  it("both create the pairs, and the schema declares the table", () => {
    expect(migration).toContain("CREATE TABLE IF NOT EXISTS lookup_property_type_use");
    expect(sync).toContain("lookup_property_type_use");
    expect(sync).toContain("TRUNCATE lookup_property_type_use CASCADE;");
    expect(schema).toMatch(/export const lookupPropertyTypeUse = pgTable\(\s*"lookup_property_type_use"/);
    for (const use of ["Arabil", "Pășune", "Fânețe", "Vie", "Livadă", "Pădure", "Ape", "Neproductiv"]) {
      expect(migration).toContain(`('Teren extravilan', '${use}')`);
    }
  });

  it("the old types are gone from the rebuild", () => {
    for (const old of ["Teren Arabil", "Teren pentru Construcții", "Spațiu Comercial", "Vegetație Forestieră"]) {
      expect(sync).not.toMatch(new RegExp(`^\\s*\\('${old}'`, "m"));
    }
  });
});
