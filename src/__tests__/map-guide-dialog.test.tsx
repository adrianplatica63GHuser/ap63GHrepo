/**
 * Slice #39.78 — „Instrumente → Măsurători pe hartă / Grupări de proprietăți / Navigare": each box draws the big
 * map's own buttons (their icons and names from map-tool-icons.ts, NAVIGATE_ICON) with a sentence on each; OK on the
 * first two opens the map with the set pulsing, OK on „Navigare" only closes; the box opens every time.
 *
 * next-intl is replaced by a lookup in the real ro-RO.json, so a key the box asks for that the file lacks fails here
 * rather than showing its raw name.
 */
import type { ReactNode } from "react";
import fs from "fs";
import path from "path";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { MapGuideDialog, guideHref, guideTools } from "@/components/sidebar/map-guide-dialog";
import { MAP_TOOL_ICON } from "@/components/maps/map-tool-icons";
import { NAVIGATE_ICON } from "@/components/maps/navigate-dialog";
import { PULSE_SETS } from "@/lib/ui/area-pulse";

type Tree = { [k: string]: string | Tree };
const RO = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "ro-RO.json"), "utf8")) as Tree;
const mockRO = RO;
const EN = JSON.parse(fs.readFileSync(path.join(process.cwd(), "messages", "en-GB.json"), "utf8")) as Tree;
function mockAt(tree: Tree, dotted: string): string {
  let cur: string | Tree = tree;
  for (const part of dotted.split(".")) {
    if (typeof cur === "string" || !(part in cur)) throw new Error(`missing message ${dotted}`);
    cur = cur[part]!;
  }
  if (typeof cur !== "string") throw new Error(`not a string: ${dotted}`);
  return cur;
}
const at = mockAt;

jest.mock("next-intl", () => ({
  useTranslations: (ns: string) => (key: string) => mockAt(mockRO, `${ns}.${key}`),
}));
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const SOURCE = fs.readFileSync(path.join(process.cwd(), "src", "components", "sidebar", "map-guide-dialog.tsx"), "utf8");
const NAV = fs.readFileSync(path.join(process.cwd(), "src", "components", "sidebar", "sidebar-nav.tsx"), "utf8");

describe("what each guide is about", () => {
  it("measure and groups are the pulse's own sets; navigation is „Navighează” alone", () => {
    expect(guideTools("measure")).toBe(PULSE_SETS.measure);
    expect(guideTools("groups")).toBe(PULSE_SETS.groups);
    expect(guideTools("navigation")).toEqual([]);
  });
  it("OK goes to the map with the set named — or nowhere, for „Navigare” (Ask first 4)", () => {
    expect(guideHref("measure")).toBe("/properties/map?pulse=measure");
    expect(guideHref("groups")).toBe("/properties/map?pulse=groups");
    expect(guideHref("navigation")).toBeNull();
  });
  it("every sentence exists in both languages", () => {
    for (const tree of [RO, EN]) {
      for (const k of ["ok", "close", "opensMap"]) expect(at(tree, `nav.guides.${k}`)).toBeTruthy();
      for (const g of ["measure", "groups"] as const) {
        for (const k of ["title", "intro", ...PULSE_SETS[g]]) expect(at(tree, `nav.guides.${g}.${k}`)).toBeTruthy();
      }
      for (const k of ["title", "intro", "navigate"]) expect(at(tree, `nav.guides.navigation.${k}`)).toBeTruthy();
    }
  });
  it("the titles are the items' names", () => {
    for (const tree of [RO, EN]) {
      expect(at(tree, "nav.guides.measure.title")).toBe(at(tree, "nav.items.mapMeasurements"));
      expect(at(tree, "nav.guides.groups.title")).toBe(at(tree, "nav.items.mapGroupings"));
      expect(at(tree, "nav.guides.navigation.title")).toBe(at(tree, "nav.items.mapNavigation"));
    }
  });
  it("„Selectează” is explained as it is since #39.73: it picks properties for a group, and deletes nothing", () => {
    expect(at(RO, "nav.guides.groups.select")).toContain(`„${at(RO, "property.map.addToGroup")}”`);
    expect(at(RO, "nav.guides.groups.select")).toContain("Nu șterge nimic.");
    expect(at(EN, "nav.guides.groups.select")).toContain(`„${at(EN, "property.map.addToGroup")}”`);
  });
  it("„Navigare” says where the button is: the property form, and a property's window on the big map", () => {
    expect(at(RO, "nav.guides.navigation.navigate")).toMatch(/fișa proprietății[\s\S]*clic pe o proprietate pe harta/);
    expect(at(EN, "nav.guides.navigation.navigate")).toMatch(/property form[\s\S]*click a property on the map/);
  });
});

describe("the box", () => {
  it.each([
    ["measure", ["Unghiuri", "Riglă", "Suprafața unei zone delimitate", "Suprafața unei zone oarecare"]],
    ["groups", ["Tarlale", "Grupuri", "Selectează"]],
    ["navigation", ["Navighează"]],
  ] as const)("%s: a row per button, in the toolbar's order, the button drawn with its name", (guide, names) => {
    render(<MapGuideDialog guide={guide} onClose={() => {}} onOpenMap={() => {}} />);
    const dialog = screen.getByRole("dialog", { name: at(RO, `nav.guides.${guide}.title`) });
    const rows = dialog.querySelectorAll("[data-map-guide-row]");
    expect([...rows].map((r) => r.querySelector(".font-medium")?.textContent)).toEqual(names);
    for (const row of rows) {
      const picture = row.querySelector("[data-map-guide-button]")!;
      // A picture of the button: hidden from a screen reader and out of reach, the name read from the row's text.
      expect(picture).toHaveAttribute("aria-hidden", "true");
      expect(picture.hasAttribute("inert")).toBe(true);
      expect(picture.querySelector("button")).toHaveAttribute("tabindex", "-1");
      expect(picture.querySelector("svg")).not.toBeNull();
    }
  });

  it("draws the map's own icons — map-tool-icons.ts and NAVIGATE_ICON, never an icon of its own", () => {
    expect(SOURCE).toContain("icon: MAP_TOOL_ICON[tool]");
    expect(SOURCE).toContain("icon: NAVIGATE_ICON");
    expect(SOURCE).toContain("name: tMap(MAP_TOOL_LABEL[tool])");
    expect(Object.keys(MAP_TOOL_ICON)).toEqual(["angles", "ruler", "areaDelimited", "areaFree", "tarlale", "groups", "select"]);
    expect(NAVIGATE_ICON).toBeTruthy();
  });

  it("OK on a map guide closes it and opens the map with the set named; the sentence says so", () => {
    const onClose = jest.fn();
    const onOpenMap = jest.fn();
    render(<MapGuideDialog guide="groups" onClose={onClose} onOpenMap={onOpenMap} />);
    expect(screen.getByText(at(RO, "nav.guides.opensMap"))).toBeInTheDocument();
    const ok = screen.getByRole("button", { name: "OK" });
    expect(ok).toHaveFocus();
    fireEvent.click(ok);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenMap).toHaveBeenCalledWith("/properties/map?pulse=groups");
  });

  it("OK on „Navigare” only closes it; no sentence about the map", () => {
    const onClose = jest.fn();
    const onOpenMap = jest.fn();
    render(<MapGuideDialog guide="navigation" onClose={onClose} onOpenMap={onOpenMap} />);
    expect(screen.queryByText(at(RO, "nav.guides.opensMap"))).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenMap).not.toHaveBeenCalled();
  });

  it("„Închide” and Escape close it without opening the map", () => {
    const onClose = jest.fn();
    const onOpenMap = jest.fn();
    render(<MapGuideDialog guide="measure" onClose={onClose} onOpenMap={onOpenMap} />);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Închide" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onOpenMap).not.toHaveBeenCalled();
  });
});

describe("the sidebar's guide items", () => {
  it("are buttons that open the box every time — no „nu mai arăta” (Ask first 5)", () => {
    expect(NAV).toMatch(/if \(item\.guide\) \{[\s\S]*?onClick=\{\(\) => setGuideOpen\(true\)\}[\s\S]*?<MapGuideDialog/);
    expect(SOURCE).not.toMatch(/localStorage|sessionStorage|dontShow|nuMaiArata/);
  });
  it("OK goes through the unsaved-changes guard, or asks the map to point them out again when it is already there", () => {
    expect(NAV).toMatch(/window\.location\.pathname \+ window\.location\.search === href\) askMapPulseAgain\(\);\s*else guardedNavigate\(href\);/);
  });
});
