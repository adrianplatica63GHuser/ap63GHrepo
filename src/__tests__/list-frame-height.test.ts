/**
 * The four principal lists fit the window — the frame's height, from the measurements.            (Slice #40.02)
 *
 * `listFrameMaxHeight` takes the window's height from the frame's top down, less what stands under it (the gap, the
 * pagination row and the page's bottom padding), never under the band of names and three rows (Ask first 3). The
 * numbers are the browser pane's at 1280 × 600 on „Persoane fizice" (40.02's handover): the frame at 188, 16 + 26 under
 * it and 32 of padding, a 74-px band and 37-px rows. The browser half is TC-LAYOUT-05 steps 7–10.
 */
import fs from "node:fs";
import path from "node:path";
import { LIST_FRAME_FLOOR_ROWS, LIST_ROW_PX, listFrameFloor, listFrameMaxHeight, rowTilesMaxHeight, FRAME_MIN_PX } from "@/lib/ui/frame-height";

describe("listFrameFloor", () => {
  it("is the band, three rows and the frame's two borders", () => {
    expect(LIST_FRAME_FLOOR_ROWS).toBe(3);
    expect(listFrameFloor(74, 37)).toBe(74 + 3 * 37 + 2);
  });
  it("takes a one-line row's height while no row is drawn, and rounds up", () => {
    expect(listFrameFloor(74, 0)).toBe(74 + 3 * LIST_ROW_PX + 2);
    expect(listFrameFloor(74.4, 36.9)).toBe(Math.ceil(74.4 + 3 * 36.9 + 2));
  });
});

describe("listFrameMaxHeight", () => {
  const floor = listFrameFloor(74, 37); // 187

  // The pane measured 337 at 1280 × 600: its frame's top and the rows under it were fractional (188.4, 74.3).
  it("takes what the window leaves under the frame's top, less what stands under it", () => {
    expect(listFrameMaxHeight({ viewport: 600, frameTop: 188, below: 16 + 26 + 32, floor })).toBe(338);
    expect(listFrameMaxHeight({ viewport: 600, frameTop: 188.4, below: 74.3, floor })).toBe(337);
  });

  it("rounds down, so the page never overflows by a fraction", () => {
    expect(listFrameMaxHeight({ viewport: 600.6, frameTop: 188.2, below: 74.1, floor })).toBe(338);
  });

  it("a filters row moves the frame down and takes its height off it", () => {
    const without = listFrameMaxHeight({ viewport: 900, frameTop: 188, below: 74, floor });
    const withRow = listFrameMaxHeight({ viewport: 900, frameTop: 236, below: 74, floor });
    expect(without - withRow).toBe(48);
  });

  it("never under the band and three rows: a short window gets the floor, and the page scrolls (Ask first 3)", () => {
    expect(listFrameMaxHeight({ viewport: 420, frameTop: 188, below: 74, floor })).toBe(floor);
    expect(listFrameMaxHeight({ viewport: 188 + 74 + floor, frameTop: 188, below: 74, floor })).toBe(floor);
    expect(listFrameMaxHeight({ viewport: 188 + 74 + floor + 1, frameTop: 188, below: 74, floor })).toBe(floor + 1);
  });

  it("a tall window gives more than a page of rows needs — the frame is a max-height, so it stays as tall as its rows", () => {
    const page = 74 + 15 * 37 + 2;
    expect(listFrameMaxHeight({ viewport: 1080, frameTop: 188, below: 74, floor })).toBeGreaterThan(page);
  });
});

describe("rowTilesMaxHeight", () => {
  it("down to the window's bottom, less the page's padding, never under the minimum", () => {
    expect(rowTilesMaxHeight({ viewport: 600, columnTop: 135, below: 32 })).toBe(433);
    expect(rowTilesMaxHeight({ viewport: 300, columnTop: 135, below: 32 })).toBe(FRAME_MIN_PX);
  });
});

describe("the four lists use the shared piece (Ask first 9)", () => {
  for (const list of ["natural-persons", "judicial-persons", "properties", "documents"]) {
    it(list, () => {
      const src = fs.readFileSync(path.join(process.cwd(), "src", "app", list, "list-view.tsx"), "utf8");
      expect(src).toContain("const fit = useListFit();");
      expect(src).toMatch(/const edge = useListEdge\((columns|COLUMNS), fit\.gutter\);/);
      expect(src).toMatch(/<div className=\{`\$\{LIST_FRAME\} [^`]*`\} \{\.\.\.edge\.frame\} \{\.\.\.fit\.frame\}>/);
      expect(src).toContain("<thead className={LIST_HEAD}>");
      expect(src).toContain("useListScrollMemory(query.isSuccess);");
    });
  }

  it("the frame scrolls both ways, keeps its bar's room, and the band sticks to its top", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src", "components", "list", "list-fit.tsx"), "utf8");
    // Slice 40.14: and keeps its vertical bar's room while the rows fit, so the bar coming or going moves no width.
    expect(src).toContain('export const LIST_FRAME = "w-fit max-w-full overflow-auto [scrollbar-gutter:stable]";');
    expect(src).toMatch(/export const LIST_HEAD =\s*"sticky top-0 z-10 bg-cap /);
  });
});
