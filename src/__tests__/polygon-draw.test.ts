/**
 * Slice #39.08 — the drawing's rules, shared by the new property's mini-map and the map's „Suprafața unei zone
 * oarecare" (`@/lib/geo/polygon-draw`), and the two area tools exclusive of each other.
 */
import fs from "fs";
import path from "path";

import { nextAreaMode } from "@/lib/geo/area-tool";
import { appendCorner, cornerClick, moveCorner, previewLine } from "@/lib/geo/polygon-draw";

const A = { lat: 44.381, lon: 25.991 };
const B = { lat: 44.381, lon: 25.9918 };
const C = { lat: 44.3814, lon: 25.9918 };

describe("appendCorner — a click on the map while drawing", () => {
  it("adds the clicked point at the end, as {lat, lon}", () => {
    expect(appendCorner([A], { lat: 1, lng: 2 })).toEqual([A, { lat: 1, lon: 2 }]);
    expect(appendCorner([], { lat: 1, lng: 2 })).toEqual([{ lat: 1, lon: 2 }]);
  });
  it("never changes the list it was given", () => {
    const list = [A];
    appendCorner(list, { lat: 1, lng: 2 });
    expect(list).toEqual([A]);
  });
});

describe("moveCorner — a corner dragged", () => {
  it("moves that corner only, the others the same objects", () => {
    const list = [A, B, C];
    const next = moveCorner(list, 1, { lat: 5, lng: 6 });
    expect(next).toEqual([A, { lat: 5, lon: 6 }, C]);
    expect(next[0]).toBe(A);
    expect(next[2]).toBe(C);
  });
});

describe("cornerClick — a click on a corner while drawing", () => {
  it.each([
    [0, 3, "close"],
    [0, 5, "close"],
    [0, 2, "absorb"],
    [0, 1, "absorb"],
    [1, 3, "absorb"],
    [2, 3, "absorb"],
  ] as const)("corner %i of %i → %s", (idx, count, want) => {
    expect(cornerClick(idx, count)).toBe(want);
  });
});

describe("previewLine — last corner to the cursor", () => {
  it("only while drawing, with a corner and a cursor", () => {
    expect(previewLine(true, [A, B], { lat: 1, lng: 2 })).toEqual([{ lat: B.lat, lng: B.lon }, { lat: 1, lng: 2 }]);
    expect(previewLine(false, [A, B], { lat: 1, lng: 2 })).toBeNull();
    expect(previewLine(true, [], { lat: 1, lng: 2 })).toBeNull();
    expect(previewLine(true, [A], null)).toBeNull();
  });
});

describe("the two area tools are exclusive", () => {
  it("pressing one releases the other; pressing it again releases it", () => {
    expect(nextAreaMode(null, "free")).toBe("free");
    expect(nextAreaMode("delimited", "free")).toBe("free");
    expect(nextAreaMode("free", "delimited")).toBe("delimited");
    expect(nextAreaMode("free", "free")).toBeNull();
  });
});

describe("one drawing, two maps", () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), "utf8");
  it.each([
    ["src/app/properties/_components/property-mini-map-inner.tsx"],
    ["src/app/properties/map/property-map.tsx"],
  ])("%s draws through usePolygonDraw", (file) => {
    expect(read(file)).toMatch(/usePolygonDraw\(/);
  });
  it("the mini-map keeps no drawing state of its own", () => {
    const src = read("src/app/properties/_components/property-mini-map-inner.tsx");
    expect(src).not.toMatch(/const \[drawing,/);
    expect(src).not.toMatch(/setHoverLatLng/);
  });
});
