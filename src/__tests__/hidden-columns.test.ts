/**
 * Which sides of a principal list hide columns — the red „>" and „<" at the band's edges.          (Slice #40.03)
 *
 * `hiddenSides` from the frame's scroll: at the start, in the middle, at the end, all fitting, and the 1-px tolerances
 * (Ask first 3). The browser half is TC-LAYOUT-05 steps 11–14.
 */
import fs from "node:fs";
import path from "node:path";
import { HIDDEN_TOLERANCE_PX, NOTHING_HIDDEN, SIGN_KEEP_REM, hiddenSides, sameSides, signScrollPx, signScrollTarget } from "@/lib/ui/hidden-columns";

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

describe("a press on a sign (Slice 40.11, Ask first 3)", () => {
  // 697 px in view of 2000: the far end is at 1303.
  const W = { clientWidth: 697, scrollWidth: 2000 };
  it("scrolls by the visible width less 4 rem — a little of what was in view stays", () => {
    expect(SIGN_KEEP_REM).toBe(4);
    expect(signScrollPx(697)).toBe(697 - 64);
    expect(signScrollPx(40)).toBe(16); // never less than a rem
  });
  it("at the start: right by a step; left stays at 0", () => {
    expect(signScrollTarget({ ...W, scrollLeft: 0 }, "right")).toBe(633);
    expect(signScrollTarget({ ...W, scrollLeft: 0 }, "left")).toBe(0);
  });
  it("in the middle: a step either way, never past either end", () => {
    expect(signScrollTarget({ ...W, scrollLeft: 300 }, "right")).toBe(933);
    expect(signScrollTarget({ ...W, scrollLeft: 300 }, "left")).toBe(0);
    expect(signScrollTarget({ ...W, scrollLeft: 1000 }, "left")).toBe(367);
    expect(signScrollTarget({ ...W, scrollLeft: 1000 }, "right")).toBe(1303);
  });
  it("at the end: never past it", () => {
    expect(signScrollTarget({ ...W, scrollLeft: 1303 }, "right")).toBe(1303);
    expect(signScrollTarget({ ...W, scrollLeft: 1303 }, "left")).toBe(670);
  });
  it("in rem: a larger root font keeps more in view", () => {
    expect(signScrollTarget({ ...W, scrollLeft: 0 }, "right", 20)).toBe(697 - 80);
  });
});

describe("the signs (Ask first 2, 6; 40.11's Ask first 2, 4)", () => {
  const SRC = fs.readFileSync(path.join(process.cwd(), "src", "components", "list", "hidden-column-signs.tsx"), "utf8");
  it("a strip with no height, sticking to the frame's top-left, that no click lands on — only its signs take one", () => {
    // 40.11: was `aria-hidden="true"` too — its signs are buttons now, read by name.
    expect(SRC).toContain('<div ref={ref} className="pointer-events-none sticky left-0 top-0 z-20 h-0 w-full" data-hidden-columns="">');
    expect(SRC).toContain("className={`pointer-events-auto absolute top-0 ${side === \"left\" ? \"left-0\" : \"right-0\"}`}");
  });
  it("in the danger red, bold, on the band's own background", () => {
    const sign = SRC.slice(SRC.indexOf("const SIGN ="), SRC.indexOf(";", SRC.indexOf("const SIGN =")));
    for (const c of ["bg-cap", "font-bold", "text-red-600", "dark:text-red-400"]) expect([c, sign.includes(c)]).toEqual([c, true]);
  });
  it("three glyphs a side, hidden from a reader; the button named by its sentence, the bubble the same words", () => {
    expect(SRC.match(/<span aria-hidden="true">\{glyph\}<\/span>/g)).toHaveLength(3);
    expect(SRC).toContain('const glyph = side === "left" ? "<" : ">";');
    expect(SRC).toContain("<IconTooltip label={label}");
    expect(SRC).toContain("aria-label={label}");
    expect(SRC).toContain('label={t("left")}');
    expect(SRC).toContain('label={t("right")}');
  });
  it("the sentences, in both languages (Ask first 1)", () => {
    const m = (f: string) => (JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", f), "utf8")) as { shared: { hiddenColumns: Record<string, string> } }).shared.hiddenColumns;
    expect(m("ro-RO.json")).toEqual({
      right: "Mai sunt coloane la dreapta. Derulați spre dreapta ca să le vedeți.",
      left: "Mai sunt coloane la stânga. Derulați spre stânga ca să le vedeți.",
    });
    expect(m("en-GB.json")).toEqual({
      right: "More columns to the right. Scroll right to see them.",
      left: "More columns to the left. Scroll left to see them.",
    });
  });
  it("a press scrolls that way, smoothly", () => {
    expect(SRC).toContain('frame.scrollTo({ left, behavior: "smooth" });');
    expect(SRC).toContain("signScrollTarget(");
  });
  for (const list of ["natural-persons", "judicial-persons", "properties", "documents"]) {
    it(`${list}: the frame's first child`, () => {
      const view = fs.readFileSync(path.join(process.cwd(), "src", "app", list, "list-view.tsx"), "utf8");
      expect(view).toMatch(/\{\.\.\.fit\.frame\}>\s*\{\/\*[^*]*\*\/\}\s*<HiddenColumnSigns \/>/);
    });
  }
});

/**
 * Slice 40.23 — Adrian: „Should have a slow blinking to draw attention but not be annoying - so: slower and less
 * intense than usual blinking". The glyphs only, 1 → 0.45 → 1 every 2.4 s, still on hover and focus, never under
 * „reduce motion". (TC-LAYOUT-05 step 11b reads it in the browser.)
 */
describe("the signs' slow pulse (40.23)", () => {
  const css = fs.readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");
  const signs = fs.readFileSync(path.join(process.cwd(), "src", "components", "list", "hidden-column-signs.tsx"), "utf8");
  it("the sign carries the class; the keyframe dims to 0.45, never off", () => {
    expect(signs).toMatch(/const SIGN =\s*"ga-sign-pulse /);
    expect(css).toMatch(/@keyframes ga-sign-pulse \{\s*0%, 100% \{ opacity: 1; \}\s*50%\s+\{ opacity: 0\.45; \}\s*\}/);
  });
  it("on the glyphs, 2.4 s, ease-in-out, endless; still on hover and focus; none under reduced motion", () => {
    expect(css).toContain(".ga-sign-pulse > span { animation: ga-sign-pulse 2.4s ease-in-out infinite; }");
    expect(css).toMatch(/\.ga-sign-pulse:hover > span,\s*\.ga-sign-pulse:focus > span,\s*\.ga-sign-pulse:focus-visible > span \{ animation: none; opacity: 1; \}/);
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*\.ga-sign-pulse > span \{ animation: none; \}\s*\}/);
  });
});
