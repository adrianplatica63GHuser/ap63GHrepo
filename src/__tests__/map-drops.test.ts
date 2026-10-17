/**
 * The big map's drops and numbered drops                          (Slice #39.60)
 *
 * A property is a drop once the larger side of its box is under 24 px on screen; drops closer than the merge
 * distance (a setting, 20–80 px, default 40) merge, repeatedly, into a numbered drop; a numbered drop's click zooms
 * to fit its properties, and at the closest zoom opens their list instead.
 */
import {
  CORNER_DOT_PX,
  DROP_SIZE,
  DROP_SWITCH_PX,
  MERGE_DISTANCE,
  boxCentre,
  boxSidePx,
  clampMergeDistance,
  dropTone,
  isDrop,
  mergeDrops,
  numberedDropAction,
  numberedDropZoom,
  shapeBox,
  unionBox,
  worldPoint,
  worldToLatLon,
  type DropCluster,
  type DropPoint,
} from "@/lib/geo/map-drops";
import { MAX_FOCUS_ZOOM } from "@/lib/geo/map-focus";

// A synthetic lot near Bragadiru, about 64 m × 44 m.
const LOT = [
  { lat: 44.381, lon: 25.991 },
  { lat: 44.381, lon: 25.9918 },
  { lat: 44.3814, lon: 25.9918 },
  { lat: 44.3814, lon: 25.991 },
];
// A field about 1.6 km wide beside it.
const FIELD = [
  { lat: 44.37, lon: 25.97 },
  { lat: 44.37, lon: 25.99 },
  { lat: 44.375, lon: 25.99 },
  { lat: 44.375, lon: 25.97 },
];

describe("the agreed numbers", () => {
  it("24 px switch, 40 px default merge in 20–80, drops of 22 × 30 and 30 × 40, corners of 4 px", () => {
    expect(DROP_SWITCH_PX).toBe(24);
    expect(MERGE_DISTANCE).toEqual({ min: 20, max: 80, step: 5, default: 40 });
    expect(DROP_SIZE).toEqual({ single: { w: 22, h: 30 }, numbered: { w: 30, h: 40 } });
    expect(CORNER_DOT_PX).toBe(4);
  });
});

describe("where a property sits on screen", () => {
  it("worldPoint is Google's: the whole world is 256 px at zoom 0, and doubles per zoom", () => {
    expect(worldPoint(0, 0, 0)).toEqual({ x: 128, y: 128 });
    const a = worldPoint(44.38, 25.99, 10), b = worldPoint(44.38, 25.99, 11);
    expect(b.x / a.x).toBeCloseTo(2, 9);
    expect(b.y / a.y).toBeCloseTo(2, 9);
  });

  it("worldToLatLon undoes worldPoint", () => {
    for (const z of [3, 12.5, 19]) {
      const back = worldToLatLon(worldPoint(44.3814, 25.9918, z), z);
      expect(back.lat).toBeCloseTo(44.3814, 9);
      expect(back.lon).toBeCloseTo(25.9918, 9);
    }
  });

  it("a polygon's box is its corners'; its centre the box's", () => {
    const box = shapeBox(LOT)!;
    expect(box).toEqual({ south: 44.381, west: 25.991, north: 44.3814, east: 25.9918 });
    const c = boxCentre(box);
    expect(c.lat).toBeCloseTo(44.3812, 9);
    expect(c.lon).toBeCloseTo(25.9914, 9);
  });

  it("the union of boxes holds them all", () => {
    expect(unionBox([shapeBox(LOT)!, shapeBox(FIELD)!])).toEqual({ south: 44.37, west: 25.97, north: 44.3814, east: 25.9918 });
    expect(unionBox([])).toBeNull();
  });

  it("below three corners the box is the 25 m circle's, centred on the first corner", () => {
    const box = shapeBox([{ lat: 44.38, lon: 25.99 }, { lat: 44.39, lon: 26 }])!;
    const c = boxCentre(box);
    expect(c.lat).toBeCloseTo(44.38, 9);
    expect(c.lon).toBeCloseTo(25.99, 9);
    // 50 m tall: 50 / 111 320 degrees.
    expect(box.north - box.south).toBeCloseTo(50 / 111_320, 9);
    expect(shapeBox([])).toBeNull();
  });

  it("each property switches on its own size: the field stays a polygon long after the lot is a drop", () => {
    const lot = shapeBox(LOT)!, field = shapeBox(FIELD)!;
    // The lot: ~64 m. At zoom 19 (~0.21 m/px here) it is ~300 px; at zoom 13 under 24.
    expect(isDrop(lot, 19)).toBe(false);
    expect(isDrop(lot, 13)).toBe(true);
    expect(isDrop(field, 13)).toBe(false);
    expect(isDrop(field, 9)).toBe(true);
    // The switch is the larger side, at exactly 24 px.
    const z = Math.log2(24 / boxSidePx(lot, 0));
    expect(isDrop(lot, z + 1e-9)).toBe(false);
    expect(isDrop(lot, z - 1e-6)).toBe(true);
  });
});

describe("the merge distance setting", () => {
  it("unreadable is the default; out of range is clamped; between is put on the 5 px step", () => {
    expect(clampMergeDistance(null)).toBe(40);
    expect(clampMergeDistance("abc")).toBe(40);
    expect(clampMergeDistance("")).toBe(40);
    expect(clampMergeDistance(Number.NaN)).toBe(40);
    expect(clampMergeDistance(5)).toBe(20);
    expect(clampMergeDistance(500)).toBe(80);
    expect(clampMergeDistance("55")).toBe(55);
    expect(clampMergeDistance(43)).toBe(45);
    expect(clampMergeDistance(41)).toBe(40);
  });
});

/** No two drops closer than the distance — what „merge, repeatedly" ends in. */
function closestPair<T>(clusters: DropCluster<T>[]): number {
  let best = Infinity;
  for (let i = 0; i < clusters.length; i++)
    for (let j = i + 1; j < clusters.length; j++)
      best = Math.min(best, Math.hypot(clusters[i].x - clusters[j].x, clusters[i].y - clusters[j].y));
  return best;
}
const pt = (x: number, y: number, item: string): DropPoint<string> => ({ x, y, item });

describe("mergeDrops", () => {
  it("drops 40 px or more apart stay single; closer ones merge into one, at their centre", () => {
    expect(mergeDrops([pt(0, 0, "a"), pt(40, 0, "b")], 40)).toHaveLength(2);
    const [m] = mergeDrops([pt(0, 0, "a"), pt(39, 0, "b")], 40);
    expect(m.items.sort()).toEqual(["a", "b"]);
    expect(m.x).toBeCloseTo(19.5, 9);
    expect(m.y).toBe(0);
  });

  it("merges repeatedly, so counts add up: a chain 30 px apart becomes one numbered drop", () => {
    const chain = Array.from({ length: 6 }, (_, i) => pt(i * 30, 0, `p${i}`));
    const out = mergeDrops(chain, 40);
    expect(out).toHaveLength(1);
    expect(out[0].items).toHaveLength(6);
  });

  it("a merged drop weighs each property once: 3 at one spot and 1 at 39 px stand at a quarter of the way", () => {
    const out = mergeDrops([pt(0, 0, "a"), pt(0, 0, "b"), pt(0, 0, "c"), pt(39, 0, "d")], 40);
    expect(out).toHaveLength(1);
    expect(out[0].x).toBeCloseTo(9.75, 9);
  });

  it("ends with no two drops closer than the distance, on scattered points at every allowed distance", () => {
    // A fixed pseudo-random scatter (a linear congruential generator), so the test is the same on every run.
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const points = Array.from({ length: 400 }, (_, i) => pt(rnd() * 1200, rnd() * 800, `p${i}`));
    for (let d = MERGE_DISTANCE.min; d <= MERGE_DISTANCE.max; d += MERGE_DISTANCE.step) {
      const out = mergeDrops(points, d);
      expect([d, closestPair(out) >= d]).toEqual([d, true]);
      // Every property is in exactly one drop.
      expect(out.reduce((n, c) => n + c.items.length, 0)).toBe(400);
      expect(new Set(out.flatMap((c) => c.items)).size).toBe(400);
    }
  });

  it("a larger distance never leaves more drops", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    const points = Array.from({ length: 300 }, (_, i) => pt(rnd() * 900, rnd() * 600, `p${i}`));
    expect(mergeDrops(points, 80).length).toBeLessThanOrEqual(mergeDrops(points, 40).length);
    expect(mergeDrops(points, 40).length).toBeLessThanOrEqual(mergeDrops(points, 20).length);
  });

  it("is deterministic, whatever order the points come in", () => {
    const points = [pt(0, 0, "a"), pt(25, 5, "b"), pt(100, 0, "c"), pt(120, 10, "d"), pt(300, 300, "e")];
    const norm = (cs: DropCluster<string>[]) => cs.map((c) => [...c.items].sort().join("")).sort();
    expect(norm(mergeDrops(points, 40))).toEqual(norm(mergeDrops([...points].reverse(), 40)));
    expect(norm(mergeDrops(points, 40))).toEqual(["ab", "cd", "e"]);
  });

  it("zooming in reverses it: the same properties, twice as far apart, merge less", () => {
    const at = (z: number) =>
      [LOT, FIELD, [{ lat: 44.3812, lon: 25.993 }]].map((cs, i) => {
        const p = worldPoint(boxCentre(shapeBox(cs)!).lat, boxCentre(shapeBox(cs)!).lon, z);
        return pt(p.x, p.y, `p${i}`);
      });
    expect(mergeDrops(at(10), 40)).toHaveLength(1);
    expect(mergeDrops(at(16), 40)).toHaveLength(3);
  });

  it("a distance of 0 merges nothing", () => {
    expect(mergeDrops([pt(0, 0, "a"), pt(0, 0, "b")], 0)).toHaveLength(2);
  });
});

describe("a drop's colour", () => {
  const sel = new Set(["s"]), dup = new Set(["d1", "d2"]);
  const tone = (ids: string[]) => dropTone(ids, (id) => sel.has(id), (id) => dup.has(id));
  it("selected (red) beats duplicate (pink) beats normal (blue)", () => {
    expect(tone(["x"])).toBe("normal");
    expect(tone(["d1", "d2"])).toBe("duplicate");
    expect(tone(["d1", "s"])).toBe("selected");
    expect(tone(["s"])).toBe("selected");
  });
});

describe("a numbered drop's click", () => {
  it("zooms to fit its properties", () => {
    const boxes = [shapeBox(LOT)!, shapeBox([{ lat: 44.3812, lon: 25.993 }])!];
    const z = numberedDropZoom(boxes, 1366, 800)!;
    expect(z).toBeGreaterThan(14);
    expect(numberedDropAction(13, z)).toBe("zoom");
  });

  it("at the closest zoom, or when fitting would not go closer, it opens the list", () => {
    expect(numberedDropAction(MAX_FOCUS_ZOOM, MAX_FOCUS_ZOOM)).toBe("list");
    expect(numberedDropAction(18, 18)).toBe("list");
    expect(numberedDropAction(18, null)).toBe("list");
    expect(numberedDropZoom([], 100, 100)).toBeNull();
  });

  it("two properties on one spot zoom to the closest, and then list", () => {
    const box = shapeBox(LOT)!;
    expect(numberedDropZoom([box, box], 1366, 800)).toBeLessThanOrEqual(MAX_FOCUS_ZOOM);
    const point = shapeBox([{ lat: 44.38, lon: 25.99 }])!;
    expect(numberedDropAction(MAX_FOCUS_ZOOM, numberedDropZoom([point, point], 1366, 800))).toBe("list");
  });
});
