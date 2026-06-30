/**
 * Unit tests for the version-diff frame className helper
 * (Slice #18.15.bugs / Bug 1).
 *
 * Pure function — picks the static ring on a historical version vs the animated
 * pulse class when the form is pulsing the latest (N-1 -> N) change.
 */

import { highlightRingClass } from "@/lib/versioning/highlight-ring";

describe("highlightRingClass", () => {
  it("returns no class when the field did not change", () => {
    expect(highlightRingClass(undefined, false)).toBe("");
    expect(highlightRingClass(undefined, true)).toBe("");
  });

  it("uses the static ring on a historical version (not pulsing)", () => {
    expect(highlightRingClass("green", false)).toBe("ring-2 ring-green-500");
    expect(highlightRingClass("red", false)).toBe("ring-2 ring-red-500");
  });

  it("uses the animated pulse class on the latest version (pulsing)", () => {
    expect(highlightRingClass("green", true)).toBe("ga-vpulse-green");
    expect(highlightRingClass("red", true)).toBe("ga-vpulse-red");
  });
});
