/**
 * Slice #39.14 — Google maps are blocked in e2e by default, and every runner
 * result counts the real ones.
 *
 * Pins the pure parts: which URLs are Google Maps (`e2e/helpers/google-maps.ts`),
 * the runner's log and note (`scripts/test-runner/protocol.ts`), and the two
 * source facts that keep the block in force — every spec takes `test` from the
 * fixture, and every opt-in is the one visible line with its reason.
 */

import fs from "fs";
import path from "path";
import vm from "vm";

import {
  MAP_COUNTER_BINDING,
  googleCounterScript,
  isAddressLookupUrl,
  isGoogleMapsUrl,
  isMapsLoaderUrl,
  isStreetViewUrl,
  type GoogleAllow,
} from "../../e2e/helpers/google-maps";
import {
  ADDRESS_LOOKUPS_CEILING_ENV,
  ADDRESS_LOOKUPS_FREE_PER_MONTH,
  ADDRESS_LOOKUPS_MONTHLY_CEILING,
  MAPS_CEILING_ENV,
  MAPS_FREE_PER_MONTH,
  MAPS_MONTHLY_CEILING,
  STREET_VIEW_CEILING_ENV,
  STREET_VIEW_FREE_PER_MONTH,
  STREET_VIEW_MONTHLY_CEILING,
  addToMapsLedger,
  extraCeiling,
  extraCeilingSkipReason,
  extraUsed,
  extrasInLog,
  mapsCeiling,
  mapsCeilingSkipReason,
  mapsInLog,
  mapsMonth,
  mapsNote,
  mapsUsed,
  parseMapsLedger,
  parseMapsLog,
  streetViewLookupsNote,
  type MapsLedger,
  type MapsLogLine,
} from "../../scripts/test-runner/protocol";

const ROOT = process.cwd();
const E2E = path.join(ROOT, "e2e");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "helpers" || e.name === "fixtures" || e.name.startsWith(".")) continue;
      out.push(...walk(p));
    } else if (e.name.endsWith(".ts")) out.push(p);
  }
  return out;
}
const rel = (p: string) => path.relative(E2E, p).replace(/\\/g, "/");

describe("isGoogleMapsUrl — what the fixture aborts", () => {
  it.each([
    "https://maps.googleapis.com/maps/api/js?key=K&v=weekly&callback=x",
    "https://maps.googleapis.com/maps/api/js/AuthenticationService.Authenticate?1shttp",
    "https://maps.googleapis.com/maps/vt?pb=!1m5",
    "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi3.png",
    "https://khms0.googleapis.com/kh?v=979&hl=ro",
    "https://khms.googleapis.com/kh?v=979",
    "https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=x",
    "https://maps.google.com/maps?ll=44.37,25.98",
  ])("blocks %s", (url) => {
    expect(isGoogleMapsUrl(url)).toBe(true);
    expect(isGoogleMapsUrl(new URL(url))).toBe(true);
  });

  it.each([
    "https://fonts.googleapis.com/css2?family=Inter",
    "https://fonts.gstatic.com/s/inter/v1.woff2",
    "https://accounts.google.com/o/oauth2/auth",
    "https://www.google.com/search?q=x",
    "https://maps.googleapis.com.example.com/maps/api/js",
    "http://localhost:3100/properties/map",
    "data:text/plain,maps.googleapis.com",
    "not a url",
  ])("lets %s through", (url) => {
    expect(isGoogleMapsUrl(url)).toBe(false);
  });
});

describe("isMapsLoaderUrl — the script a page fetches to start a map", () => {
  it("is the API's own script, with or without a query", () => {
    expect(isMapsLoaderUrl("https://maps.googleapis.com/maps/api/js?key=K&libraries=marker")).toBe(true);
    expect(isMapsLoaderUrl("https://maps.googleapis.com/maps/api/js")).toBe(true);
  });
  it("is not what that script loads after it", () => {
    expect(isMapsLoaderUrl("https://maps.googleapis.com/maps/api/js/AuthenticationService.Authenticate")).toBe(false);
    expect(isMapsLoaderUrl("https://maps.googleapis.com/maps-api-v3/api/js/58/1/main.js")).toBe(false);
    expect(isMapsLoaderUrl("https://maps.gstatic.com/maps/api/js")).toBe(false);
    expect(isMapsLoaderUrl("nonsense")).toBe(false);
  });
});

const line = (o: Partial<MapsLogLine>): MapsLogLine => ({
  spec: "map/a.spec.ts",
  title: "t",
  realMaps: false,
  maps: 0,
  loaders: 0,
  blocked: 0,
  realStreetView: false,
  realAddressLookups: false,
  streetView: 0,
  streetViewRequests: 0,
  streetViewBlocked: 0,
  addressLookups: 0,
  addressLookupsBlocked: 0,
  ...o,
});

describe("parseMapsLog / mapsNote — the note on the runner's e2e step", () => {
  it("reads one line per test and skips what is not one, never guessing", () => {
    const text = [
      JSON.stringify(line({ spec: "map/a.spec.ts", realMaps: true, maps: 2, loaders: 1 })),
      "",
      "{not json",
      JSON.stringify({ spec: "x", title: "t", realMaps: false, maps: -1, loaders: 0, blocked: 0 }),
      JSON.stringify({ spec: "x", title: "t", realMaps: "no", maps: 0, loaders: 0, blocked: 0 }),
      JSON.stringify(line({ spec: "person/b.spec.ts", blocked: 3 })) + "\r",
    ].join("\n");
    expect(parseMapsLog(text)).toEqual([
      line({ spec: "map/a.spec.ts", realMaps: true, maps: 2, loaders: 1 }),
      line({ spec: "person/b.spec.ts", blocked: 3 }),
    ]);
  });

  it("says „not counted” when there is no file — never zero", () => {
    expect(mapsNote(null)).toMatch(/^Google maps loaded: not counted/);
  });

  it("adds the tests up and names the specs that opted in", () => {
    const note = mapsNote([
      line({ spec: "map/a.spec.ts", realMaps: true, maps: 2, loaders: 1 }),
      line({ spec: "map/a.spec.ts", title: "u", realMaps: true, maps: 1, loaders: 1 }),
      line({ spec: "property/c.spec.ts", realMaps: true, maps: 0, loaders: 0 }),
      line({ spec: "person/b.spec.ts", blocked: 3 }),
    ]);
    expect(note).toBe(
      "Google maps loaded: 3 (Maps JavaScript API fetched 2×; 3 Google Maps requests blocked; " +
        "4 tests, 3 with real maps in 2 specs: map/a.spec.ts, property/c.spec.ts)",
    );
  });

  it("calls out a map made by a spec that did not opt in", () => {
    expect(mapsNote([line({ spec: "person/b.spec.ts", maps: 1 })])).toMatch(
      /maps made by specs that did not opt in: person\/b\.spec\.ts$/,
    );
  });

  it("does not list the specs when nothing was blocked (a measuring run lets every spec through)", () => {
    const many = Array.from({ length: 13 }, (_, i) => line({ spec: `s/${i}.spec.ts`, realMaps: true, maps: 1, loaders: 1 }));
    expect(mapsNote(many)).toBe(
      "Google maps loaded: 13 (Maps JavaScript API fetched 13×; 0 Google Maps requests blocked; 13 tests, 13 with real maps in 13 specs)",
    );
  });
});

describe("the block stays in force", () => {
  const files = walk(E2E);

  it("finds the specs", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("every spec takes `test` from e2e/helpers/test.ts, never straight from @playwright/test", () => {
    const straight = files.filter((f) => /from ["']@playwright\/test["']/.test(fs.readFileSync(f, "utf8"))).map(rel);
    expect(straight).toEqual([]);
  });

  it("is on: e2e/helpers/test.ts blocks by default — false only for a measuring run, never committed so", () => {
    expect(fs.readFileSync(path.join(E2E, "helpers", "test.ts"), "utf8")).toMatch(/^const BLOCK_BY_DEFAULT = true;$/m);
  });

  it("every opt-in is `test.use({ realMaps: true });` — or, since #39.18, realStreetView / realAddressLookups — alone on its line, with the reason", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
        if (!/realMaps|realStreetView|realAddressLookups/.test(l)) continue;
        if (!/^test\.use\(\{ (realMaps|realStreetView|realAddressLookups): true \}\); \/\/ \S.{9,}$/.test(l)) bad.push(`${rel(f)}: ${l.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("a spec that opts in for Street View or look-ups opts in for the map too — both come through the Maps JavaScript API", () => {
    const bad = files
      .filter((f) => {
        const text = fs.readFileSync(f, "utf8");
        return /realStreetView|realAddressLookups/.test(text) && !/^test\.use\(\{ realMaps: true \}\);/m.test(text);
      })
      .map(rel);
    expect(bad).toEqual([]);
  });
});

// ---- Slice #39.16: the tests' monthly ceiling ------------------------------------------

describe("the month's ceiling on the tests' real maps", () => {
  const ledger = (over: Partial<MapsLedger> = {}): MapsLedger => ({ month: "2026-11", maps: 0, streetView: 0, addressLookups: 0, runs: [], ...over });

  it("is 3,000 of Google's free 10,000 — 7,000 left for the people using the app", () => {
    expect(MAPS_MONTHLY_CEILING).toBe(3_000);
    expect(MAPS_FREE_PER_MONTH - MAPS_MONTHLY_CEILING).toBe(7_000);
  });

  it("counts the month the way Google bills it, in US Pacific time", () => {
    // 03:30 UTC on Nov 1 is still the evening of Oct 31 in California (PDT, UTC-7).
    expect(mapsMonth(new Date("2026-11-01T03:30:00Z"))).toBe("2026-10");
    expect(mapsMonth(new Date("2026-11-01T08:00:00Z"))).toBe("2026-11");
    // In winter, PST is UTC-8.
    expect(mapsMonth(new Date("2027-01-01T07:59:00Z"))).toBe("2026-12");
  });

  it("adds a run once, and starts a new month at zero", () => {
    const a = addToMapsLedger(null, "2026-11", "r1", 24);
    expect(a).toEqual({ month: "2026-11", maps: 24, streetView: 0, addressLookups: 0, runs: ["r1"] });
    expect(addToMapsLedger(a, "2026-11", "r1", 24)).toEqual(a);
    expect(addToMapsLedger(a, "2026-11", "r2", 4)).toEqual({ month: "2026-11", maps: 28, streetView: 0, addressLookups: 0, runs: ["r1", "r2"] });
    expect(addToMapsLedger(a, "2026-12", "r3", 2)).toEqual({ month: "2026-12", maps: 2, streetView: 0, addressLookups: 0, runs: ["r3"] });
    expect(addToMapsLedger(a, "2026-11", "r4", -1)).toEqual(a);
    expect(mapsUsed(a, "2026-12")).toBe(0);
  });

  it("is not reached below 3,000, and every result says how much of the month is used", () => {
    const c = mapsCeiling(ledger({ maps: 2_999 }), "2026-11");
    expect(c.reached).toBe(false);
    expect(c.note).toBe(
      "Google maps this month (2026-11): 2,999 of the tests' ceiling of 3,000 — Google's free 10,000 are shared with the people using the app",
    );
  });

  it("is reached at 3,000 — and a ledger from last month counts as nothing", () => {
    expect(mapsCeiling(ledger({ maps: 3_000 }), "2026-11").reached).toBe(true);
    expect(mapsCeiling(ledger({ maps: 3_000 }), "2026-12").reached).toBe(false);
    expect(mapsCeiling(null, "2026-11")).toMatchObject({ reached: false, used: 0 });
  });

  it("names a hand-written starting count for what it is", () => {
    const c = mapsCeiling(
      ledger({ month: "2026-10", maps: 14_800, seeded: { maps: 14_600, note: "October's runs before the count existed" } }),
      "2026-10",
    );
    expect(c.reached).toBe(true);
    expect(c.note).toContain("14,800 (14,600 of them estimated: October's runs before the count existed)");
    expect(c.note).toContain("real maps are blocked for every test and the map specs are skipped");
  });

  it("the skip reason names the ceiling and where it is set", () => {
    expect(mapsCeilingSkipReason(3_012, "2026-11")).toBe(
      "Google maps ceiling reached: the tests made 3,012 real maps in 2026-11, and allow themselves 3,000 a month (scripts/test-runner/protocol.ts → MAPS_MONTHLY_CEILING)",
    );
  });

  it("adds up a run's log", () => {
    expect(mapsInLog([])).toBe(0);
    const l = (maps: number): MapsLogLine => line({ spec: "s", realMaps: true, maps });
    expect(mapsInLog([l(2), l(0), l(22)])).toBe(24);
  });

  it("reads a ledger back, and refuses one that is not", () => {
    const good = { month: "2026-10", maps: 5, streetView: 2, addressLookups: 1, runs: ["a"], seeded: { maps: 3, note: "n" } };
    expect(parseMapsLedger("﻿" + JSON.stringify(good))).toEqual(good);
    // A ledger written before #39.18 — October's, on Adrian's laptop — reads zero for the two new counts.
    expect(parseMapsLedger(JSON.stringify({ month: "2026-10", maps: 5, runs: ["a"] }))).toEqual({
      month: "2026-10",
      maps: 5,
      streetView: 0,
      addressLookups: 0,
      runs: ["a"],
    });
    expect(parseMapsLedger(JSON.stringify({ ...good, streetView: -1 }))).toBeNull();
    expect(parseMapsLedger(JSON.stringify({ ...good, addressLookups: "2" }))).toBeNull();
    expect(parseMapsLedger("{")).toBeNull();
    expect(parseMapsLedger(JSON.stringify({ ...good, month: "Oct" }))).toBeNull();
    expect(parseMapsLedger(JSON.stringify({ ...good, maps: -1 }))).toBeNull();
    expect(parseMapsLedger(JSON.stringify({ ...good, runs: [1] }))).toBeNull();
  });

  it("the fixture lets no real map through once the ceiling is set, and skips — never fails — a spec that opted in", () => {
    const code = fs
      .readFileSync(path.join(E2E, "helpers", "test.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/const ceilingReached = process\.env\[MAPS_CEILING_ENV\];/);
    expect(code).toMatch(/const letThrough = \(realMaps \|\| !BLOCK_BY_DEFAULT\) && !ceilingReached;/);
    expect(code).toMatch(/const skipFor = \(realMaps && ceilingReached\) \|\| [^;]*;\s*if \(skipFor\) \{[\s\S]*?testInfo\.skip\(true, skipFor\);/);
    expect(MAPS_CEILING_ENV).toBe("E2E_MAPS_CEILING");
  });

  it("the runner decides the ceiling before the run and adds every run's maps to the month after it", () => {
    const code = fs
      .readFileSync(path.join(ROOT, "scripts", "test-runner", "runner.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/if \(ceiling\.reached\) env\[MAPS_CEILING_ENV\] = mapsCeilingSkipReason\(ceiling\.used, month\);/);
    expect(code).toMatch(/notes\.push\(\.\.\.recordMaps\(month, runId, made\)\);/);
  });
});

// ---- Slice #39.18: Street View panoramas and address look-ups -----------------------------------

describe("isStreetViewUrl / isAddressLookupUrl — Google's two other charges, by request", () => {
  it.each([
    "https://streetviewpixels-pa.googleapis.com/v1/tile?panoid=x&x=0&y=0&zoom=1",
    "https://cbk0.googleapis.com/cbk?output=tile",
    "https://maps.googleapis.com/maps/api/js/GeoPhotoService.GetMetadata?pb=x",
    "https://maps.googleapis.com/maps/api/js/GeoPhotoService.SingleImageSearch?pb=x",
    "https://maps.google.com/maps/photometa/v1?authuser=0",
  ])("Street View: %s", (url) => {
    expect(isStreetViewUrl(url)).toBe(true);
    expect(isAddressLookupUrl(url)).toBe(false);
  });

  it.each([
    "https://maps.googleapis.com/maps/api/js/GeocodeService.Search?5m2&callback=x",
    "https://maps.googleapis.com/maps/api/geocode/json?latlng=44.4,26.1",
  ])("address look-up: %s", (url) => {
    expect(isAddressLookupUrl(url)).toBe(true);
    expect(isStreetViewUrl(url)).toBe(false);
  });

  it.each([
    "https://maps.googleapis.com/maps/api/js?key=K",
    "https://maps.googleapis.com/maps/vt?pb=!1m5",
    "https://maps.googleapis.com/maps/api/js/AuthenticationService.Authenticate",
    "https://khms0.googleapis.com/kh?v=979",
    "https://fonts.googleapis.com/css2?family=Inter",
    "http://localhost:3100/properties/1",
    "not a url",
  ])("neither: %s", (url) => {
    expect(isStreetViewUrl(url)).toBe(false);
    expect(isAddressLookupUrl(url)).toBe(false);
  });

  it("every Street View and look-up request is also a Google Maps request, so a spec without realMaps blocks it already", () => {
    for (const url of [
      "https://streetviewpixels-pa.googleapis.com/v1/tile",
      "https://maps.googleapis.com/maps/api/js/GeoPhotoService.GetMetadata",
      "https://maps.googleapis.com/maps/api/js/GeocodeService.Search",
      "https://maps.google.com/maps/photometa/v1",
    ]) {
      expect(isGoogleMapsUrl(url)).toBe(true);
    }
  });
});

/**
 * The page-side counter, run against a stand-in `google.maps` shaped the way the app meets the real one: the
 * bootstrap's `importLibrary` first, the API's classes and real `importLibrary` assigned later, and the app taking
 * `StreetViewPanorama` and `Geocoder` from `importLibrary` (street-view-panel-inner.tsx, property-form.tsx).
 */
type Page = { reports: string[]; geocoded: number; run: (code: string) => Promise<unknown> };
function page(allow: GoogleAllow): Page {
  const reports: string[] = [];
  const counter = { geocoded: 0 };
  const ctx = vm.createContext({ setTimeout, __count: () => counter.geocoded++ });
  vm.runInContext("var window = globalThis;", ctx);
  (ctx as Record<string, unknown>)[MAP_COUNTER_BINDING] = (kind?: string) => reports.push(kind ?? "map");
  vm.runInContext(googleCounterScript(allow), ctx);
  // The bootstrap, as @vis.gl/react-google-maps installs it: google, google.maps, then a deferring importLibrary.
  vm.runInContext(
    `var g = window.google || (window.google = {});
     var ns = g.maps || (g.maps = {});
     var loaded;
     var ready = new Promise((r) => { loaded = r; });
     ns.importLibrary ? 0 : (ns.importLibrary = (name) => ready.then(() => ns.importLibrary(name)));
     // The API arrives: its classes, and the real importLibrary over the bootstrap's.
     class Map {}
     class StreetViewPanorama { constructor(el, opts) { this.opts = opts; } }
     class StreetViewService { getPanorama(req, cb) { cb({ location: { pano: "p1" } }, "OK"); return Promise.resolve({ data: {} }); } }
     class Geocoder { geocode(req) { __count(); return Promise.resolve({ results: [{ formatted_address: "Strada X 1" }] }); } }
     var LIBS = { maps: { Map }, streetView: { StreetViewPanorama, StreetViewService }, geocoding: { Geocoder } };
     var Originals = { Map, StreetViewPanorama, Geocoder };
     setTimeout(() => {
       ns.Map = Map; ns.StreetViewPanorama = StreetViewPanorama; ns.StreetViewService = StreetViewService; ns.Geocoder = Geocoder;
       ns.importLibrary = (name) => Promise.resolve(LIBS[name]);
       loaded();
     }, 0);`,
    ctx,
  );
  return {
    reports,
    get geocoded() {
      return counter.geocoded;
    },
    run: (code: string) => vm.runInContext(`(async () => { ${code} })()`, ctx) as Promise<unknown>,
  };
}

describe("googleCounterScript — what the page counts, and what it stops", () => {
  it("counts a map as before, and each Street View panorama, whichever way the app reached the class", async () => {
    const p = page({ streetView: true, addressLookups: true });
    const same = await p.run(`
      const sv = await google.maps.importLibrary("streetView");
      new sv.StreetViewPanorama({}, { pano: "p1" });
      const a = new google.maps.StreetViewPanorama({}, {});
      new google.maps.Map();
      return a instanceof Originals.StreetViewPanorama && sv.StreetViewPanorama === google.maps.StreetViewPanorama;
    `);
    expect(same).toBe(true);
    expect(p.reports).toEqual(["streetView", "streetView", "map"]);
  });

  it("counts each address look-up, and the free coverage check not at all", async () => {
    const p = page({ streetView: true, addressLookups: true });
    const status = await p.run(`
      const g = await google.maps.importLibrary("geocoding");
      const geocoder = new g.Geocoder();
      const { results } = await geocoder.geocode({ location: { lat: 44.4, lng: 26.1 } });
      await new google.maps.Geocoder().geocode({});
      const sv = await google.maps.importLibrary("streetView");
      return await new Promise((r) => new sv.StreetViewService().getPanorama({}, (d, s) => r(s + ":" + results.length)));
    `);
    expect(status).toBe("OK:1");
    expect(p.reports).toEqual(["addressLookup", "addressLookup"]);
    expect(p.geocoded).toBe(2);
  });

  it("when Street View is not allowed, the coverage check answers UNKNOWN_ERROR — so the app never builds a panorama", async () => {
    const p = page({ streetView: false, addressLookups: true });
    const out = await p.run(`
      const sv = await google.maps.importLibrary("streetView");
      const s = new sv.StreetViewService();
      const viaCallback = await new Promise((r) => s.getPanorama({}, (d, st) => r(String(d) + ":" + st)));
      const viaPromise = await s.getPanorama({}).then(() => "resolved", (e) => e.message);
      return viaCallback + " | " + viaPromise;
    `);
    expect(out).toBe("null:UNKNOWN_ERROR | e2e: Street View is blocked (Slice #39.18)");
    expect(p.reports).toEqual(["streetViewBlocked", "streetViewBlocked"]);
  });

  it("when address look-ups are not allowed, geocode rejects and Google is never asked", async () => {
    const p = page({ streetView: true, addressLookups: false });
    const out = await p.run(`
      const g = await google.maps.importLibrary("geocoding");
      return await new g.Geocoder().geocode({}).then(() => "resolved", (e) => e.message);
    `);
    expect(out).toBe("e2e: address look-ups are blocked (Slice #39.18)");
    expect(p.reports).toEqual(["addressLookupBlocked"]);
    expect(p.geocoded).toBe(0);
  });

  it("leaves the bootstrap's own test alone: importLibrary reads as absent until something installs one", () => {
    const ctx = vm.createContext({});
    vm.runInContext("var window = globalThis;", ctx);
    vm.runInContext(googleCounterScript({ streetView: false, addressLookups: false }), ctx);
    expect(vm.runInContext("window.google = {}; google.maps = {}; Boolean(google.maps.importLibrary)", ctx)).toBe(false);
  });
});

describe("streetViewLookupsNote — the second note on the runner's e2e step", () => {
  it("says „not counted” when there is no file — never zero", () => {
    expect(streetViewLookupsNote(null)).toMatch(/^Street View panoramas · address look-ups: not counted/);
  });

  it("reads a line from before 39.18 as zero and false, and skips one whose new fields are malformed", () => {
    const old = JSON.stringify({ spec: "map/a.spec.ts", title: "t", realMaps: true, maps: 1, loaders: 1, blocked: 0 });
    const bad = JSON.stringify({ ...line({}), streetView: -1 });
    const worse = JSON.stringify({ ...line({}), realStreetView: "yes" });
    expect(parseMapsLog([old, bad, worse].join("\n"))).toEqual([line({ realMaps: true, maps: 1, loaders: 1 })]);
  });

  it("adds both kinds up and names who made them", () => {
    const note = streetViewLookupsNote([
      line({ spec: "property/sv.spec.ts", realMaps: true, realStreetView: true, streetView: 2, streetViewRequests: 9 }),
      line({ spec: "property/geo.spec.ts", realMaps: true, realAddressLookups: true, addressLookups: 1 }),
      line({ spec: "map/a.spec.ts", realMaps: true, streetViewBlocked: 1, addressLookupsBlocked: 2 }),
    ]);
    expect(note).toBe(
      "Street View panoramas: 2 · address look-ups: 1 (9 Street View requests let through; blocked: 1 Street View, 2 look-ups; " +
        "let through for Street View: property/sv.spec.ts; for look-ups: property/geo.spec.ts; " +
        "Street View made by: property/sv.spec.ts; look-ups made by: property/geo.spec.ts)",
    );
  });

  it("is quiet when nothing was made", () => {
    expect(streetViewLookupsNote([line({}), line({ spec: "map/b.spec.ts", realMaps: true })])).toBe(
      "Street View panoramas: 0 · address look-ups: 0 (0 Street View requests let through; blocked: 0 Street View, 0 look-ups; " +
        "let through for Street View: none; for look-ups: none)",
    );
  });

  it("calls out a panorama or a look-up made by a spec that did not opt in for it", () => {
    const note = streetViewLookupsNote([
      line({ spec: "map/a.spec.ts", realMaps: true, streetViewRequests: 3 }),
      line({ spec: "map/b.spec.ts", realMaps: true, addressLookups: 1 }),
    ]);
    expect(note).toMatch(/; ⚠️ Street View made by specs that did not opt in: map\/a\.spec\.ts; ⚠️ address look-ups made by specs that did not opt in: map\/b\.spec\.ts$/);
  });
});

describe("the block by kind — a map spec gets the map, and nothing else", () => {
  const code = fs
    .readFileSync(path.join(E2E, "helpers", "test.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("lets Street View and look-ups through only to a spec that opted in for that kind, under its month's ceiling", () => {
    expect(code).toMatch(/const letStreetView = letThrough && \(realStreetView \|\| !BLOCK_BY_DEFAULT\) && !streetViewCeiling;/);
    expect(code).toMatch(/const letLookups = letThrough && \(realAddressLookups \|\| !BLOCK_BY_DEFAULT\) && !lookupsCeiling;/);
    expect(code).toMatch(/googleCounterScript\(\{ streetView: letStreetView, addressLookups: letLookups \}\)/);
  });

  it("skips — never fails — a spec whose kind's month is used up", () => {
    expect(code).toMatch(/\(realStreetView && streetViewCeiling\) \|\| \(realAddressLookups && lookupsCeiling\)/);
    expect(code).toMatch(/const streetViewCeiling = process\.env\[STREET_VIEW_CEILING_ENV\];/);
    expect(code).toMatch(/const lookupsCeiling = process\.env\[ADDRESS_LOOKUPS_CEILING_ENV\];/);
  });

  it("refuses an opt-in for Street View or look-ups without the map they come through", () => {
    expect(code).toMatch(/if \(\(realStreetView \|\| realAddressLookups\) && !realMaps\) \{\s*throw new Error\(/);
  });
});

describe("the month's ceilings on Street View panoramas and address look-ups", () => {
  const ledger = (over: Partial<MapsLedger> = {}): MapsLedger => ({ month: "2026-11", maps: 0, streetView: 0, addressLookups: 0, runs: [], ...over });

  it("is 30 % of each kind's own free allowance — the share 39.16 gave the maps", () => {
    expect(STREET_VIEW_FREE_PER_MONTH).toBe(5_000);
    expect(STREET_VIEW_MONTHLY_CEILING).toBe(1_500);
    expect(ADDRESS_LOOKUPS_FREE_PER_MONTH).toBe(10_000);
    expect(ADDRESS_LOOKUPS_MONTHLY_CEILING).toBe(3_000);
    expect(MAPS_MONTHLY_CEILING / MAPS_FREE_PER_MONTH).toBe(0.3);
    expect(STREET_VIEW_MONTHLY_CEILING / STREET_VIEW_FREE_PER_MONTH).toBe(0.3);
    expect(ADDRESS_LOOKUPS_MONTHLY_CEILING / ADDRESS_LOOKUPS_FREE_PER_MONTH).toBe(0.3);
    expect(STREET_VIEW_CEILING_ENV).toBe("E2E_STREET_VIEW_CEILING");
    expect(ADDRESS_LOOKUPS_CEILING_ENV).toBe("E2E_ADDRESS_LOOKUPS_CEILING");
  });

  it("adds each run's panoramas and look-ups to the month, once", () => {
    const a = addToMapsLedger(null, "2026-11", "r1", 4, { streetView: 2, addressLookups: 1 });
    expect(a).toEqual({ month: "2026-11", maps: 4, streetView: 2, addressLookups: 1, runs: ["r1"] });
    expect(addToMapsLedger(a, "2026-11", "r1", 4, { streetView: 2 })).toEqual(a);
    expect(addToMapsLedger(a, "2026-11", "r2", 0, { streetView: -1 })).toEqual(a);
    expect(addToMapsLedger(a, "2026-11", "r2", 0, { addressLookups: 3 })).toMatchObject({ streetView: 2, addressLookups: 4 });
    expect(extraUsed(a, "2026-11", "streetView")).toBe(2);
    expect(extraUsed(a, "2026-12", "streetView")).toBe(0);
  });

  it("October's two new counts start at zero: its ledger was written before them", () => {
    const october = parseMapsLedger(JSON.stringify({ month: "2026-10", maps: 14_598, runs: [], seeded: { maps: 14_598, note: "n" } }));
    expect(extraCeiling(october, "2026-10", "streetView")).toMatchObject({ reached: false, used: 0 });
    expect(extraCeiling(october, "2026-10", "addressLookups")).toMatchObject({ reached: false, used: 0 });
  });

  it("every result says where each kind's month stands", () => {
    expect(extraCeiling(ledger({ streetView: 1_499 }), "2026-11", "streetView")).toEqual({
      reached: false,
      used: 1_499,
      note: "Street View panoramas this month (2026-11): 1,499 of the tests' ceiling of 1,500 — Google's free 5,000 are shared with the people using the app",
    });
    expect(extraCeiling(ledger({ addressLookups: 12 }), "2026-11", "addressLookups").note).toBe(
      "Address look-ups this month (2026-11): 12 of the tests' ceiling of 3,000 — Google's free 10,000 are shared with the people using the app",
    );
  });

  it("is reached at the ceiling, kind by kind — the maps' own ceiling is not the others'", () => {
    const sv = extraCeiling(ledger({ streetView: 1_500 }), "2026-11", "streetView");
    expect(sv.reached).toBe(true);
    expect(sv.note).toBe(
      "Street View panoramas this month (2026-11): 1,500 — the tests' ceiling of 1,500 is reached, so Street View is blocked for every test and the specs that opted in for it are skipped until the month ends",
    );
    expect(extraCeiling(ledger({ streetView: 1_500 }), "2026-11", "addressLookups").reached).toBe(false);
    expect(extraCeiling(ledger({ maps: 99_999 }), "2026-11", "streetView").reached).toBe(false);
    expect(extraCeiling(ledger({ addressLookups: 3_000 }), "2026-11", "addressLookups").note).toContain(
      "address look-ups are blocked for every test and the specs that opted in for them are skipped",
    );
  });

  it("the skip reasons name the ceiling and where it is set", () => {
    expect(extraCeilingSkipReason("streetView", 1_512, "2026-11")).toBe(
      "Street View ceiling reached: the tests made 1,512 Street View panoramas in 2026-11, and allow themselves 1,500 a month (scripts/test-runner/protocol.ts → STREET_VIEW_MONTHLY_CEILING)",
    );
    expect(extraCeilingSkipReason("addressLookups", 3_000, "2026-11")).toBe(
      "Address look-up ceiling reached: the tests made 3,000 address look-ups in 2026-11, and allow themselves 3,000 a month (scripts/test-runner/protocol.ts → ADDRESS_LOOKUPS_MONTHLY_CEILING)",
    );
  });

  it("adds up a run's log, kind by kind", () => {
    expect(extrasInLog([])).toEqual({ streetView: 0, addressLookups: 0 });
    expect(extrasInLog([line({ streetView: 2 }), line({ addressLookups: 3 }), line({ streetView: 1, addressLookups: 1 })])).toEqual({
      streetView: 3,
      addressLookups: 4,
    });
  });

  it("the runner sets each kind's variable from its own ceiling, before the run", () => {
    const runner = fs
      .readFileSync(path.join(ROOT, "scripts", "test-runner", "runner.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(runner).toMatch(/if \(svCeiling\.reached\) env\[STREET_VIEW_CEILING_ENV\] = extraCeilingSkipReason\("streetView", svCeiling\.used, month\);/);
    expect(runner).toMatch(
      /if \(alCeiling\.reached\) env\[ADDRESS_LOOKUPS_CEILING_ENV\] = extraCeilingSkipReason\("addressLookups", alCeiling\.used, month\);/,
    );
  });
});
