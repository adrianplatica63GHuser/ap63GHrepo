/**
 * Unit tests for the Property versioning (Slice #18.02) pure helpers:
 * snapshot conversion, version label colour, per-field highlights, the corner
 * diff (added/removed/same), corner-change detection, and form-value equality.
 *
 * No DB / React — pure functions only.
 */

import {
  computeCornerDiff,
  computeFieldHighlights,
  cornersChanged,
  emptyFormValues,
  formValuesEqual,
  snapshotToCorners,
  snapshotToFormValues,
  versionLabelColor,
  type Corner,
} from "@/app/properties/_components/form-schema";
import type { PropertySnapshot } from "@/lib/properties/validation";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_PROP: PropertySnapshot["property"] = {
  propertyTypeId:  null,
  nickname:        null,
  tarlaSola:       null,
  parcela:         null,
  cadastralNumber: null,
  carteFunciara:   null,
  useCategoryId:   null,
  surfaceAreaMp:   null,
  notes:           null,
};

function snap(over: {
  property?: Partial<PropertySnapshot["property"]>;
  address?:  PropertySnapshot["address"];
  corners?:  Corner[];
} = {}): PropertySnapshot {
  return {
    property: { ...EMPTY_PROP, ...(over.property ?? {}) },
    address:  over.address ?? null,
    corners:  (over.corners ?? []).map((c) => ({
      lat: c.lat,
      lon: c.lon,
      originalIndex: c.originalIndex ?? null,
    })),
  };
}

const A: Corner = { lat: 1, lon: 1 };
const B: Corner = { lat: 2, lon: 2 };
const C: Corner = { lat: 3, lon: 3 };
const X: Corner = { lat: 9, lon: 9 };

// ---------------------------------------------------------------------------
// versionLabelColor
// ---------------------------------------------------------------------------

describe("versionLabelColor", () => {
  it("version 0 (no predecessor) is always green", () => {
    expect(versionLabelColor(null, snap({ property: { nickname: "x" } }))).toBe("green");
  });

  it("addition-only field change with no corner change is green", () => {
    const prev = snap({ property: { nickname: null } });
    const curr = snap({ property: { nickname: "Lot 12" } });
    expect(versionLabelColor(prev, curr)).toBe("green");
  });

  it("modifying an existing field is red", () => {
    const prev = snap({ property: { nickname: "Old" } });
    const curr = snap({ property: { nickname: "New" } });
    expect(versionLabelColor(prev, curr)).toBe("red");
  });

  it("deleting an existing field is red", () => {
    const prev = snap({ property: { nickname: "Old" } });
    const curr = snap({ property: { nickname: null } });
    expect(versionLabelColor(prev, curr)).toBe("red");
  });

  it("any corner change is red, even a pure addition", () => {
    const prev = snap({ corners: [A, B, C] });
    const curr = snap({ corners: [A, B, C, X] });
    expect(versionLabelColor(prev, curr)).toBe("red");
  });

  it("adding a field while corners are untouched is green", () => {
    const prev = snap({ property: { nickname: null }, corners: [A, B] });
    const curr = snap({ property: { nickname: "y" }, corners: [A, B] });
    expect(versionLabelColor(prev, curr)).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// computeFieldHighlights
// ---------------------------------------------------------------------------

describe("computeFieldHighlights", () => {
  it("returns no highlights for version 0 (prev null)", () => {
    const h = computeFieldHighlights(null, snap({ property: { nickname: "x" } }));
    expect(h.property).toEqual({});
    expect(h.address).toEqual({});
  });

  it("flags an added field green and a modified field red", () => {
    const prev = snap({ property: { nickname: null, parcela: "P1" } });
    const curr = snap({ property: { nickname: "added", parcela: "P2" } });
    const h = computeFieldHighlights(prev, curr);
    expect(h.property.nickname).toBe("green");
    expect(h.property.parcela).toBe("red");
    expect(h.property.tarlaSola).toBeUndefined();
  });

  it("flags a deleted field red", () => {
    const prev = snap({ property: { notes: "kept" } });
    const curr = snap({ property: { notes: null } });
    expect(computeFieldHighlights(prev, curr).property.notes).toBe("red");
  });

  it("diffs address fields, treating a missing block as all-empty", () => {
    const prev = snap({ address: null });
    const curr = snap({
      address: { streetLine: "Main 1", postalCode: null, locality: null, county: null, country: "RO", notes: null },
    });
    const h = computeFieldHighlights(prev, curr);
    expect(h.address.streetLine).toBe("green");
    expect(h.address.country).toBe("green");
  });
});

// ---------------------------------------------------------------------------
// computeCornerDiff
// ---------------------------------------------------------------------------

describe("computeCornerDiff", () => {
  it("marks every corner same when nothing changed", () => {
    const d = computeCornerDiff([A, B, C], [A, B, C]);
    expect(d.map((e) => e.type)).toEqual(["same", "same", "same"]);
  });

  it("marks an appended corner as added", () => {
    const d = computeCornerDiff([A, B], [A, B, X]);
    expect(d.map((e) => e.type)).toEqual(["same", "same", "added"]);
  });

  it("places a removed marker at the deleted corner's former position", () => {
    // B removed from the middle.
    const d = computeCornerDiff([A, B, C], [A, C]);
    expect(d.map((e) => e.type)).toEqual(["same", "removed", "same"]);
  });

  it("represents an inserted corner as added between the unchanged ones", () => {
    const d = computeCornerDiff([A, B], [A, X, B]);
    expect(d.map((e) => e.type)).toEqual(["same", "added", "same"]);
  });

  it("an in-place coordinate edit is one `changed` row (no extra rows)", () => {
    const d = computeCornerDiff([A, B, C], [A, X, C]);
    expect(d.map((e) => e.type)).toEqual(["same", "changed", "same"]);
    expect(d).toHaveLength(3); // same count as before — table does not grow
  });

  it("a reorder marks the moved positions changed without changing row count", () => {
    const d = computeCornerDiff([A, B, C], [A, C, B]);
    expect(d.map((e) => e.type)).toEqual(["same", "changed", "changed"]);
    expect(d).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// cornersChanged
// ---------------------------------------------------------------------------

describe("cornersChanged", () => {
  it("is false for identical corner lists", () => {
    expect(cornersChanged([A, B, C], [A, B, C])).toBe(false);
  });

  it("is true when corners are reordered", () => {
    expect(cornersChanged([A, B, C], [A, C, B])).toBe(true);
  });

  it("is true when originalIndex differs", () => {
    expect(
      cornersChanged(
        [{ lat: 1, lon: 1, originalIndex: 5 }],
        [{ lat: 1, lon: 1, originalIndex: 6 }],
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formValuesEqual + snapshot conversion
// ---------------------------------------------------------------------------

describe("formValuesEqual", () => {
  it("treats blank and whitespace-only as equal-to-empty", () => {
    expect(formValuesEqual(emptyFormValues, { ...emptyFormValues, nickname: "   " })).toBe(true);
  });

  it("detects a real field change", () => {
    expect(formValuesEqual(emptyFormValues, { ...emptyFormValues, nickname: "x" })).toBe(false);
  });

  it("detects an address field change", () => {
    expect(
      formValuesEqual(emptyFormValues, {
        ...emptyFormValues,
        address: { ...emptyFormValues.address, locality: "Bragadiru" },
      }),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// "Make this version current" (restore) — snapshot-level semantics
//
// Restore re-saves the *viewed* historical snapshot verbatim as a brand-new
// version. So its content equals the chosen snapshot, and its label/highlights
// (vs the previous latest) reflect whatever the restore reverts.
// ---------------------------------------------------------------------------

describe("make-this-version-current (restore)", () => {
  it("restores the chosen historical snapshot's content verbatim", () => {
    const older = snap({ property: { nickname: "Original", notes: "keep" }, corners: [A, B, C] });
    const restored = older; // make-current re-saves the viewed snapshot as-is
    expect(snapshotToFormValues(restored).nickname).toBe("Original");
    expect(snapshotToFormValues(restored).notes).toBe("keep");
    expect(snapshotToCorners(restored)).toEqual([
      { lat: 1, lon: 1, originalIndex: null },
      { lat: 2, lon: 2, originalIndex: null },
      { lat: 3, lon: 3, originalIndex: null },
    ]);
  });

  it("a restore that reverts a modified field is red vs the previous latest", () => {
    const prevLatest = snap({ property: { nickname: "Edited" } });
    const restored   = snap({ property: { nickname: "Original" } }); // older content
    expect(versionLabelColor(prevLatest, restored)).toBe("red");
    expect(computeFieldHighlights(prevLatest, restored).property.nickname).toBe("red");
  });

  it("a restore that brings back a previously-deleted field is green for that field", () => {
    const prevLatest = snap({ property: { notes: null } });          // field had been cleared
    const restored   = snap({ property: { notes: "from older version" } }); // older still had it
    expect(computeFieldHighlights(prevLatest, restored).property.notes).toBe("green");
  });

  it("a restore that reverts a corner change is red (any corner change)", () => {
    const prevLatest = snap({ corners: [A, B, C, X] }); // a corner was added
    const restored   = snap({ corners: [A, B, C] });    // older had fewer
    expect(versionLabelColor(prevLatest, restored)).toBe("red");
  });
});

describe("snapshot conversion", () => {
  it("round-trips property + address into form values", () => {
    const s = snap({
      property: { nickname: "Lot 9", surfaceAreaMp: "450.50" },
      address: { streetLine: "Main 1", postalCode: null, locality: "Br", county: null, country: "RO", notes: null },
    });
    const fv = snapshotToFormValues(s);
    expect(fv.nickname).toBe("Lot 9");
    expect(fv.surfaceAreaMp).toBe("450.50");
    expect(fv.address.streetLine).toBe("Main 1");
    expect(fv.address.country).toBe("RO");
  });

  it("converts corners preserving originalIndex", () => {
    const s = snap({ corners: [{ lat: 1, lon: 2, originalIndex: 7 }] });
    expect(snapshotToCorners(s)).toEqual([{ lat: 1, lon: 2, originalIndex: 7 }]);
  });
});
