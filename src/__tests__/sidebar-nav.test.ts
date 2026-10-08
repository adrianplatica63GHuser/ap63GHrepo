import {
  isItemActive,
  getActiveHref,
  getActiveSectionKey,
  isFlatSectionActive,
  sectionsFor,
  USER_HREFS,
} from "@/components/sidebar/sidebar-helpers";

// Minimal nav structure that mirrors the real NAV_SECTIONS shape (Slice
// #38.20's nine sections, cut down) — no lucide-react icons required here,
// keeping the test dependency-free. „Tablou de bord" and „Setări" are flat
// links; the four lists are items of „Domeniu".
const MOCK_SECTIONS = [
  { key: "dashboard", href: "/", items: [] },
  {
    key: "domain",
    items: [
      { key: "naturalPeople", href: "/natural-persons" },
      { key: "judicialPeople", href: "/judicial-persons" },
      { key: "propertyList", href: "/properties" },
      { key: "document", href: "/documents" },
      { key: "referenceData", href: "/admin/value-lists" },
    ],
  },
  {
    key: "functions",
    items: [
      { key: "globalSearch", href: "/admin/global-search" },
      { key: "checkCorrelations" },
    ],
  },
  { key: "reports", items: [{ key: "reportsInProgress", href: "/reports" }] },
  { key: "settings", href: "/admin/settings", items: [] },
  { key: "study", items: [{ key: "courses" }] },
];

// ---------------------------------------------------------------------------
// isItemActive
// ---------------------------------------------------------------------------

describe("isItemActive", () => {
  it("matches an exact path", () => {
    expect(isItemActive("/properties", "/properties")).toBe(true);
  });

  it("matches a sub-path (detail page)", () => {
    expect(isItemActive("/properties", "/properties/abc-123")).toBe(true);
  });

  it("matches a sub-path (new page)", () => {
    expect(isItemActive("/documents", "/documents/new")).toBe(true);
  });

  it("does NOT match an unrelated path", () => {
    expect(isItemActive("/properties", "/documents")).toBe(false);
  });

  it("does NOT match a path that shares a prefix but lacks the separator", () => {
    expect(isItemActive("/properties", "/properties-extra")).toBe(false);
  });

  it("#38.20: „/” matches the dashboard alone, not every path", () => {
    expect(isItemActive("/", "/")).toBe(true);
    expect(isItemActive("/", "/documents")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getActiveHref — most-specific-match wins
// ---------------------------------------------------------------------------

describe("getActiveHref", () => {
  it("„Proprietăți” is the active item on the whole map, and on a property (#37.92)", () => {
    expect(getActiveHref("/properties/map", MOCK_SECTIONS)).toBe("/properties");
    expect(getActiveHref("/properties/some-uuid", MOCK_SECTIONS)).toBe("/properties");
  });

  it("a person's page activates its list", () => {
    expect(getActiveHref("/natural-persons/abc", MOCK_SECTIONS)).toBe("/natural-persons");
  });

  it("returns /admin/value-lists for the reference-data page", () => {
    expect(getActiveHref("/admin/value-lists", MOCK_SECTIONS)).toBe("/admin/value-lists");
  });

  it("returns /reports for the reports page", () => {
    expect(getActiveHref("/reports", MOCK_SECTIONS)).toBe("/reports");
  });

  it("returns null for a route not in the nav, and for a flat link's own page", () => {
    expect(getActiveHref("/unknown/route", MOCK_SECTIONS)).toBeNull();
    expect(getActiveHref("/admin/settings", MOCK_SECTIONS)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getActiveSectionKey
// ---------------------------------------------------------------------------

describe("getActiveSectionKey", () => {
  it("„Domeniu” for the four lists and their records, and for Date de referință", () => {
    for (const p of ["/natural-persons", "/judicial-persons/x", "/properties/map", "/documents/new", "/admin/value-lists"]) {
      expect([p, getActiveSectionKey(p, MOCK_SECTIONS)]).toEqual([p, "domain"]);
    }
  });

  it("„Funcții” for global search; „Rapoarte” for the reports page", () => {
    expect(getActiveSectionKey("/admin/global-search", MOCK_SECTIONS)).toBe("functions");
    expect(getActiveSectionKey("/reports", MOCK_SECTIONS)).toBe("reports");
  });

  it("returns null for an unknown route", () => {
    expect(getActiveSectionKey("/unknown", MOCK_SECTIONS)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The flat links, and who sees what (#38.20)
// ---------------------------------------------------------------------------

describe("isFlatSectionActive", () => {
  it("„Tablou de bord” on / alone; „Setări” on /admin/settings", () => {
    expect(isFlatSectionActive(MOCK_SECTIONS[0], "/")).toBe(true);
    expect(isFlatSectionActive(MOCK_SECTIONS[0], "/documents")).toBe(false);
    expect(isFlatSectionActive(MOCK_SECTIONS[4], "/admin/settings")).toBe(true);
    expect(isFlatSectionActive(MOCK_SECTIONS[1], "/natural-persons")).toBe(false); // not a flat section
  });
});

describe("sectionsFor — full access sees every drawn section; an account without a row, the four lists", () => {
  it("full access sees every section that has something to draw — not one of placeholders only (#38.42)", () => {
    expect(sectionsFor(MOCK_SECTIONS, true).map((s) => s.key)).toEqual(
      MOCK_SECTIONS.filter((s) => s.href || s.items.some((i) => i.href)).map((s) => s.key),
    );
    expect(sectionsFor(MOCK_SECTIONS, true).map((s) => s.key)).not.toContain("study");
  });

  it("anyone else: the dashboard and the four lists — no administration screen, no reports page, no placeholder", () => {
    const seen = sectionsFor(MOCK_SECTIONS, false);
    expect(seen.map((s) => s.key)).toEqual(["dashboard", "domain"]);
    expect(seen[1].items.map((i) => i.href)).toEqual(["/natural-persons", "/judicial-persons", "/properties", "/documents"]);
    expect(USER_HREFS).toEqual(["/", "/natural-persons", "/judicial-persons", "/properties", "/documents"]);
  });

  it("does not change the sections it was given", () => {
    sectionsFor(MOCK_SECTIONS, false);
    expect(MOCK_SECTIONS[1].items).toHaveLength(5);
  });
});
