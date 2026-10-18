/**
 * Unit tests for the Groups pure helpers
 * (Slice #18.07, updated Slice #20.08 — new GRP-NNN code scheme)
 *
 * Tests:
 *   - encodeGroupCode:    1-based sequence value -> GRP-NNN string
 *   - computeMemberDelta: desired vs current member sets -> add/remove lists
 *   - isPropertyVisibleForGroups: map-filter visibility helper
 *
 * No DB / React — pure functions only.
 */

import { encodeGroupCode } from "@/lib/groups/code";
import { computeMemberDelta, membersOverLimit } from "@/lib/groups/members";
import { isPropertyVisibleForGroups } from "@/lib/groups/map-filter";

describe("encodeGroupCode", () => {
  it("encodes 1 as GRP-001", () => {
    expect(encodeGroupCode(1)).toBe("GRP-001");
  });

  it("encodes 2 as GRP-002", () => {
    expect(encodeGroupCode(2)).toBe("GRP-002");
  });

  it("zero-pads single-digit values to 3 digits", () => {
    expect(encodeGroupCode(9)).toBe("GRP-009");
  });

  it("zero-pads double-digit values to 3 digits", () => {
    expect(encodeGroupCode(42)).toBe("GRP-042");
  });

  it("encodes 999 as GRP-999", () => {
    expect(encodeGroupCode(999)).toBe("GRP-999");
  });

  it("encodes 1000 as GRP-1000 (4 digits, no cap)", () => {
    expect(encodeGroupCode(1000)).toBe("GRP-1000");
  });

  it("throws on zero", () => {
    expect(() => encodeGroupCode(0)).toThrow();
  });

  it("throws on negative values", () => {
    expect(() => encodeGroupCode(-1)).toThrow();
  });

  it("throws on non-integer values", () => {
    expect(() => encodeGroupCode(1.5)).toThrow();
  });
});

describe("computeMemberDelta", () => {
  it("computes adds and removes against the current set", () => {
    const { toAdd, toRemove } = computeMemberDelta(["a", "b"], ["b", "c"]);
    expect(toAdd).toEqual(["c"]);
    expect(toRemove).toEqual(["a"]);
  });

  it("removes everything when the desired set is empty", () => {
    const { toAdd, toRemove } = computeMemberDelta(["a", "b"], []);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual(["a", "b"]);
  });

  it("is a no-op when sets are identical (order-independent)", () => {
    const { toAdd, toRemove } = computeMemberDelta(["a", "b"], ["b", "a"]);
    expect(toAdd).toEqual([]);
    expect(toRemove).toEqual([]);
  });

  it("adds everything to an empty group", () => {
    const { toAdd, toRemove } = computeMemberDelta([], ["x", "y"]);
    expect(toAdd).toEqual(["x", "y"]);
    expect(toRemove).toEqual([]);
  });
});

describe("isPropertyVisibleForGroups", () => {
  // --- Ungrouped items (groupCodes = []) ---

  it("ungrouped item is visible when '_ungrouped' sentinel is not unchecked", () => {
    expect(isPropertyVisibleForGroups([], new Set())).toBe(true);
  });

  it("ungrouped item is hidden when '_ungrouped' sentinel is unchecked", () => {
    expect(isPropertyVisibleForGroups([], new Set(["_ungrouped"]))).toBe(false);
  });

  it("unchecking named codes does not affect ungrouped items", () => {
    expect(isPropertyVisibleForGroups([], new Set(["GRP-001", "GRP-002"]))).toBe(true);
  });

  it("ungrouped item hidden only when _ungrouped is in the unchecked set", () => {
    expect(isPropertyVisibleForGroups([], new Set(["GRP-001", "_ungrouped"]))).toBe(false);
  });

  // --- Grouped items ---

  it("is visible when none of its groups are unchecked", () => {
    expect(isPropertyVisibleForGroups(["GRP-001"], new Set())).toBe(true);
    expect(isPropertyVisibleForGroups(["GRP-001", "GRP-002"], new Set())).toBe(true);
  });

  it("hides a single-group property when its only group is unchecked", () => {
    expect(isPropertyVisibleForGroups(["GRP-001"], new Set(["GRP-001"]))).toBe(false);
  });

  it("keeps a multi-group property visible while at least one group is checked", () => {
    expect(isPropertyVisibleForGroups(["GRP-001", "GRP-002"], new Set(["GRP-001"]))).toBe(true);
  });

  it("hides a multi-group property only when every one of its groups is unchecked", () => {
    expect(
      isPropertyVisibleForGroups(["GRP-001", "GRP-002"], new Set(["GRP-001", "GRP-002"])),
    ).toBe(false);
  });

  it("ignores unchecked codes the property does not belong to", () => {
    expect(isPropertyVisibleForGroups(["GRP-002"], new Set(["GRP-001", "GRP-003"]))).toBe(true);
  });

  it("_ungrouped sentinel does not affect grouped items", () => {
    expect(isPropertyVisibleForGroups(["GRP-001"], new Set(["_ungrouped"]))).toBe(true);
  });
});

// 2026-10-18 — the cap names every record over it, with the groups it is already in, instead of stopping at the first.
describe("membersOverLimit", () => {
  const m = (poId: string, groupId: string, groupCode: string) => ({ poId, groupId, groupCode });
  const three = (poId: string) => [m(poId, "g3", "GRP-003"), m(poId, "g1", "GRP-001"), m(poId, "g2", "GRP-002")];

  it("names each record at the limit, in the order asked for, its groups sorted by code", () => {
    const out = membersOverLimit(
      [{ id: "b", poId: "pb" }, { id: "a", poId: "pa" }, { id: "c", poId: "pc" }],
      [...three("pa"), m("pc", "g1", "GRP-001"), ...three("pb")],
      3,
    );
    expect(out.map((o) => o.id)).toEqual(["b", "a"]);
    expect(out[1].groups).toEqual([
      { id: "g1", code: "GRP-001" },
      { id: "g2", code: "GRP-002" },
      { id: "g3", code: "GRP-003" },
    ]);
  });

  it("is empty when every record is under the limit", () => {
    expect(membersOverLimit([{ id: "a", poId: "pa" }], [m("pa", "g1", "GRP-001"), m("pa", "g2", "GRP-002")], 3)).toEqual([]);
  });

  it("counts a repeated membership row once, and a repeated record once", () => {
    const rows = [m("pa", "g1", "GRP-001"), m("pa", "g1", "GRP-001"), m("pa", "g2", "GRP-002")];
    expect(membersOverLimit([{ id: "a", poId: "pa" }], rows, 3)).toEqual([]);
    expect(membersOverLimit([{ id: "a", poId: "pa" }, { id: "a", poId: "pa" }], three("pa"), 3)).toHaveLength(1);
  });
});
