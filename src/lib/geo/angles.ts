/**
 * Pure helpers for the property corner angle display feature (Slice #19.05).
 *
 * All computation is in screen-space (pixel directions), using a cos(lat) scale
 * factor for longitude to approximate a locally-conformal projection. This is
 * accurate to fractions of a degree for the small polygons involved (< 1 km),
 * and the result matches what the user sees visually on the map.
 *
 * Nothing in this module does I/O or uses React hooks — it is safe to call
 * directly inside render paths.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A {lat, lon} point — matches the shape used in property_corner rows. */
export type LatLon = { lat: number; lon: number };

/**
 * Geometry needed to render one angle arc at a polygon corner.
 *
 * The arc is drawn as an SVG path anchored at the corner (origin = 0,0) with a
 * fixed pixel radius. `prevEdgeRad` and `nextEdgeRad` are the screen-space
 * directions (atan2, SVG convention: 0=east, +π/2=south, ±π=west, -π/2=north)
 * of the two edges meeting at this corner. `sweepCW` tells the renderer whether
 * the arc sweeps clockwise (sweep-flag=1 in SVG) or counter-clockwise from
 * prevEdgeRad to nextEdgeRad to trace the interior sector.
 */
export type AngleArcInfo = {
  /** Interior angle in degrees (0–180 for convex corners; ≤360 in general). */
  angleDeg:    number;
  /** Screen-space direction (rad) of the edge toward the "prev" neighbour. */
  prevEdgeRad: number;
  /** Screen-space direction (rad) of the edge toward the "next" neighbour. */
  nextEdgeRad: number;
  /**
   * When true, the CW (SVG sweep=1) arc from prevEdgeRad to nextEdgeRad traces
   * the interior sector. When false, the CCW arc does.
   */
  sweepCW: boolean;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Approximate screen-space vector from `from` to `to`.
 *
 * SVG convention: x = east (right), y = south (down), so lat differences are
 * negated.  The cos(lat) factor scales longitude so that unit steps in lon and
 * lat cover roughly the same screen distance.
 */
function toScreenVec(from: LatLon, to: LatLon): { x: number; y: number } {
  const cosLat = Math.cos(((from.lat + to.lat) / 2) * (Math.PI / 180));
  return {
    x:  (to.lon - from.lon) * cosLat,
    y: -(to.lat - from.lat), // screen y is down → negate lat delta
  };
}

/**
 * Screen-space angle (radians) of the directed edge from→to.
 * 0 = east, +π/2 = south, ±π = west, -π/2 = north (SVG/atan2 convention with
 * y pointing down).
 */
function edgeScreenAngleRad(from: LatLon, to: LatLon): number {
  const v = toScreenVec(from, to);
  return Math.atan2(v.y, v.x);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * For a **closed polygon** of `n ≥ 3` corners (open or self-intersecting
 * polygons are not handled), compute the angle arc info for each corner.
 *
 * The interior angle at corner `i` is the angle between the edges toward
 * corner[i-1] and corner[i+1]. For convex polygons this is always 0–180°.
 *
 * Returns [] when the polygon has fewer than 3 corners.
 */
export function computePolygonAngles(corners: LatLon[]): AngleArcInfo[] {
  const n = corners.length;
  if (n < 3) return [];

  return corners.map((corner, i) => {
    const prev = corners[(i - 1 + n) % n];
    const next = corners[(i + 1) % n];

    // Screen-space angle of each edge going AWAY from this corner
    const prevRad = edgeScreenAngleRad(corner, prev);
    const nextRad = edgeScreenAngleRad(corner, next);

    // CW arc measure from prevEdge to nextEdge (in [0, 2π))
    let cwDelta = nextRad - prevRad;
    if (cwDelta < 0) cwDelta += 2 * Math.PI;

    // The interior angle is the smaller of the two arcs (for simple polygons)
    const sweepCW = cwDelta <= Math.PI;
    const angleDeg = (sweepCW ? cwDelta : 2 * Math.PI - cwDelta) * (180 / Math.PI);

    return { angleDeg, prevEdgeRad: prevRad, nextEdgeRad: nextRad, sweepCW };
  });
}

/**
 * For a **corner where multiple edges meet** (the properties-map corner tool),
 * compute the displayable angle arcs between consecutive edges sorted by their
 * screen-space direction.
 *
 * - `neighbors` is the full list of adjacent corners reaching this vertex from
 *   ALL polygons that share it — one entry per edge.
 * - Exactly 2 neighbours (= 1 polygon): returns the single smaller angle.
 * - 3+ neighbours: returns all inter-edge sectors whose angular size differs
 *   from 180° by more than `straightLineTol` degrees (straight-line collinear
 *   edges are not informative and are suppressed).
 *
 * Returns [] when fewer than 2 neighbours are supplied.
 */
export function computeVertexAngles(
  corner:          LatLon,
  neighbors:       LatLon[],
  straightLineTol: number = 1.5,
): AngleArcInfo[] {
  if (neighbors.length < 2) return [];

  // Sort neighbours by their screen-space direction angle.
  const sorted = neighbors
    .map((n) => ({ n, rad: edgeScreenAngleRad(corner, n) }))
    .sort((a, b) => a.rad - b.rad);

  const m = sorted.length;

  // --- Exactly 2 neighbours: show the smaller of the two sectors. ----------
  if (m === 2) {
    const radA = sorted[0].rad;
    const radB = sorted[1].rad;
    // CW arc measure from A to B
    let cwDelta = radB - radA; // already in (0, 2π) since A < B after sorting
    if (cwDelta < 0) cwDelta += 2 * Math.PI;
    if (cwDelta > Math.PI) {
      // The A→B CW arc is the major arc — use the B→A CW arc instead
      return [
        {
          angleDeg:    (2 * Math.PI - cwDelta) * (180 / Math.PI),
          prevEdgeRad: radB,
          nextEdgeRad: radA,
          sweepCW:     true,
        },
      ];
    }
    return [
      {
        angleDeg:    cwDelta * (180 / Math.PI),
        prevEdgeRad: radA,
        nextEdgeRad: radB,
        sweepCW:     true,
      },
    ];
  }

  // --- 3+ neighbours: all consecutive sectors (sorted order, wrap last→first) -
  const results: AngleArcInfo[] = [];
  for (let i = 0; i < m; i++) {
    const curr = sorted[i];
    const next = sorted[(i + 1) % m];

    // CW arc measure from curr to next
    let cwDelta = next.rad - curr.rad;
    if (cwDelta < 0) cwDelta += 2 * Math.PI; // handle the wrap (last → first)

    const angleDeg = cwDelta * (180 / Math.PI);

    // Skip straight-line sectors and degenerate slivers
    if (Math.abs(angleDeg - 180) <= straightLineTol) continue;
    if (angleDeg < 0.5 || angleDeg > 359.5) continue;

    results.push({
      angleDeg,
      prevEdgeRad: curr.rad,
      nextEdgeRad: next.rad,
      sweepCW:     true,
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// SVG arc path helper (shared by both mini-map and properties-map renderers)
// ---------------------------------------------------------------------------

/**
 * Returns the SVG `d` attribute string for an angle arc centred at the SVG
 * origin (0, 0).
 *
 * The path is a filled sector (M 0 0 → L start → A → end → Z) so the arc
 * interior is clearly visible against any map background.
 */
export function arcSvgPath(info: AngleArcInfo, radius: number): string {
  const { prevEdgeRad, nextEdgeRad, sweepCW, angleDeg } = info;

  const sx = radius * Math.cos(prevEdgeRad);
  const sy = radius * Math.sin(prevEdgeRad);
  const ex = radius * Math.cos(nextEdgeRad);
  const ey = radius * Math.sin(nextEdgeRad);

  const sweep     = sweepCW ? 1 : 0;
  const largeArc  = angleDeg > 180 ? 1 : 0;

  const f = (n: number) => n.toFixed(2);

  // Sector: start at corner, line to arc-start, arc to arc-end, close.
  return `M 0 0 L ${f(sx)} ${f(sy)} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${f(ex)} ${f(ey)} Z`;
}

/**
 * Returns the (x, y) position of the angle label in SVG space.
 *
 * The label is placed along the bisector of the arc at `radius + offset` pixels
 * from the corner origin.
 */
export function arcLabelPosition(
  info:     AngleArcInfo,
  radius:   number,
  offset:   number,
): { x: number; y: number } {
  const { prevEdgeRad, nextEdgeRad, sweepCW, angleDeg } = info;

  // Angular midpoint along the interior arc
  let bisRad: number;
  if (sweepCW) {
    let cwDelta = nextEdgeRad - prevEdgeRad;
    if (cwDelta < 0) cwDelta += 2 * Math.PI;
    bisRad = prevEdgeRad + cwDelta / 2;
  } else {
    let ccwDelta = prevEdgeRad - nextEdgeRad;
    if (ccwDelta < 0) ccwDelta += 2 * Math.PI;
    bisRad = nextEdgeRad + ccwDelta / 2;
  }

  // Normalise (keep in sync with angleDeg = 180 special case where bisector is ambiguous)
  if (angleDeg > 170) {
    // Near-straight corner: place label perpendicular to bisector
    bisRad += Math.PI / 2;
  }

  const r = radius + offset;
  return {
    x: r * Math.cos(bisRad),
    y: r * Math.sin(bisRad),
  };
}
