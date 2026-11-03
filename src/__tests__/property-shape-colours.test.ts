/**
 * Slice 41.69 — properties drawn green on the maps; the drops green with champagne.
 *
 * Adrian, 2026-11-03: „the blue hues used for borders and for the area of the property will be replaced with a similar
 * shade of green (darker for sides, lighter for the inside) […] The bubbles […] will change their color from current
 * blue to the shade of green that is now used for the sides of the property; and the white that is used for the contour
 * of the bubbles and for showing the count […] will be replaced with a hue of Champagne".
 *
 * One colour source (property-shapes.tsx), read by the big map, the „Hartă" tile and „Hartă extinsă".
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { DROP_INK, SHAPE_COLOR, SHAPE_FILL } from "@/components/maps/property-shapes";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** WCAG contrast of two sRGB hex colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, bl] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => p - q);
  return (y + 0.05) / (x + 0.05);
}

describe("the property's colours on the maps (41.69)", () => {
  it("sides, corner dots and drops green-700, the inside green-500; red and pink unchanged", () => {
    expect(SHAPE_COLOR).toEqual({ selected: "#ef4444", duplicate: "#ec4899", normal: "#15803D" });
    expect(SHAPE_FILL).toEqual({ selected: "#ef4444", duplicate: "#ec4899", normal: "#22C55E" });
  });

  it("a normal drop's outline and count champagne, readable on the green; red and pink keep white", () => {
    expect(DROP_INK).toEqual({ selected: "#fff", duplicate: "#fff", normal: "#F7E7CE" });
    expect(contrast(DROP_INK.normal, SHAPE_COLOR.normal)).toBeGreaterThan(4);
    // …and better than the white it replaces on the blue it replaces (3.7:1).
    expect(contrast(DROP_INK.normal, SHAPE_COLOR.normal)).toBeGreaterThan(contrast("#FFFFFF", "#3B82F6"));
  });

  it("the drop draws its fill, outline and count from the three", () => {
    const src = code(read("src", "components", "maps", "property-shapes.tsx"));
    expect(src).toContain("fill={SHAPE_COLOR[drop.tone]}");
    expect(src).toContain("stroke={DROP_INK[drop.tone]}");
    expect(src).toContain("color:         DROP_INK[drop.tone],");
    expect(src).not.toMatch(/stroke="#fff"|color:\s+"#fff"/);
  });

  it("the big map, the tile and „Hartă extinsă” read SHAPE_COLOR and SHAPE_FILL — no colour of their own", () => {
    const big = code(read("src", "app", "properties", "map", "property-map.tsx"));
    expect(big).toContain("const strokeColor = SHAPE_COLOR[shapeTone];");
    expect(big).toContain("const fillColor = SHAPE_FILL[shapeTone];");
    expect(big).not.toMatch(/"#ef4444" :|"#ec4899" :/);
    const tile = code(read("src", "app", "properties", "_components", "property-mini-map-inner.tsx"));
    expect(tile).toContain("const shapeFill = SHAPE_FILL[tone];");
    expect(tile).toMatch(/fillColor=\{shapeFill\}/);
    const theater = code(read("src", "app", "properties", "_components", "theater-others-layer.tsx"));
    expect(theater).toContain("const fill = SHAPE_FILL.normal;");
    expect(theater.match(/fillColor=\{fill\}/g)).toHaveLength(2);
  });

  it("no hard-coded #3b82f6 is left under src/app/properties", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? walk(join(dir, n)) : [join(dir, n)]));
    const files = walk(join(process.cwd(), "src", "app", "properties")).filter((f) => /\.tsx?$/.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const f of files) expect([f, /#3b82f6/i.test(code(readFileSync(f, "utf8")))]).toEqual([f, false]);
  });
});
