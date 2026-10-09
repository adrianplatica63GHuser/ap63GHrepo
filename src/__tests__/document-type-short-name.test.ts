/**
 * The short names' seed, their uniqueness, and where they are read.
 *                                                               (Slice #37.95)
 *
 * The seed is one VALUES list written twice — in migration_092 and in
 * sync-reference-data.sql. #37.95 held the two byte-equal, as #36.01's forms
 * were; since #38.54 six of its names change in migration_103, so the
 * reference data equals 092's list with 103's six applied.
 * Every catalogue type gets one, no two read alike (stored or derived), and
 * the Documents list shows them with the full name in the tooltip.
 */
import fs from "node:fs";
import path from "node:path";
import { LIST_META } from "@/lib/admin/value-lists/config";
import { derivedShortName, shortNameKey } from "@/lib/documents/type-short-name";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const MIGRATION = read("src/db/migration_092_document_type_short_name.sql");
// Slice #38.54: six short names changed by a migration of their own, over 092's list.
const MIGRATION_103 = read("src/db/migration_103_document_type_short_names_6.sql");
const SYNC = read("src/db/sync-reference-data.sql");

/** The seed block: from its header comment to the UPDATE's closing `WHERE`. */
function seedBlock(sql: string): string {
  const start = sql.indexOf("-- SHORT NAMES (Slice #37.95).");
  const end = sql.indexOf(" WHERE t.key = s.key;", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return sql.slice(start, end);
}
/** A seed block's VALUES, in order. */
const pairsOf = (block: string) => [...block.matchAll(/\('([A-Z_]+)',\s+'([^']+)'\)/g)].map((m) => ({ key: m[1], shortName: m[2] }));
/** migration_103's six (#38.54): from its header comment to its `WHERE`. */
const SIX = pairsOf(MIGRATION_103.slice(MIGRATION_103.indexOf("-- SHORT NAMES (Slice #38.54)."), MIGRATION_103.indexOf(" WHERE t.key = s.key;")));
const SIX_BY_KEY = Object.fromEntries(SIX.map((s) => [s.key, s.shortName]));
/** The seed as the database holds it after every migration: 092's list with 103's six in their places. */
const SEED = pairsOf(seedBlock(MIGRATION)).map((s) => ({ key: s.key, shortName: SIX_BY_KEY[s.key] ?? s.shortName }));
const INSERT = SYNC.slice(SYNC.indexOf("INSERT INTO lookup_document_type (key, name, sort_order) VALUES"), SYNC.indexOf("-- SHORT NAMES (Slice #37.95)."));
const CATALOGUE = [...INSERT.matchAll(/\('([A-Z_]+)',\s+'([^']+)',\s+\d+\)/g)].map((m) => ({ key: m[1], name: m[2] }));

describe("the short names' seed (#37.95)", () => {
  // Slice #37.95 had „is byte-equal in the migration and in the reference data" — `seedBlock(SYNC)`
  // `toBe` `seedBlock(MIGRATION)`. Slice #38.54 changes six names by a NEW migration (092 is history),
  // so the reference data now equals 092's list with 103's six applied, pair for pair.
  it("equals migration_092's list with migration_103's six applied, in the reference data (#38.54)", () => {
    expect(pairsOf(seedBlock(SYNC))).toEqual(SEED);
  });

  it("changes exactly the six short names Adrian chose (#38.54)", () => {
    expect(SIX_BY_KEY).toEqual({
      UNCLASSIFIED: "NECLASIF.",
      AUTORIZATIE_CONSTRUIRE: "Aut. Constr.",
      CERTIFICAT_URBANISM: "Urbanism",
      HOTARARE_JUDECATOREASCA: "Hot. judec.",
      AUTORIZATIE: "Aut.",
      HOTARARE_ADMINISTRATIVA: "Hot. admin.",
    });
    expect(MIGRATION_103).not.toMatch(/ALTER TABLE|CREATE|DROP|DELETE/);
  });

  it("names every catalogue type, and nothing else", () => {
    expect(SEED.map((s) => s.key).sort()).toEqual(CATALOGUE.map((c) => c.key).sort());
  });

  it("gives the archive's abbreviations", () => {
    const by = Object.fromEntries(SEED.map((s) => [s.key, s.shortName]));
    expect(by.CONTRACT_VANZARE).toBe("CVC");
    expect(by.PLAN_AMPLASAMENT_DELIMITARE).toBe("PAD");
    // Slice #37.95 had CERTIFICAT_URBANISM „CU" and AUTORIZATIE_CONSTRUIRE „AC"; Slice #38.54, Adrian's
    // choice: „Urbanism" and „Aut. Constr.".
    expect(by.CERTIFICAT_URBANISM).toBe("Urbanism");
    expect(by.AUTORIZATIE_CONSTRUIRE).toBe("Aut. Constr.");
  });

  it("has no two types reading alike — stored, or a stored one against another's derived", () => {
    const keys = SEED.map((s) => shortNameKey(s.shortName));
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    const byKey = Object.fromEntries(CATALOGUE.map((c) => [c.key, c.name]));
    for (const s of SEED) {
      for (const c of CATALOGUE) {
        if (c.key === s.key) continue;
        expect([s.key, c.key, shortNameKey(s.shortName) === shortNameKey(derivedShortName(c.name))]).toEqual([s.key, c.key, false]);
      }
      expect(byKey[s.key]).toBeDefined();
    }
  });

  it("is a short name: shorter than the type's full name, or equal to it", () => {
    const byKey = Object.fromEntries(CATALOGUE.map((c) => [c.key, c.name]));
    for (const s of SEED) expect([s.key, s.shortName.length <= byKey[s.key].length]).toEqual([s.key, true]);
  });
});

describe("the column (#37.95)", () => {
  it("is nullable text, with a partial unique index on its folded value", () => {
    expect(MIGRATION).toContain("ADD COLUMN IF NOT EXISTS short_name text;");
    expect(MIGRATION).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS lookup_document_type_short_name_uq\s+ON lookup_document_type \(lower\(btrim\(short_name\)\)\)\s+WHERE short_name IS NOT NULL AND btrim\(short_name\) <> '';/);
    expect(read("src/db/schema/index.ts")).toContain('shortName: text("short_name"),');
  });

  it("is edited in Date de referință beside the name, and not required", () => {
    expect(LIST_META["document-types"].fields.find((f) => f.key === "shortName")).toEqual({ key: "shortName", labelKey: "shortName", required: false });
  });
});

describe("the Documents list's „Tip” (#37.95)", () => {
  const view = read("src/app/documents/list-view.tsx");
  it("shows the short name, the full name in the tooltip", () => {
    expect(view).toContain("documentTypeShortName({ name: item.documentTypeName, shortName: item.documentTypeShortName })");
    expect(view).toContain("title={item.documentTypeName ?? undefined}");
    expect(read("src/lib/documents/queries.ts")).toContain("documentTypeShortName: lookupDocumentType.shortName,");
  });
});
