/**
 * Which sides of a principal list hide columns — the red „>" and „<" at the band's edges.          (Slice #40.03)
 *
 * `hiddenSides` from the frame's scroll: at the start, in the middle, at the end, all fitting, and the 1-px tolerances
 * (Ask first 3). The browser half is TC-LAYOUT-05 steps 11–14.
 */
import fs from "node:fs";
import path from "node:path";
import { HIDDEN_TOLERANCE_PX, NOTHING_HIDDEN, hiddenSides, sameSides } from "@/lib/ui/hidden-columns";

describe("hiddenSides", () => {
  const W = { clientWidth: 697, scrollWidth: 800 }; // Acte at 1000 px, measured in the browser pane

  it("at the start: the right side only", () => {
    expect(hiddenSides({ ...W, scrollLeft: 0 })).toEqual({ left: false, right: true });
  });
  it("in the middle: both", () => {
    expect(hiddenSides({ ...W, scrollLeft: 50 })).toEqual({ left: true, right: true });
  });
  it("at the end: the left side only", () => {
    expect(hiddenSides({ ...W, scrollLeft: 103 })).toEqual({ left: true, right: false });
  });
  it("every column fitting: neither", () => {
    expect(hiddenSides({ scrollLeft: 0, clientWidth: 800, scrollWidth: 800 })).toEqual(NOTHING_HIDDEN);
  });
  it("within a pixel of either end counts as the end", () => {
    expect(HIDDEN_TOLERANCE_PX).toBe(1);
    expect(hiddenSides({ ...W, scrollLeft: 1 }).left).toBe(false);
    expect(hiddenSides({ ...W, scrollLeft: 1.5 }).left).toBe(true);
    expect(hiddenSides({ ...W, scrollLeft: 102 }).right).toBe(false);
    expect(hiddenSides({ ...W, scrollLeft: 101.5 }).right).toBe(true);
  });
  it("sameSides compares both", () => {
    expect(sameSides({ left: true, right: false }, { left: true, right: false })).toBe(true);
    expect(sameSides({ left: true, right: false }, { left: true, right: true })).toBe(false);
  });
});

describe("the signs (Ask first 2, 4, 6)", () => {
  const SRC = fs.readFileSync(path.join(process.cwd(), "src", "components", "list", "hidden-column-signs.tsx"), "utf8");
  it("a strip with no height, sticking to the frame's top-left, that no click lands on and no reader reads", () => {
    expect(SRC).toContain('aria-hidden="true" className="pointer-events-none sticky left-0 top-0 z-20 h-0 w-full" data-hidden-columns=""');
  });
  it("in the danger red, bold, on the band's own background", () => {
    expect(SRC).toMatch(/const SIGN = "[^"]*\bbg-cap\b[^"]*\bfont-bold\b[^"]*\btext-red-600\b[^"]*\bdark:text-red-400\b/);
  });
  it("three „<” and three „>”", () => {
    expect(SRC.match(/<span>&lt;<\/span>/g)).toHaveLength(3);
    expect(SRC.match(/<span>&gt;<\/span>/g)).toHaveLength(3);
  });
  for (const list of ["natural-persons", "judicial-persons", "properties", "documents"]) {
    it(`${list}: the frame's first child`, () => {
      const view = fs.readFileSync(path.join(process.cwd(), "src", "app", list, "list-view.tsx"), "utf8");
      expect(view).toMatch(/\{\.\.\.fit\.frame\}>\s*\{\/\*[^*]*\*\/\}\s*<HiddenColumnSigns \/>/);
    });
  }
});
