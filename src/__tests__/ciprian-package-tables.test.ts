/**
 * Which tables travel to Ciprian's box (Slice #39.58) — every table answered, Adrian's progress kept back.
 *
 * scripts/ciprian/package-tables.ts is the one answer; build-ciprian-image.ps1's `$refTablePatterns` and
 * `$knownOperationalTables` must say the same, and every table and sequence of the schema must be in exactly one list.
 */
import fs from "node:fs";
import path from "node:path";
import {
  HELD_BACK,
  NOT_DATA,
  REFERENCE_TABLE_PATTERNS,
  SHIPPED_SEQUENCES,
  SHIPPED_WITH_DATA,
  classifyTable,
  matchesPattern,
  packageLists,
} from "../../scripts/ciprian/package-tables";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");

/** Every pgTable("name", …) of the drizzle schema. */
const SCHEMA_TABLES = [...read("src", "db", "schema", "index.ts").matchAll(/pgTable\(\s*"([a-z_0-9]+)"/g)].map((m) => m[1]);
/** Every sequence the schema creates. */
const SCHEMA_SEQUENCES = [...read("src", "db", "supabase_schema_full.sql").matchAll(/^CREATE SEQUENCE public\.([a-z_0-9]+)/gm)].map((m) => m[1]);
const SCRIPT = read("build-ciprian-image.ps1");

/** A PowerShell array literal `$name = @("a", "b", …)`, possibly over several lines. */
function psArray(name: string): string[] {
  const m = new RegExp(`^\\$${name}\\s*=\\s*@\\(([\\s\\S]*?)\\)`, "m").exec(SCRIPT);
  if (!m) throw new Error(`build-ciprian-image.ps1 has no $${name} = @(…)`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe("every table of the schema has one answer", () => {
  it("finds the schema's tables", () => {
    expect(SCHEMA_TABLES.length).toBeGreaterThan(50);
  });

  it.each(SCHEMA_TABLES)("%s is reference, shipped with -WithData, or held back — never unclassified", (t) => {
    expect({ t, class: classifyTable(t) }).not.toEqual({ t, class: "unclassified" });
  });

  it("no table is in two lists", () => {
    const named = [...Object.keys(SHIPPED_WITH_DATA), ...Object.keys(HELD_BACK), ...Object.keys(NOT_DATA)];
    expect(new Set(named).size).toBe(named.length);
    for (const t of named) expect({ t, ref: REFERENCE_TABLE_PATTERNS.some((p) => matchesPattern(t, p)) }).toEqual({ t, ref: false });
  });

  it("names no table the schema does not have (a list that outlives a dropped table is a list nobody reads)", () => {
    for (const t of [...Object.keys(SHIPPED_WITH_DATA), ...Object.keys(HELD_BACK)]) expect(SCHEMA_TABLES).toContain(t);
  });

  it("every reason says something", () => {
    for (const r of [...Object.values(SHIPPED_WITH_DATA), ...Object.values(HELD_BACK), ...Object.values(NOT_DATA)]) expect(r.trim().length).toBeGreaterThan(5);
  });
});

describe("what stays on Adrian's box", () => {
  it("his skills-map progress and his accounts are held back (Adrian: „I don't want my progress … in Ciprian database”)", () => {
    expect(classifyTable("skill_attempt")).toBe("held-back");
    expect(classifyTable("app_users")).toBe("held-back");
    expect(classifyTable("user_tile_default")).toBe("held-back");
  });

  it("the archive travels: persons, properties, documents, their pages and links, interactions", () => {
    for (const t of ["person", "property", "document", "document_page", "person_document", "interaction", "principal_object"]) expect(classifyTable(t)).toBe("shipped");
  });

  it("the reference data is what it always was", () => {
    expect(classifyTable("lookup_document_type")).toBe("reference");
    expect(classifyTable("help_content")).toBe("reference");
    expect(classifyTable("time_frame_setting")).toBe("reference");
  });
});

describe("the sequences travel with the data", () => {
  it("every sequence of the schema is shipped, so Ciprian's next code is not one dev has used", () => {
    expect(SCHEMA_SEQUENCES.length).toBeGreaterThan(0);
    expect([...SCHEMA_SEQUENCES].sort()).toEqual([...SHIPPED_SEQUENCES].sort());
  });
});

describe("build-ciprian-image.ps1 says the same", () => {
  it("$refTablePatterns is REFERENCE_TABLE_PATTERNS", () => {
    expect(psArray("refTablePatterns")).toEqual([...REFERENCE_TABLE_PATTERNS]);
  });

  it("$knownOperationalTables is every table that is not reference data — shipped, held back or not data", () => {
    const l = packageLists();
    expect([...psArray("knownOperationalTables")].sort()).toEqual([...l.shipped, ...l.heldBack, ...l.notData].sort());
  });

  it("has a -WithData switch that reads these lists from the CLI", () => {
    expect(SCRIPT).toMatch(/^param\(\s*\[switch\]\$WithData\s*\)/m);
    expect(SCRIPT).toContain("scripts\\ciprian\\package-tables.ts");
  });
});
