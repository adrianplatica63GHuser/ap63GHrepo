/**
 * Same-browser notices between windows, and the forms' use of the save check.
 *                                                              (Slice #37.21)
 *
 * The pure half of `@/lib/sync/record-sync` — which requests are announced,
 * what a change means for the record on screen, which queries it refetches —
 * and the wiring: the provider is in the root layout, and each of the four
 * entity forms sends its base version, remembers the one it wrote, shows the
 * refusal, and hears the other windows. The browser half is TC-TABS-01.
 */
import fs from "fs";
import path from "path";
import { changeOf, effectOn, refetchesAfterChange } from "@/lib/sync/record-sync";

const ORIGIN = "http://localhost:3000";
const ROOT = process.cwd();
const read = (...p: string[]): string => fs.readFileSync(path.join(ROOT, ...p), "utf8");
const code = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("which requests are announced", () => {
  it("a successful write to this application's own /api/", () => {
    expect(changeOf("PATCH", "/api/people/p1", ORIGIN, true)).toEqual({ method: "PATCH", path: "/api/people/p1" });
    expect(changeOf("delete", `${ORIGIN}/api/documents/d1/persons/l1?x=1`, ORIGIN, true)).toEqual({
      method: "DELETE",
      path: "/api/documents/d1/persons/l1",
    });
    expect(changeOf("POST", "/api/properties/p1/documents", ORIGIN, true)?.method).toBe("POST");
  });

  it("never a read, a failure, a page, or another origin", () => {
    expect(changeOf(undefined, "/api/people/p1", ORIGIN, true)).toBeNull();
    expect(changeOf("GET", "/api/people/p1", ORIGIN, true)).toBeNull();
    expect(changeOf("PATCH", "/api/people/p1", ORIGIN, false)).toBeNull();
    expect(changeOf("POST", "/natural-persons", ORIGIN, true)).toBeNull();
    expect(changeOf("POST", "https://maps.googleapis.com/api/x", ORIGIN, true)).toBeNull();
  });
});

describe("what a change means for the record on screen", () => {
  const RECORD = "/api/people/p1";
  it("its own PATCH is a save, its own DELETE a delete", () => {
    expect(effectOn(RECORD, { method: "PATCH", path: RECORD })).toBe("saved");
    expect(effectOn(RECORD, { method: "DELETE", path: RECORD })).toBe("deleted");
  });
  it("its associations, another record, or a new record: nothing — the refetched tiles show those", () => {
    expect(effectOn(RECORD, { method: "POST", path: `${RECORD}/documents` })).toBeNull();
    expect(effectOn(RECORD, { method: "PATCH", path: "/api/people/p2" })).toBeNull();
    expect(effectOn(RECORD, { method: "POST", path: "/api/people" })).toBeNull();
  });
});

describe("which queries a change refetches", () => {
  it("lists and association tiles, never a version list", () => {
    expect(refetchesAfterChange(["persons"])).toBe(true);
    expect(refetchesAfterChange(["document-persons", "d1"])).toBe(true);
    expect(refetchesAfterChange(["person-versions", "p1"])).toBe(false);
    expect(refetchesAfterChange(["document-versions", "d1"])).toBe(false);
  });
});

describe("the wiring", () => {
  it("the provider sits in the root layout, under the query client", () => {
    expect(code(read("src", "app", "layout.tsx"))).toMatch(/<QueryProvider>\s*<RecordSyncProvider>/);
  });

  const FORMS: [string, string[], string][] = [
    ["the Natural Person", ["src", "app", "natural-persons", "_components", "natural-person-form.tsx"], "/api/people/"],
    ["the Judicial Person", ["src", "app", "judicial-persons", "_components", "judicial-person-form.tsx"], "/api/judicial-persons/"],
    ["the Property", ["src", "app", "properties", "_components", "property-form.tsx"], "/api/properties/"],
    ["the Document", ["src", "app", "documents", "_components", "document-form.tsx"], "/api/documents/"],
  ];

  it.each(FORMS)("%s's form sends its base version, remembers the one it wrote, shows the refusal and the other windows", (_what, file, api) => {
    const src = code(read(...file));
    expect(src).toContain(`recordPath: mode === "create"`);
    expect(src).toContain(api);
    expect(src).toMatch(/baseVersion: recordSync\.baseVersion\(\)/);
    expect(src).toMatch(/await recordSync\.remember\(saved\)/);
    expect(src).toMatch(/if \(recordSync\.refused\(err\)\) return/);
    expect(src).toMatch(/<RecordSyncNotice sync=\{recordSync\}/);
  });
});
