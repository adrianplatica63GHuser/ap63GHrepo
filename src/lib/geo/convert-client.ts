/**
 * Client-side helpers for the /api/geo/convert endpoint (Slice #18.09).
 *
 * The Stereo 70 grid interpolation runs server-side, so the browser converts in
 * batch via the API route. Shared between the corners table (Stereo 70 display)
 * and the property form (live Calculated Area preview) so both use the SAME
 * TanStack Query cache key — see `s70QueryKey` — and never double-fetch.
 */

export type Stereo70Point = { north: number; east: number };

type LatLon = { lat: number; lon: number };

/** Stable cache key fragment derived from a corner set's coordinates. */
export function cornersToS70Key(corners: LatLon[]): string {
  return corners.map((c) => c.lat + "," + c.lon).join("|");
}

/** Batch-convert WGS84 corners to Stereo 70 (Northing / Easting, metres). */
export async function wgs84ToStereo70Batch(
  corners: LatLon[],
): Promise<Stereo70Point[]> {
  const res = await fetch("/api/geo/convert", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      direction: "wgs84ToStereo70",
      points: corners.map((c) => ({ lat: c.lat, lon: c.lon })),
    }),
  });
  if (!res.ok) throw new Error("Conversion failed");
  const data = await res.json();
  return data.points as Stereo70Point[];
}
