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
import {
  MAPS_CEILING_ENV,
  MAPS_FREE_PER_MONTH,
  MAPS_MONTHLY_CEILING,
  addToMapsLedger,
  mapsCeiling,
  mapsCeilingSkipReason,
  mapsInLog,
  mapsMonth,
  mapsNote,
  mapsUsed,
  parseMapsLedger,
  parseMapsLog,
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

// ---- Slice #39.16: the tests' monthly ceiling ------------------------------------------

describe("the month's ceiling on the tests' real maps", () => {
  const ledger = (over: Partial<MapsLedger> = {}): MapsLedger => ({ month: "2026-11", maps: 0, runs: [], ...over });

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
    expect(a).toEqual({ month: "2026-11", maps: 24, runs: ["r1"] });
    expect(addToMapsLedger(a, "2026-11", "r1", 24)).toEqual(a);
    expect(addToMapsLedger(a, "2026-11", "r2", 4)).toEqual({ month: "2026-11", maps: 28, runs: ["r1", "r2"] });
    expect(addToMapsLedger(a, "2026-12", "r3", 2)).toEqual({ month: "2026-12", maps: 2, runs: ["r3"] });
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
    const l = (maps: number): MapsLogLine => ({ spec: "s", title: "t", realMaps: true, maps, loaders: 0, blocked: 0 });
    expect(mapsInLog([l(2), l(0), l(22)])).toBe(24);
  });

  it("reads a ledger back, and refuses one that is not", () => {
    const good = { month: "2026-10", maps: 5, runs: ["a"], seeded: { maps: 3, note: "n" } };
    expect(parseMapsLedger("﻿" + JSON.stringify(good))).toEqual(good);
    expect(parseMapsLedger(JSON.stringify({ month: "2026-10", maps: 5, runs: ["a"] }))).toEqual({ month: "2026-10", maps: 5, runs: ["a"] });
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
    expect(code).toMatch(/if \(realMaps && ceilingReached\) \{[\s\S]*?testInfo\.skip\(true, ceilingReached\);/);
    expect(MAPS_CEILING_ENV).toBe("E2E_MAPS_CEILING");
  });

  it("the runner decides the ceiling before the run and adds every run's maps to the month after it", () => {
    const code = fs
      .readFileSync(path.join(ROOT, "scripts", "test-runner", "runner.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(code).toMatch(/if \(ceiling\.reached\) env\[MAPS_CEILING_ENV\] = mapsCeilingSkipReason\(ceiling\.used, month\);/);
    expect(code).toMatch(/notes\.push\(recordMaps\(month, runId, mapsMade\)\);/);
  });
});
