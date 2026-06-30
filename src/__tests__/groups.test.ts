/**
 * Unit tests for the Groups (Slice #18.07 + Slice #18.17 + Slice #18.18) pure helpers:
 *   - encodeGroupCode:  1-based sequence value -> two-letter code (I/O excluded)
 *   - groupCodePrefix:  target type -> display prefix (PROP-, PPERS-, JPERS-, DOC-)
 *   - computeMemberDelta: desired vs current member sets -> add/remove lists
 *
 * No DB / React — pure functions only.
 */

import { encodeGroupCode, GROUP_CODE_ALPHABET, groupCodePrefix } from "@/lib/groups/code";
import { computeMemberDelta } from "@/lib/groups/members";
import { isPropertyVisibleForGroups } from "@/lib/groups/map-filter";

describe("encodeGroupCode", () => {
  it("starts at AA and steps through the alphabet", () => {
    expect(encodeGroupCode(1)).toBe("AA");
    expect(encodeGroupCode(2)).toBe("AB");
  });

  it("skips the letter I (8th position is H, 9th is J)", () => {
    expect(encodeGroupCode(8)).toBe("AH");
    expect(encodeGroupCode(9)).toBe("AJ");
  });

  it("rolls the second letter to Z then carries to the next first letter", () => {
    expect(encodeGroupCode(24)).toBe("AZ");
    expect(encodeGroupCode(25)).toBe("BA");
  });

  it("reaches ZZ at the end of the two-letter range (576)", () => {
    expect(encodeGroupCode(576)).toBe("ZZ");
  });

  it("never produces the excluded letters I or O", () => {
    expect(GROUP_CODE_ALPHABET).not.toMatch(/[IO]/);
    for (let n = 1; n <= 576; n++) {
      expect(encodeGroupCode(n)).not.toMatch(/[IO]/);
    }
  });

  it("throws on out-of-range values", () => {
    expect(() => encodeGroupCode(0)).toThrow();
    expect(() => encodeGroupCode(-1)).toThrow();
    expect(() => encodeGroupCode(1.5)).toThrow();
    expect(() => encodeGroupCode(577)).toThrow();
  });
});

describe("groupCodePrefix (Slice #18.17, updated #18.18)", () => {
  it("returns PROP- for PROPERTY", () => {
    expect(groupCodePrefix("PROPERTY")).toBe("PROP-");
  });

  it("returns PPERS- for PHYSICAL_PERSON", () => {
    expect(groupCodePrefix("PHYSICAL_PERSON")).toBe("PPERS-");
  });

  it("returns JPERS- for JUDICIAL_PERSON", () => {
    expect(groupCodePrefix("JUDICIAL_PERSON")).toBe("JPERS-");
  });

  it("returns DOC- for DOCUMENT", () => {
    expect(groupCodePrefix("DOCUMENT")).toBe("DOC-");
  });

  it("combines with encodeGroupCode to form the full stored code", () => {
    expect(groupCodePrefix("PROPERTY")        + encodeGroupCode(1)).toBe("PROP-AA");
    expect(groupCodePrefix("PHYSICAL_PERSON") + encodeGroupCode(2)).toBe("PPERS-AB");
    expect(groupCodePrefix("JUDICIAL_PERSON") + encodeGroupCode(25)).toBe("JPERS-BA");
    expect(groupCodePrefix("DOCUMENT")        + encodeGroupCode(576)).toBe("DOC-ZZ");
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
    // Only the _ungrouped sentinel hides ungrouped properties.
    expect(isPropertyVisibleForGroups([], new Set(["AA", "AB"]))).toBe(true);
  });

  it("ungrouped item hidden only when _ungrouped is in the unchecked set", () => {
    expect(isPropertyVisibleForGroups([], new Set(["AA", "_ungrouped"]))).toBe(false);
  });

  // --- Grouped items ---

  it("is visible when none of its groups are unchecked", () => {
    expect(isPropertyVisibleForGroups(["AA"], new Set())).toBe(true);
    expect(isPropertyVisibleForGroups(["AA", "AB"], new Set())).toBe(true);
  });

  it("hides a single-group property when its only group is unchecked", () => {
    expect(isPropertyVisibleForGroups(["AA"], new Set(["AA"]))).toBe(false);
  });

  it("keeps a multi-group property visible while at least one group is checked", () => {
    // AA unchecked but AB still checked -> visible.
    expect(isPropertyVisibleForGroups(["AA", "AB"], new Set(["AA"]))).toBe(true);
  });

  it("hides a multi-group property only when every one of its groups is unchecked", () => {
    expect(isPropertyVisibleForGroups(["AA", "AB"], new Set(["AA", "AB"]))).toBe(false);
  });

  it("ignores unchecked codes the property does not belong to", () => {
    // Property is in AB (checked); AA + AC unchecked but irrelevant -> visible.
    expect(isPropertyVisibleForGroups(["AB"], new Set(["AA", "AC"]))).toBe(true);
  });

  it("_ungrouped sentinel does not affect grouped items", () => {
    // A property in group AA is still visible even when _ungrouped is unchecked.
    expect(isPropertyVisibleForGroups(["AA"], new Set(["_ungrouped"]))).toBe(true);
  });
});
