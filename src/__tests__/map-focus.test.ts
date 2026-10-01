/**
 * The properties map opened on one Property                    (Slice #37.38)
 *
 * The link „Proprietăți — Hartă" builds from a Property's form, the reading of
 * it on the map, the zoom a fitBounds would give when the mini-map is off, and
 * the blink's curve — held to `.ga-vpulse-green` in globals.css.
 */
import fs from "fs";
import path from "path";
import {
  FOCUS_BLINK,
  MAX_FOCUS_ZOOM,
  PROPERTY_MAP_PATH,
  blinkIntensity,
  cornersBoundsCenter,
  easeInOut,
  mapFocusHref,
  parseMapFocus,
  propertyIdFromPath,
  propertyMapHref,
  setMapFocusSource,
  zoomToFitCorners,
  type FocusCorner,
  type MapFocusSource,
} from "@/lib/geo/map-focus";

const ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const OTHER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";

// A synthetic parcel near Ghermănești, about 60 m × 40 m.
const PARCEL: FocusCorner[] = [
  { lat: 44.5000, lon: 26.1000 },
  { lat: 44.5000, lon: 26.1008 },
  { lat: 44.5004, lon: 26.1008 },
  { lat: 44.5004, lon: 26.1000 },
];

describe("cornersBoundsCenter", () => {
  it("is the centre of the bounding box, not the mean of the corners", () => {
    const c = cornersBoundsCenter([...PARCEL, { lat: 44.5001, lon: 26.1001 }]);
    expect(c!.lat).toBeCloseTo(44.5002, 10);
    expect(c!.lng).toBeCloseTo(26.1004, 10);
  });
  it("is null with no corners", () => {
    expect(cornersBoundsCenter([])).toBeNull();
  });
});

describe("zoomToFitCorners — fitBounds(…, 40) when the mini-map is not mounted", () => {
  it("fits a span of exactly the box less its padding at that zoom, and not one level more", () => {
    // At zoom 15 the world is 256·2^15 px wide, so 360/2^15 degrees of
    // longitude are 256 px. A box 256 + 2·40 px wide, of a span a hair under
    // that, fits at 15 exactly.
    const span = (360 / 2 ** 15) * 0.99;
    const flat: FocusCorner[] = [{ lat: 44.5, lon: 26 }, { lat: 44.5, lon: 26 + span }];
    expect(zoomToFitCorners(flat, 256 + 80, 2000)).toBe(15);
    // The same span in a box one pixel narrower than it needs: 14.
    expect(zoomToFitCorners(flat, 256 + 80 - 3, 2000)).toBe(14);
  });

  it("is limited by whichever side is tighter", () => {
    const wide = zoomToFitCorners(PARCEL, 2000, 200)!;
    const tall = zoomToFitCorners(PARCEL, 200, 2000)!;
    const both = zoomToFitCorners(PARCEL, 200, 200)!;
    expect(both).toBe(Math.min(wide, tall));
  });

  it("gives a 60 m parcel a street-level zoom in the tile's box", () => {
    // The mini-map box is a few hundred pixels: a parcel this size lands at 17–19.
    const z = zoomToFitCorners(PARCEL, 572, 350)!;
    expect(z).toBeGreaterThanOrEqual(17);
    expect(z).toBeLessThanOrEqual(19);
    expect(Number.isInteger(z)).toBe(true);
  });

  it("gives one corner, or corners on one spot, the highest zoom", () => {
    expect(zoomToFitCorners([PARCEL[0]], 572, 350)).toBe(MAX_FOCUS_ZOOM);
    expect(zoomToFitCorners([PARCEL[0], PARCEL[0]], 572, 350)).toBe(MAX_FOCUS_ZOOM);
  });

  it("is null with no corners, and never below 0", () => {
    expect(zoomToFitCorners([], 572, 350)).toBeNull();
    expect(zoomToFitCorners([{ lat: -80, lon: -179 }, { lat: 80, lon: 179 }], 100, 100)).toBe(0);
  });
});

describe("the link and its reading", () => {
  it("carries the id and the zoom, and reads back to them", () => {
    const href = mapFocusHref(ID, 17);
    expect(href).toBe(`/properties/map?focus=${ID}&z=17`);
    expect(parseMapFocus(href.split("?")[1])).toEqual({ id: ID, zoom: 17 });
  });

  it("rounds a fractional zoom to two decimals", () => {
    expect(mapFocusHref(ID, 16.123456)).toBe(`/properties/map?focus=${ID}&z=16.12`);
  });

  it("drops a zoom that is missing, not a number or out of range, and keeps the focus", () => {
    expect(parseMapFocus(`focus=${ID}`)).toEqual({ id: ID, zoom: null });
    expect(parseMapFocus(`focus=${ID}&z=`)).toEqual({ id: ID, zoom: null });
    expect(parseMapFocus(`focus=${ID}&z=abc`)).toEqual({ id: ID, zoom: null });
    expect(parseMapFocus(`focus=${ID}&z=23`)).toEqual({ id: ID, zoom: null });
    expect(parseMapFocus(`focus=${ID}&z=-1`)).toEqual({ id: ID, zoom: null });
  });

  it("ignores a focus that is not a Property id, and a query with none", () => {
    expect(parseMapFocus("focus=new&z=17")).toBeNull();
    expect(parseMapFocus("focus=PROP00042")).toBeNull();
    expect(parseMapFocus("")).toBeNull();
    expect(parseMapFocus(new URLSearchParams({ z: "17" }))).toBeNull();
  });

  it("finds the Property in its own form's route only", () => {
    expect(propertyIdFromPath(`/properties/${ID}`)).toBe(ID);
    expect(propertyIdFromPath(`/properties/${ID}/`)).toBe(ID);
    expect(propertyIdFromPath("/properties/new")).toBeNull();
    expect(propertyIdFromPath("/properties/map")).toBeNull();
    expect(propertyIdFromPath("/properties")).toBeNull();
    expect(propertyIdFromPath(`/properties/${ID}/associate-person`)).toBeNull();
    expect(propertyIdFromPath(`/natural-persons/${ID}`)).toBeNull();
    expect(propertyIdFromPath(null)).toBeNull();
  });
});

describe("propertyMapHref — what the sidebar link opens", () => {
  let off: (() => void) | null = null;
  afterEach(() => {
    off?.();
    off = null;
  });
  const source = (over: Partial<MapFocusSource> = {}): MapFocusSource => ({
    propertyId: ID,
    latestCorners: () => PARCEL,
    miniMapZoom: () => 18,
    boxPx: { width: 572, height: 350 },
    ...over,
  });

  it("is the plain map anywhere but a Property's form", () => {
    off = setMapFocusSource(source());
    expect(propertyMapHref("/properties")).toBe(PROPERTY_MAP_PATH);
    expect(propertyMapHref("/properties/new")).toBe(PROPERTY_MAP_PATH);
    expect(propertyMapHref("/")).toBe(PROPERTY_MAP_PATH);
  });

  it("carries the form's id and the mini-map's zoom at that moment", () => {
    let zoom = 18;
    off = setMapFocusSource(source({ miniMapZoom: () => zoom }));
    expect(propertyMapHref(`/properties/${ID}`)).toBe(mapFocusHref(ID, 18));
    zoom = 16;
    expect(propertyMapHref(`/properties/${ID}`)).toBe(mapFocusHref(ID, 16));
  });

  it("falls back to the fitted zoom when the tile is off", () => {
    off = setMapFocusSource(source({ miniMapZoom: () => null }));
    expect(propertyMapHref(`/properties/${ID}`)).toBe(mapFocusHref(ID, zoomToFitCorners(PARCEL, 572, 350)));
  });

  it("is the plain map for a Property with no corners", () => {
    off = setMapFocusSource(source({ latestCorners: () => [] }));
    expect(propertyMapHref(`/properties/${ID}`)).toBe(PROPERTY_MAP_PATH);
  });

  it("is the plain map when no form is registered, or another Property's is", () => {
    expect(propertyMapHref(`/properties/${ID}`)).toBe(PROPERTY_MAP_PATH);
    off = setMapFocusSource(source({ propertyId: OTHER }));
    expect(propertyMapHref(`/properties/${ID}`)).toBe(PROPERTY_MAP_PATH);
  });

  it("is not cleared by a form that unmounts after the next one registered", () => {
    const offFirst = setMapFocusSource(source({ propertyId: OTHER }));
    off = setMapFocusSource(source());
    offFirst();
    expect(propertyMapHref(`/properties/${ID}`)).toBe(mapFocusHref(ID, 18));
  });
});

describe("the blink — the same pulse as .ga-vpulse-green, three times", () => {
  it("eases in and out like CSS ease-in-out, cubic-bezier(0.42, 0, 0.58, 1)", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(0.25)).toBeCloseTo(0.1291, 3);
    expect(easeInOut(0.75)).toBeCloseTo(1 - 0.1291, 3);
  });

  it("peaks mid-cycle, is its normal colour between cycles, and ends after 2.4 s", () => {
    for (let k = 0; k < FOCUS_BLINK.cycles; k++) {
      const t0 = k * FOCUS_BLINK.cycleMs;
      expect(blinkIntensity(t0)).toBeCloseTo(0, 6);
      expect(blinkIntensity(t0 + FOCUS_BLINK.cycleMs / 2)).toBeCloseTo(1, 6);
      expect(blinkIntensity(t0 + 200)).toBeCloseTo(blinkIntensity(t0 + 600)!, 6);
    }
    expect(blinkIntensity(FOCUS_BLINK.totalMs - 1)).toBeLessThan(0.01);
    expect(blinkIntensity(FOCUS_BLINK.totalMs)).toBeNull();
    expect(blinkIntensity(-1)).toBeNull();
  });

  it("counts exactly three peaks", () => {
    let peaks = 0;
    for (let t = 1; t < FOCUS_BLINK.totalMs; t++) {
      const [a, b, c] = [blinkIntensity(t - 1)!, blinkIntensity(t)!, blinkIntensity(t + 1) ?? 0];
      if (b > a && b >= c) peaks++;
    }
    expect(peaks).toBe(3);
  });

  it("is a steady green for the same 2.4 s under reduced motion", () => {
    expect(blinkIntensity(0, true)).toBe(1);
    expect(blinkIntensity(1234, true)).toBe(1);
    expect(blinkIntensity(FOCUS_BLINK.totalMs, true)).toBeNull();
  });

  it("uses globals.css's numbers: the 0.8 s ease-in-out cycle, the green, the peak alphas", () => {
    const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
    const anim = /\.ga-vpulse-green\s*\{[^}]*animation:\s*ga-version-pulse-green\s+([\d.]+)s\s+ease-in-out\s+(\d+)/.exec(css);
    expect(anim).not.toBeNull();
    expect(Number(anim![1]) * 1000).toBe(FOCUS_BLINK.cycleMs);
    // The form pulses four times; the map, three — the header's choice, on purpose.
    expect(Number(anim![2])).toBe(4);
    expect(FOCUS_BLINK.totalMs).toBe(FOCUS_BLINK.cycleMs * FOCUS_BLINK.cycles);
    const peak = /@keyframes ga-version-pulse-green\s*\{[\s\S]*?50%\s*\{([^}]*)\}/.exec(css);
    expect(peak).not.toBeNull();
    expect(peak![1]).toContain(`rgba(34, 197, 94, ${FOCUS_BLINK.peakStroke})`);
    expect(peak![1]).toContain(`rgba(34, 197, 94, ${FOCUS_BLINK.peakFill})`);
    expect(FOCUS_BLINK.rgb).toBe("rgb(34, 197, 94)");
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\.ga-vpulse-green\s*\{\s*animation:\s*none/);
  });
});
