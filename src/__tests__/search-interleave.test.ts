/**
 * Unit tests for the global-search result shaping  (Slice #23.11.search)
 *
 * The headline test is "the original defect cannot come back": 200 matching
 * documents used to erase every property and every person from the response.
 */

import {
  MAX_PAGES,
  MAX_RESULTS,
  PER_TYPE_CAP,
  SEARCH_ENTITY_TYPES,
  SEARCH_PAGE_SIZE,
  capBucket,
  clampPage,
  interleaveByType,
  pageCount,
  pageSlice,
  truncatedTypes,
  type SearchBucket,
  type SearchEntityType,
} from "@/lib/search/interleave";

/** `n` rows of `type`, labelled so order is visible in a failure message. */
function rows(type: SearchEntityType, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${type}-${i + 1}`);
}

function bucket(type: SearchEntityType, n: number, cap = PER_TYPE_CAP): SearchBucket<string> {
  return capBucket(type, rows(type, n), cap);
}

describe("constants", () => {
  it("caps the whole result set at 4 x 50", () => {
    expect(SEARCH_ENTITY_TYPES).toHaveLength(4);
    expect(PER_TYPE_CAP).toBe(50);
    expect(MAX_RESULTS).toBe(200);
  });

  it("allows at most 14 pages — a 15th means a cap is not being applied", () => {
    expect(SEARCH_PAGE_SIZE).toBe(15);
    expect(MAX_PAGES).toBe(14);
    expect(pageCount(MAX_RESULTS)).toBe(MAX_PAGES);
  });

  it("rotates in code-prefix order (DOC < JPERS < PPERS < PROP)", () => {
    expect([...SEARCH_ENTITY_TYPES]).toEqual([
      "DOCUMENT",
      "JUDICIAL_PERSON",
      "NATURAL_PERSON",
      "PROPERTY",
    ]);
  });
});

describe("capBucket — limit + 1 truncation detection", () => {
  it("is not truncated when fewer rows than the cap come back", () => {
    const b = capBucket("DOCUMENT", rows("DOCUMENT", 7));
    expect(b.items).toHaveLength(7);
    expect(b.truncated).toBe(false);
  });

  it("is not truncated at exactly the cap", () => {
    const b = capBucket("DOCUMENT", rows("DOCUMENT", PER_TYPE_CAP));
    expect(b.items).toHaveLength(PER_TYPE_CAP);
    expect(b.truncated).toBe(false);
  });

  it("is truncated at cap + 1, and discards the probe row", () => {
    const b = capBucket("DOCUMENT", rows("DOCUMENT", PER_TYPE_CAP + 1));
    expect(b.items).toHaveLength(PER_TYPE_CAP);
    expect(b.truncated).toBe(true);
    expect(b.items).not.toContain(`DOCUMENT-${PER_TYPE_CAP + 1}`);
  });

  it("handles an empty result set", () => {
    const b = capBucket("PROPERTY", []);
    expect(b.items).toEqual([]);
    expect(b.truncated).toBe(false);
  });

  it("rejects a nonsense cap rather than silently returning everything", () => {
    expect(() => capBucket("PROPERTY", rows("PROPERTY", 3), -1)).toThrow();
    expect(() => capBucket("PROPERTY", rows("PROPERTY", 3), 1.5)).toThrow();
  });
});

describe("interleaveByType", () => {
  it("takes one row of each type per round, in canonical order", () => {
    const merged = interleaveByType([
      bucket("PROPERTY", 2),
      bucket("DOCUMENT", 2),
      bucket("NATURAL_PERSON", 2),
      bucket("JUDICIAL_PERSON", 2),
    ]);
    expect(merged).toEqual([
      "DOCUMENT-1", "JUDICIAL_PERSON-1", "NATURAL_PERSON-1", "PROPERTY-1",
      "DOCUMENT-2", "JUDICIAL_PERSON-2", "NATURAL_PERSON-2", "PROPERTY-2",
    ]);
  });

  it("ignores the order the buckets are passed in", () => {
    const a = interleaveByType([bucket("PROPERTY", 3), bucket("DOCUMENT", 3)]);
    const b = interleaveByType([bucket("DOCUMENT", 3), bucket("PROPERTY", 3)]);
    expect(a).toEqual(b);
  });

  it("drops a type out of the rotation when it runs dry, without a gap", () => {
    const merged = interleaveByType([
      bucket("DOCUMENT", 3),
      bucket("PROPERTY", 1),
    ]);
    expect(merged).toEqual([
      "DOCUMENT-1", "PROPERTY-1",
      "DOCUMENT-2",
      "DOCUMENT-3",
    ]);
  });

  it("keeps each type's own rows in the order they arrived", () => {
    const merged = interleaveByType([bucket("DOCUMENT", 4), bucket("PROPERTY", 4)]);
    const docs = merged.filter((r) => r.startsWith("DOCUMENT"));
    expect(docs).toEqual(["DOCUMENT-1", "DOCUMENT-2", "DOCUMENT-3", "DOCUMENT-4"]);
  });

  it("handles missing types and an all-empty input", () => {
    expect(interleaveByType([bucket("PROPERTY", 2)])).toEqual(["PROPERTY-1", "PROPERTY-2"]);
    expect(interleaveByType([])).toEqual([]);
    expect(interleaveByType([bucket("DOCUMENT", 0), bucket("PROPERTY", 0)])).toEqual([]);
  });

  it("concatenates two buckets of the same type instead of shadowing one", () => {
    const first  = capBucket("NATURAL_PERSON", ["a", "b"]);
    const second = capBucket("NATURAL_PERSON", ["c"]);
    expect(interleaveByType([first, second])).toEqual(["a", "b", "c"]);
  });

  it("loses nothing: every input row appears exactly once", () => {
    const buckets = [
      bucket("DOCUMENT", 50),
      bucket("JUDICIAL_PERSON", 9),
      bucket("NATURAL_PERSON", 23),
      bucket("PROPERTY", 50),
    ];
    const merged = interleaveByType(buckets);
    expect(merged).toHaveLength(50 + 9 + 23 + 50);
    expect(new Set(merged).size).toBe(merged.length);
  });
});

describe("the regression this slice exists for", () => {
  // Before #23.11.search: three queries each LIMIT 200, merged, sorted by
  // code, sliced to 200. With 200+ matching documents the DOC-prefixed codes
  // filled the slice and every property and person vanished silently.
  it("still shows every matching type on page 1 when documents overflow", () => {
    const buckets = [
      capBucket("DOCUMENT", rows("DOCUMENT", 500)),
      capBucket("JUDICIAL_PERSON", rows("JUDICIAL_PERSON", 4)),
      capBucket("NATURAL_PERSON", rows("NATURAL_PERSON", 120)),
      capBucket("PROPERTY", rows("PROPERTY", 80)),
    ];

    const merged = interleaveByType(buckets);
    expect(merged.length).toBeLessThanOrEqual(MAX_RESULTS);

    const firstPage = pageSlice(merged, 0);
    const typesOnPage1 = new Set(firstPage.map((r) => r.split("-")[0]));
    expect(typesOnPage1).toEqual(
      new Set(["DOCUMENT", "JUDICIAL_PERSON", "NATURAL_PERSON", "PROPERTY"]),
    );
  });

  it("names every truncated type, and only those", () => {
    const buckets = [
      capBucket("DOCUMENT", rows("DOCUMENT", 500)),        // truncated
      capBucket("JUDICIAL_PERSON", rows("JUDICIAL_PERSON", 4)),   // not
      capBucket("NATURAL_PERSON", rows("NATURAL_PERSON", 120)),   // truncated
      capBucket("PROPERTY", rows("PROPERTY", PER_TYPE_CAP)),      // exactly at cap: not
    ];
    expect(truncatedTypes(buckets)).toEqual(["DOCUMENT", "NATURAL_PERSON"]);
  });

  it("reports truncated types in canonical order regardless of bucket order", () => {
    const buckets = [
      capBucket("PROPERTY", rows("PROPERTY", 99)),
      capBucket("DOCUMENT", rows("DOCUMENT", 99)),
    ];
    expect(truncatedTypes(buckets)).toEqual(["DOCUMENT", "PROPERTY"]);
  });

  it("reports nothing when no type overflowed", () => {
    expect(truncatedTypes([bucket("DOCUMENT", 3), bucket("PROPERTY", 3)])).toEqual([]);
  });
});

describe("paging over the capped set", () => {
  const full = interleaveByType(
    SEARCH_ENTITY_TYPES.map((t) => capBucket(t, rows(t, PER_TYPE_CAP + 1))),
  );

  it("fills exactly 14 pages from a full result set", () => {
    expect(full).toHaveLength(MAX_RESULTS);
    expect(pageCount(full.length)).toBe(14);
  });

  it("gives a full page everywhere but the last", () => {
    expect(pageSlice(full, 0)).toHaveLength(SEARCH_PAGE_SIZE);
    expect(pageSlice(full, 12)).toHaveLength(SEARCH_PAGE_SIZE);
    expect(pageSlice(full, 13)).toHaveLength(MAX_RESULTS - 13 * SEARCH_PAGE_SIZE);
  });

  it("pages with no gap and no repeat", () => {
    const walked: string[] = [];
    for (let p = 0; p < pageCount(full.length); p++) walked.push(...pageSlice(full, p));
    expect(walked).toEqual(full);
  });

  it("treats an empty result set as page 1 of 1", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageSlice([], 0)).toEqual([]);
  });

  it("clamps a shared ?page= link whose result set has since shrunk", () => {
    expect(clampPage(9, 20)).toBe(1);       // 20 rows = 2 pages
    expect(pageSlice(full.slice(0, 20), 9)).toEqual(full.slice(15, 20));
  });

  it("clamps hostile and malformed page values", () => {
    expect(clampPage(-4, 200)).toBe(0);
    expect(clampPage(Number.NaN, 200)).toBe(0);
    expect(clampPage(Number.POSITIVE_INFINITY, 200)).toBe(13);
    expect(clampPage(Number.NEGATIVE_INFINITY, 200)).toBe(0);
    expect(clampPage(2.9, 200)).toBe(2);
  });

  it("rejects a nonsense page size", () => {
    expect(() => pageCount(10, 0)).toThrow();
    expect(() => pageCount(10, -5)).toThrow();
  });
});
