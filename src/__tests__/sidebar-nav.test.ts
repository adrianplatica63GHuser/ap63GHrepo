import {
  isItemActive,
  getActiveHref,
  getActiveSectionKey,
} from "@/components/sidebar/sidebar-helpers";

// Minimal nav structure that mirrors the real NAV_SECTIONS shape — no
// lucide-react icons required here, keeping the test dependency-free.
const MOCK_SECTIONS = [
  {
    key: "people",
    items: [
      { key: "naturalPerson", href: "/natural-persons" },
      { key: "judicialPerson" },
    ],
  },
  {
    key: "property",
    items: [
      { key: "landList", href: "/properties" },
      { key: "landMap", href: "/properties/map" },
      { key: "building" },
    ],
  },
  {
    key: "paperwork",
    items: [
      { key: "contract" },
      { key: "certificate" },
    ],
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
  it("returns /properties/map (not /properties) on the map page", () => {
    expect(getActiveHref("/properties/map", MOCK_SECTIONS)).toBe(
      "/properties/map",
    );
  });

  it("returns /properties for the list page", () => {
    expect(getActiveHref("/properties", MOCK_SECTIONS)).toBe("/properties");
  });

  it("returns /properties for a detail page under /properties/", () => {
    expect(getActiveHref("/properties/some-uuid", MOCK_SECTIONS)).toBe(
      "/properties",
    );
  });

  it("returns /natural-persons for a detail page under /natural-persons/", () => {
    expect(getActiveHref("/natural-persons/abc", MOCK_SECTIONS)).toBe(
      "/natural-persons",
    );
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
  it("identifies the people section for /natural-persons", () => {
    expect(getActiveSectionKey("/natural-persons", MOCK_SECTIONS)).toBe(
      "people",
    );
  });

  it("identifies the property section for /properties/map", () => {
    expect(getActiveSectionKey("/properties/map", MOCK_SECTIONS)).toBe(
      "property",
    );
  });

  it("identifies the property section for /properties (list)", () => {
    expect(getActiveSectionKey("/properties", MOCK_SECTIONS)).toBe("property");
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
