/**
 * Slice 41.70 — „Caută pe hartă": what the box understands, where the camera lands, and the flight.
 */
import { readFileSync } from "fs";
import { join } from "path";
import {
  FLIGHT_MS,
  POINT_ZOOM,
  cameraAt,
  cameraForCorners,
  cameraForGeocode,
  classifySearch,
  easeInOut,
  findByCode,
  flightMs,
  flightPeak,
  foldText,
  globalSearchHref,
  propertyCode,
  rankMapMatches,
  readGeocodeResult,
  zoomForBoxFraction,
  type Bounds,
  type Camera,
  type MapSearchProperty,
  type MapSearchTarla,
} from "@/lib/geo/map-search";
import { MAP_TOOL_ICON, MAP_TOOL_LABEL } from "@/components/maps/map-tool-icons";

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const box = (lat: number, lon: number, d = 0.0008) => [
  { lat, lon },
  { lat, lon: lon + d },
  { lat: lat + d / 2, lon: lon + d },
  { lat: lat + d / 2, lon },
];
const P = (n: number, nickname: string | null, corners = box(45.7, 24.4)): MapSearchProperty => ({ id: `p${n}`, code: propertyCode(n), nickname, corners });
const T = (id: string, indicativ: string): MapSearchTarla => ({ id, indicativ, corners: box(45.71, 24.41, 0.004) });

describe("what the box understands (Ask first 1)", () => {
  it("a property's code: 'PROP' and its number padded to five", () => {
    expect([propertyCode(42), propertyCode(12345), propertyCode(123456)]).toEqual(["PROP00042", "PROP12345", "PROP123456"]);
  });

  it.each([
    ["42", "PROP00042"],
    [" 0042 ", "PROP00042"],
    ["PROP00042", "PROP00042"],
    ["prop42", "PROP00042"],
    ["Prop 42", "PROP00042"],
  ])("%j → the property %s", (raw, want) => {
    expect(classifySearch(raw)).toEqual({ kind: "code", code: want });
  });

  it("anything else is text; nothing is nothing; 0 is no property", () => {
    expect(classifySearch("Livada 3")).toEqual({ kind: "text", text: "Livada 3" });
    expect(classifySearch("Strada Florilor 12")).toEqual({ kind: "text", text: "Strada Florilor 12" });
    expect(classifySearch("   ")).toEqual({ kind: "empty" });
    expect(classifySearch("0")).toEqual({ kind: "text", text: "0" });
  });

  it("the code finds the property on the map, or nothing", () => {
    const ps = [P(41, "Unu"), P(42, "Doi"), P(43, "Fără colțuri", [])];
    expect(findByCode("PROP00042", ps)).toMatchObject({ kind: "property", id: "p42", label: "Doi" });
    expect(findByCode("PROP00043", ps)).toBeNull(); // no corners: nothing to frame
    expect(findByCode("PROP00099", ps)).toBeNull();
  });

  it("case and diacritics fold away — ș, ț (comma below), ă, î, â", () => {
    expect(foldText("  Ștefănești  Țarină Mâine Înalt ")).toBe("stefanesti tarina maine inalt");
  });

  it("names: exact, then starts with, then contains; a nickname before a tarla at one level", () => {
    const ps = [P(1, "Livada Mare"), P(2, "Livada"), P(3, "Teren lângă livadă"), P(4, "Arătură")];
    const ts = [T("t1", "Livada"), T("t2", "T35")];
    expect(rankMapMatches("livadă", ps, ts).map((h) => `${h.kind}:${h.label}`)).toEqual([
      "property:Livada", // exact
      "tarla:Livada", // exact, after the nickname
      "property:Livada Mare", // starts with
      "property:Teren lângă livadă", // contains
    ]);
    expect(rankMapMatches("t35", ps, ts).map((h) => h.id)).toEqual(["t2"]);
    expect(rankMapMatches("nimic", ps, ts)).toEqual([]);
  });

  it("a record without corners is never a match: the camera could not frame it", () => {
    expect(rankMapMatches("gol", [P(5, "Gol", [])], [{ id: "t", indicativ: "Gol", corners: [] }])).toEqual([]);
  });
});

describe("a geocoder result, by its location_type (Ask first 2)", () => {
  const viewport: Bounds = { north: 44.45, south: 44.35, east: 26.05, west: 25.95 };
  it.each([
    ["ROOFTOP", "point"],
    ["RANGE_INTERPOLATED", "point"],
    ["GEOMETRIC_CENTER", "area"],
    ["APPROXIMATE", "area"],
  ])("%s → %s", (type, kind) => {
    const r = readGeocodeResult({ geometry: { location: { lat: 44.4, lng: 26 }, location_type: type, viewport } });
    expect(r?.kind).toBe(kind);
    if (r?.kind === "point") expect(r.at).toEqual({ lat: 44.4, lng: 26 });
    if (r?.kind === "area") expect(r.bounds).toEqual(viewport);
  });

  it("reads Google's own objects: lat()/lng() and a viewport's toJSON()", () => {
    const r = readGeocodeResult({
      geometry: { location: { lat: () => 44.4, lng: () => 26 }, location_type: "APPROXIMATE", viewport: { toJSON: () => viewport } },
    });
    expect(r).toEqual({ kind: "area", bounds: viewport });
  });

  it("no result, no location → nothing", () => {
    expect(readGeocodeResult(null)).toBeNull();
    expect(readGeocodeResult(undefined)).toBeNull();
  });

  it("a point lands at zoom 18; an area's viewport fills the map", () => {
    expect(cameraForGeocode({ kind: "point", at: { lat: 44.4, lng: 26 } }, 1366, 768)).toEqual({ center: { lat: 44.4, lng: 26 }, zoom: POINT_ZOOM });
    const area = cameraForGeocode({ kind: "area", bounds: viewport }, 1366, 768);
    expect(area.zoom).toBeCloseTo(zoomForBoxFraction(viewport, 1366, 768, 1), 6);
    expect(area.center.lng).toBeCloseTo(26, 6);
  });
});

describe("the item at a tenth of the map (Ask first 2)", () => {
  // A box's size in pixels at a zoom, in the projection — what the map draws.
  const merc = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return Math.log((1 + s) / (1 - s)) / 2 / 2;
  };
  const pixels = (b: Bounds, zoom: number) => ({
    w: ((b.east - b.west) / 360) * 256 * 2 ** zoom,
    h: ((merc(b.north) - merc(b.south)) / Math.PI) * 256 * 2 ** zoom,
  });

  it.each([
    [1366, 768],
    [1920, 1080],
  ])("on %i × %i: the binding side is 10 %, the other no more", (w, h) => {
    for (const corners of [box(45.7, 24.4), box(45.7, 24.4, 0.01), [{ lat: 45.7, lon: 24.4 }, { lat: 45.71, lon: 24.4001 }]]) {
      const cam = cameraForCorners(corners, w, h);
      const lats = corners.map((c) => c.lat);
      const lons = corners.map((c) => c.lon);
      const px = pixels({ north: Math.max(...lats), south: Math.min(...lats), east: Math.max(...lons), west: Math.min(...lons) }, cam.zoom);
      const share = Math.max(px.w / w, px.h / h);
      expect(share).toBeCloseTo(0.1, 3);
      expect(px.w / w).toBeLessThanOrEqual(0.1 + 1e-9);
      expect(px.h / h).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it("the centre is the box's; a point property at zoom 18", () => {
    const cam = cameraForCorners(box(45.7, 24.4), 1366, 768);
    expect(cam.center.lng).toBeCloseTo(24.4004, 6);
    expect(cam.center.lat).toBeCloseTo(45.7002, 4);
    expect(cameraForCorners([{ lat: 45.7, lon: 24.4 }], 1366, 768)).toEqual({ center: { lat: 45.7, lng: 24.4 }, zoom: POINT_ZOOM });
  });
});

describe("the flight (Ask first 3)", () => {
  const from: Camera = { center: { lat: 44.4, lng: 26.1 }, zoom: 12 };
  const to: Camera = { center: { lat: 45.7, lng: 24.4 }, zoom: 17 };

  it("4 s; none under prefers-reduced-motion — the camera jumps", () => {
    expect(FLIGHT_MS).toBe(4000);
    expect([flightMs(false), flightMs(true)]).toEqual([4000, 0]);
    expect(cameraAt(0, from, to, 7, 0)).toEqual(to);
  });

  it("ease-in-out: slow at both ends, half way at the middle", () => {
    expect([easeInOut(0), easeInOut(0.5), easeInOut(1)]).toEqual([0, 0.5, 1]);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });

  it("far apart: it zooms out first, so the path is seen; never above either end", () => {
    const peak = flightPeak(from, to, 1366, 768);
    expect(peak).toBeLessThan(from.zoom);
    const near: Camera = { center: { lat: 44.4005, lng: 26.1005 }, zoom: 17 };
    expect(flightPeak(from, near, 1366, 768)).toBe(from.zoom);
  });

  it("the camera at 0, 2 and 4 s", () => {
    const peak = flightPeak(from, to, 1366, 768);
    const at0 = cameraAt(0, from, to, peak);
    expect(at0.center.lat).toBeCloseTo(from.center.lat, 9);
    expect(at0.center.lng).toBeCloseTo(from.center.lng, 9);
    expect(at0.zoom).toBeCloseTo(from.zoom, 9);
    const at2 = cameraAt(2000, from, to, peak);
    expect(at2.zoom).toBeCloseTo(peak, 6); // the lowest point, half way
    expect(at2.center.lng).toBeCloseTo((from.center.lng + to.center.lng) / 2, 6);
    expect(at2.center.lat).toBeGreaterThan(Math.min(from.center.lat, to.center.lat));
    expect(at2.center.lat).toBeLessThan(Math.max(from.center.lat, to.center.lat));
    expect(cameraAt(4000, from, to, peak)).toEqual(to);
    expect(cameraAt(9000, from, to, peak)).toEqual(to);
  });

  it("no dip when the two ends already fit: the zoom goes straight across", () => {
    const a: Camera = { center: { lat: 45.7, lng: 24.4 }, zoom: 14 };
    const b: Camera = { center: { lat: 45.7001, lng: 24.4001 }, zoom: 18 };
    const peak = flightPeak(a, b, 1366, 768);
    expect(cameraAt(2000, a, b, peak).zoom).toBeCloseTo(16, 6);
  });
});

describe("the box on the map (Ask first 4–6)", () => {
  const MAP = code(read("src", "app", "properties", "map", "property-map.tsx"));
  const PANEL = code(read("src", "components", "maps", "map-search-panel.tsx"));

  it("the button is the map's table's — the Lucide Search, „Caută pe hartă”, first in the toolbar row", () => {
    expect(MAP_TOOL_LABEL.search).toBe("map.searchButton");
    expect(MAP_TOOL_ICON.search.displayName ?? "").toMatch(/Search/);
    const row = MAP.slice(MAP.indexOf("<div data-map-ui className=\"absolute top-3 right-3"));
    expect(row.indexOf("MAP_TOOL_ICON.search")).toBeGreaterThan(0);
    expect(row.indexOf("MAP_TOOL_ICON.search")).toBeLessThan(row.indexOf("MAP_TOOL_ICON.angles"));
    expect(row.indexOf("<MapSearchPanel")).toBeLessThan(row.indexOf("MAP_TOOL_ICON.angles"));
  });

  it("the map's own data first; one Geocoder look-up, region RO, biased to the view; never Places", () => {
    expect(MAP).toContain('new Geocoder().geocode({ address: q.text, region: "RO", bounds })');
    expect(MAP.indexOf("rankMapMatches(")).toBeLessThan(MAP.indexOf("new Geocoder()"));
    expect(MAP).not.toMatch(/importLibrary\("places"\)|PlacesService|Autocomplete/);
    expect(MAP).toContain("map.moveCamera(cameraAt(t, from, to, peak, duration))");
    expect(MAP).toContain('map.addListener("dragstart", userMoved)');
    expect(MAP).toContain('div.addEventListener("wheel", userMoved, { passive: true })');
  });

  it("the message above the box links „Căutarea globală”, with the typed text; Escape closes", () => {
    expect(PANEL).toContain('t.rich("intro", { link: globalLink })');
    expect(PANEL).toContain("globalSearchHref(outcome?.text ?? text)");
    expect(PANEL).toMatch(/e\.key === "Escape"\) onClose\(\)/);
    expect(globalSearchHref(" Livada ")).toBe("/admin/global-search?search=Livada");
    expect(globalSearchHref("")).toBe("/admin/global-search");
  });

  it("both languages carry the box's sentences, the link tag in both", () => {
    for (const f of ["ro-RO.json", "en-GB.json"]) {
      const m = JSON.parse(read("messages", f)).property.map;
      expect([f, typeof m.searchButton, typeof m.searchHint]).toEqual([f, "string", "string"]);
      for (const k of ["intro", "inputLabel", "placeholder", "submit", "searching", "notFound", "failed", "more"]) {
        expect([f, k, typeof m.search[k]]).toEqual([f, k, "string"]);
      }
      expect(m.search.intro).toMatch(/<link>[^<]+<\/link>/);
      expect(m.search.more).toMatch(/<link>[^<]+<\/link>/);
    }
    const ro = JSON.parse(read("messages", "ro-RO.json")).property.map;
    expect(ro.searchButton).toBe("Caută pe hartă");
    expect(ro.search.intro).toBe(
      "Această căutare găsește un singur loc: o adresă, un nume de pe hartă sau numărul unei proprietăți. Pentru mai multe proprietăți deodată, folosiți <link>Căutarea globală</link>.",
    );
  });
});
