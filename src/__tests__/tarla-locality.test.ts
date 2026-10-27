/**
 * A tarla belongs to a locality.                                                 (Slice #39.67, migration_112)
 *
 * Tarla numbers restart in every locality: T50 in Bragadiru is not T50 in Cornetu. So the code is unique per
 * locality (the guard, the index), the cadastral identity is locality + tarla + parcela, an import adds its codes
 * in the locality its folder names, and a tarla is named with its locality where two share a code.
 */
import fs from "fs";
import path from "path";
import { sameTarlaCode, sameTarlaLocality, tarlaCodeTakenBy } from "@/lib/properties/tarla-code-guard";
import { localityFromFolderName } from "@/lib/import/folder-locality";
import { tarlaLabel, tarlaPickerOption } from "@/lib/tarla/label";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

const ROWS = [
  { id: "t50-bragadiru", indicativ: "50", locality: "Bragadiru" },
  { id: "t50-none", indicativ: "50", locality: null },
  { id: "t3-cornetu", indicativ: "T3", locality: "Cornetu" },
];

describe("the same code in another locality is another tarla", () => {
  it("compares localities folded, and an empty locality equals only another empty one", () => {
    expect(sameTarlaLocality("Bragadiru", "  bragadiru ")).toBe(true);
    expect(sameTarlaLocality("Măgurele", "Magurele")).toBe(true);
    expect(sameTarlaLocality("Bragadiru", "Cornetu")).toBe(false);
    expect(sameTarlaLocality(null, "")).toBe(true);
    expect(sameTarlaLocality(undefined, "  ")).toBe(true);
    expect(sameTarlaLocality(null, "Cornetu")).toBe(false);
  });

  it("refuses the code only in its own locality", () => {
    expect(tarlaCodeTakenBy("50", ROWS, null, "Bragadiru")?.id).toBe("t50-bragadiru");
    expect(tarlaCodeTakenBy("50", ROWS, null, "Cornetu")).toBeNull();
    expect(tarlaCodeTakenBy("50", ROWS, null, null)?.id).toBe("t50-none");
    expect(tarlaCodeTakenBy("t3", ROWS, null, "cornetu")?.id).toBe("t3-cornetu");
    expect(tarlaCodeTakenBy("t3", ROWS, null, "Bragadiru")).toBeNull();
    // A rename keeps its own code.
    expect(tarlaCodeTakenBy("50", ROWS, "t50-bragadiru", "Bragadiru")).toBeNull();
    // The code fold is unchanged.
    expect(sameTarlaCode("t3", "T3")).toBe(true);
  });
});

describe("the import's locality, read off the root folder", () => {
  it.each([
    ["CLINCENI.3", "Clinceni"],
    ["Bragadiru", "Bragadiru"],
    ["MĂGURELE_2024", "Măgurele"],
    ["cornetu 2", "Cornetu"],
    ["Oct.16", ""],
    ["A2.comune", ""],
    ["40-212per40IE52172", ""],
    ["", ""],
  ])("%s → „%s”", (folder, locality) => {
    expect(localityFromFolderName(folder)).toBe(locality);
  });
});

describe("a tarla's name", () => {
  it("carries its locality, and stands alone without one", () => {
    expect(tarlaLabel({ indicativ: "50", locality: "Bragadiru" })).toBe("50 — Bragadiru");
    expect(tarlaLabel({ indicativ: "50", locality: "  " })).toBe("50");
    expect(tarlaLabel({ indicativ: "47/2" })).toBe("47/2");
  });
});

// Slice 40.90 — Adrian: „show only the <Tarla code> and show <Tarla code - description> only on hover".
describe("a property's tarla: the code, its description on hover", () => {
  it("shows the code alone and hovers „code — description”; no description, no hover", () => {
    expect(tarlaPickerOption("T201", "Sola din nord-vestul orașului Bragadiru")).toEqual({
      label: "T201",
      title: "T201 — Sola din nord-vestul orașului Bragadiru",
    });
    expect(tarlaPickerOption("50 (Cornetu)", "Lunca Mare")).toEqual({ label: "50 (Cornetu)", title: "50 (Cornetu) — Lunca Mare" });
    expect(tarlaPickerOption("47/2", null)).toEqual({ label: "47/2" });
    expect(tarlaPickerOption("47/2", "   ")).toEqual({ label: "47/2" });
  });

  it("is what both property pickers build their options from, and neither writes the description beside the code", () => {
    const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
    for (const file of ["src/app/properties/_components/property-form.tsx", "src/app/properties/_components/add-property-dialog.tsx"]) {
      const src = read(file);
      expect([file, src.includes("tarlaPickerOption(")]).toEqual([file, true]);
      expect([file, /—\s*\$\{o\.descriere\}/.test(src)]).toEqual([file, false]);
    }
  });
});

describe("the identity and the auto-seed read the locality", () => {
  const queries = read("src", "lib", "properties", "queries.ts");
  const importProperty = read("src", "lib", "properties", "import-property.ts");

  it("findPropertiesByCadastralIdentity compares the tarla's locality", () => {
    expect(queries).toContain("locality: string | null = null,");
    expect(queries).toContain("tarlaLocality: lookupTarla.locality,");
    expect(queries).toContain("sameTarlaLocality(row.tarlaLocality, locality),");
  });

  it("resolveTarlaForCreate looks and mints in the locality", () => {
    expect(queries).toContain(".filter((r) => sameTarlaLocality(r.locality, locality));");
    expect(queries.replace(/\s+/g, "")).toContain('.values({indicativ:value,locality,origin:"IMPORT"})');
    expect(queries).toContain("tarlaLocality: propFields.tarlaLocality ?? addrInput?.locality ?? null,");
  });

  it("every caller of the identity passes a locality", () => {
    // Each call, up to the end of its statement — the plan's call spans four lines.
    const calls = importProperty.split("findPropertiesByCadastralIdentity(").slice(1).map((rest) => rest.slice(0, rest.search(/\)\s*(;|\n\s*:)/)));
    expect(calls.length).toBe(3);
    for (const c of calls) expect({ c, locality: /locality/.test(c) }).toEqual({ c, locality: true });
  });
});

describe("migration_112 gives every tarla its properties' locality, and splits the rest", () => {
  const sql = read("src", "db", "migration_112_tarla_locality.sql");

  it("adds the three columns and the outline table", () => {
    for (const c of ["locality", "county", "notes"]) expect(sql).toContain(`ALTER TABLE lookup_tarla ADD COLUMN IF NOT EXISTS ${c}`);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS tarla_corner (");
    expect(sql).toContain("REFERENCES lookup_tarla(id) ON DELETE CASCADE");
  });

  it("drops the code-only index before the split, and reports every split", () => {
    expect(sql.indexOf("DROP INDEX IF EXISTS lookup_tarla_indicativ_folded_unique;")).toBeLessThan(sql.indexOf("DO $$"));
    expect(sql).toContain("RAISE NOTICE 'migration_112 split:");
    expect(sql).toContain("ORDER BY count(*) DESC, 1");
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
  });
});
