import {
  isItemActive,
  getActiveHref,
  getActiveSectionKey,
} from "@/components/sidebar/sidebar-helpers";

// Minimal nav structure that mirrors the real NAV_SECTIONS shape — no
// lucide-react icons required here, keeping the test dependency-free.
//
// "people", "document", "propertyList", and "propertyMap" are flat-link
// sections (Slices #15.08 / #15.09 / #15.09.2): they have no expandable
// items, so getActiveHref/getActiveSectionKey never resolve them — that
// active-state is computed separately in sidebar-nav.tsx via
// isFlatSectionActive, which isn't covered by these pure helpers.
const MOCK_SECTIONS = [
  {
    key: "people",
    items: [],
  },
  {
    key: "propertyList",
    items: [],
  },
  {
    key: "propertyMap",
    items: [],
  },
  {
    key: "document",
    items: [],
  },
  {
    key: "administration",
    items: [
      { key: "users" },
      { key: "referenceData", href: "/admin/value-lists" },
    ],
  },
];

// ---------------------------------------------------------------------------
// isItemActive
// ---------------------------------------------------------------------------

describe("isItemActive", () => {
  it("matches an exact path", () => {
    expect(isItemActive("/natural-persons", "/natural-persons")).toBe(true);
  });

  it("matches a sub-path (detail page)", () => {
    expect(
      isItemActive("/natural-persons", "/natural-persons/some-uuid"),
    ).toBe(true);
  });

  it("matches a sub-path (new page)", () => {
    expect(isItemActive("/properties", "/properties/new")).toBe(true);
  });

  it("does NOT match an unrelated path", () => {
    expect(isItemActive("/natural-persons", "/properties")).toBe(false);
  });

  it("does NOT match a path that shares a prefix but lacks the separator", () => {
    // /properties must NOT activate for /properties-extra
    expect(isItemActive("/properties", "/properties-extra")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getActiveHref — most-specific-match wins
// ---------------------------------------------------------------------------

describe("getActiveHref", () => {
  it("returns null for /properties/map ('propertyMap' is a flat-link section with no items)", () => {
    expect(getActiveHref("/properties/map", MOCK_SECTIONS)).toBeNull();
  });

  it("returns null for /properties ('propertyList' is a flat-link section with no items)", () => {
    expect(getActiveHref("/properties", MOCK_SECTIONS)).toBeNull();
  });

  it("returns null for a detail page under /properties/", () => {
    expect(getActiveHref("/properties/some-uuid", MOCK_SECTIONS)).toBeNull();
  });

  it("returns null for /natural-persons (flat-link 'people' section has no items)", () => {
    expect(getActiveHref("/natural-persons/abc", MOCK_SECTIONS)).toBeNull();
  });

  it("returns /admin/value-lists for the reference-data page", () => {
    expect(getActiveHref("/admin/value-lists", MOCK_SECTIONS)).toBe(
      "/admin/value-lists",
    );
  });

  it("returns null for a route not in the nav", () => {
    expect(getActiveHref("/unknown/route", MOCK_SECTIONS)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getActiveSectionKey
// ---------------------------------------------------------------------------

describe("getActiveSectionKey", () => {
  it("returns null for /natural-persons (flat-link 'people' section has no items)", () => {
    expect(getActiveSectionKey("/natural-persons", MOCK_SECTIONS)).toBeNull();
  });

  it("returns null for /properties/map ('propertyMap' is a flat-link section with no items)", () => {
    expect(getActiveSectionKey("/properties/map", MOCK_SECTIONS)).toBeNull();
  });

  it("returns null for /properties ('propertyList' is a flat-link section with no items)", () => {
    expect(getActiveSectionKey("/properties", MOCK_SECTIONS)).toBeNull();
  });

  it("identifies the administration section for /admin/value-lists", () => {
    expect(getActiveSectionKey("/admin/value-lists", MOCK_SECTIONS)).toBe(
      "administration",
    );
  });

  it("returns null for an unknown route", () => {
    expect(getActiveSectionKey("/unknown", MOCK_SECTIONS)).toBeNull();
  });
});
