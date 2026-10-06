/**
 * One „Proprietăți" in the sidebar; the whole map opened from the list.
 *                                                               (Slice #37.92)
 *
 * The sidebar's two property items („Proprietăți — Listă", „Proprietăți —
 * Hartă") are one, „Proprietăți", with the map's icon. /properties/map stays a
 * route: the list's „Hartă completă" opens it, „Proprietăți" is the active
 * item while it is open, and its breadcrumb reads „Proprietăți › Hartă
 * completă", the first segment leading back to the list.
 */
import fs from "node:fs";
import path from "node:path";
import { Map as MapIcon } from "lucide-react";
import { NAV_SECTIONS } from "@/components/sidebar/nav-config";
import { getActiveHref } from "@/components/sidebar/sidebar-helpers";

const read = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
type Messages = {
  nav: { sections: Record<string, string>; items: Record<string, string> };
  navigation: { breadcrumb: Record<string, string> };
  property: Record<string, unknown>;
};
const RO = JSON.parse(read("messages/ro-RO.json")) as Messages;
const EN = JSON.parse(read("messages/en-GB.json")) as Messages;

describe("the sidebar's one property item (#37.92)", () => {
  const hrefs = NAV_SECTIONS.flatMap((s) => [s.href, ...s.items.map((i) => i.href)]);

  it("has no /properties/map item, and one /properties", () => {
    expect(hrefs).not.toContain("/properties/map");
    expect(hrefs.filter((h) => h === "/properties")).toHaveLength(1);
    expect(NAV_SECTIONS.map((s) => s.key)).not.toContain("propertyMap");
  });

  // #38.20: an item of „Domeniu" now, no longer a section of its own.
  it('is „Proprietăți" / „Properties", with the map\'s icon, in „Domeniu"', () => {
    const domain = NAV_SECTIONS.find((s) => s.key === "domain");
    const item = domain?.items.find((i) => i.href === "/properties");
    expect(item?.key).toBe("propertyList");
    expect(item?.icon).toBe(MapIcon);
    expect(RO.nav.items.propertyList).toBe("Proprietăți");
    expect(EN.nav.items.propertyList).toBe("Properties");
  });

  it("drops the map item's words", () => {
    expect(RO.nav.sections.propertyMap).toBeUndefined();
    expect(EN.nav.sections.propertyMap).toBeUndefined();
    expect(RO.nav.items.propertyMap).toBeUndefined();
  });

  it("is the active item on every /properties page, the map's included", () => {
    for (const p of ["/properties", "/properties/map", "/properties/new", "/properties/abc"]) expect([p, getActiveHref(p, NAV_SECTIONS)]).toEqual([p, "/properties"]);
    expect(read("src/components/sidebar/sidebar-nav.tsx")).not.toMatch(/propertyMap|propertyMapHref/);
  });
});

describe('„Hartă completă" (#37.92)', () => {
  it('opens the whole map from the list\'s group, at the left of „Adaugă proprietate"', () => {
    const list = read("src/app/properties/list-view.tsx");
    const opener = list.indexOf('label={t("wholeMap")}');
    const add = list.indexOf('label={t("addNew")}');
    expect(opener).toBeGreaterThan(-1);
    expect(opener).toBeLessThan(add);
    expect(list).toContain('onClick={() => router.push("/properties/map")}');
    expect(RO.property.wholeMap).toBe("Hartă completă");
    expect(EN.property.wholeMap).toBe("Full map");
  });

  it('is the map page\'s breadcrumb, after „Proprietăți"', () => {
    expect(RO.navigation.breadcrumb.properties).toBe("Proprietăți");
    expect(RO.navigation.breadcrumb.propertiesMap).toBe("Hartă completă");
    expect(EN.navigation.breadcrumb.propertiesMap).toBe("Full map");
    expect(read("src/components/breadcrumb-bar.tsx")).toContain('segments.push({ label: t("properties"), href: "/properties" });');
  });
});
