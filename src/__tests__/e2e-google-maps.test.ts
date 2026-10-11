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

import { isGoogleMapsUrl, isMapsLoaderUrl } from "../../e2e/helpers/google-maps";
import { mapsNote, parseMapsLog, type MapsLogLine } from "../../scripts/test-runner/protocol";

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

  it("every opt-in is `test.use({ realMaps: true });` with the reason on the same line", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const l of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
        if (!/realMaps/.test(l)) continue;
        if (!/^test\.use\(\{ realMaps: true \}\); \/\/ \S.{9,}$/.test(l)) bad.push(`${rel(f)}: ${l.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
