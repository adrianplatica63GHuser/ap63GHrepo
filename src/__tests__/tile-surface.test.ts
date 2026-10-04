/**
 * Slice #37.78 — the right column's tiles are tinted a light purple, as light
 * as the card's grey, and only they: the registry's `placement.right` decides.
 */
import fs from "node:fs";
import path from "node:path";
import { PINNED_TILE_SURFACE, TILE_SURFACE, tileSurface } from "@/lib/ui/tile-surface";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";

const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** OKLCH lightness of an sRGB hex colour (Björn Ottosson's matrices). */
function lightness(hex: string): number {
  const lin = (c: number) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
}

const CSS = read("src", "app", "globals.css");
const token = (name: string): string => {
  const m = CSS.match(new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`--color-${name} is not in globals.css`);
  return m[1];
};

describe("the right column's tiles are tinted (#37.78)", () => {
  it("a placement.right tile takes the pinned surface, any other tile the card", () => {
    expect(tileSurface(true)).toBe(PINNED_TILE_SURFACE);
    expect(tileSurface(false)).toBe(TILE_SURFACE);
    expect(TILE_SURFACE).toBe("rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900");
    expect(PINNED_TILE_SURFACE.split(" ")).toEqual(expect.arrayContaining(["bg-card-pinned", "border-card-pinned-rim", "dark:bg-card-pinned-dark", "dark:border-card-pinned-rim-dark"]));
    // The same box otherwise: corners, padding, shadow.
    expect(PINNED_TILE_SURFACE.replace(/card-pinned(-rim)?(-dark)?/g, "x")).toBe(TILE_SURFACE.replace(/card-rim|card\b|zinc-800|zinc-900/g, "x"));
  });

  it("each purple is as light as the grey beside it (OKLCH L within 0.002)", () => {
    expect(Math.abs(lightness(token("card-pinned")) - lightness(token("card")))).toBeLessThan(0.002);
    expect(Math.abs(lightness(token("card-pinned-rim")) - lightness(token("card-rim")))).toBeLessThan(0.002);
    expect(Math.abs(lightness(token("card-pinned-dark")) - lightness("#18181B"))).toBeLessThan(0.002); // zinc-900
    expect(Math.abs(lightness(token("card-pinned-rim-dark")) - lightness("#27272A"))).toBeLessThan(0.002); // zinc-800
  });

  it("the Property draws its three right tiles from the registry, its other tiles as cards", () => {
    expect(PROP_TILE_REGISTRY.placement?.right).toEqual(["map", "corners", "streetView"]);
    const src = code(read("src", "app", "properties", "_components", "property-form.tsx"));
    expect(src).toMatch(/const surface = \(tile: PropTile\): string => tileSurface\(!!tiles\?\.right\?\.has\(tile\)\)/);
    for (const [panel, tile] of [["map", "map"], ["corners", "corners"], ["street-view", "streetView"]]) {
      const at = src.indexOf(`data-panel="${panel}"`);
      expect(at).toBeGreaterThan(0);
      expect(src.slice(at, at + 200)).toContain(`surface("${tile}")`);
    }
    for (const panel of ["cadastral", "address"]) {
      const at = src.indexOf(`data-panel="${panel}"`);
      expect(src.slice(at, at + 200)).toContain("bg-card p-3");
    }
  });

  it("the Document's „Pagini” takes the surface its place in the column gives it", () => {
    const form = code(read("src", "app", "documents", "_components", "document-form.tsx"));
    expect(form).toContain('surface={tileSurface(!!tiles?.right?.has("pages"))}');
    const panel = code(read("src", "app", "documents", "_components", "pages-panel.tsx"));
    expect(panel).toContain("surface = TILE_SURFACE,");
    expect(panel).toMatch(/className=\{\[\s*surface,/);
  });
});
