/**
 * Slice #37.78 — the right column's tiles are tinted a light purple, as light
 * as the card's grey, and only they: the registry's `placement.right` decides.
 */
import fs from "node:fs";
import path from "node:path";
import {
  FAMILY_TILE_SURFACE, META_TILE_SURFACE, PINNED_TILE_SURFACE, RELATED_ROWS_SURFACE, RELATED_TILE_SURFACE, TILE_SURFACE,
  groupColours, groupStrip, groupSurface, tileHue, tileScreenOf, tileSurface,
} from "@/lib/ui/tile-surface";
import { PROP_TILE_REGISTRY } from "@/app/properties/_components/property-tiles";
import { NP_TILE_REGISTRY } from "@/app/natural-persons/_components/person-tiles";
import { JP_TILE_REGISTRY } from "@/app/judicial-persons/_components/person-tiles";
import { tileGroupOf } from "@/lib/ui/tiles";

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
    // 41.68: in the property's hue for the right-hand tiles (it read `tileSurface(!!tiles?.right?.has(tile))`).
    expect(src).toMatch(/const surface = \(tile: PropTile\): string => tileSurface\(!!tiles\?\.right\?\.has\(tile\), "property"\)/);
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
    // 41.68: in the document's hue (it read `surface={tileSurface(!!tiles?.right?.has("pages"))}`).
    expect(form).toContain('surface={tileSurface(!!tiles?.right?.has("pages"), "document")}');
    expect(form).toContain('surface={tileSurface(true, "document")}');
    const panel = code(read("src", "app", "documents", "_components", "pages-panel.tsx"));
    expect(panel).toContain("surface = TILE_SURFACE,");
    expect(panel).toMatch(/className=\{\[\s*surface,/);
  });
});

describe("the four groups' colours (#37.88)", () => {
  it("each group has its surface, the same box otherwise", () => {
    expect(groupSurface("record")).toBe(TILE_SURFACE);
    expect(groupSurface("related")).toBe(RELATED_TILE_SURFACE);
    expect(groupSurface("meta")).toBe(META_TILE_SURFACE);
    expect(groupSurface("fixed")).toBe(PINNED_TILE_SURFACE);
    for (const [surface, name] of [[RELATED_TILE_SURFACE, "related"], [META_TILE_SURFACE, "meta"]] as const) {
      expect(surface.replace(new RegExp(`card-${name}(-rim)?(-dark)?`, "g"), "x")).toBe(PINNED_TILE_SURFACE.replace(/card-pinned(-rim)?(-dark)?/g, "x"));
      expect(groupStrip(name)).toContain(`bg-card-${name}`);
    }
  });

  it("the fills share one lightness, and the rims another, in light and dark (OKLCH L within 0.002) — all but „Corelate” since #38.15", () => {
    for (const name of ["card-pinned", "card-meta"]) {
      expect(Math.abs(lightness(token(name)) - lightness(token("card")))).toBeLessThan(0.002);
      expect(Math.abs(lightness(token(`${name}-rim`)) - lightness(token("card-rim")))).toBeLessThan(0.002);
      expect(Math.abs(lightness(token(`${name}-dark`)) - lightness("#18181B"))).toBeLessThan(0.002);
      expect(Math.abs(lightness(token(`${name}-rim-dark`)) - lightness("#27272A"))).toBeLessThan(0.002);
    }
  });

  it("every detail screen colours its list tiles and its bar from the registry's groups", () => {
    for (const file of [
      ["properties", "_components", "property-detail-tiles.tsx"],
      ["natural-persons", "_components", "person-detail-tiles.tsx"],
      ["judicial-persons", "_components", "person-detail-tiles.tsx"],
      ["documents", "_components", "document-detail-tiles.tsx"],
    ]) {
      const src = code(read("src", "app", ...file));
      for (const tile of ["related", "classification", "connections"]) {
        expect(src).toMatch(new RegExp(`<ListTile tile="${tile}"[^>]*surface=\\{groupSurface\\(tileGroupOf\\(`));
      }
      expect(src).toMatch(/<TileSelector [^>]*groups=\{groupedTiles\(/);
    }
  });
});

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

describe("„Corelate” a stronger green, its rows a lighter one (#38.15)", () => {
  // #37.88's green, which the rows must be lighter than.
  const OLD_FILL = "#EBF7ED";
  const OLD_DARK = "#0F1C11";

  it("the tile one step stronger than #37.88's green; its rim as far below it as the card's rim is below the card", () => {
    expect(token("card-related")).toBe("#DDF0E1");
    expect(lightness(token("card-related"))).toBeLessThan(lightness(OLD_FILL) - 0.02);
    const cardStep = lightness(token("card")) - lightness(token("card-rim"));
    expect(Math.abs(lightness(token("card-related")) - lightness(token("card-related-rim")) - cardStep)).toBeLessThan(0.003);
  });

  it("dark keeps the relation: the tile a step further from zinc-900, its rows nearer it", () => {
    expect(lightness(token("card-related-dark"))).toBeGreaterThan(lightness(OLD_DARK) + 0.015);
    expect(lightness(token("card-related-row-dark"))).toBeLessThan(lightness(OLD_DARK));
    expect(lightness(token("card-related-rim-dark"))).toBeGreaterThan(lightness(token("card-related-dark")));
  });

  it("the rows' green is lighter than the tile's old colour, in light mode", () => {
    expect(token("card-related-row")).toBe("#F4FBF5");
    expect(lightness(token("card-related-row"))).toBeGreaterThan(lightness(OLD_FILL) + 0.01);
  });

  it("text keeps at least 4.5:1 on the tile and on the rows, light and dark", () => {
    for (const bg of [token("card-related"), token("card-related-row"), token("card-row")]) {
      for (const fg of [token("ink"), token("fade")]) expect({ fg, bg, ok: contrast(fg, bg) >= 4.5 }).toEqual({ fg, bg, ok: true });
    }
    for (const bg of [token("card-related-dark"), token("card-related-row-dark"), token("card-row-dark")]) {
      for (const fg of ["#D4D4D8", "#A1A1AA"]) expect({ fg, bg, ok: contrast(fg, bg) >= 4.5 }).toEqual({ fg, bg, ok: true }); // zinc-300, zinc-400
    }
  });

  it("the rows' container takes the rows' token; the tile, its strip and a preview keep sharing the tile's", () => {
    // 41.68: „Legături" wears the card, its rows a lighter row of it (it read `bg-card-related-row`,
    // `dark:bg-card-related-row-dark`, `border-card-related-rim`).
    expect(RELATED_ROWS_SURFACE.split(" ")).toEqual(expect.arrayContaining(["bg-card-row", "dark:bg-card-row-dark", "border-card-rim"]));
    const tile = code(read("src", "components", "tiles", "related-tile.tsx"));
    expect(tile).toMatch(/data-related-rows=""\s*className=\{RELATED_ROWS_SURFACE\}/);
    expect(tile).not.toMatch(/data-related-rows=""\s*className="[^"]*bg-card\b/);
    expect(groupStrip("related")).toContain("bg-card-related "); // with no screen named, the old green
    expect(groupStrip("related", false, "property")).toContain("bg-card ");
    // 41.68: a preview is the card itself (it read `toContain("bg-card-related p-3")`).
    expect(code(read("src", "components", "tiles", "preview-tile-body.tsx"))).toContain("border-dashed border-card-rim bg-card p-3");
  });
});

describe("41.68 — the tiles' colours switched round to follow the kinds", () => {
  const SAVED_DOCUMENT_ENTITY = "document-ADEVERINTA";

  it("the four screens' entities name their screen; others none", () => {
    expect([PROP_TILE_REGISTRY.entity, NP_TILE_REGISTRY.entity, JP_TILE_REGISTRY.entity].map(tileScreenOf)).toEqual(["property", "natural-person", "judicial-person"]);
    expect(tileScreenOf(SAVED_DOCUMENT_ENTITY)).toBe("document");
    expect(tileScreenOf("document-untyped")).toBe("document");
    for (const e of [undefined, "home", "settings", "admin-group", "tarla"]) expect(tileScreenOf(e)).toBeUndefined();
  });

  it.each([
    // [screen entity, tile's group, hue, surface] — Adrian's list, per tile
    ["property", tileGroupOf(PROP_TILE_REGISTRY, "related"), "card", TILE_SURFACE],
    ["property", tileGroupOf(PROP_TILE_REGISTRY, "map"), "green", RELATED_TILE_SURFACE],
    ["property", tileGroupOf(PROP_TILE_REGISTRY, "corners"), "green", RELATED_TILE_SURFACE],
    ["property", tileGroupOf(PROP_TILE_REGISTRY, "streetView"), "green", RELATED_TILE_SURFACE],
    ["property", tileGroupOf(PROP_TILE_REGISTRY, "classification"), "yellow", META_TILE_SURFACE],
    ["natural-person", tileGroupOf(NP_TILE_REGISTRY, "related"), "card", TILE_SURFACE],
    ["natural-person", tileGroupOf(NP_TILE_REGISTRY, "interactions"), "purple", PINNED_TILE_SURFACE],
    ["natural-person", tileGroupOf(NP_TILE_REGISTRY, "inheritanceTree"), "purple", PINNED_TILE_SURFACE],
    ["natural-person", tileGroupOf(NP_TILE_REGISTRY, "connections"), "yellow", META_TILE_SURFACE],
    ["judicial-person", tileGroupOf(JP_TILE_REGISTRY, "related"), "card", TILE_SURFACE],
    ["judicial-person", tileGroupOf(JP_TILE_REGISTRY, "interactions"), "purple", PINNED_TILE_SURFACE],
    [SAVED_DOCUMENT_ENTITY, "related", "card", TILE_SURFACE],
    [SAVED_DOCUMENT_ENTITY, "fixed", "blue", FAMILY_TILE_SURFACE],
    [SAVED_DOCUMENT_ENTITY, "meta", "yellow", META_TILE_SURFACE],
  ] as const)("%s, group %s → %s", (entity, group, hue, surface) => {
    expect(tileHue(group, entity)).toBe(hue);
    expect(groupSurface(group, entity)).toBe(surface);
    // The strip on the bar and the rectangle in „Panouri" wear the same hue as the tile.
    const fill = surface.split(" ").find((c) => c.startsWith("bg-"))!;
    expect(groupColours(group, entity).split(" ")).toContain(fill);
    expect(groupStrip(group, true, entity)).toContain(groupColours(group, entity));
  });

  it("a document's „Pagini” and a property's right tiles from tileSurface, with the screen named", () => {
    expect(tileSurface(true, "document")).toBe(FAMILY_TILE_SURFACE);
    expect(tileSurface(true, "property")).toBe(RELATED_TILE_SURFACE);
    expect(tileSurface(false, "property")).toBe(TILE_SURFACE);
  });

  it("with no screen named (the dashboard, Setări), a group keeps its old hue", () => {
    expect(["record", "related", "meta", "family", "fixed"].map((g) => tileHue(g as never))).toEqual(["card", "green", "yellow", "blue", "purple"]);
  });

  it("every record screen names its entity: its tiles, its bar's strips and its diagram", () => {
    for (const [file, reg] of [
      [["properties", "_components", "property-detail-tiles.tsx"], "PROP_TILE_REGISTRY"],
      [["natural-persons", "_components", "person-detail-tiles.tsx"], "NP_TILE_REGISTRY"],
      [["judicial-persons", "_components", "person-detail-tiles.tsx"], "JP_TILE_REGISTRY"],
      [["documents", "_components", "document-detail-tiles.tsx"], "reg"],
    ] as const) {
      const src = code(read("src", "app", ...file));
      const calls = [...src.matchAll(/groupSurface\(tileGroupOf\((\w+), "\w+"\)(, [\w.]+)?\)/g)];
      expect(calls.length).toBeGreaterThan(0);
      expect(src.match(/groupSurface\(/g)).toHaveLength(calls.length);
      for (const c of calls) expect([file.join("/"), c[0], c[2]]).toEqual([file.join("/"), c[0], `, ${reg}.entity`]);
      expect(src).toMatch(new RegExp(`<TileSelector [^>]*diagram=\\{${reg}\\.entity\\}`));
    }
    const bar = code(read("src", "components", "tiles", "tile-selector.tsx"));
    expect(bar.match(/groupStrip\(/g)).toHaveLength(2);
    expect(bar.match(/groupStrip\([^)]*, diagram\)/g)).toHaveLength(2);
    expect(code(read("src", "components", "tiles", "tiles-diagram.tsx"))).toContain("groupColours(r.group, entity)");
  });
});
