import {
  resolveHelpScreenKey,
  isHelpOptedOut,
  HELP_OPTED_OUT,
} from "@/lib/help/route-map";
import { isHelpScreenKey } from "@/lib/help/registry";

describe("resolveHelpScreenKey", () => {
  describe("home and opted-out routes", () => {
    it("resolves the home page to the dashboard screen", () => {
      expect(resolveHelpScreenKey("/")).toBe("dashboard");
    });

    it.each(HELP_OPTED_OUT)("returns null for the opted-out route %s", (route) => {
      expect(resolveHelpScreenKey(route)).toBeNull();
      expect(isHelpOptedOut(route)).toBe(true);
    });

    it("treats a sub-path of an opted-out route as opted out", () => {
      expect(isHelpOptedOut("/login/callback")).toBe(true);
    });

    it("does not opt out a route that merely shares a prefix string", () => {
      expect(isHelpOptedOut("/signup-review")).toBe(false);
    });
  });

  describe("entity lists", () => {
    it.each([
      ["/properties", "properties-list"],
      ["/documents", "documents-list"],
      ["/natural-persons", "natural-persons-list"],
      ["/judicial-persons", "judicial-persons-list"],
    ])("%s -> %s", (path, expected) => {
      expect(resolveHelpScreenKey(path)).toBe(expected);
    });
  });

  describe("entity detail and new share one key", () => {
    it.each([
      ["/properties/[id]", "property-detail"],
      ["/properties/new", "property-detail"],
      ["/documents/[id]", "document-detail"],
      ["/documents/new", "document-detail"],
      ["/natural-persons/[id]", "natural-person-detail"],
      ["/natural-persons/new", "natural-person-detail"],
      ["/judicial-persons/[id]", "judicial-person-detail"],
      ["/judicial-persons/new", "judicial-person-detail"],
    ])("%s -> %s", (path, expected) => {
      expect(resolveHelpScreenKey(path)).toBe(expected);
    });

    it("resolves a real uuid the same way as the [id] placeholder", () => {
      const uuid = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
      expect(resolveHelpScreenKey(`/properties/${uuid}`)).toBe("property-detail");
    });
  });

  describe("the map is its own screen, not a property detail", () => {
    it("/properties/map -> properties-map", () => {
      expect(resolveHelpScreenKey("/properties/map")).toBe("properties-map");
    });
  });

  describe("association sub-pages win over the parent detail route", () => {
    it.each([
      ["/properties/[id]/associate-person", "associate-person"],
      ["/properties/[id]/associate-document", "associate-document"],
      ["/properties/[id]/associate-reference", "associate-reference"],
      ["/documents/[id]/associate-property", "associate-property"],
      ["/documents/[id]/associate-party", "associate-party"],
      ["/natural-persons/[id]/associate-document", "associate-document"],
      ["/judicial-persons/[id]/associate-property", "associate-property"],
    ])("%s -> %s", (path, expected) => {
      expect(resolveHelpScreenKey(path)).toBe(expected);
    });
  });

  describe("administration", () => {
    it.each([
      ["/admin/value-lists", "admin-value-lists"],
      ["/admin/import", "admin-import"],
      ["/admin/doc-type-engine", "admin-doc-type-engine"],
      ["/admin/tags", "admin-tags"],
      ["/admin/settings", "admin-settings"],
      ["/admin/users", "admin-users"],
      ["/admin/global-search", "admin-global-search"],
      ["/admin/help-content", "admin-help-content"],
      ["/admin/groups", "admin-groups"],
      ["/admin/groups/[id]", "admin-group-editor"],
      ["/admin/stamps", "admin-stamps"],
      ["/admin/stamps/[id]", "admin-stamp-applicator"],
      ["/admin/calculation", "admin-calculation"],
      ["/admin/calculation/history", "admin-calculation-history"],
      ["/admin/calculation/history/[id]", "admin-calculation-run"],
    ])("%s -> %s", (path, expected) => {
      expect(resolveHelpScreenKey(path)).toBe(expected);
    });

    it("returns null for an unknown admin sub-route", () => {
      expect(resolveHelpScreenKey("/admin/not-a-real-screen")).toBeNull();
    });
  });

  describe("normalisation", () => {
    it("ignores a trailing slash", () => {
      expect(resolveHelpScreenKey("/properties/")).toBe("properties-list");
    });

    it("ignores query strings and hashes", () => {
      expect(resolveHelpScreenKey("/properties?page=3")).toBe("properties-list");
      expect(resolveHelpScreenKey("/properties#top")).toBe("properties-list");
    });

    it("tolerates a missing leading slash", () => {
      expect(resolveHelpScreenKey("properties")).toBe("properties-list");
    });
  });

  describe("every resolved key is actually registered", () => {
    const routes = [
      "/",
      "/properties",
      "/properties/map",
      "/properties/new",
      "/properties/[id]",
      "/documents",
      "/documents/new",
      "/documents/[id]",
      "/natural-persons",
      "/natural-persons/new",
      "/natural-persons/[id]",
      "/judicial-persons",
      "/judicial-persons/new",
      "/judicial-persons/[id]",
      "/properties/[id]/associate-person",
      "/documents/[id]/associate-party",
      "/admin/value-lists",
      "/admin/import",
      "/admin/doc-type-engine",
      "/admin/calculation",
      "/admin/calculation/history",
      "/admin/calculation/history/[id]",
      "/admin/groups",
      "/admin/groups/[id]",
      "/admin/stamps",
      "/admin/stamps/[id]",
      "/admin/tags",
      "/admin/settings",
      "/admin/users",
      "/admin/global-search",
      "/admin/help-content",
    ];

    it.each(routes)("%s resolves to a key present in HELP_SCREENS", (route) => {
      const key = resolveHelpScreenKey(route);
      expect(key).not.toBeNull();
      expect(isHelpScreenKey(key as string)).toBe(true);
    });
  });
});
