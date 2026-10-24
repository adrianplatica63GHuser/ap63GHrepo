/**
 * THE TILE BAR ON TWO ROWS.                                                                          (Slice 40.41)
 *
 * Adrian, 2026-10-23: „The entire row containing the check boxes and the 3 buttons should be repositioned on two rows -
 * trying to not split the groups (a group have the same color) and trying to keep the buttons at the very end of the
 * second row; in most cases we cannot obtain equal width rows, so in this case we should have the top row a bit longer
 * than the bottom row; please note that the order of the checkboxes inside these two rows is irrelevant as long as we
 * keep the groups together".
 *
 * So, from measured widths (`pickTwoRows`):
 *   - the pieces are the colour groups, whole — a group is split only when it alone is wider than a row can be, and
 *     then at a checkbox boundary, into two pieces as near equal as the boxes allow (Ask first 2);
 *   - each piece goes on the first or the second row; the buttons stand at the end of the second row;
 *   - of every way that fits the width, the one taken is the one whose first row is the longer by the least, gaps
 *     included — or, when no way has the first row the longer (one small group beside the buttons), the one whose rows
 *     differ least; inside a row the pieces keep the registry's order (Ask first 1);
 *   - when no way fits two rows, `null`: the bar wraps as it did, the buttons still last (Ask first 3).
 *
 * PURE — no DOM; `tile-bar-rows.test.ts` covers it. TileSelector measures and draws.
 */

/** One colour group of the bar, as measured: its key and the width of each of its boxes, in order. */
export interface BarGroup {
  key: string;
  boxes: readonly number[];
}

export interface BarMeasures {
  groups: readonly BarGroup[];
  /** A strip's own padding and borders, both sides together, in px. */
  stripPad: number;
  /** The gap between two boxes inside a strip, in px. */
  boxGap: number;
  /** The gap between two strips, and before the buttons, in px. */
  gap: number;
  /** The buttons' group (the ⓘ and the three buttons), in px. */
  buttons: number;
  /** The width a row may take, in px. */
  width: number;
}

/** A piece of one group on one row: its boxes `from` (inclusive) to `to` (exclusive). */
export interface BarPiece {
  key: string;
  from: number;
  to: number;
}

export interface TwoRows {
  rows: [BarPiece[], BarPiece[]];
  /** Each row's width, in px, the buttons included on the second. */
  widths: [number, number];
}

/** A strip holding boxes `from`..`to` of `g`, in px. */
export function pieceWidth(g: BarGroup, from: number, to: number, m: Pick<BarMeasures, "stripPad" | "boxGap">): number {
  const boxes = g.boxes.slice(from, to);
  return m.stripPad + boxes.reduce((s, w) => s + w, 0) + m.boxGap * Math.max(0, boxes.length - 1);
}

/** The pieces: each group whole, or — wider than a row — split at the box boundary that leaves the wider half least wide. */
export function barPieces(m: BarMeasures): BarPiece[] {
  const out: BarPiece[] = [];
  for (const g of m.groups) {
    const n = g.boxes.length;
    if (n === 0) continue;
    if (n < 2 || pieceWidth(g, 0, n, m) <= m.width) {
      out.push({ key: g.key, from: 0, to: n });
      continue;
    }
    let best = 1;
    let bestWide = Infinity;
    for (let cut = 1; cut < n; cut++) {
      const wide = Math.max(pieceWidth(g, 0, cut, m), pieceWidth(g, cut, n, m));
      if (wide < bestWide) {
        bestWide = wide;
        best = cut;
      }
    }
    out.push({ key: g.key, from: 0, to: best }, { key: g.key, from: best, to: n });
  }
  return out;
}

/** A row's width: its pieces and the gaps between them — and, on the second, the buttons after a gap. */
function rowWidth(pieces: readonly BarPiece[], m: BarMeasures, withButtons: boolean): number {
  const byKey = new Map(m.groups.map((g) => [g.key, g]));
  const strips = pieces.reduce((s, p) => s + pieceWidth(byKey.get(p.key)!, p.from, p.to, m), 0) + m.gap * Math.max(0, pieces.length - 1);
  if (!withButtons) return strips;
  return pieces.length === 0 ? m.buttons : strips + m.gap + m.buttons;
}

/** The two rows, as above; `null` when the bar cannot stand on two rows of `width`. */
export function pickTwoRows(m: BarMeasures): TwoRows | null {
  const pieces = barPieces(m);
  const n = pieces.length;
  if (n === 0 || n > 16) return null;
  let best: { mask: number; diff: number; widths: [number, number] } | null = null;
  let closest: { mask: number; diff: number; widths: [number, number] } | null = null;
  // Every way of putting each piece on row 1 (bit set) or row 2; row 1 never empty.
  for (let mask = 1; mask < 1 << n; mask++) {
    const one = pieces.filter((_, i) => mask & (1 << i));
    const two = pieces.filter((_, i) => !(mask & (1 << i)));
    const w1 = rowWidth(one, m, false);
    const w2 = rowWidth(two, m, true);
    if (w1 > m.width + 0.5 || w2 > m.width + 0.5) continue;
    if (!closest || Math.abs(w1 - w2) < closest.diff - 0.01) closest = { mask, diff: Math.abs(w1 - w2), widths: [w1, w2] };
    if (w1 < w2) continue;
    const diff = w1 - w2;
    if (!best || diff < best.diff - 0.01) best = { mask, diff, widths: [w1, w2] };
  }
  best ??= closest;
  if (!best) return null;
  const mask = best.mask;
  return {
    rows: [pieces.filter((_, i) => mask & (1 << i)), pieces.filter((_, i) => !(mask & (1 << i)))],
    widths: best.widths,
  };
}

/**
 * Pieces chosen on earlier widths, fitted to the items a group has NOW — a preview opened or closed since adds or takes
 * a box: each group's last piece runs to its end, a piece past the end goes, and a group no piece names gets one
 * whole piece (on the second row, before the buttons, until the next measure places it). So no box is ever left out.
 */
export function fitPieces(rows: readonly (readonly BarPiece[])[], counts: Readonly<Record<string, number>>): BarPiece[][] {
  const last = new Map<string, number>();
  for (const row of rows) for (const p of row) last.set(p.key, Math.max(last.get(p.key) ?? -1, p.from));
  const out = rows.map((row) =>
    row
      .filter((p) => (counts[p.key] ?? 0) > p.from)
      .map((p) => (last.get(p.key) === p.from ? { ...p, to: counts[p.key] ?? 0 } : { ...p, to: Math.min(p.to, counts[p.key] ?? 0) })),
  );
  const named = new Set(out.flat().map((p) => p.key));
  const missing = Object.keys(counts).filter((k) => (counts[k] ?? 0) > 0 && !named.has(k));
  if (missing.length > 0) out[out.length - 1].push(...missing.map((key) => ({ key, from: 0, to: counts[key] })));
  return out;
}
