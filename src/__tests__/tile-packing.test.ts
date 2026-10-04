/**
 * Each tile right under the tile above it; a preview right under its tile.
 *                                                              (Slice #37.75)
 *
 * The fixtures are Adrian's two cases, with the boxes' widths in units and
 * their heights in px as measured on #37.75's synthetic records (the runner's
 * picture run, `screens\before\before-boxes.json`): a Natural Person with
 * every tile and twelve related documents; a company with „Corelate" holding
 * a document, „Clasificare subiectivă" beside it and a document's preview
 * open. 1366 px gives the row 6 units, 1920 px 10. The browser half — the
 * hook measuring and drawing on the four screens — is TC-TILES-12.
 */
import fs from "node:fs";
import path from "node:path";

import { columnsIn, freeUnder, grow, overlaps, packTiles, packedHeight, topUnder, unitsOf, type PackBox, type Placed } from "@/lib/ui/tile-packing";

const GAP = 16;
const UNIT = 148; // 9.25rem
const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PERSON: PackBox[] = [
  { id: "identity", units: 3, height: 354 },
  { id: "idCard", units: 3, height: 382 },
  { id: "contact", units: 2, height: 348 },
  { id: "addresses#0", units: 3, height: 326 }, // Adresă domiciliu
  { id: "addresses#1", units: 3, height: 294 }, // Adresă corespondență
  { id: "related", units: 4, height: 521 },
  { id: "classification", units: 3, height: 280 },
  { id: "connections", units: 3, height: 364 },
  { id: "actions", units: 1, height: 63, rowEnd: true },
];

const COMPANY: PackBox[] = [
  { id: "identity", units: 3, height: 290 },
  { id: "contactPersons", units: 2, height: 234 },
  { id: "addresses#0", units: 3, height: 326 }, // Sediu social
  { id: "addresses#1", units: 3, height: 294 },
  { id: "related", units: 4, height: 136 },
  { id: "classification", units: 3, height: 280 },
  { id: "preview:document:1", units: 4, height: 152, anchor: "related" },
  { id: "actions", units: 1, height: 63, rowEnd: true },
];

const at = (placed: readonly Placed[], id: string): Placed => {
  const p = placed.find((x) => x.id === id);
  if (!p) throw new Error(`${id} not placed`);
  return p;
};
const bottom = (p: Placed): number => p.top + p.height;

function expectNoOverlap(placed: readonly Placed[], columns: number): void {
  for (const p of placed) {
    expect(p.col).toBeGreaterThanOrEqual(0);
    expect(p.col + p.units).toBeLessThanOrEqual(columns);
  }
  for (const [i, a] of placed.entries()) {
    for (const b of placed.slice(i + 1)) {
      expect({ pair: [a.id, b.id], overlaps: overlaps(a, b, GAP) }).toEqual({ pair: [a.id, b.id], overlaps: false });
    }
  }
}

describe("Adrian's Natural Person — „Clasificare subiectivă” under the address boxes", () => {
  it("at 1920 px: under the two addresses, not under „Corelate”", () => {
    const placed = packTiles(PERSON, 10, GAP);
    expectNoOverlap(placed, 10);
    // The first line as before: Identitate, Carte de identitate, Contact.
    expect(["identity", "idCard", "contact"].map((id) => at(placed, id).col)).toEqual([0, 3, 6]);
    // The second line: the two addresses and „Corelate", each right under the box above it.
    expect(at(placed, "addresses#0")).toMatchObject({ col: 0, top: bottom(at(placed, "identity")) + GAP });
    expect(at(placed, "addresses#1")).toMatchObject({ col: 3, top: bottom(at(placed, "idCard")) + GAP });
    expect(at(placed, "related")).toMatchObject({ col: 6, top: bottom(at(placed, "contact")) + GAP });
    // Adrian's bug: they waited under „Corelate" (398 + 521 + 16 = 935 px).
    expect(at(placed, "classification")).toMatchObject({ col: 0, top: bottom(at(placed, "addresses#0")) + GAP });
    expect(at(placed, "connections")).toMatchObject({ col: 3, top: bottom(at(placed, "addresses#1")) + GAP });
    expect(at(placed, "classification").top).toBeLessThan(bottom(at(placed, "related")));
    // The action bar under everything, the row's whole width.
    const actions = at(placed, "actions");
    expect(actions).toMatchObject({ col: 0, units: 10, rowEnd: true });
    expect(actions.top).toBe(Math.max(...placed.filter((p) => !p.rowEnd).map(bottom)) + GAP);
    expect(packedHeight(placed)).toBe(bottom(actions));
  });

  it("at 1366 px: every box right under the boxes above it, none overlapping, none past the row", () => {
    const placed = packTiles(PERSON, 6, GAP);
    expectNoOverlap(placed, 6);
    for (const p of placed.filter((x) => !x.rowEnd)) {
      const above = placed.filter((q) => q !== p && q.top < p.top);
      expect({ id: p.id, top: p.top }).toEqual({ id: p.id, top: topUnder(above, p.col, p.units, GAP) });
    }
  });
});

describe("Adrian's company — the preview under „Corelate”", () => {
  it("at 1920 px: right under „Corelate”, in its columns, not under „Clasificare subiectivă”", () => {
    const placed = packTiles(COMPANY, 10, GAP);
    expectNoOverlap(placed, 10);
    const related = at(placed, "related");
    const preview = at(placed, "preview:document:1");
    expect(preview).toMatchObject({ col: related.col, top: bottom(related) + GAP });
    expect(preview.top).toBeLessThan(bottom(at(placed, "classification")));
  });

  it("at 1366 px: where its width is not free under „Corelate”, at the first free place below that holds it", () => {
    const placed = packTiles(COMPANY, 6, GAP);
    expectNoOverlap(placed, 6);
    const related = at(placed, "related");
    const preview = at(placed, "preview:document:1");
    expect(preview.col).toBe(related.col);
    expect(preview.top).toBeGreaterThanOrEqual(bottom(related) + GAP);
    const others = placed.filter((p) => p.id !== preview.id && !p.rowEnd);
    expect(preview.top).toBe(freeUnder(others, related, 4, 152, 6, GAP).top);
  });

  it("closing it leaves every tile where it was", () => {
    const open = packTiles(COMPANY, 10, GAP).filter((p) => !p.id.startsWith("preview:") && !p.rowEnd);
    const closed = packTiles(COMPANY.filter((b) => !b.anchor), 10, GAP).filter((p) => !p.rowEnd);
    expect(closed).toEqual(open);
  });

  it("a preview whose tile is not on the screen flows like a tile", () => {
    const placed = packTiles([...COMPANY.slice(0, 4), { id: "preview:x", units: 4, height: 152, anchor: "related" }], 10, GAP);
    expectNoOverlap(placed, 10);
    expect(at(placed, "preview:x")).toMatchObject({ col: 3 });
  });
});

describe("a tile that grows, and one that shrinks", () => {
  it("growing, it moves the boxes under it down by as much as it now overlaps them, and those under them in turn", () => {
    const placed = packTiles(PERSON, 10, GAP);
    const grown = grow(placed, "addresses#0", 326 + 120, GAP);
    expectNoOverlap(grown, 10);
    expect(at(grown, "classification").top).toBe(at(placed, "classification").top + 120);
    // Nothing beside it moves.
    for (const id of ["identity", "idCard", "contact", "addresses#1", "related", "connections"]) expect(at(grown, id).top).toBe(at(placed, id).top);
    expect(at(grown, "actions").top).toBe(Math.max(...grown.filter((p) => !p.rowEnd).map(bottom)) + GAP);
  });

  it("a push travels down: „Corelate” growing at 1366 px pushes what stands under it", () => {
    const placed = packTiles(PERSON, 6, GAP);
    const grown = grow(placed, "related", 521 + 300, GAP);
    expectNoOverlap(grown, 6);
  });

  it("shrinking, nothing moves — no box jumps while the user types", () => {
    const placed = packTiles(PERSON, 10, GAP);
    const shrunk = grow(placed, "addresses#0", 200, GAP);
    for (const p of placed.filter((x) => !x.rowEnd)) expect(at(shrunk, p.id).top).toBe(p.top);
    expect(at(shrunk, "addresses#0").height).toBe(200);
  });
});

describe("the row's lines", () => {
  it("a banner (`basis-full`) is a line of its own, at its place in the order", () => {
    const placed = packTiles([{ id: "banner", units: 1, height: 40, full: true }, ...PERSON], 10, GAP);
    expect(at(placed, "banner")).toMatchObject({ col: 0, units: 10, top: 0 });
    expect(at(placed, "identity")).toMatchObject({ col: 0, top: 40 + GAP });
    expect(at(placed, "contact")).toMatchObject({ col: 6, top: 40 + GAP });
    expectNoOverlap(placed, 10);
  });

  it("a box wider than the row takes the row", () => {
    expect(packTiles([{ id: "wide", units: 12, height: 10 }], 6, GAP)[0]).toMatchObject({ col: 0, units: 6 });
  });

  it("counts units as the row does: 9.25rem a unit, 1rem between", () => {
    expect(columnsIn(968, UNIT, GAP)).toBe(6);
    expect(columnsIn(1624, UNIT, GAP)).toBe(10);
    expect([476, 312, 640].map((w) => unitsOf(w, UNIT, GAP))).toEqual([3, 2, 4]);
    expect(unitsOf(300, UNIT, GAP)).toBe(2); // a compact preview takes the next whole unit
  });
});

describe("the screens", () => {
  it("the Natural and the Judicial Person pack their tile row", () => {
    for (const f of ["src/app/natural-persons/_components/person-detail-tiles.tsx", "src/app/judicial-persons/_components/person-detail-tiles.tsx"]) {
      const src = code(read(...f.split("/")));
      expect(src).toContain("useTilePacking(rowRef");
      expect(src).toMatch(/<div ref=\{rowRef\}[^>]*data-tile-row/);
    }
  });

  it("the Property and the Document pack their left area (`TileAreas`), the right column kept", () => {
    const src = code(read("src", "components", "tiles", "tile-areas.tsx"));
    expect(src).toContain("useTilePacking(leftRef, { fitWidest: true");
    expect(src).toMatch(/<div ref=\{leftRef\}[^>]*data-tile-area="left"/);
    expect(src).toContain('data-tile-area="right"');
    for (const f of ["src/app/properties/_components/property-detail-tiles.tsx", "src/app/documents/_components/document-detail-tiles.tsx"]) {
      expect(code(read(...f.split("/")))).toContain("<TileAreas");
    }
  });

  it("the hook measures and places, and never moves an element: the DOM's order stays the reading order", () => {
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).not.toMatch(/\.(insertBefore|prepend|append|replaceChildren)\(/);
    // #37.76: the one element it adds is the drag outline, after the boxes, and it never counts as a box.
    expect(src.match(/\.appendChild\([^)]*\)/g) ?? []).toEqual([".appendChild(outline)"]);
    expect(src).toContain("container.appendChild(outline)");
    expect(src).toContain("child.dataset.tileOutline !== undefined");
    expect(src).not.toContain("createPortal");
    expect(src).toContain('typeof ResizeObserver === "undefined"');
    expect(src).toContain("placeWithStored("); // #37.75's packTiles, around the stored places (#37.76)
    expect(src).toContain("grow(");
  });

  it("puts back exactly the inline styles it overwrote — never removes a width React set", () => {
    // Full 20261004T064902Z-20097: a cleanup that removed `width` from every box shrank the panels to their content.
    const src = code(read("src", "components", "tiles", "use-tile-packing.ts"));
    expect(src).toContain("styles.restore()");
    expect(src).not.toMatch(/\.style\.(width|left|top|position|height)\s*=/);
    expect(src).not.toMatch(/removeProperty\(k\)/);
  });

  it("„Previzualizare” remembers the tile it was pressed in, and the preview carries it", () => {
    const tiles = code(read("src", "components", "tiles", "preview-tiles.tsx"));
    expect(tiles).toContain('closest<HTMLElement>("[data-tile]")');
    expect(tiles).toContain("anchor={target.anchor}");
    expect(code(read("src", "components", "tiles", "preview-tile-body.tsx"))).toContain("data-preview-anchor={anchor}");
  });
});
