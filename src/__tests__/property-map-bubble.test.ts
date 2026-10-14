/**
 * #39.27 — a click on a property on the map of all properties opens the bubble again.
 *
 * Adrian, 2026-10-13: „When I click on a property I expect it to see a bubble with the nickname of the property and an
 * open link; well, I do not get any bubble!" The bubble is #15.12's: the MAP's click is hit-tested against every
 * property and an InfoWindow lists what is under it. #39.08 (afdc49f1) gave the property shapes `clickable={!areaOn}`
 * — clickable whenever no area tool is pressed — and a clickable Google shape with no handler of its own swallows the
 * click, so the map never heard it. `@vis.gl/react-google-maps` infers `clickable` from `onClick` only when it is not
 * given, which is why the shapes had let clicks through before. TC-MAP-01 step 2a drives it on the real map.
 */
import { readFileSync } from "fs";
import { join } from "path";

const SOURCE = readFileSync(join(process.cwd(), "src", "app", "properties", "map", "property-map.tsx"), "utf8");
/** The code alone — a behaviour guard reads no comment (the fix's own comment quotes the bug). */
const MAP = SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("the map of all properties: a click reaches the map (#39.27)", () => {
  it("no property shape is ever clickable — the bug was `clickable={!areaOn}`", () => {
    expect(MAP).not.toContain("clickable={!areaOn}");
    // Every property's own shape — `key={prop.id}`; the focus blink's overlay (`{...common}`, clickable: false) is
    // another.
    const shape = (tag: string) => {
      const at = MAP.search(new RegExp(`<${tag}\\s+key=\\{prop\\.id\\}`));
      expect([tag, at >= 0]).toEqual([tag, true]);
      return MAP.slice(at, MAP.indexOf("/>", at));
    };
    const polygon = shape("Polygon");
    expect(polygon).toContain("clickable={false}");
    const circle = shape("Circle");
    expect(circle).toContain("clickable={false}");
    // And neither has a click handler of its own that would make it take the click.
    expect(polygon).not.toMatch(/\bonClick=/);
    expect(circle).not.toMatch(/\bonClick=/);
  });

  it("the map's click opens the bubble unless a tool that takes clicks is pressed, as #15.12 and #39.07 built it", () => {
    expect(MAP).toContain("else if (!rulerMode && !anglesMode && !areaOn) handleMapClick(e.detail.latLng);");
    expect(MAP).toMatch(/if \(overlapping\.length === 0\) \{\s*setSelected\(null\);/);
    // Each entry of the bubble: the property's nickname (or its unnamed words) and „Deschide".
    expect(MAP).toContain('items:    overlapping.map((p) => ({ id: p.id, label: nameOr(p.nickname, "property") })),');
    expect(MAP).toMatch(/href=\{`\/properties\/\$\{item\.id\}`\}\s*icon=\{ArrowRight\}\s*label=\{t\("map\.openLink"\)\}/);
  });
});
