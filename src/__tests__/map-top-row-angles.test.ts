/**
 * Slice #38.09 — „Puncte de contur" loses „Arată Street View"; „Arată
 * Unghiuri" moves to the map's top row, between „Desenează" and „Străzi |
 * Satelit", on the tile's map and on „Hartă extinsă", one state driving both.
 * The map renders Google Maps, which jsdom cannot, so its row is read from the
 * source; the browser is TC-ICON-04's and TC-PROP-09's.
 */
import { readFileSync } from "fs";
import { join } from "path";

const read = (...p: string[]) => readFileSync(join(process.cwd(), "src", "app", "properties", "_components", ...p), "utf8");
const INNER = read("property-mini-map-inner.tsx");
const WRAPPER = read("property-mini-map.tsx");
const FORM = read("property-form.tsx");
const CORNERS = read("corners-manager.tsx");

describe("the map's top row (#38.09)", () => {
  const row = INNER.slice(INNER.indexOf("data-map-top-row"), INNER.indexOf("data-map-draw-hint"));

  it("reads [Hartă extinsă] [Desenează / Gata] [Unghiuri] [Străzi | Satelit], in that order", () => {
    const at = (needle: string) => {
      const i = row.indexOf(needle);
      expect([needle, i >= 0]).toEqual([needle, true]);
      return i;
    };
    const order = [at("icon={Maximize}"), at("icon={PenTool}"), at("icon={Check}"), at("icon={DraftingCompass}"), at('["roadmap", "hybrid"]')];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("the toggle keeps its names, its pressed state, its fill and its 3-corner rule — and shows in view mode", () => {
    const toggle = row.slice(row.indexOf("{onToggleAngles && corners.length >= 3 && ("), row.indexOf('["roadmap", "hybrid"]'));
    expect(toggle).toContain('label={showAngles ? t("corners.hideAngles") : t("corners.showAngles")}');
    expect(toggle).toContain('variant={showAngles ? "primary" : "secondary"}');
    expect(toggle).toContain("aria-pressed={showAngles}");
    expect(toggle).toContain("onClick={onToggleAngles}");
    expect(toggle).not.toMatch(/readOnly/);
  });

  it("both maps are given the one toggle; the wrapper passes it through", () => {
    expect((FORM.match(/onToggleAngles=\{toggleAngles\}/g) ?? []).length).toBe(2);
    expect(FORM).toMatch(/const toggleAngles = useCallback\(\(\) => setShowAngles\(\(v\) => !v\), \[\]\);/);
    expect(WRAPPER).toContain("onToggleAngles={onToggleAngles}");
  });
});

describe("the corners tile's toolbar (#38.09)", () => {
  it("draws no angles toggle at all", () => {
    expect(CORNERS).not.toMatch(/DraftingCompass|onToggleAngles|showAngles/);
  });

  it("on a saved property (tiles) gets no Street View toggle — its checkbox opens it; „Adaugă proprietate” keeps it", () => {
    expect(FORM).toMatch(/onToggleStreetView=\{tiled \|\| typeConfig\.hideStreetView \? undefined : handleToggleStreetView\}/);
  });
});
