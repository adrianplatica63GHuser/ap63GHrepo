/**
 * Slice #39.09 — „Instrumente → Calcul suprafață": the address, the sidebar's active item, and the two area buttons'
 * three-second pulse (`@/lib/ui/area-pulse`, globals.css `.ga-area-pulse`).
 */
import fs from "fs";
import path from "path";
import { act, renderHook } from "@testing-library/react";

import { NAV_SECTIONS } from "@/components/sidebar/nav-config";
import { getActiveHref, getActiveSectionKey, isItemActive } from "@/components/sidebar/sidebar-helpers";
import { NOTE_PULSE_MS } from "@/app/admin/value-lists/_components/relationship-triangle";
import { AREA_CALCULATION_HREF, AREA_PULSE_CLASS, AREA_PULSE_MS, readAreaPulse, useAreaPulse } from "@/lib/ui/area-pulse";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("the address", () => {
  it("is the map of all properties with ?area=1", () => {
    expect(AREA_CALCULATION_HREF).toBe("/properties/map?area=1");
  });
  it.each([
    ["?area=1", true],
    ["area=1", true],
    ["?focus=x&area=1", true],
    ["?area", true],
    ["", false],
    ["?focus=x&z=19", false],
    ["?areal=1", false],
  ])("readAreaPulse(%j) → %s", (search, want) => {
    expect(readAreaPulse(search)).toBe(want);
  });
});

describe("the sidebar: „Calcul suprafață” under „Instrumente”, after „Calcul drum lateral”", () => {
  const functions = NAV_SECTIONS.find((s) => s.key === "functions")!;
  it("stands right after the road calculation, with the area address", () => {
    const keys = functions.items.map((i) => i.key);
    expect(keys.indexOf("areaCalculation")).toBe(keys.indexOf("calculation") + 1);
    expect(functions.items.find((i) => i.key === "areaCalculation")!.href).toBe(AREA_CALCULATION_HREF);
  });
  it("is the active item on the map with the parameter, „Proprietăți” without it (Ask first 2)", () => {
    expect(getActiveHref("/properties/map", NAV_SECTIONS, "area=1")).toBe(AREA_CALCULATION_HREF);
    expect(getActiveSectionKey("/properties/map", NAV_SECTIONS, "area=1")).toBe("functions");
    expect(getActiveHref("/properties/map", NAV_SECTIONS, "")).toBe("/properties");
    expect(getActiveHref("/properties/map", NAV_SECTIONS)).toBe("/properties");
    expect(getActiveSectionKey("/properties/map", NAV_SECTIONS, "focus=x")).toBe("domain");
  });
  it("an address with a query matches its path exactly and every parameter it names", () => {
    expect(isItemActive(AREA_CALCULATION_HREF, "/properties/map", "area=1&z=3")).toBe(true);
    expect(isItemActive(AREA_CALCULATION_HREF, "/properties/map", "area=2")).toBe(false);
    expect(isItemActive(AREA_CALCULATION_HREF, "/properties/map/x", "area=1")).toBe(false);
    expect(isItemActive(AREA_CALCULATION_HREF, "/properties", "area=1")).toBe(false);
    expect(isItemActive("/properties", "/properties/map", "area=1")).toBe(true);
  });
});

describe("useAreaPulse — three seconds, then settled", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is #38.79's three seconds", () => {
    expect(AREA_PULSE_MS).toBe(NOTE_PULSE_MS);
    expect(AREA_PULSE_MS).toBe(3000);
  });

  it("asked on arrival: on at once, still on at 2.999 s, off at 3 s", () => {
    const { result } = renderHook(() => useAreaPulse(true));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(2999));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current).toBe(false);
  });

  it("not asked: never on", () => {
    const { result } = renderHook(() => useAreaPulse(false));
    expect(result.current).toBe(false);
  });

  it("asked again after the parameter went away: on again", () => {
    const { result, rerender } = renderHook(({ asked }) => useAreaPulse(asked), { initialProps: { asked: true } });
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
    rerender({ asked: false });
    expect(result.current).toBe(false);
    rerender({ asked: true });
    expect(result.current).toBe(true);
  });
});

describe("the pulse itself, in globals.css", () => {
  const CSS = read("src/app/globals.css");
  it("is 1 s × 3, as ga-note-pulse", () => {
    expect(CSS).toContain(`.${AREA_PULSE_CLASS} {`);
    expect(CSS).toContain("animation: ga-area-pulse 1s ease-in-out 3;");
    expect(CSS).toContain("@keyframes ga-area-pulse");
  });
  it("only paints — a ring and the background, never a size or a position", () => {
    const keyframes = CSS.slice(CSS.indexOf("@keyframes ga-area-pulse"), CSS.indexOf(`.${AREA_PULSE_CLASS} {`));
    expect(keyframes).toMatch(/box-shadow/);
    expect(keyframes).not.toMatch(/width|height|margin|padding|transform|top|left/);
  });
  it("reduced motion holds the highlight instead", () => {
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.ga-area-pulse \{ animation: none; box-shadow: 0 0 0 3px var\(--ga-area-ring\); background-color: var\(--ga-area-band\); \}/,
    );
  });
  it("both area buttons carry it on the map", () => {
    const MAP = read("src/app/properties/map/property-map.tsx");
    expect(MAP.match(/className=\{areaPulse \? AREA_PULSE_CLASS : undefined\}/g)).toHaveLength(2);
  });
});
