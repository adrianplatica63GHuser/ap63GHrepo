/**
 * @jest-environment node
 *
 * FU-220 — a relation between two properties reads the right way from both
 * ends.                                                        (Slice #37.10)
 *
 * `property_property` stores a pair in uuid order and, until migration_087, no
 * direction: both properties showed the same bare role, so a directional role
 * („Inclus în") said the opposite of what was chosen on one of them —
 * TC-ASSOC-08, red since #36.19. Every assertion here runs with the viewed
 * property sorting FIRST and sorting SECOND, the way TC-ASSOC-07 proved the
 * document family (#36.19): a fix that is right on half the pairs is FU-001.
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

import { manualPairDirection, roleReadsFrom } from "@/lib/associations/pair-direction";
import { associatePropertiesToProperty, listPropertyReferences } from "@/lib/properties/queries";
import { propertyRoleChip, propertyRoleReadsSameBothWays } from "@/lib/properties/relation-roles";

const LOW = "11111111-1111-4111-8111-111111111111";
const HIGH = "99999999-9999-4999-8999-999999999999";

/** The part is linked „Inclus în" the whole, from the PART's screen — TC-ASSOC-08. */
const ORDERS = [
  ["the part sorts first", { part: LOW, whole: HIGH }],
  ["the part sorts second", { part: HIGH, whole: LOW }],
] as const;

beforeEach(() => {
  inserted.length = 0;
  selectRows = [];
});

describe.each(ORDERS)("FU-220 when %s", (_label, { part, whole }) => {
  it("stores the pair in uuid order with the direction of the screen it was made on", async () => {
    await associatePropertiesToProperty(part, [whole], "role-inclus");
    expect(inserted).toHaveLength(1);
    const row = inserted[0] as { propertyIdA: string; propertyIdB: string; roleReadsAToB: boolean };
    expect(row.propertyIdA < row.propertyIdB).toBe(true);
    // Read back from the part, the role reads forward: „this property Inclus în the whole".
    expect(roleReadsFrom(part, row.propertyIdA, row.roleReadsAToB)).toBe(true);
    // From the whole, the converse.
    expect(roleReadsFrom(whole, row.propertyIdA, row.roleReadsAToB)).toBe(false);
  });

  it("reads forward on the part and backward on the whole, through the list", async () => {
    const pair = manualPairDirection(part, whole);
    const stored = { propertyIdA: pair.idA, propertyIdB: pair.idB, roleReadsAToB: pair.roleReadsAToB };
    selectRows = [{ ...stored, associatedAt: new Date(0), relationshipRoleId: "r", relationshipRoleName: "Inclus în", id: whole, code: "PROP-WHOLE", nickname: null }];
    const [fromPart] = await listPropertyReferences(part);
    expect(fromPart.roleReadsFromViewed).toBe(true);
    selectRows = [{ ...stored, associatedAt: new Date(0), relationshipRoleId: "r", relationshipRoleName: "Inclus în", id: part, code: "PROP-PART", nickname: null }];
    const [fromWhole] = await listPropertyReferences(whole);
    expect(fromWhole.roleReadsFromViewed).toBe(false);
  });

  it("writes each of several ticked properties with its own pair's direction", async () => {
    const others = [LOW.replace("1111", "2222"), HIGH.replace("9999", "8888")];
    const viewed = part;
    await associatePropertiesToProperty(viewed, others, "role-inclus");
    for (const row of inserted as { propertyIdA: string; roleReadsAToB: boolean }[]) {
      expect(roleReadsFrom(viewed, row.propertyIdA, row.roleReadsAToB)).toBe(true);
    }
  });
});

describe("FU-220: what „Tip relație” shows", () => {
  it("keeps a bare chip for the four symmetric roles, however they are spelled", () => {
    for (const r of ["Adiacent", "Contiguu", "Suprapus cu", "Alipit de", "suprapus  CU"]) {
      expect(propertyRoleReadsSameBothWays(r)).toBe(true);
    }
    expect(propertyRoleChip("Adiacent", false, "PROP1")).toEqual({ kind: "bare", role: "Adiacent" });
  });

  it("says a directional role as a sentence, the right way round", () => {
    expect(propertyRoleChip("Inclus în", true, "PROP1")).toEqual({ kind: "forward", role: "Inclus în", other: "PROP1" });
    expect(propertyRoleChip("Inclus în", false, "PROP1")).toEqual({ kind: "backward", role: "Inclus în", other: "PROP1" });
    for (const r of ["Subdiviziune a", "Acces prin"]) expect(propertyRoleReadsSameBothWays(r)).toBe(false);
  });

  it("gives a role it does not know the sentence, which cannot be read the wrong way", () => {
    expect(propertyRoleChip("Rol nou", false, "PROP1").kind).toBe("backward");
  });

  it("shows nothing but „—” when there is no role", () => {
    expect(propertyRoleChip(null, true, "PROP1")).toEqual({ kind: "none" });
  });

  it("stores the direction through the helper, not a default", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/properties/queries.ts"), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
    const fn = code.slice(code.indexOf("export async function associatePropertiesToProperty("));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    expect(body).toContain("manualPairDirection(propertyId, otherId)");
    expect(body).toContain("roleReadsAToB:       pair.roleReadsAToB");
  });
});
