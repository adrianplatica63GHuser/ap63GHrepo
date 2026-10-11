/**
 * Slice #39.10 — a person-to-person role's family tie (`lookup_person_role.kinship`, migration_106): read the right
 * way from each end of a pair, the CHECKs, the seed as Adrian confirmed it, and where the role's panel sets it.
 */
import fs from "fs";
import path from "path";

import { LIST_META } from "@/lib/admin/value-lists/config";
import { personRoleSchema } from "@/lib/admin/value-lists/validation";
import { KINSHIPS, KINSHIP_SEED, converseKinship, isKinship, tieOf } from "@/lib/persons/kinship";

const ROOT = process.cwd();
const read = (...p: string[]) => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const MIGRATION = read("src", "db", "migration_106_role_kinship.sql");

describe("the tie, read from each end of a pair", () => {
  const A = "00000000-0000-0000-0000-00000000000a";
  const B = "00000000-0000-0000-0000-00000000000b";

  it("„A Tată B” (A holds the role): A is the parent, B the child", () => {
    const pair = { personIdA: A, roleReadsAToB: true, kinship: "PARENT" };
    expect(tieOf(A, pair)).toBe("PARENT");
    expect(tieOf(B, pair)).toBe("CHILD");
  });

  it("the same role held by B: B is the parent, A the child", () => {
    const pair = { personIdA: A, roleReadsAToB: false, kinship: "PARENT" };
    expect(tieOf(B, pair)).toBe("PARENT");
    expect(tieOf(A, pair)).toBe("CHILD");
  });

  it("„A Fiu B”: A the child, B the parent", () => {
    const pair = { personIdA: A, roleReadsAToB: true, kinship: "CHILD" };
    expect([tieOf(A, pair), tieOf(B, pair)]).toEqual(["CHILD", "PARENT"]);
  });

  it.each(["SPOUSE", "SIBLING", "OTHER"] as const)("%s reads the same from both ends", (k) => {
    for (const roleReadsAToB of [true, false]) {
      const pair = { personIdA: A, roleReadsAToB, kinship: k };
      expect([tieOf(A, pair), tieOf(B, pair)]).toEqual([k, k]);
    }
  });

  it("no family tie: null from both ends, and an unknown value is not guessed at", () => {
    for (const kinship of [null, "", "COUSIN", "parent"]) {
      const pair = { personIdA: A, roleReadsAToB: true, kinship };
      expect([tieOf(A, pair), tieOf(B, pair)]).toEqual([null, null]);
    }
  });

  it("converse twice is the tie itself", () => {
    for (const k of KINSHIPS) expect(converseKinship(converseKinship(k))).toBe(k);
    expect(isKinship("OTHER")).toBe(true);
    expect(isKinship(undefined)).toBe(false);
  });
});

describe("migration_106", () => {
  it("adds the column with the five values, and keeps a parent_kind role at PARENT", () => {
    expect(MIGRATION).toContain("ALTER TABLE lookup_person_role ADD COLUMN IF NOT EXISTS kinship text;");
    expect(MIGRATION).toContain("CHECK (kinship IS NULL OR kinship IN ('PARENT', 'CHILD', 'SPOUSE', 'SIBLING', 'OTHER'))");
    expect(MIGRATION).toContain("CHECK (parent_kind IS NULL OR kinship = 'PARENT')");
    // The parent_kind roles are set by the column before the CHECK is added, so it cannot fail on them.
    expect(MIGRATION.indexOf("WHERE parent_kind IS NOT NULL")).toBeLessThan(MIGRATION.indexOf("chk_lookup_person_role_kinship_parent\n"));
  });

  it("seeds exactly the confirmed list, only where the tie is still empty", () => {
    const values = [...MIGRATION.matchAll(/\('([^']+)',\s*'(PARENT|CHILD|SPOUSE|SIBLING|OTHER)'\)/g)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(values)).toEqual(KINSHIP_SEED);
    expect(MIGRATION).toMatch(/WHERE r\.name = c\.name\s+AND r\.kinship IS NULL;/);
  });

  it("the reference seed carries the same ties for the names it has", () => {
    const seed = read("src", "db", "sync-reference-data.sql");
    const block = seed.slice(seed.indexOf("-- ── lookup_person_role.kinship"));
    const pairs = Object.fromEntries([...block.matchAll(/\('([^']+)',\s*'(PARENT|CHILD|SPOUSE|SIBLING|OTHER)'\)/g)].map((m) => [m[1], m[2]]));
    const names = [...seed.matchAll(/\(gen_random_uuid\(\), '([^']+)'/g)].map((m) => m[1]);
    const expected = Object.fromEntries(Object.entries(KINSHIP_SEED).filter(([n]) => names.includes(n)));
    expect(pairs).toEqual(expected);
    expect(Object.keys(expected)).toHaveLength(9); // „Bunic" and „Nepot" are Adrian's own, in no file
  });

  it("the schema has the column", () => {
    expect(read("src", "db", "schema", "index.ts")).toContain('kinship:    text("kinship"),');
  });
});

describe("where it is set — the role's panel, and read in „Persoană → Persoană”", () => {
  it("is a select of the five, read in the person column, not a column of its own", () => {
    const f = LIST_META["person-roles"].fields.find((x) => x.key === "kinship");
    expect(f).toMatchObject({ type: "select", options: KINSHIPS, readIn: "validForPerson", required: false });
  });

  it("accepts the five, „none” as null, and nothing else", () => {
    const base = { name: "Rol" };
    for (const k of KINSHIPS) expect(personRoleSchema.parse({ ...base, kinship: k }).kinship).toBe(k);
    expect(personRoleSchema.parse({ ...base, kinship: "" }).kinship).toBeNull();
    expect(personRoleSchema.parse({ ...base, kinship: null }).kinship).toBeNull();
    expect(personRoleSchema.parse(base).kinship).toBeUndefined();
    expect(personRoleSchema.safeParse({ ...base, kinship: "COUSIN" }).success).toBe(false);
  });
});
