/**
 * Slice 41.16 — the width unit set on „Setări”.
 *
 * The unit is the CSS variable `--unit`; every width drawn in units is the fewest live units at least as wide as on
 * 119 px (`atLeastUnitsCss`). These pin the arithmetic that CSS does — worked out the same way by `declaredWidthPx`,
 * which the tile packing reads — and the cookie that carries the unit to the server.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  DEFAULT_UNIT_PX,
  PANEL_MIN_REM,
  PANEL_UNITS,
  PANEL_UNIT_STYLE,
  PANEL_UNIT_INNER_REM,
  UNIT_PX_MAX,
  UNIT_PX_MIN,
  UNIT_REM,
  atLeastUnitsCss,
  declaredWidthPx,
  stackedBoxStyle,
  tileExtraCss,
  tileInner,
  unitPxOf,
  unitStyle,
  unitsCss,
  unitsFor,
  unitsInnerRem,
  unitsRem,
} from "@/lib/ui/field-widths";
import { parseWidthUnitDraft, unitVarValue, widthUnitCookie, widthUnitOf, widthUnitStyle } from "@/lib/ui/width-unit";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
/** `n` units of `px` and the gaps between them. */
const unitsPx = (n: number, px: number) => n * px + (n - 1) * 16;

describe("the unit (41.16)", () => {
  it("is 119 px until changed, whole px from 80 to 200", () => {
    expect([DEFAULT_UNIT_PX, UNIT_PX_MIN, UNIT_PX_MAX, UNIT_REM]).toEqual([119, 80, 200, 7.4375]);
    expect(widthUnitOf(undefined)).toBe(119);
    expect(widthUnitOf("100")).toBe(100);
    expect(["79", "201", "100.5", "abc", "", " 150 "].map(widthUnitOf)).toEqual([119, 119, 119, 119, 119, 150]);
    expect(["80", "200", "79", "201", "12.5", "1e2", "", " 99 "].map(parseWidthUnitDraft)).toEqual([80, 200, null, null, null, null, null, 99]);
  });

  it("is kept in a cookie and drawn as `--unit` in rem", () => {
    expect(widthUnitCookie(100)).toBe("ga40-width-unit=100; path=/; max-age=31536000; SameSite=Lax");
    expect(unitVarValue(119)).toBe("7.4375rem");
    expect(widthUnitStyle(100)).toEqual({ "--unit": "6.25rem" });
    expect([unitPxOf("7.4375rem"), unitPxOf(" 100px "), unitPxOf("6.25rem", 20), unitPxOf(""), unitPxOf("calc(1px)")]).toEqual([119, 100, 125, null, null]);
  });
});

describe("a width drawn in units (41.16)", () => {
  it("is exactly n units on 119 px — every count is what it was", () => {
    for (let n = 1; n <= 14; n++) {
      expect([n, declaredWidthPx(unitsCss(n), 119)]).toEqual([n, unitsRem(n) * 16]);
      expect([n, declaredWidthPx(atLeastUnitsCss(unitsRem(n)), 119)]).toEqual([n, unitsPx(n, 119)]);
    }
  });

  it("on another unit is the fewest of its units at least as wide — never narrower than on 119", () => {
    for (const px of [80, 100, 119, 150, 200]) {
      for (let n = 1; n <= 10; n++) {
        const drawn = declaredWidthPx(unitsCss(n), px)!;
        const k = (drawn + 16) / (px + 16);
        expect([px, n, Number.isInteger(Math.round(k * 1e6) / 1e6)]).toEqual([px, n, true]);
        expect(drawn).toBeGreaterThanOrEqual(unitsPx(n, 119));
        expect(drawn - (px + 16)).toBeLessThan(unitsPx(n, 119)); // one unit fewer would be narrower
      }
    }
    // The header's figures: 3 units of 119 (389 px) are 4 of 100 (448); 2 (254) are 3 of 100 (332); 4 (524) are 3 of 200 (632).
    expect([declaredWidthPx(unitsCss(3), 100), declaredWidthPx(unitsCss(2), 100), declaredWidthPx(unitsCss(4), 200)]).toEqual([448, 332, 632]);
  });

  it("carries its inner width for what fills it, and a filled box takes it", () => {
    expect(unitStyle(3)).toEqual({ width: unitsCss(3), "--tile-inner": `calc(${unitsCss(3)} - 1.625rem)` });
    expect(tileInner(14.25)).toBe("var(--tile-inner, 14.25rem)");
    expect(stackedBoxStyle({ step: "TILE", kind: "grows", fill: true }, tileInner(unitsInnerRem(2)))).toEqual({ width: "var(--tile-inner, 14.25rem)" });
    expect(stackedBoxStyle({ step: "M", kind: "input" }, tileInner(unitsInnerRem(2)))).toEqual({ width: "8.5rem" });
    expect(tileExtraCss(2)).toBe("(var(--tile-inner, 14.25rem) - 14.25rem)");
  });

  it("reads a declared width the packing knows, and nothing else", () => {
    expect([declaredWidthPx("24.3125rem", 100), declaredWidthPx("300px", 100), declaredWidthPx("100%", 100), declaredWidthPx("", 100)]).toEqual([389, 300, null, null]);
  });
});

describe("the form panels (41.16, Ask first 3)", () => {
  it("count what they always counted on 119 px, from the width their rows need", () => {
    for (const screen of ["naturalPerson", "judicialPerson", "property", "document"] as const) {
      const min = PANEL_MIN_REM[screen] as Record<string, number>;
      const units = PANEL_UNITS[screen] as Record<string, number>;
      for (const [panel, rem] of Object.entries(min)) {
        expect([screen, panel, unitsFor(rem)]).toEqual([screen, panel, units[panel]]);
        const drawn = declaredWidthPx(String((PANEL_UNIT_STYLE[screen] as Record<string, { width: string }>)[panel].width), 119);
        expect([screen, panel, drawn]).toEqual([screen, panel, unitsRem(units[panel]) * 16]);
        expect([screen, panel, (PANEL_UNIT_INNER_REM[screen] as Record<string, number>)[panel]]).toEqual([screen, panel, unitsInnerRem(units[panel])]);
      }
    }
    expect(PANEL_UNITS.naturalPerson).toEqual({ identity: 3, idCard: 4, contact: 2, address: 2 });
  });

  it("a panel counted from its rows is recomputed on a new unit; a count pinned by hand keeps its 119-px width", () => {
    const fewestPx = (minPx: number, px: number) => {
      let n = 1;
      while (unitsPx(n, px) < minPx - 1e-6) n++;
      return unitsPx(n, px);
    };
    for (const px of [80, 100, 150, 200]) {
      for (const screen of ["naturalPerson", "judicialPerson", "property", "document"] as const) {
        for (const [panel, rem] of Object.entries(PANEL_MIN_REM[screen] as Record<string, number>)) {
          const drawn = declaredWidthPx(String((PANEL_UNIT_STYLE[screen] as Record<string, { width: string }>)[panel].width), px);
          expect([px, screen, panel, drawn]).toEqual([px, screen, panel, fewestPx(rem * 16, px)]);
        }
      }
    }
    // Rows needing 450 px are 4 units on 119 (524 px) and 3 on 150 (482) — where 4 units pinned by hand would be 648.
    expect([declaredWidthPx(atLeastUnitsCss(450 / 16), 119), declaredWidthPx(atLeastUnitsCss(450 / 16), 150), declaredWidthPx(unitsCss(4), 150)]).toEqual([524, 482, 648]);
  });
});

describe("where the unit is read (41.16)", () => {
  it("the root layout draws `--unit` from the cookie; the page keeps it in step on every navigation", () => {
    const layout = read("src", "app", "layout.tsx");
    expect(layout).toContain("widthUnitOf((await cookies()).get(WIDTH_UNIT_COOKIE_NAME)?.value)");
    expect(layout).toContain("style={{ colorScheme: theme, ...widthUnitStyle(unitPx) }}");
    expect(layout).toContain("<WidthUnitSync />");
    expect(read("src", "app", "globals.css")).toMatch(/--unit: 7\.4375rem;/);
    const sync = read("src", "components", "providers", "width-unit-sync.tsx");
    expect(sync).toMatch(/useEffect\(sync, \[pathname\]\)/);
    expect(sync).toContain('"visibilitychange"');
  });

  it("the tile packing measures in the live unit, not the default", () => {
    const packing = read("src", "components", "tiles", "use-tile-packing.ts");
    expect(packing).toContain("return { unit: liveUnitPx(r), gap: UNIT_GAP_REM * r };");
    expect(packing).not.toMatch(/UNIT_REM \* r/);
  });

  it("„Setări” holds it in „Contul meu”, under „Aspect”, with „Salvează” and a way back to 119", () => {
    const view = read("src", "app", "admin", "settings", "_components", "settings-view.tsx");
    expect(view).toMatch(/<AppearanceChoice \/>\s*<WidthUnitChoice initial=\{unitPx\} \/>/);
    expect(view).toContain('{...screenBox("widthUnitPx")}');
    expect(view).toContain("applyWidthUnit(px)");
    for (const locale of ["ro-RO", "en-GB"]) {
      const m = JSON.parse(read("messages", `${locale}.json`)).settings.account.widthUnit;
      expect([locale, Object.keys(m).sort()]).toEqual([locale, ["intro", "invalid", "label", "range", "reset", "save", "saved", "title"]]);
      expect(m.range).toMatch(/\{min\}[\s\S]*\{max\}/);
      expect(m.reset).toContain("{px}");
      expect(m.saved).toContain("{px}");
    }
    const ro = JSON.parse(read("messages", "ro-RO.json")).settings.account.widthUnit;
    expect([ro.title, ro.save, ro.reset]).toEqual(["Unitatea de lățime", "Salvează", "Revino la {px} px"]);
  });
});
