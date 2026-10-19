/**
 * The property's map: small corners on the „Hartă" tile, and „Hartă extinsă" with every property      (Slice #39.94)
 *
 * Adrian, 2026-10-19: the tile's corners „just the smaller blue dot like on the expanded map"; „Hartă extinsă" with
 * „this property … marked as red" and „all the properties", the property „in the middle" and „the same size". The
 * pure parts are in map-drops.test.ts (`placeShapes`) and map-focus.test.ts (`theaterOpenView`); this suite holds the
 * wiring, read from the source: one drawing of corners and drops for both maps, and which map gets what.
 */
import fs from "node:fs";
import path from "node:path";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const FORM = read("src/app/properties/_components/property-form.tsx");
const INNER = read("src/app/properties/_components/property-mini-map-inner.tsx");
const LAYER = read("src/app/properties/_components/theater-others-layer.tsx");
const BIG = read("src/app/properties/map/property-map.tsx");
const SHAPES = read("src/components/maps/property-shapes.tsx");
const count = (text: string, needle: string) => text.split(needle).length - 1;

/** The two `<PropertyMiniMap … >` openings in the form: the tile's first, the overlay's second. */
const miniMaps = FORM.split("<PropertyMiniMap").slice(1).map((s) => s.slice(0, s.indexOf(">\n")));

describe("one drawing of a property's corners and drops (#39.94: lifted, not copied)", () => {
  it("lives in property-shapes.tsx, and the big map draws with it", () => {
    for (const name of ["export function PropertyCornerDot", "export function PropertyDrop", "export const SHAPE_COLOR"]) {
      expect(SHAPES).toContain(name);
    }
    expect(BIG).toMatch(/import \{[^}]*PropertyCornerDot[^}]*PropertyDrop[^}]*\} from "@\/components\/maps\/property-shapes"/);
    expect(BIG).not.toMatch(/function PropertyCornerDot|function PropertyDrop|const SHAPE_COLOR/);
    expect(BIG).toContain("placeShapes(displayItems, zoom, mergeDistance)");
  });

  it("the overlay's other properties are drawn with the same pieces, at the map's zoom, and take no click", () => {
    expect(LAYER).toMatch(/import \{[^}]*PropertyCornerDot[^}]*PropertyDrop[^}]*\} from "@\/components\/maps\/property-shapes"/);
    expect(LAYER).toContain("placeShapes(others, zoom, mergeDistance)");
    expect(LAYER).toContain("useMergeDistance()");
    expect(LAYER).toContain("p.id !== excludeId");
    expect(LAYER).toContain("clickable={false}");
    expect(count(LAYER, "clickable={false}")).toBe(3);
    expect(LAYER).not.toMatch(/onClick=/);
    expect(LAYER).toContain('fetch("/api/properties/map")');
    expect(LAYER).toContain("gcTime:               0");
  });
});

describe("the „Hartă\" tile's corners (#39.94)", () => {
  it("are the big map's 4 px dot, centred on the corner, in the polygon's colour — no red, no white border", () => {
    expect(INNER).toContain("width:           CORNER_DOT_PX");
    expect(INNER).toContain("anchorPoint={AdvancedMarkerAnchorPoint.CENTER}");
    expect(INNER).toContain("backgroundColor: shapeColor");
    expect(INNER).toContain("const shapeColor = SHAPE_COLOR[tone]");
    expect(INNER).not.toContain("#ef4444");
    expect(INNER).not.toContain("2px solid white");
  });

  it("keep a 14 px grab area for the drag and the closing click, and a ring in the dot's colour for the hovered row", () => {
    expect(INNER).toContain("const CORNER_GRAB_PX = 14;");
    expect(INNER).toContain("width: CORNER_GRAB_PX, height: CORNER_GRAB_PX");
    expect(INNER).toContain("border:        `2px solid ${shapeColor}`");
    expect(INNER).toContain("opacity:       isHighlighted ? 1 : 0");
  });
});

describe("„Hartă extinsă\" (#39.94)", () => {
  it("the form draws two mini-maps: the tile, blue, opening the overlay; the overlay, red, with the others under it", () => {
    expect(miniMaps).toHaveLength(2);
    const [tile, overlay] = miniMaps;
    expect(tile).toContain("onFullScreen={handleOpenTheaterMap}");
    expect(tile).toContain("onCenterChange={handleMiniMapCenter}");
    expect(tile).not.toContain("tone=");
    expect(overlay).toContain('tone="selected"');
    expect(overlay).toContain("initialView={theaterView}");
    expect(overlay).not.toContain("onFullScreen");
    expect(FORM).toContain("<TheaterOthersLayer excludeId={propertyId} />");
    expect(count(FORM, "<TheaterOthersLayer")).toBe(1);
  });

  it("opens where the tile looks when the button is pressed: centred on the live corners, at the tile's zoom", () => {
    expect(FORM).toContain(
      "setTheaterView(theaterOpenView(corners, { center: miniMapCenterRef.current, zoom: miniMapZoomRef.current }));",
    );
    expect(INNER).toContain("defaultCenter={initialView?.center ?? DEFAULT_CENTER}");
    expect(INNER).toContain("defaultZoom={initialView?.zoom ?? DEFAULT_ZOOM}");
    expect(INNER).toContain("{!initialView && <FitBounds corners={corners} />}");
  });

  it("loads the others only with the overlay — a dynamic import, never with the form", () => {
    expect(FORM).toMatch(/const TheaterOthersLayer = dynamic\(\(\) => import\("\.\/theater-others-layer"\), \{ ssr: false \}\);/);
  });

  it("names a numbered drop by its count in both languages, without the big map's „click to zoom in\"", () => {
    for (const file of ["messages/ro-RO.json", "messages/en-GB.json"]) {
      const m = JSON.parse(read(file)) as { property: { corners: Record<string, string> } };
      expect(m.property.corners.theaterOthers).toMatch(/^\{count, plural, /);
      expect(m.property.corners.theaterOthers).not.toMatch(/apăsați|click/);
    }
  });
});
