/**
 * Unit tests for the Properties-Map ruler helpers (Slice #18.14.ruler).
 *
 * All pure functions — no DB / React. Covers the 3x3 solver, the local affine
 * WGS84 -> Stereo 70 fit + apply, planar/ruler distance, 1 cm formatting, and
 * pixel-radius corner snapping — and, since Slice 40.07, the zigzag: what a
 * click does, each segment's kept length, the total, and the labels' text in
 * both languages.
 */

import fs from "node:fs";
import path from "node:path";
import {
  solve3x3,
  fitAffine,
  applyAffine,
  planarDistanceM,
  rulerDistanceM,
  formatMeters,
  nearestCornerWithinPx,
  EMPTY_RULER_PATH,
  addRulerPoint,
  fillPendingLengths,
  finishRulerPath,
  rulerClickKind,
  rulerLabelMessage,
  rulerLiveLabel,
  rulerSegmentLabels,
  rulerTotalM,
  SNAP_PX,
  type AffineSample,
  type AffineWgs84ToStereo70,
  type LatLon,
  type RulerPath,
} from "@/lib/geo/ruler";

// A synthetic-but-realistic local transform around the project area
// (Bragadiru, ~44.37 N, 25.98 E). Magnitudes mirror Stereo 70 metres.
const REF_LAT = 44.37;
const REF_LON = 25.98;
function trueNorth(lat: number, lon: number): number {
  return 111_000 * (lat - REF_LAT) + 2 * (lon - REF_LON) + 320_000;
}
function trueEast(lat: number, lon: number): number {
  return 1 * (lat - REF_LAT) + 78_000 * (lon - REF_LON) + 580_000;
}
function sampleAt(lat: number, lon: number): AffineSample {
  return { lat, lon, north: trueNorth(lat, lon), east: trueEast(lat, lon) };
}

describe("solve3x3", () => {
  it("solves a simple system", () => {
    // x + y + z = 6 ; 2y + 5z = -4 ; 2x + 5y - z = 27  -> x=5, y=3, z=-2
    const x = solve3x3(
      [
        [1, 1, 1],
        [0, 2, 5],
        [2, 5, -1],
      ],
      [6, -4, 27],
    );
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(5, 9);
    expect(x![1]).toBeCloseTo(3, 9);
    expect(x![2]).toBeCloseTo(-2, 9);
  });

  it("returns null for a singular matrix", () => {
    expect(
      solve3x3(
        [
          [1, 2, 3],
          [2, 4, 6], // 2x row 0 — linearly dependent
          [1, 0, 1],
        ],
        [1, 2, 3],
      ),
    ).toBeNull();
  });
});

describe("fitAffine / applyAffine", () => {
  it("recovers a known affine transform from 3 well-spread samples", () => {
    const samples = [
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON),
      sampleAt(REF_LAT, REF_LON + 0.01),
    ];
    const aff = fitAffine(samples);
    expect(aff).not.toBeNull();

    // Apply to a fresh point and compare to the ground truth.
    const p = { lat: REF_LAT + 0.004, lon: REF_LON + 0.007 };
    const got = applyAffine(aff!, p);
    expect(got.north).toBeCloseTo(trueNorth(p.lat, p.lon), 4);
    expect(got.east).toBeCloseTo(trueEast(p.lat, p.lon), 4);
  });

  it("is robust with more than 3 samples (least squares)", () => {
    const samples = [
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON),
      sampleAt(REF_LAT, REF_LON + 0.01),
      sampleAt(REF_LAT + 0.008, REF_LON + 0.006),
    ];
    const aff = fitAffine(samples);
    expect(aff).not.toBeNull();
    const p = { lat: REF_LAT + 0.002, lon: REF_LON + 0.009 };
    const got = applyAffine(aff!, p);
    expect(got.north).toBeCloseTo(trueNorth(p.lat, p.lon), 3);
    expect(got.east).toBeCloseTo(trueEast(p.lat, p.lon), 3);
  });

  it("returns null for fewer than 3 samples", () => {
    expect(fitAffine([])).toBeNull();
    expect(fitAffine([sampleAt(REF_LAT, REF_LON)])).toBeNull();
    expect(
      fitAffine([sampleAt(REF_LAT, REF_LON), sampleAt(REF_LAT + 0.01, REF_LON)]),
    ).toBeNull();
  });

  it("returns null for collinear samples", () => {
    const collinear = [
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON + 0.01),
      sampleAt(REF_LAT + 0.02, REF_LON + 0.02),
    ];
    expect(fitAffine(collinear)).toBeNull();
  });
});

describe("planarDistanceM", () => {
  it("computes a 3-4-5 distance", () => {
    expect(
      planarDistanceM({ north: 0, east: 0 }, { north: 4, east: 3 }),
    ).toBeCloseTo(5, 9);
  });

  it("is zero for identical points", () => {
    expect(
      planarDistanceM({ north: 100, east: 200 }, { north: 100, east: 200 }),
    ).toBe(0);
  });
});

describe("rulerDistanceM", () => {
  it("measures true ground distance under the fitted transform", () => {
    const aff = fitAffine([
      sampleAt(REF_LAT, REF_LON),
      sampleAt(REF_LAT + 0.01, REF_LON),
      sampleAt(REF_LAT, REF_LON + 0.01),
    ])!;
    const a = { lat: REF_LAT, lon: REF_LON };
    const b = { lat: REF_LAT + 0.001, lon: REF_LON };
    // North scale is 111 000 m/deg, so 0.001 deg of latitude ≈ 111 m.
    expect(rulerDistanceM(aff, a, b)).toBeCloseTo(111, 2);
  });
});

describe("formatMeters", () => {
  it("renders 1 cm precision with a unit", () => {
    expect(formatMeters(12.3)).toBe("12.30 m");
    expect(formatMeters(5.678)).toBe("5.68 m"); // third decimal 7 rounds up
    expect(formatMeters(0)).toBe("0.00 m");
    expect(formatMeters(1234.5)).toBe("1234.50 m");
  });

  it("guards non-finite / negative input", () => {
    expect(formatMeters(NaN)).toBe("0.00 m");
    expect(formatMeters(-5)).toBe("0.00 m");
    expect(formatMeters(Infinity)).toBe("0.00 m");
  });
});

describe("nearestCornerWithinPx", () => {
  const corners = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 },
  ];

  it("returns the nearest corner within the threshold", () => {
    expect(nearestCornerWithinPx({ x: 4, y: 3 }, corners, 12)).toBe(0);
    expect(nearestCornerWithinPx({ x: 96, y: 0 }, corners, 12)).toBe(1);
  });

  it("returns null when no corner is within the threshold", () => {
    expect(nearestCornerWithinPx({ x: 25, y: 25 }, corners, 12)).toBeNull();
  });

  it("picks the lowest index on an exact tie", () => {
    // Equidistant from corner 0 (0,0) and corner 1 (100,0) at x=50.
    const twoCorners = [
      { x: 0, y: 0 },
      { x: 8, y: 0 },
    ];
    expect(nearestCornerWithinPx({ x: 4, y: 0 }, twoCorners, 12)).toBe(0);
  });

  it("uses SNAP_PX by default", () => {
    expect(nearestCornerWithinPx({ x: 10, y: 0 }, corners)).toBe(0); // 10 <= 12
    expect(nearestCornerWithinPx({ x: 13, y: 0 }, corners)).toBeNull(); // 13 > 12
  });
});

// ---------------------------------------------------------------------------
// Slice 40.07 — the zigzag
// ---------------------------------------------------------------------------

describe("the ruler's zigzag (Slice 40.07)", () => {
  // The transform the tests measure with: fitted on the synthetic local transform above.
  const AFF = fitAffine([sampleAt(44.37, 25.98), sampleAt(44.38, 25.98), sampleAt(44.37, 25.99)]) as AffineWgs84ToStereo70;
  // Five points, each step a known number of metres north or east under that transform.
  const north = (m: number) => m / 111_000;
  const east = (m: number) => m / 78_000;
  const P: LatLon[] = [
    { lat: 44.37, lon: 25.98 },
    { lat: 44.37 + north(30), lon: 25.98 },
    { lat: 44.37 + north(30), lon: 25.98 + east(40) },
    { lat: 44.37, lon: 25.98 + east(40) },
    { lat: 44.37, lon: 25.98 + east(52.5) },
  ];
  const build = (pts: LatLon[], aff: AffineWgs84ToStereo70 | null = AFF): RulerPath =>
    pts.reduce((p, pt) => addRulerPoint(p, pt, aff), EMPTY_RULER_PATH);
  const near = (a: number | null, b: number) => expect(Math.abs((a ?? NaN) - b)).toBeLessThan(0.02);
  const RO = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ro-RO.json"), "utf8")).property.map;
  const EN = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "en-GB.json"), "utf8")).property.map;
  const say = (m: Record<string, string>, label: Parameters<typeof rulerLabelMessage>[0]) => {
    const { key, values } = rulerLabelMessage(label);
    return m[key].replace(/\{(\w+)\}/g, (_: string, k: string) => values[k]);
  };

  it("what a click does: start, add, finish on the last point again, ignore on a lone point, clear once ended", () => {
    const at = { x: 100, y: 100 };
    expect(rulerClickKind(EMPTY_RULER_PATH, null, at)).toBe("start");
    const one = build(P.slice(0, 1));
    expect(rulerClickKind(one, { x: 100, y: 100 }, { x: 105, y: 103 })).toBe("ignore");
    expect(rulerClickKind(one, { x: 100, y: 100 }, { x: 300, y: 100 })).toBe("add");
    const two = build(P.slice(0, 2));
    expect(rulerClickKind(two, { x: 100, y: 100 }, { x: 100 + SNAP_PX, y: 100 })).toBe("finish");
    expect(rulerClickKind(two, { x: 100, y: 100 }, { x: 100 + SNAP_PX + 1, y: 100 })).toBe("add");
    expect(rulerClickKind(finishRulerPath(two), { x: 100, y: 100 }, { x: 100, y: 100 })).toBe("clear");
  });

  it("an earlier point clicked again is simply a new point; the zigzag stays open", () => {
    const back = addRulerPoint(build(P.slice(0, 3)), P[0], AFF);
    expect(back.points).toHaveLength(4);
    expect(back.lengths).toHaveLength(3);
    near(back.lengths[2], 50); // the diagonal back to the first point: 30 by 40
  });

  it("three points: two segments and their total", () => {
    const p = build(P.slice(0, 3));
    near(p.lengths[0], 30);
    near(p.lengths[1], 40);
    near(rulerTotalM(p), 70);
  });

  it("five points, ended on the fifth: four segments, each „x din y” with the same total, which is their sum", () => {
    const p = finishRulerPath(build(P));
    expect(p.done).toBe(true);
    expect(p.lengths).toHaveLength(4);
    const labels = rulerSegmentLabels(p);
    expect(labels.map((l) => l.kind)).toEqual(["segmentOfTotal", "segmentOfTotal", "segmentOfTotal", "segmentOfTotal"]);
    expect(labels.map((l) => say(RO, l))).toEqual(["30.00 m din 112.50 m", "40.00 m din 112.50 m", "30.00 m din 112.50 m", "12.50 m din 112.50 m"]);
    expect(say(EN, labels[3])).toBe("12.50 m of 112.50 m");
    // above each segment's midpoint
    expect(labels[0].at).toEqual({ lat: (P[0].lat + P[1].lat) / 2, lon: (P[0].lon + P[1].lon) / 2 });
  });

  it("ended on a corner or on a free point alike — the click kind reads the last point's pixels, not what it was", () => {
    const p = build(P.slice(0, 4));
    expect(rulerClickKind(p, { x: 10, y: 10 }, { x: 18, y: 14 })).toBe("finish");
  });

  it("one segment ended: its length alone — „x din x” says nothing", () => {
    const labels = rulerSegmentLabels(finishRulerPath(build(P.slice(0, 2))));
    expect(labels).toHaveLength(1);
    expect(labels[0].kind).toBe("segment");
    expect(say(RO, labels[0])).toBe("30.00 m");
  });

  it("while drawing: each fixed segment alone, and by the cursor the live one with the total so far, in both languages", () => {
    const p = build(P.slice(0, 3));
    expect(rulerSegmentLabels(p).map((l) => say(RO, l))).toEqual(["30.00 m", "40.00 m"]);
    const live = rulerLiveLabel(p, P[3], AFF)!;
    expect(live.kind).toBe("live");
    expect(say(RO, live)).toBe("+ 30.00 m · total 100.00 m");
    expect(say(EN, live)).toBe("+ 30.00 m · 100.00 m in all");
    // before any segment is fixed, the live one alone, as today
    const first = rulerLiveLabel(build(P.slice(0, 1)), P[1], AFF)!;
    expect(say(RO, first)).toBe("30.00 m");
    // none once ended, before the first point, or with no cursor
    expect(rulerLiveLabel(finishRulerPath(p), P[3], AFF)).toBeNull();
    expect(rulerLiveLabel(EMPTY_RULER_PATH, P[3], AFF)).toBeNull();
    expect(rulerLiveLabel(p, null, AFF)).toBeNull();
  });

  it("a length is kept across a re-fit: the live segment moves with the new fit, a drawn label does not", () => {
    const p = build(P.slice(0, 2));
    // A different fit after a pan: everything 10 % longer.
    const stretched = fitAffine([
      { lat: 44.37, lon: 25.98, north: 0, east: 0 },
      { lat: 44.38, lon: 25.98, north: 1.1 * 111_000 * 0.01, east: 0 },
      { lat: 44.37, lon: 25.99, north: 0, east: 1.1 * 78_000 * 0.01 },
    ]) as AffineWgs84ToStereo70;
    expect(fillPendingLengths(p, stretched)).toBe(p); // nothing pending: the same object, lengths untouched
    near(p.lengths[0], 30);
    const live = rulerLiveLabel(p, P[2], stretched)!;
    expect(say(RO, live)).toBe("+ 44.00 m · total 74.00 m");
  });

  it("a segment fixed before the first fit reads „…” and takes the fit as soon as it arrives", () => {
    const p = build(P.slice(0, 3), null);
    expect(p.lengths).toEqual([null, null]);
    expect(rulerTotalM(p)).toBeNull();
    expect(rulerSegmentLabels(p).map((l) => say(RO, l))).toEqual(["…", "…"]);
    const filled = fillPendingLengths(p, AFF);
    near(filled.lengths[0], 30);
    near(rulerTotalM(filled), 70);
  });

  it("finishing a lone point does nothing", () => {
    const one = build(P.slice(0, 1));
    expect(finishRulerPath(one)).toBe(one);
  });
});
