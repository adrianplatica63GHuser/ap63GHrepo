/**
 * @jest-environment node
 *
 * A relationship between two people reads the right way from both ends.
 *                                                              (Slice #37.28)
 *
 * `person_person` stores a pair in uuid order and, until migration_088, no
 * direction: both people's „Persoane" tiles showed the same word, so Ion
 * recorded as „Fiu" of Maria read „Maria — Fiu" on Ion's tile. Every assertion
 * that stores a pair runs with the viewed person sorting FIRST and SECOND —
 * a fix that is right on half the pairs is FU-001 (TC-ASSOC-07, TC-ASSOC-08).
 */
import fs from "node:fs";
import path from "node:path";

const inserted: Record<string, unknown>[] = [];
let selectRows: Record<string, unknown>[] = [];

jest.mock("@/db", () => {
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    leftJoin: () => chain,
    where: () => chain,
    orderBy: async () => selectRows,
  };
  return {
    db: {
      select: () => chain,
      insert: () => ({
        values: (v: Record<string, unknown>[]) => {
          inserted.push(...v);
          return { onConflictDoNothing: async () => undefined };
        },
      }),
    },
  };
});

jest.mock("@/lib/admin/value-lists/role-offers", () => ({
  personRoleIdsAcrossDocumentTypes: async () => [],
  personRoleIdsValidForPerson:      async () => ["role-fiu", "role-rep"],
  personRoleIdsValidForProperty:    async () => [],
}));

import { associatePersonsToPerson, listPersonReferences } from "@/lib/persons/queries";
import {
  converseFor,
  pairForTicked,
  personRoleShown,
  roleHeldBy,
  type PersonRoleWords,
} from "@/lib/persons/relation-roles";

const LOW  = "11111111-1111-4111-8111-111111111111";
const HIGH = "99999999-9999-4999-8999-999999999999";

/** The ten roles as migration_088 fills them in. */
const ROLES: Record<string, PersonRoleWords> = {
  Coproprietar:                    { name: "Coproprietar", converseName: "Coproprietar", converseNameMale: null, converseNameFemale: null },
  "Reprezentant legal / Mandatar": { name: "Reprezentant legal / Mandatar", converseName: "Reprezentat / Mandant", converseNameMale: null, converseNameFemale: "Reprezentată / Mandantă" },
  "Moștenitor":                    { name: "Moștenitor", converseName: "Autorul moștenirii", converseNameMale: null, converseNameFemale: null },
  "Soț":                           { name: "Soț", converseName: "Soț / Soție", converseNameMale: "Soț", converseNameFemale: "Soție" },
  "Soție":                         { name: "Soție", converseName: "Soț / Soție", converseNameMale: "Soț", converseNameFemale: "Soție" },
  "Părinte":                       { name: "Părinte", converseName: "Copil", converseNameMale: "Fiu", converseNameFemale: "Fiică" },
  Fiu:                             { name: "Fiu", converseName: "Părinte", converseNameMale: null, converseNameFemale: null },
  "Fiică":                         { name: "Fiică", converseName: "Părinte", converseNameMale: null, converseNameFemale: null },
  Frate:                           { name: "Frate", converseName: "Frate / Soră", converseNameMale: "Frate", converseNameFemale: "Soră" },
  "Soră":                          { name: "Soră", converseName: "Frate / Soră", converseNameMale: "Frate", converseNameFemale: "Soră" },
};

beforeEach(() => {
  inserted.length = 0;
  selectRows = [];
});

/** Ion is linked „Fiu" from MARIA's screen — ticked on her „Asociază". */
const ORDERS = [
  ["Maria sorts first", { maria: LOW, ion: HIGH }],
  ["Maria sorts second", { maria: HIGH, ion: LOW }],
] as const;

describe.each(ORDERS)("Ion „Fiu” of Maria, when %s", (_label, { maria, ion }) => {
  it("stores the pair in uuid order, held by the person ticked", async () => {
    await associatePersonsToPerson(maria, [ion], "role-fiu");
    expect(inserted).toHaveLength(1);
    const row = inserted[0] as { personIdA: string; personIdB: string; roleReadsAToB: boolean; relationshipRoleId: string };
    expect(row.personIdA < row.personIdB).toBe(true);
    expect(row.relationshipRoleId).toBe("role-fiu");
    expect(roleHeldBy(ion, row.personIdA, row.roleReadsAToB)).toBe(true);
    expect(roleHeldBy(maria, row.personIdA, row.roleReadsAToB)).toBe(false);
  });

  it("reads „Ion — Fiu” on Maria's tile and „Maria — Părinte” on Ion's, through the list", async () => {
    const pair = pairForTicked(maria, ion);
    const role = {
      relationshipRoleId: "role-fiu", relationshipRoleName: "Fiu",
      converseName: "Părinte", converseNameMale: null, converseNameFemale: null,
    };
    selectRows = [{ ...pair, ...role, associatedAt: new Date(0), id: ion, code: "PPERS-ION", type: "NATURAL", displayName: "Ion", gender: "MALE" }];
    const [onMaria] = await listPersonReferences(maria);
    expect(onMaria.roleShown).toEqual({ kind: "role", name: "Fiu" });
    expect(onMaria.relationshipRoleName).toBe("Fiu");

    selectRows = [{ ...pair, ...role, associatedAt: new Date(0), id: maria, code: "PPERS-MARIA", type: "NATURAL", displayName: "Maria", gender: "FEMALE" }];
    const [onIon] = await listPersonReferences(ion);
    expect(onIon.roleShown).toEqual({ kind: "role", name: "Părinte" });
  });

  it("gives each of several ticked people their own pair's direction", async () => {
    const others = [LOW.replace("1111", "2222"), HIGH.replace("9999", "8888")];
    await associatePersonsToPerson(maria, others, "role-fiu");
    expect(inserted).toHaveLength(2);
    for (const row of inserted as { personIdA: string; personIdB: string; roleReadsAToB: boolean }[]) {
      const ticked = row.personIdA === maria ? row.personIdB : row.personIdA;
      expect(roleHeldBy(ticked, row.personIdA, row.roleReadsAToB)).toBe(true);
    }
  });
});

describe.each([
  ["the company sorts first", { company: LOW, rep: HIGH }],
  ["the company sorts second", { company: HIGH, rep: LOW }],
] as const)("a representative for the company (TC-ASSOC-11), when %s", (_label, { company, rep }) => {
  it("reads „Reprezentant legal / Mandatar” on the company and its converse on the person", async () => {
    await associatePersonsToPerson(company, [rep], "role-rep");
    const row = inserted[0] as { personIdA: string; roleReadsAToB: boolean };
    const role = ROLES["Reprezentant legal / Mandatar"];
    // The company's tile lists the person, who holds the role.
    expect(personRoleShown(role, roleHeldBy(rep, row.personIdA, row.roleReadsAToB), "FEMALE"))
      .toEqual({ kind: "role", name: "Reprezentant legal / Mandatar" });
    // The person's tile lists the company — no gender — which is represented.
    expect(personRoleShown(role, roleHeldBy(company, row.personIdA, row.roleReadsAToB), null))
      .toEqual({ kind: "role", name: "Reprezentat / Mandant" });
  });
});

describe("the converse follows the gender of the person shown", () => {
  const cases: Array<[string, "MALE" | "FEMALE" | null, string]> = [
    ["Părinte", "MALE", "Fiu"],
    ["Părinte", "FEMALE", "Fiică"],
    ["Părinte", null, "Copil"],
    ["Fiu", "FEMALE", "Părinte"],
    ["Fiică", "MALE", "Părinte"],
    ["Soț", "FEMALE", "Soție"],
    ["Soție", "MALE", "Soț"],
    ["Soț", null, "Soț / Soție"],
    ["Frate", "FEMALE", "Soră"],
    ["Soră", "MALE", "Frate"],
    ["Frate", null, "Frate / Soră"],
    ["Moștenitor", "MALE", "Autorul moștenirii"],
    ["Reprezentant legal / Mandatar", "FEMALE", "Reprezentată / Mandantă"],
    ["Reprezentant legal / Mandatar", "MALE", "Reprezentat / Mandant"],
    ["Coproprietar", "FEMALE", "Coproprietar"],
  ];
  it.each(cases)("the converse of %s for %s is %s", (role, gender, expected) => {
    expect(converseFor(ROLES[role], gender)).toBe(expected);
    expect(personRoleShown(ROLES[role], false, gender)).toEqual({ kind: "role", name: expected });
  });

  it("shows the role itself beside the person who holds it, whatever their gender", () => {
    expect(personRoleShown(ROLES["Părinte"], true, "FEMALE")).toEqual({ kind: "role", name: "Părinte" });
    expect(personRoleShown(ROLES.Fiu, true, null)).toEqual({ kind: "role", name: "Fiu" });
  });

  it("reads „Coproprietar” the same from both ends", () => {
    for (const held of [true, false]) {
      expect(personRoleShown(ROLES.Coproprietar, held, null)).toEqual({ kind: "role", name: "Coproprietar" });
    }
  });
});

describe("a role with no converse is not guessed at", () => {
  const bare: PersonRoleWords = { name: "Rol nou", converseName: null, converseNameMale: null, converseNameFemale: null };

  it("is said as a sentence from the holder's side, never as the same bare word", () => {
    expect(personRoleShown(bare, false, "MALE")).toEqual({ kind: "held-by-viewed", name: "Rol nou" });
    expect(personRoleShown(bare, true, "MALE")).toEqual({ kind: "role", name: "Rol nou" });
  });

  it("treats a blank converse box as empty, and a blank gendered one as the neutral", () => {
    expect(personRoleShown({ ...bare, converseName: "  " }, false, null).kind).toBe("held-by-viewed");
    expect(converseFor({ ...ROLES["Părinte"], converseNameFemale: "" }, "FEMALE")).toBe("Copil");
  });

  it("shows nothing but „—” when the link has no role", () => {
    expect(personRoleShown(null, true, null)).toEqual({ kind: "none" });
  });
});

describe("migration_088 and sync-reference-data.sql carry the same roles", () => {
  const read = (rel: string) =>
    fs.readFileSync(path.join(process.cwd(), rel), "utf8")
      .split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
  const migration = read("src/db/migration_088_person_relation_direction.sql");
  const seed = read("src/db/sync-reference-data.sql");

  /** The converse VALUES table: every `('name', 'neutral', male, female)` row. */
  function converseRows(sql: string): string[] {
    const start = sql.indexOf("SET converse_name        = c.neutral");
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf("AS c(name, neutral, male, female)", start));
    return [...body.matchAll(/\(('[^']*'),\s*('[^']*'),\s*('[^']*'|NULL),\s*('[^']*'|NULL)\)/g)]
      .map((m) => m.slice(1).join(" | ")).sort();
  }

  it("names the same converse for every role, row for row", () => {
    expect(converseRows(migration)).toHaveLength(10);
    expect(converseRows(seed)).toEqual(converseRows(migration));
  });

  it("matches this suite's own table, so the tests above test the shipped words", () => {
    const q = (v: string | null) => (v === null ? "NULL" : `'${v}'`);
    const mine = Object.values(ROLES)
      .map((r) => [q(r.name), q(r.converseName), q(r.converseNameMale), q(r.converseNameFemale)].join(" | "))
      .sort();
    expect(converseRows(migration)).toEqual(mine);
  });

  it("adds the seven kinship roles with the same description and sort_order on both", () => {
    const fromMigration = [...migration.matchAll(/\('([^']+)',\s*'([^']*)',\s*(\d+)\)/g)]
      .map((m) => `${m[1]} | ${m[2]} | ${m[3]}`).sort();
    const fromSeed = [...seed.matchAll(/\(gen_random_uuid\(\), '([^']+)', '([^']*)', (5[7-9]|6[0-3]), now\(\), now\(\)\)/g)]
      .map((m) => `${m[1]} | ${m[2]} | ${m[3]}`).sort();
    expect(fromMigration).toHaveLength(7);
    expect(fromSeed).toEqual(fromMigration);
  });

  it("ticks the same ten roles for people on both", () => {
    const ticks = (sql: string) => {
      const i = sql.indexOf("SET valid_for_person = true");
      const body = sql.slice(i, sql.indexOf(";", i));
      return [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
    };
    expect(ticks(migration)).toHaveLength(10);
    expect(ticks(seed)).toEqual(ticks(migration));
  });
});

describe("the write path stores the direction through the helper", () => {
  it("builds every pair with pairForTicked", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/persons/queries.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const fn = code.slice(code.indexOf("export async function associatePersonsToPerson("));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("pairForTicked(personId, otherId)");
    expect(body).not.toContain(".sort()");
  });
});
