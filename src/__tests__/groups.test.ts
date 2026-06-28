/**
 * Unit tests for the Groups (Slice #18.07) pure helpers:
 *   - encodeGroupCode: 1-based sequence value -> two-letter code (I/O excluded)
 *   - computeMemberDelta: desired vs current member sets -> add/remove lists
 *
 * No DB / React — pure functions only.
 */

import { encodeGroupCode, GROUP_CODE_ALPHABET } from "@/lib/groups/code";
import { computeMemberDelta } from "@/lib/groups/members";

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
