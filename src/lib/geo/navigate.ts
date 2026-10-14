/**
 * „Navighează" — a Google Maps directions link to a property.                       (Slice #39.35)
 *
 * Option A of Adrian's investigation (Navigation.to.my.property): the link hands the route to Google Maps, by
 * road. It needs no key and makes no API call — no Directions, Routes, Geocoding or Places request, no panorama —
 * so it costs nothing (C:\dev\CLAUDE.md → „Tests run targeted", Google's three charges). An address goes to
 * Google as text and Google resolves it on its side.
 *
 *   https://www.google.com/maps/dir/?api=1&destination=…&travelmode=driving[&origin=…][&dir_action=navigate]
 *
 * THE DESTINATION (Ask first 1): a property's shape wins over its address — a Romanian rural address often
 * resolves only to the village centre. With a start that is a known point, the shape's corner nearest it; with no
 * point known (the device's own location — the phone that scans the code is elsewhere — or a typed address), the
 * shape's centroid. Address only: the address text. Google routes to the nearest mapped road either way.
 *
 * THE START (Ask first 2): the device's own location by default — no `origin` in the link, so Google uses the
 * phone's GPS when the code is scanned (no location permission is asked by this app); or an address typed as the
 * origin's text; or, where a caller has one, a point.
 *
 * PURE — `navigate-link.test.ts` covers it.
 */

export type NavCorner = { lat: number; lon: number };
export type NavAddress = {
  streetLine?: string | null;
  streetViewStreetLine?: string | null;
  locality?: string | null;
  county?: string | null;
  postalCode?: string | null;
  country?: string | null;
};
export type NavTarget = { corners: readonly NavCorner[]; address: NavAddress | null };
export type NavStart = { kind: "device" } | { kind: "address"; text: string } | { kind: "point"; lat: number; lon: number };
export type NavDestination = { kind: "point"; lat: number; lon: number; from: "corner" | "centroid" } | { kind: "address"; text: string };

export const DIRECTIONS_BASE = "https://www.google.com/maps/dir/?api=1";

/**
 * The address as one line Google can read: the street, the locality, the county, the postal code, the country.
 * Null when there is nothing to find a place by — a country alone is not a destination.
 */
export function addressText(a: NavAddress | null): string | null {
  if (!a) return null;
  const clean = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
  const street = clean(a.streetLine) || clean(a.streetViewStreetLine);
  const locality = clean(a.locality);
  if (!street && !locality) return null;
  return [street, locality, clean(a.county), clean(a.postalCode), clean(a.country)].filter(Boolean).join(", ");
}

/** The centroid of a polygon's corners (area-weighted); the corners' mean for fewer than three or a flat polygon. */
export function centroid(corners: readonly NavCorner[]): NavCorner {
  const mean = { lat: corners.reduce((s, c) => s + c.lat, 0) / corners.length, lon: corners.reduce((s, c) => s + c.lon, 0) / corners.length };
  if (corners.length < 3) return mean;
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < corners.length; i++) {
    const p = corners[i]!;
    const q = corners[(i + 1) % corners.length]!;
    // Relative to the mean, so the products stay small and exact enough.
    const [x0, y0, x1, y1] = [p.lon - mean.lon, p.lat - mean.lat, q.lon - mean.lon, q.lat - mean.lat];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (Math.abs(a) < 1e-18) return mean;
  return { lat: mean.lat + cy / (3 * a), lon: mean.lon + cx / (3 * a) };
}

/** The squared distance between two points, the longitude scaled by the latitude — enough to compare. */
const dist2 = (p: NavCorner, q: NavCorner) => {
  const k = Math.cos(((p.lat + q.lat) / 2) * (Math.PI / 180));
  return (p.lat - q.lat) ** 2 + ((p.lon - q.lon) * k) ** 2;
};

/** Where the link leads — or null when the property has no shape and no address. */
export function destinationOf(target: NavTarget, start: NavStart): NavDestination | null {
  if (target.corners.length > 0) {
    if (start.kind === "point" && target.corners.length >= 3) {
      const from = { lat: start.lat, lon: start.lon };
      const nearest = [...target.corners].sort((p, q) => dist2(p, from) - dist2(q, from))[0]!;
      return { kind: "point", lat: nearest.lat, lon: nearest.lon, from: "corner" };
    }
    const c = centroid(target.corners);
    return { kind: "point", lat: c.lat, lon: c.lon, from: "centroid" };
  }
  const text = addressText(target.address);
  return text ? { kind: "address", text } : null;
}

const point = (lat: number, lon: number) => `${lat.toFixed(6)},${lon.toFixed(6)}`;

/**
 * The directions link. `phone` adds `dir_action=navigate`, so the Google Maps app starts navigating as soon as the
 * code is scanned. Null when there is nowhere to go, or when a typed start is empty.
 */
export function navigationLink(target: NavTarget, start: NavStart, phone = false): string | null {
  const dest = destinationOf(target, start);
  if (!dest) return null;
  const params: string[] = [`destination=${encodeURIComponent(dest.kind === "point" ? point(dest.lat, dest.lon) : dest.text)}`];
  if (start.kind === "address") {
    const text = start.text.replace(/\s+/g, " ").trim();
    if (!text) return null;
    params.push(`origin=${encodeURIComponent(text)}`);
  } else if (start.kind === "point") {
    params.push(`origin=${encodeURIComponent(point(start.lat, start.lon))}`);
  }
  params.push("travelmode=driving");
  if (phone) params.push("dir_action=navigate");
  return `${DIRECTIONS_BASE}&${params.join("&")}`;
}
