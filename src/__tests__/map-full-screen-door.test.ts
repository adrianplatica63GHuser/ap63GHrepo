/**
 * The Property's full-screen map has one door: the „Hartă" tile's own top
 * row.                                                           (Slice #37.91)
 *
 * The theater overlay (#20.16) is the one full-screen map. Since this slice it
 * opens from the Maximize button at the left of the map's top row
 * ([full screen] [Desenează] [Străzi | Satelit]), and the corners tile's
 * „Hartă extinsă" is gone. The overlay's own map is not given the opener, so
 * it draws no second door; „Restrânge" (Minimize) and Escape close it.
 */
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const FORM = read("src/app/properties/_components/property-form.tsx");
const CORNERS = read("src/app/properties/_components/corners-manager.tsx");
const INNER = read("src/app/properties/_components/property-mini-map-inner.tsx");
const count = (text: string, needle: string) => text.split(needle).length - 1;

describe("the full-screen map's one opener (#37.91)", () => {
  it("is set open in one place, handed to one map", () => {
    expect(count(FORM, "setBigMap(true)")).toBe(1);
    expect(count(FORM, "onFullScreen={")).toBe(1);
    expect(FORM).toContain("onFullScreen={handleOpenTheaterMap}");
    expect(FORM).not.toMatch(/onToggleBigMap|handleToggleBigMap/);
  });

  it("is not on the corners tile any more", () => {
    expect(CORNERS).not.toMatch(/onToggleBigMap|showBigMap|showSmallMap|Maximize2/);
  });

  it('is the map\'s Maximize, named and titled „Hartă extinsă", left of the draw button', () => {
    expect(INNER).toMatch(/import \{[^}]*\bMaximize\b[^}]*\} from "lucide-react"/);
    const opener = INNER.indexOf('label={t("map.miniMap.fullScreen")}');
    const draw = INNER.indexOf('label={t("map.miniMap.draw")}');
    const toggle = INNER.indexOf('t("map.typeStreet")');
    expect(opener).toBeGreaterThan(-1);
    expect(opener).toBeLessThan(draw);
    expect(draw).toBeLessThan(toggle);
  });

  it('is closed by the theater\'s Minimize „Restrânge"', () => {
    expect(FORM).toMatch(/<IconButton icon=\{Minimize\} label=\{t\("corners\.theaterClose"\)\}/);
    expect(FORM).not.toContain("Minimize2");
  });

  it("has its words in both languages, and the corners tile's are gone", () => {
    for (const [file, words] of [["messages/ro-RO.json", "Hartă extinsă"], ["messages/en-GB.json", "Expand map"]] as const) {
      const m = JSON.parse(read(file)) as { property: { map: { miniMap: Record<string, string> }; corners: Record<string, string> } };
      expect(m.property.map.miniMap.fullScreen).toBe(words);
      expect(m.property.corners.showBigMap).toBeUndefined();
      expect(m.property.corners.showSmallMap).toBeUndefined();
    }
  });
});
