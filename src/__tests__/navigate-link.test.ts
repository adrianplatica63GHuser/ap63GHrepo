/**
 * Slice #39.35 — „Navighează": the Google Maps directions link (`@/lib/geo/navigate`). No key, no API call: the
 * link is all of it. The destination (Ask first 1), the start (Ask first 2), the encoding.
 */
import { DIRECTIONS_BASE, addressText, centroid, destinationOf, navigationLink, type NavTarget } from "@/lib/geo/navigate";

const SQUARE = [
  { lat: 44.37, lon: 25.97 },
  { lat: 44.37, lon: 25.974 },
  { lat: 44.372, lon: 25.974 },
  { lat: 44.372, lon: 25.97 },
];
const ADDRESS = { streetLine: "Strada Școlii 5", locality: "Bragadiru", county: "Ilfov", postalCode: null, country: "România" };

describe("the address as one line", () => {
  it("street, locality, county, postal code, country — the blanks left out", () => {
    expect(addressText(ADDRESS)).toBe("Strada Școlii 5, Bragadiru, Ilfov, România");
    expect(addressText({ ...ADDRESS, postalCode: "077025" })).toBe("Strada Școlii 5, Bragadiru, Ilfov, 077025, România");
  });
  it("the Street View street line when the street is blank", () => {
    expect(addressText({ streetViewStreetLine: "Strada Anemonelor nr. 7", locality: "Bragadiru" })).toBe("Strada Anemonelor nr. 7, Bragadiru");
  });
  it("nothing to find a place by: a country alone, or no address", () => {
    expect(addressText({ country: "România" })).toBeNull();
    expect(addressText(null)).toBeNull();
  });
});

describe("the destination (Ask first 1)", () => {
  it("a polygon's centroid — the area's, not the corners' mean", () => {
    expect(centroid(SQUARE).lat).toBeCloseTo(44.371, 9);
    expect(centroid(SQUARE).lon).toBeCloseTo(25.972, 9);
    // A triangle's centroid is its corners' mean; an L-shape's is not.
    const L = [{ lat: 0, lon: 0 }, { lat: 0, lon: 2 }, { lat: 1, lon: 2 }, { lat: 1, lon: 1 }, { lat: 2, lon: 1 }, { lat: 2, lon: 0 }];
    expect(centroid(L).lon).toBeCloseTo(5 / 6, 9);
    expect(centroid(L).lat).toBeCloseTo(5 / 6, 9);
  });
  it("the shape wins over the address", () => {
    expect(destinationOf({ corners: SQUARE, address: ADDRESS }, { kind: "device" })).toMatchObject({ kind: "point", from: "centroid" });
  });
  it("with a start that is a point, the corner nearest it", () => {
    expect(destinationOf({ corners: SQUARE, address: null }, { kind: "point", lat: 44.38, lon: 25.98 })).toEqual({ kind: "point", lat: 44.372, lon: 25.974, from: "corner" });
  });
  it("with a typed start — not a point we know — the centroid", () => {
    expect(destinationOf({ corners: SQUARE, address: null }, { kind: "address", text: "București" })).toMatchObject({ from: "centroid" });
  });
  it("address only: its text; neither: nowhere", () => {
    expect(destinationOf({ corners: [], address: ADDRESS }, { kind: "device" })).toEqual({ kind: "address", text: "Strada Școlii 5, Bragadiru, Ilfov, România" });
    expect(destinationOf({ corners: [], address: { country: "România" } }, { kind: "device" })).toBeNull();
  });
});

describe("the link (Ask first 2, and Option A's form)", () => {
  const shape: NavTarget = { corners: SQUARE, address: null };
  it("from the device's own location: no origin, by car", () => {
    expect(navigationLink(shape, { kind: "device" })).toBe(`${DIRECTIONS_BASE}&destination=44.371000%2C25.972000&travelmode=driving`);
  });
  it("the phone's link starts navigating", () => {
    expect(navigationLink(shape, { kind: "device" }, true)).toBe(`${DIRECTIONS_BASE}&destination=44.371000%2C25.972000&travelmode=driving&dir_action=navigate`);
  });
  it("from a typed address — Romanian letters encoded as UTF-8, spaces tidied", () => {
    expect(navigationLink(shape, { kind: "address", text: "  Piața   Unirii, București " })).toBe(
      `${DIRECTIONS_BASE}&destination=44.371000%2C25.972000&origin=Pia%C8%9Ba%20Unirii%2C%20Bucure%C8%99ti&travelmode=driving`,
    );
  });
  it("from a point: the point, and the corner nearest it", () => {
    expect(navigationLink(shape, { kind: "point", lat: 44.38, lon: 25.98 })).toBe(
      `${DIRECTIONS_BASE}&destination=44.372000%2C25.974000&origin=44.380000%2C25.980000&travelmode=driving`,
    );
  });
  it("to an address: its text, encoded", () => {
    expect(navigationLink({ corners: [], address: ADDRESS }, { kind: "device" })).toBe(
      `${DIRECTIONS_BASE}&destination=Strada%20%C8%98colii%205%2C%20Bragadiru%2C%20Ilfov%2C%20Rom%C3%A2nia&travelmode=driving`,
    );
  });
  it("no link: nowhere to go, or a typed start left empty", () => {
    expect(navigationLink({ corners: [], address: null }, { kind: "device" })).toBeNull();
    expect(navigationLink(shape, { kind: "address", text: "   " })).toBeNull();
  });
  it("is only ever a google.com/maps/dir link — no key, no API host", () => {
    const link = navigationLink(shape, { kind: "device" })!;
    expect(link.startsWith("https://www.google.com/maps/dir/?api=1&")).toBe(true);
    expect(link).not.toMatch(/key=|googleapis/);
  });
});
