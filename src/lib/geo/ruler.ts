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

// ---------------------------------------------------------------------------
// The zigzag (Slice 40.07)
// ---------------------------------------------------------------------------
//
// Adrian, 2026-10-20: after the first segment „we should allow to pick a 3rd corner … a 4th corner a 5th corner and so
// on until we pick a corner that is not a new corner but is the last corner that we picked", and each segment's label
// gives „the size of the segment of total size which … is the sum of all the segments".
//
// A click adds a point; a click on the LAST point again (within SNAP_PX of it, a corner or a free point alike) ends
// the measurement and adds nothing. A segment's length is computed with the transform in force when its end is fixed
// and kept: a later re-fit (a pan, a zoom) changes only the live segment, never a label already drawn. A length is
// `null` only while the first fit is still pending; `fillPendingLengths` gives it one as soon as a fit arrives.

/** The points clicked so far, each fixed segment's kept length, and whether the last point was clicked again. */
export type RulerPath = {
  points: LatLon[];
  /** `lengths[i]` is the segment from `points[i]` to `points[i + 1]`; `null` while the fit was pending. */
  lengths: (number | null)[];
  done: boolean;
};

export const EMPTY_RULER_PATH: RulerPath = { points: [], lengths: [], done: false };

/**
 * What a click does to the path:
 *   - `clear` — the path was ended: the click clears it (and the ruler is released, as after today's frozen segment);
 *   - `start` — the first point;
 *   - `finish` — the last point clicked again, with at least one segment fixed: the measurement ends;
 *   - `ignore` — the only point clicked again: there is no segment to end on;
 *   - `add` — anything else, an earlier point included: a new point.
 */
export type RulerClick = "clear" | "start" | "finish" | "ignore" | "add";

export function rulerClickKind(
  path: RulerPath,
  lastPointPx: PixelPoint | null,
  clickPx: PixelPoint,
  thresholdPx: number = SNAP_PX,
): RulerClick {
  if (path.done) return "clear";
  if (path.points.length === 0) return "start";
  const onLast = lastPointPx !== null && Math.hypot(clickPx.x - lastPointPx.x, clickPx.y - lastPointPx.y) <= thresholdPx;
  if (onLast) return path.points.length >= 2 ? "finish" : "ignore";
  return "add";
}

/** The path with one more point, the new segment's length measured now (null with no fit yet). */
export function addRulerPoint(path: RulerPath, point: LatLon, aff: AffineWgs84ToStereo70 | null): RulerPath {
  const last = path.points[path.points.length - 1];
  const lengths = last ? [...path.lengths, aff ? rulerDistanceM(aff, last, point) : null] : path.lengths;
  return { points: [...path.points, point], lengths, done: false };
}

export function finishRulerPath(path: RulerPath): RulerPath {
  return path.points.length >= 2 ? { ...path, done: true } : path;
}

/** Lengths still pending get the fit that has just arrived; the same object back when none is pending. */
export function fillPendingLengths(path: RulerPath, aff: AffineWgs84ToStereo70 | null): RulerPath {
  if (!aff || !path.lengths.includes(null)) return path;
  return {
    ...path,
    lengths: path.lengths.map((l, i) => l ?? rulerDistanceM(aff, path.points[i], path.points[i + 1])),
  };
}

/** The sum of the fixed segments (plus `extra`), or null while any of them is still pending. */
export function rulerTotalM(path: RulerPath, extra: number | null = 0): number | null {
  if (extra === null || path.lengths.includes(null)) return null;
  return path.lengths.reduce<number>((sum, l) => sum + (l ?? 0), extra);
}

const lengthText = (m: number | null): string => (m === null ? "…" : formatMeters(m));

/**
 * One label on the map:
 *   - `segment` — a length alone: a fixed segment while drawing, the only segment of an ended measurement, or the
 *     live segment before any is fixed — „x din x" would say nothing;
 *   - `segmentOfTotal` — a segment of an ended measurement of two or more: „{segment} din {total}";
 *   - `live` — by the cursor, with segments fixed: „+ {segment} · total {total}", the total so far with the live one.
 */
export type RulerLabel =
  | { kind: "segment"; at: LatLon; segment: string }
  | { kind: "segmentOfTotal"; at: LatLon; segment: string; total: string }
  | { kind: "live"; at: LatLon; segment: string; total: string };

const midpoint = (a: LatLon, b: LatLon): LatLon => ({ lat: (a.lat + b.lat) / 2, lon: (a.lon + b.lon) / 2 });

/** Each fixed segment's label, above its midpoint. */
export function rulerSegmentLabels(path: RulerPath): RulerLabel[] {
  const total = rulerTotalM(path);
  const many = path.done && path.lengths.length >= 2;
  return path.lengths.map((len, i) => {
    const at = midpoint(path.points[i], path.points[i + 1]);
    return many
      ? { kind: "segmentOfTotal", at, segment: lengthText(len), total: lengthText(total) }
      : { kind: "segment", at, segment: lengthText(len) };
  });
}

/** The label by the cursor while drawing; null once ended, before the first point, or with no cursor. */
export function rulerLiveLabel(path: RulerPath, cursor: LatLon | null, aff: AffineWgs84ToStereo70 | null): RulerLabel | null {
  const last = path.points[path.points.length - 1];
  if (path.done || !last || !cursor) return null;
  const live = aff ? rulerDistanceM(aff, last, cursor) : null;
  if (path.lengths.length === 0) return { kind: "segment", at: cursor, segment: lengthText(live) };
  return { kind: "live", at: cursor, segment: lengthText(live), total: lengthText(rulerTotalM(path, live)) };
}

/** The message key and values each label kind reads (`map.*` in messages/*.json). */
export function rulerLabelMessage(label: RulerLabel): { key: "rulerSegment" | "rulerSegmentOf" | "rulerLive"; values: Record<string, string> } {
  if (label.kind === "segment") return { key: "rulerSegment", values: { segment: label.segment } };
  if (label.kind === "segmentOfTotal") return { key: "rulerSegmentOf", values: { segment: label.segment, total: label.total } };
  return { key: "rulerLive", values: { segment: label.segment, total: label.total } };
}
