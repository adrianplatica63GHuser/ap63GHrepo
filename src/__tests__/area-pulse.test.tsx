/**
 * Slice #39.09, #39.78 — the big map points out some of its buttons: the address that asks for a set
 * (`?pulse=measure|groups`, and #39.09's `?area=1` for old links), the sets, the map's buttons that carry the class,
 * and its three-second pulse (`@/lib/ui/area-pulse`, globals.css `.ga-area-pulse`). The sidebar's guides that send
 * the user there are map-guide-dialog.test.tsx's.
 */
import fs from "fs";
import path from "path";
import { act, renderHook } from "@testing-library/react";

import { NAV_SECTIONS } from "@/components/sidebar/nav-config";
import { getActiveHref, getActiveSectionKey } from "@/components/sidebar/sidebar-helpers";
import {
  AREA_CALCULATION_HREF,
  AREA_PULSE_CLASS,
  AREA_PULSE_MS,
  MAP_PULSE_EVENT,
  MAP_TOOLS,
  PULSE_SETS,
  askMapPulseAgain,
  mapPulseHref,
  readAreaPulse,
  readMapPulse,
  useAreaPulse,
} from "@/lib/ui/area-pulse";

const ROOT = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

describe("the address", () => {
  it("each guide's OK opens the map of all properties with its set named", () => {
    expect(mapPulseHref("measure")).toBe("/properties/map?pulse=measure");
    expect(mapPulseHref("groups")).toBe("/properties/map?pulse=groups");
  });
  it("#39.09's ?area=1 still points out the two area buttons (an old link, Ask first 3)", () => {
    expect(AREA_CALCULATION_HREF).toBe("/properties/map?area=1");
    expect(readMapPulse("?area=1")).toBe("area");
  });
  it.each([
    ["?pulse=measure", "measure"],
    ["pulse=groups", "groups"],
    ["?focus=x&pulse=measure", "measure"],
    ["?pulse=groups&area=1", "groups"],
    ["?area=1", "area"],
    ["area=1", "area"],
    ["?focus=x&area=1", "area"],
    ["?area", "area"],
    ["?pulse=nothing", null],
    ["?pulse=", null],
    ["", null],
    ["?focus=x&z=19", null],
    ["?areal=1", null],
  ])("readMapPulse(%j) → %s", (search, want) => {
    expect(readMapPulse(search)).toBe(want);
    expect(readAreaPulse(search)).toBe(want !== null);
  });
});

describe("the sets — the toolbar's buttons, left to right", () => {
  it("measure: Unghiuri, Riglă and the two area buttons; groups: Tarlale, Grupuri, Selectează; area: the two", () => {
    expect(PULSE_SETS).toEqual({
      measure: ["angles", "ruler", "areaDelimited", "areaFree"],
      groups: ["tarlale", "groups", "select"],
      area: ["areaDelimited", "areaFree"],
    });
  });
  it("each set keeps the toolbar's order", () => {
    for (const set of Object.values(PULSE_SETS)) {
      const at = set.map((t) => MAP_TOOLS.indexOf(t));
      expect(at).toEqual([...at].sort((a, b) => a - b));
      expect(at.every((i) => i >= 0)).toBe(true);
    }
  });
});

describe("the map's sidebar item, now that no item carries a query", () => {
  it("on the map, with or without a pulse, „Proprietăți” is the active item, under „Domeniu”", () => {
    for (const search of ["pulse=measure", "pulse=groups", "area=1", "", "focus=x"]) {
      expect(getActiveHref("/properties/map", NAV_SECTIONS, search)).toBe("/properties");
      expect(getActiveSectionKey("/properties/map", NAV_SECTIONS, search)).toBe("domain");
    }
  });
});

describe("useAreaPulse — three seconds, then settled", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("is #38.79's three seconds", () => {
    // Read from the source: the triangle is a component, and importing it here would pull next-intl's ESM into jest.
    const note = /export const NOTE_PULSE_MS = (\d+);/.exec(read("src/app/admin/value-lists/_components/relationship-triangle.tsx"));
    expect(Number(note?.[1])).toBe(AREA_PULSE_MS);
    expect(AREA_PULSE_MS).toBe(3000);
  });

  it("asked on arrival: on at once, still on at 2.999 s, off at 3 s", () => {
    const { result } = renderHook(() => useAreaPulse("measure"));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(2999));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(false);
    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current).toBe(false);
  });

  it("not asked: never on — not even on the event", () => {
    const { result } = renderHook(() => useAreaPulse(null));
    expect(result.current).toBe(false);
    act(() => askMapPulseAgain());
    expect(result.current).toBe(false);
  });

  it("asked again after the parameter went away: on again", () => {
    const { result, rerender } = renderHook(({ asked }) => useAreaPulse(asked), {
      initialProps: { asked: "area" as "area" | null },
    });
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
    rerender({ asked: null });
    expect(result.current).toBe(false);
    rerender({ asked: "area" });
    expect(result.current).toBe(true);
  });

  it("another set asked while on the map: on again, for three seconds of its own", () => {
    const { result, rerender } = renderHook(({ asked }) => useAreaPulse(asked), {
      initialProps: { asked: "measure" as "measure" | "groups" },
    });
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
    rerender({ asked: "groups" });
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
  });

  it("a guide's OK on the address already shown: the event points them out again, the three seconds restarted", () => {
    const { result } = renderHook(() => useAreaPulse("groups"));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe(false);
    act(() => window.dispatchEvent(new Event(MAP_PULSE_EVENT)));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(2000));
    act(() => askMapPulseAgain());
    act(() => jest.advanceTimersByTime(2999));
    expect(result.current).toBe(true);
    act(() => jest.advanceTimersByTime(1));
    expect(result.current).toBe(false);
  });
});

describe("the pulse itself, in globals.css", () => {
  const CSS = read("src/app/globals.css");
  it("is 1 s × 3, as ga-note-pulse", () => {
    expect(CSS).toContain(`.${AREA_PULSE_CLASS} {`);
    expect(CSS).toContain("animation: ga-area-pulse 1s ease-in-out 3;");
    // IconButton puts className on its tooltip wrapper: the ring is the wrapper's, the band its button's, one beat.
    expect(CSS).toContain(".ga-area-pulse > button { animation: ga-area-pulse-fill 1s ease-in-out 3; }");
    expect(CSS).toContain("@keyframes ga-area-pulse");
  });
  it("only paints — a ring and the background, never a size or a position", () => {
    const keyframes = CSS.slice(CSS.indexOf("@keyframes ga-area-pulse"), CSS.indexOf(`.${AREA_PULSE_CLASS} {`));
    expect(keyframes).toMatch(/box-shadow/);
    expect(keyframes).not.toMatch(/width|height|margin|padding|transform|top|left/);
  });
  it("reduced motion holds the highlight instead", () => {
    expect(CSS).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*\.ga-area-pulse \{ animation: none; box-shadow: 0 0 0 3px var\(--ga-area-ring\); \}\s*\.ga-area-pulse > button \{ animation: none; background-color: var\(--ga-area-band\); \}/,
    );
  });
});

describe("the map: every button a set names carries it, and the two wider gaps", () => {
  const MAP = read("src/app/properties/map/property-map.tsx");
  it.each(MAP_TOOLS.map((t) => [t]))("%s asks pulseClass for itself", (tool) => {
    expect(MAP).toContain(`pulseClass("${tool}")`);
  });
  it("the class is AREA_PULSE_CLASS, only while pulsing and only for the set's buttons", () => {
    expect(MAP).toMatch(/pulsing && pulseSet && PULSE_SETS\[pulseSet\]\.includes\(tool\) \? AREA_PULSE_CLASS : undefined/);
    expect(MAP).toContain('const pulseSet = readMapPulse(searchParams?.toString() ?? "");');
  });
  it("its icons and names are map-tool-icons.ts's, the ones the guides draw", () => {
    for (const t of MAP_TOOLS) {
      expect(MAP).toContain(`MAP_TOOL_ICON.${t}`);
      expect(MAP).toContain(`t(MAP_TOOL_LABEL.${t})`);
    }
  });
  it("twice the row's gap after „Suprafața unei zone oarecare” (before „Tarlale”) and after „Selectează” (before „Setări hartă”)", () => {
    // The row is `gap-2`; `ml-2` on the next box doubles the space before it.
    expect(MAP).toMatch(/data-map-ui className="absolute top-3 right-3 z-20 flex flex-wrap justify-end items-start gap-2 /);
    expect(MAP).toMatch(/data-map-layer="tarlale"\s+className=\{\["ml-2", pulseClass\("tarlale"\)\]/);
    expect(MAP).toMatch(/<div className="relative ml-2">\s+<IconButton\s+icon=\{Settings2\}/);
  });
});
