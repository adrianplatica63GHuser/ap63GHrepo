/**
 * Pure helpers for the Properties-Map ruler tool (Slice #18.14.ruler).
 *
 * The ruler measures real ground distance in Stereo 70 planar metres so its
 * readout matches the cadastral distances/areas used everywhere else in the
 * app. Stereo 70 conversion itself is a server-side grid interpolation
 * (@/lib/geo/transdatRO, exposed to the browser via the /api/geo/convert batch
 * endpoint), which is far too slow to call on every mouse-move.
 *
 * Over the small viewport the map shows (a few km), the WGS84 -> Stereo 70
 * mapping is locally affine to sub-millimetre precision. So we sample a few
 * viewport reference points through the batch endpoint ONCE, fit a local affine
 * transform here, and then convert every ruler endpoint (live cursor, free
 * clicks and corners alike) client-side and instantly from that transform —
 * the live readout and the frozen label therefore use one identical,
 * grid-accurate transform.
 *
 * Everything in this module is pure (no I/O, no React) and unit-tested.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LatLon = { lat: number; lon: number };

/** Stereo 70 planar coordinates in metres (matches @/lib/geo/convert-client). */
export type Stereo70Point = { north: number; east: number };

export type PixelPoint = { x: number; y: number };

/** A WGS84 reference point with its known Stereo 70 image, used to fit. */
export type AffineSample = {
  lat: number;
  lon: number;
  north: number;
  east: number;
};

/**
 * Local affine WGS84 -> Stereo 70 transform.
 *
 * Coordinates are fitted on deltas from a reference point (refLat / refLon) to
 * keep the normal-equation matrix well-conditioned despite the large absolute
 * magnitudes of lon/lat (~26 / ~44) vs north/east (~320 000 / ~580 000):
 *
 *   north = an*(lon-refLon) + bn*(lat-refLat) + cn
 *   east  = ae*(lon-refLon) + be*(lat-refLat) + ce
 */
export type AffineWgs84ToStereo70 = {
  refLat: number;
  refLon: number;
  an: number; bn: number; cn: number;
  ae: number; be: number; ce: number;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Snap radius, in screen pixels, around a property corner. */
export const SNAP_PX = 12;

// ---------------------------------------------------------------------------
// Linear algebra — 3x3 solve via Gaussian elimination with partial pivoting
// ---------------------------------------------------------------------------

/**
 * Solves the 3x3 system `m * x = b`. Returns the solution vector, or null when
 * the matrix is singular (degenerate / collinear samples).
 *
 * `m` is row-major: m[row][col]. `b` has length 3.
 */
export function solve3x3(
  m: [number, number, number][],
  b: [number, number, number],
): [number, number, number] | null {
  // Work on copies so the caller's arrays are untouched.
  const a: number[][] = [
    [m[0][0], m[0][1], m[0][2], b[0]],
    [m[1][0], m[1][1], m[1][2], b[1]],
    [m[2][0], m[2][1], m[2][2], b[2]],
  ];

  for (let col = 0; col < 3; col++) {
    // Partial pivot: pick the row with the largest magnitude in this column.
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null; // singular

    [a[col], a[pivot]] = [a[pivot], a[col]];

    // Eliminate this column from the rows below.
    for (let r = col + 1; r < 3; r++) {
      const factor = a[r][col] / a[col][col];
      for (let c = col; c < 4; c++) a[r][c] -= factor * a[col][c];
    }
  }

  // Back-substitution.
  const x: [number, number, number] = [0, 0, 0];
  for (let row = 2; row >= 0; row--) {
    let sum = a[row][3];
    for (let c = row + 1; c < 3; c++) sum -= a[row][c] * x[c];
    x[row] = sum / a[row][row];
  }
  return x;
}

// ---------------------------------------------------------------------------
// Affine fit + apply
// ---------------------------------------------------------------------------

/**
 * Fits a local affine WGS84 -> Stereo 70 transform from >= 3 (non-collinear)
 * samples by least squares (normal equations on the centred coordinates).
 * Returns null when the samples are degenerate (collinear / coincident) or too
 * few.
 */
export function fitAffine(
  samples: AffineSample[],
): AffineWgs84ToStereo70 | null {
  if (samples.length < 3) return null;

  const refLat = samples[0].lat;
  const refLon = samples[0].lon;

  // Build the symmetric 3x3 normal matrix M = sum p p^T where
  // p = [dlon, dlat, 1], plus the two RHS vectors (for north and east).
  let s_ll = 0, s_la = 0, s_l = 0; // sum dlon*dlon, dlon*dlat, dlon
  let s_aa = 0, s_a = 0, s_1 = 0;  // sum dlat*dlat, dlat, 1
  let r_n_l = 0, r_n_a = 0, r_n_1 = 0; // RHS for north
  let r_e_l = 0, r_e_a = 0, r_e_1 = 0; // RHS for east

  for (const s of samples) {
    const dlon = s.lon - refLon;
    const dlat = s.lat - refLat;
    s_ll += dlon * dlon;
    s_la += dlon * dlat;
    s_l  += dlon;
    s_aa += dlat * dlat;
    s_a  += dlat;
    s_1  += 1;
    r_n_l += dlon * s.north;
    r_n_a += dlat * s.north;
    r_n_1 += s.north;
    r_e_l += dlon * s.east;
    r_e_a += dlat * s.east;
    r_e_1 += s.east;
  }

  const M: [number, number, number][] = [
    [s_ll, s_la, s_l],
    [s_la, s_aa, s_a],
    [s_l,  s_a,  s_1],
  ];

  const north = solve3x3(M, [r_n_l, r_n_a, r_n_1]);
  const east  = solve3x3(M, [r_e_l, r_e_a, r_e_1]);
  if (!north || !east) return null;

  return {
    refLat,
    refLon,
    an: north[0], bn: north[1], cn: north[2],
    ae: east[0],  be: east[1],  ce: east[2],
  };
}

/** Applies a fitted affine transform to a WGS84 point. */
export function applyAffine(
  aff: AffineWgs84ToStereo70,
  p: LatLon,
): Stereo70Point {
  const dlon = p.lon - aff.refLon;
  const dlat = p.lat - aff.refLat;
  return {
    north: aff.an * dlon + aff.bn * dlat + aff.cn,
    east:  aff.ae * dlon + aff.be * dlat + aff.ce,
  };
}

// ---------------------------------------------------------------------------
// Distance + formatting
// ---------------------------------------------------------------------------

/** Euclidean distance, in metres, between two Stereo 70 planar points. */
export function planarDistanceM(a: Stereo70Point, b: Stereo70Point): number {
  return Math.hypot(a.north - b.north, a.east - b.east);
}

/**
 * Real ground distance, in metres, between two WGS84 points under a fitted
 * affine Stereo 70 transform.
 */
export function rulerDistanceM(
  aff: AffineWgs84ToStereo70,
  a: LatLon,
  b: LatLon,
): number {
  return planarDistanceM(applyAffine(aff, a), applyAffine(aff, b));
}

/**
 * Formats a metre distance to 1 cm precision, e.g. 12.3 -> "12.30 m".
 * Negative / NaN guard: non-finite or negative inputs render as "0.00 m".
 */
export function formatMeters(metres: number): string {
  const safe = Number.isFinite(metres) && metres > 0 ? metres : 0;
  return `${safe.toFixed(2)} m`;
}

// ---------------------------------------------------------------------------
// Snapping
// ---------------------------------------------------------------------------

/**
 * Returns the index of the corner nearest to `cursor` within `thresholdPx`
 * screen pixels, or null when none is close enough. On ties the lowest index
 * wins (stable).
 */
export function nearestCornerWithinPx(
  cursor: PixelPoint,
  corners: PixelPoint[],
  thresholdPx: number = SNAP_PX,
): number | null {
  let best: number | null = null;
  let bestDist = thresholdPx;
  for (let i = 0; i < corners.length; i++) {
    const d = Math.hypot(corners[i].x - cursor.x, corners[i].y - cursor.y);
    if (d <= bestDist) {
      // Strict `<` keeps the first (lowest-index) corner on an exact tie.
      if (best === null || d < bestDist) {
        best = i;
        bestDist = d;
      }
    }
  }
  return best;
}
