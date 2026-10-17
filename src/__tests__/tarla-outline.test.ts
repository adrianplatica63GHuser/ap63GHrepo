/**
 * A tarla's outline: its drawn corners, else the convex hull of its properties' corners.          (Slice #39.68)
 */
import { closedRing, convexHull, labelAt, tarlaOutline, tarlaOutlines } from "@/lib/geo/tarla-outline";

const P = (lat: number, lon: number) => ({ lat, lon });

describe("convexHull", () => {
  it("is the square around a square and a point inside it, counter-clockwise, the inner point dropped", () => {
    const hull = convexHull([P(0, 0), P(0, 2), P(2, 2), P(2, 0), P(1, 1)]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual(P(1, 1));
    // counter-clockwise in (lon, lat): the signed area is positive
    const area = hull.reduce((a, p, i) => {
      const q = hull[(i + 1) % hull.length];
      return a + (p.lon * q.lat - q.lon * p.lat);
    }, 0);
    expect(area).toBeGreaterThan(0);
  });

  it("drops a point on an edge, and duplicates", () => {
    const hull = convexHull([P(0, 0), P(0, 1), P(0, 2), P(2, 2), P(2, 0), P(0, 0), P(2, 2)]);
    expect(hull).toHaveLength(4);
    expect(hull).not.toContainEqual(P(0, 1));
  });

  it("joins two plots into one shape around both", () => {
    const a = [P(44.37, 25.97), P(44.371, 25.97), P(44.371, 25.971), P(44.37, 25.971)];
    const b = [P(44.372, 25.973), P(44.373, 25.973), P(44.373, 25.974), P(44.372, 25.974)];
    const hull = convexHull([...a, ...b]);
    expect(hull).toEqual(expect.arrayContaining([P(44.37, 25.97), P(44.373, 25.974)]));
    expect(hull.length).toBeGreaterThanOrEqual(4);
    expect(hull.length).toBeLessThanOrEqual(6);
  });

  it("returns fewer than three points as they are, and ignores what is not a number", () => {
    expect(convexHull([])).toEqual([]);
    expect(convexHull([P(1, 1), P(1, 1)])).toEqual([P(1, 1)]);
    expect(convexHull([P(1, 1), P(Number.NaN, 2), P(2, 2)])).toEqual([P(1, 1), P(2, 2)]);
  });
});

describe("tarlaOutline", () => {
  const plots = [[P(0, 0), P(0, 1), P(1, 1)], [P(2, 2), P(2, 3), P(3, 3)]];

  it("takes the drawn corners when there are three or more", () => {
    const own = [P(5, 5), P(5, 6), P(6, 6)];
    expect(tarlaOutline(own, plots)).toEqual({ kind: "drawn", path: own });
  });

  it("else the hull of the properties' corners", () => {
    const o = tarlaOutline([P(5, 5)], plots);
    expect(o.kind).toBe("hull");
    expect(o.path).toEqual(convexHull(plots.flat()));
  });

  it("and nothing when neither gives three points", () => {
    expect(tarlaOutline([], [[P(1, 1)]])).toEqual({ kind: "none", path: [] });
  });

  it("groups properties by tarla, and leaves out a tarla with no outline", () => {
    const out = tarlaOutlines(
      [
        { id: "t1", corners: [] },
        { id: "t2", corners: [] },
      ],
      [
        { tarlaId: "t1", corners: plots[0] },
        { tarlaId: "t1", corners: plots[1] },
        { tarlaId: null, corners: [P(9, 9), P(9, 8), P(8, 8)] },
        { tarlaId: "t2", corners: [] },
      ],
    );
    expect(out.map((o) => [o.tarla.id, o.outline.kind])).toEqual([["t1", "hull"]]);
  });
});

describe("the ring and the label", () => {
  it("closes the ring, and writes the label at the northernmost point", () => {
    const path = [P(0, 0), P(2, 1), P(1, 2)];
    expect(closedRing(path)).toEqual([...path, P(0, 0)]);
    expect(closedRing([])).toEqual([]);
    expect(labelAt(path)).toEqual(P(2, 1));
    expect(labelAt([])).toBeNull();
  });
});
