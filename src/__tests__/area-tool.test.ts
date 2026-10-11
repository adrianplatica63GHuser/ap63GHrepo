/**
 * Slices #39.07/#39.08 — the map's area tools: what they share (`@/lib/geo/area-tool`). The browser half is TC-MAP-02.
 */
import {
  AREA_FILL,
  AREA_INK,
  LABEL_MAX_PX,
  LABEL_MIN_PX,
  addCorner,
  contrastRatio,
  formatAreaRo,
  labelFontPx,
  labelPoint,
  metresBox,
  nextAreaMode,
  pixelsPerMetre,
  pixelBox,
  readArea,
  removeLastCorner,
} from "@/lib/geo/area-tool";
import type { AffineWgs84ToStereo70 } from "@/lib/geo/ruler";

/** A transform where one degree of longitude is 1000 m east and one of latitude 1000 m north — easy arithmetic. */
const KM: AffineWgs84ToStereo70 = { refLat: 0, refLon: 0, an: 0, bn: 1000, cn: 0, ae: 1000, be: 0, ce: 0 };
const sq = (s: number) => [
  { lat: 0, lon: 0 },
  { lat: 0, lon: s },
  { lat: s, lon: s },
  { lat: s, lon: 0 },
];

describe("the area, through Stereo 70", () => {
  it("a square 100 m a side is 10.000 m²", () => {
    expect(readArea(KM, sq(0.1))).toEqual({ kind: "area", m2: expect.closeTo(10_000, 6) });
  });

  it("is the same whichever way round the corners go", () => {
    const a = readArea(KM, sq(0.1));
    const b = readArea(KM, [...sq(0.1)].reverse());
    expect(a).toEqual(b);
  });

  it("under three corners there is none", () => {
    expect(readArea(KM, sq(0.1).slice(0, 2))).toEqual({ kind: "none" });
    expect(readArea(KM, [])).toEqual({ kind: "none" });
  });

  it("an order whose sides cross is marked, never a meaningless number", () => {
    const bowtie = [sq(0.1)[0]!, sq(0.1)[2]!, sq(0.1)[1]!, sq(0.1)[3]!];
    expect(readArea(KM, bowtie)).toEqual({ kind: "crossing" });
  });
});

describe("its words, in Romanian (Ask first 2)", () => {
  it.each([
    [12_345, "12.345 m² (1,2345 ha)"],
    [10_000, "10.000 m² (1,0000 ha)"],
    [999.6, "1.000 m² (0,1000 ha)"],
    [523.4, "523 m² (0,0523 ha)"],
    [1_234_567, "1.234.567 m² (123,4567 ha)"],
    [0, "0 m² (0,0000 ha)"],
  ] as const)("%s m² reads „%s”", (m2, text) => {
    expect(formatAreaRo(m2)).toBe(text);
  });
});

describe("the label (Ask first 1)", () => {
  it("is 10 % of the smaller side of the polygon's box on screen, between 11 and 48 px", () => {
    expect(labelFontPx({ width: 300, height: 200 })).toBe(20);
    expect(labelFontPx({ width: 40, height: 900 })).toBe(LABEL_MIN_PX);
    expect(labelFontPx({ width: 2000, height: 1500 })).toBe(LABEL_MAX_PX);
    expect(labelFontPx({ width: Number.NaN, height: 10 })).toBe(LABEL_MIN_PX);
  });

  it("the box of the corners on screen", () => {
    expect(pixelBox([{ x: 10, y: 50 }, { x: 110, y: 20 }, { x: 60, y: 90 }])).toEqual({ width: 100, height: 70 });
    expect(pixelBox([])).toEqual({ width: 0, height: 0 });
  });

  it("stands at the polygon's centroid", () => {
    const c = labelPoint(sq(0.1))!;
    expect(c.lat).toBeCloseTo(0.05, 9);
    expect(c.lon).toBeCloseTo(0.05, 9);
    expect(labelPoint([])).toBeNull();
    // Collinear: the vertices' mean.
    expect(labelPoint([{ lat: 0, lon: 0 }, { lat: 0, lon: 2 }])).toEqual({ lat: 0, lon: 1 });
  });

  it("its ink keeps 4.5 : 1 against the mauve", () => {
    expect(contrastRatio(AREA_INK, AREA_FILL)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });
});

describe("the corners and the two modes", () => {
  it("a corner joins the list; the same corner again (a double click) does not", () => {
    const a = addCorner([], { lat: 1, lon: 1 });
    expect(a).toEqual([{ lat: 1, lon: 1 }]);
    expect(addCorner(a, { lat: 1, lon: 1 })).toBe(a);
    expect(addCorner(a, { lat: 2, lon: 1 })).toHaveLength(2);
  });

  it("Backspace removes the last corner (Ask first 3)", () => {
    expect(removeLastCorner([{ lat: 1, lon: 1 }, { lat: 2, lon: 2 }])).toEqual([{ lat: 1, lon: 1 }]);
    expect(removeLastCorner([])).toEqual([]);
  });

  it("a button pressed turns its tool on, releasing the other; pressed again, none", () => {
    expect(nextAreaMode(null, "delimited")).toBe("delimited");
    expect(nextAreaMode("delimited", "delimited")).toBeNull();
    expect(nextAreaMode("delimited", "free")).toBe("free");
    expect(nextAreaMode("free", "delimited")).toBe("delimited");
  });
});

describe("the label's size from the ground (recomputed on zoom)", () => {
  it("the polygon's extent in metres", () => {
    expect(metresBox(KM, sq(0.1))).toEqual({ width: expect.closeTo(100, 9), height: expect.closeTo(100, 9) });
  });

  it("pixels per metre double with each zoom step; at the equator zoom 0 is 256 px for the whole Earth", () => {
    expect(pixelsPerMetre(0, 0) * 40_075_016.686).toBeCloseTo(256, 6);
    expect(pixelsPerMetre(18, 44) / pixelsPerMetre(17, 44)).toBeCloseTo(2, 9);
  });
});
