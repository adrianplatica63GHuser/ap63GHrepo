/**
 * A tile's surface — its fill, rim, corners, padding and shadow.  (Slice #37.78)
 *
 * The tiles of the right column (the registry's `placement.right`,
 * `src/lib/ui/tiles.ts`: the Property's „Hartă", „Puncte de contur" and
 * „Street View"; the Document's „Pagini") never move: #37.76's drag never
 * starts on them. They are tinted a light purple so the user sees at a glance
 * that they stay where they are. Every other tile keeps the card's grey-blue.
 *
 * WHICH TILES is the registry's answer, never a second list: a form asks
 * `RightColumn.has(tile)` (`src/components/tiles/tile-areas.tsx`), so a tile
 * added to `placement.right` later is tinted by itself, and a right tile stays
 * tinted when a narrow window wraps the column under the left area.
 *
 * THE COLOUR (`src/app/globals.css`): each purple has the OKLCH lightness of
 * the grey it stands beside, so the tint reads as a hue, not a shade.
 *   fill  `--color-card-pinned`          #F6F0FE  L 0.964 C 0.020 h 305 — the card #EEF4FA is L 0.964
 *   rim   `--color-card-pinned-rim`      #DACBEE  L 0.865 C 0.050 h 305 — the rim  #C6D4E8 is L 0.866
 *   dark  `--color-card-pinned-dark`     #1C1523  L 0.211 C 0.029 h 307 — zinc-900 #18181B is L 0.210
 *   dark rim `--color-card-pinned-rim-dark` #2C2237 L 0.273 C 0.040 h 306 — zinc-800 #27272A is L 0.274
 * Only the tile's own surface changes: the map's and Street View's frames,
 * the corner table's white body and the page viewer's white box keep theirs.
 */

/** Every tile that can move: the card. */
export const TILE_SURFACE =
  "rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** A right-column tile, which never moves: the same box, tinted purple. */
export const PINNED_TILE_SURFACE =
  "rounded-md border border-card-pinned-rim bg-card-pinned p-3 shadow-sm dark:border-card-pinned-rim-dark dark:bg-card-pinned-dark";

/** The surface for a tile: pinned when it stands in the right column. */
export function tileSurface(pinned: boolean): string {
  return pinned ? PINNED_TILE_SURFACE : TILE_SURFACE;
}
