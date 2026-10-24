/**
 * Slice 40.41 — the tile bar on two rows: the pure half (`pickTwoRows`, tile-bar-rows.ts).
 *
 * Groups whole, the buttons at the end of the second row, the first row the longer by the least; a group split only
 * when it alone is wider than a row; `null` when two rows cannot hold the bar; a stale arrangement fitted to the items a
 * group has now. The browser half — the four screens at 1920 and 1366 — is TC-TILES-18's step 8.
 */
import fs from "node:fs";
import path from "node:path";

import { barPieces, fitPieces, pickTwoRows, pieceWidth, type BarMeasures } from "@/lib/ui/tile-bar-rows";
import { groupStrip } from "@/lib/ui/tile-surface";

const read = (...p: string[]) => fs.readFileSync(path.join(process.cwd(), ...p), "utf8");

// A strip's padding and borders 22 px; boxes 16 px apart; strips 16 px apart; one box per group sized so each strip is
// a round number: A 300, B 200, C 100.
const M = (over: Partial<BarMeasures> = {}): BarMeasures => ({
  groups: [
    { key: "A", boxes: [278] },
    { key: "B", boxes: [178] },
    { key: "C", boxes: [78] },
  ],
  stripPad: 22,
  boxGap: 16,
  gap: 16,
  buttons: 150,
  width: 1000,
  ...over,
});

describe("the tile bar on two rows (40.41)", () => {
  it("a strip's width: its padding, its boxes and the gaps between them", () => {
    expect(pieceWidth({ key: "x", boxes: [100, 50, 30] }, 0, 3, M())).toBe(22 + 180 + 32);
    expect(pieceWidth({ key: "x", boxes: [100, 50, 30] }, 1, 3, M())).toBe(22 + 80 + 16);
  });

  it("groups whole, the buttons last on the second row, the first row the longer by the least", () => {
    // {A, C} 416 over {B} + buttons 366 — {A, B} 516 / 266 is further apart, {A} 300 / 482 has the second the longer.
    const r = pickTwoRows(M())!;
    expect(r.rows.map((row) => row.map((p) => p.key))).toEqual([["A", "C"], ["B"]]);
    expect(r.widths).toEqual([416, 366]);
    expect(r.widths[0]).toBeGreaterThanOrEqual(r.widths[1]);
    for (const row of r.rows) for (const p of row) expect([p.from, p.to]).toEqual([0, 1]);
  });

  it("too narrow for two rows: null — the bar wraps as before, the buttons still last", () => {
    expect(pickTwoRows(M({ width: 400 }))).toBeNull();
  });

  it("a group wider than a row is split at a box boundary, both halves its own; the rest stays whole", () => {
    const m = M({ groups: [{ key: "D", boxes: [200, 200, 200] }, { key: "C", boxes: [78] }], width: 500, buttons: 40 });
    expect(pieceWidth(m.groups[0], 0, 3, m)).toBe(654);
    expect(barPieces(m)).toEqual([
      { key: "D", from: 0, to: 1 },
      { key: "D", from: 1, to: 3 },
      { key: "C", from: 0, to: 1 },
    ]);
    // The wider half (438) alone on the first row; the narrower (222), „C" (100) and the buttons (40) under it: 394.
    const r = pickTwoRows(m)!;
    expect(r.rows).toEqual([[{ key: "D", from: 1, to: 3 }], [{ key: "D", from: 0, to: 1 }, { key: "C", from: 0, to: 1 }]]);
    expect(r.widths).toEqual([438, 394]);
  });

  it("when no way has the first row the longer, the rows that differ least", () => {
    const r = pickTwoRows(M({ groups: [{ key: "A", boxes: [78] }], buttons: 300 }))!;
    expect(r.rows.map((row) => row.map((p) => p.key))).toEqual([["A"], []]);
  });

  it("an arrangement made on earlier widths is fitted to the items a group has now", () => {
    // A preview opened: „related" has a third item; the group „meta" appeared.
    const rows = fitPieces([[{ key: "related", from: 0, to: 2 }], [{ key: "record", from: 0, to: 4 }]], { related: 3, record: 4, meta: 2 });
    expect(rows).toEqual([[{ key: "related", from: 0, to: 3 }], [{ key: "record", from: 0, to: 4 }, { key: "meta", from: 0, to: 2 }]]);
    // A preview closed: the last piece shrinks; a piece past the end goes.
    expect(fitPieces([[{ key: "related", from: 0, to: 1 }, { key: "related", from: 1, to: 3 }]], { related: 1 })).toEqual([[{ key: "related", from: 0, to: 1 }]]);
  });

  it("a strip of the two-row bar never wraps inside", () => {
    expect(groupStrip("record", true)).toContain("flex-nowrap whitespace-nowrap");
    expect(groupStrip("record")).toContain("flex-wrap");
    expect(groupStrip("record")).not.toContain("nowrap");
  });

  it("the four record screens stand their bar on two rows; the home page and Setări do not", () => {
    for (const f of [
      ["src", "app", "natural-persons", "_components", "person-detail-tiles.tsx"],
      ["src", "app", "judicial-persons", "_components", "person-detail-tiles.tsx"],
      ["src", "app", "properties", "_components", "property-detail-tiles.tsx"],
      ["src", "app", "documents", "_components", "document-detail-tiles.tsx"],
    ]) {
      expect([f.join("/"), /<TileSelector [^>]*\btwoRows \/>/.test(read(...f))]).toEqual([f.join("/"), true]);
    }
    expect(read("src", "app", "_components", "dashboard-client.tsx")).not.toMatch(/\btwoRows\b/);
    expect(read("src", "app", "admin", "settings", "_components", "settings-view.tsx")).not.toMatch(/\btwoRows\b/);
    const bar = read("src", "components", "tiles", "tile-selector.tsx");
    expect(bar).toContain('data-tile-bar-row="1"');
    expect(bar).toContain('data-tile-bar-row="2"');
    expect(bar).toMatch(/\{row2\.map\(piece\)\}\s*\{loose\}\s*\{buttonsGroup\}/);
  });
});
