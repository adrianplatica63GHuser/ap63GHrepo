/**
 * „Calcul drum lateral" — an owner's colour travels with the owner  (Slice #38.27)
 *
 * The colour is decided by the OWNER — by the owner's line in the file — and
 * never by where the owner's slice sits. The first owner in the file takes the
 * palette's first colour, the second the second, and so on, cycling past eight.
 * So a swap, by dragging one slice onto another or with ↑ ↓ in the owners'
 * table, moves each owner's colour with the owner.
 *
 * Every screen that draws slices asks here: the preview map, the owners'
 * table's swatch, and the history's map and table of a side-road run. A run
 * made before #38.23 has no file order to read, so the history colours its
 * slices by their place in the run's output, as it always did — nothing moves
 * on those maps.
 *
 * The road is not an owner: it stays grey, a colour the palette never uses.
 */

/** Distinct fill colours for the owners' slices, cycled past eight. */
export const OWNER_COLORS: readonly string[] = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#a855f7", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
  "#ef4444", // red
  "#6366f1", // indigo
];

/** The road's fill — grey, and never an owner's colour. */
export const ROAD_COLOR = "#6b7280";

/**
 * The colour of the owner on the file's line `fileIndex` (0-based, as compute.ts's
 * `owner` and the `order` array count). Cycles past the palette's length.
 */
export function ownerColor(fileIndex: number): string {
  const n = OWNER_COLORS.length;
  const i = Math.trunc(fileIndex);
  return OWNER_COLORS[((i % n) + n) % n];
}

/**
 * The colour of each slice, in slice order: `order[k]` is the file index of the
 * owner in slice k (compute.ts), so slice k wears that owner's colour.
 */
export function sliceColors(order: readonly number[]): string[] {
  return order.map(ownerColor);
}
