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
 * Slice #37.88 gives every tile its group's colour (`groupSurface`): the record's
 * own data in the card's grey-blue, „Corelate" light green, „Clasificări" and
 * „Conexiuni" light yellow, the right column purple — all four at one lightness:
 *   green  `--color-card-related`  #EBF7ED / rim #BBDDC2 / dark #0F1C11 / dark rim #182D1D (h 151)
 *   yellow `--color-card-meta`     #F8F3E5 / rim #DDD3AE / dark #1D1808 / dark rim #2E270D (h 93)
 * Only the tile's own surface changes: the map's and Street View's frames,
 * the corner table's white body and the page viewer's white box keep theirs.
 */

import type { TileGroup } from "@/lib/ui/tiles";

/** Every tile that can move: the card. */
export const TILE_SURFACE =
  "rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** A right-column tile, which never moves: the same box, tinted purple. */
export const PINNED_TILE_SURFACE =
  "rounded-md border border-card-pinned-rim bg-card-pinned p-3 shadow-sm dark:border-card-pinned-rim-dark dark:bg-card-pinned-dark";

/** Slice #37.88: „Corelate", the same box in light green. */
export const RELATED_TILE_SURFACE =
  "rounded-md border border-card-related-rim bg-card-related p-3 shadow-sm dark:border-card-related-rim-dark dark:bg-card-related-dark";

/** Slice #37.88: „Clasificări" and „Conexiuni", the same box in light yellow. */
export const META_TILE_SURFACE =
  "rounded-md border border-card-meta-rim bg-card-meta p-3 shadow-sm dark:border-card-meta-rim-dark dark:bg-card-meta-dark";

/** The surface for a tile: pinned when it stands in the right column. */
export function tileSurface(pinned: boolean): string {
  return pinned ? PINNED_TILE_SURFACE : TILE_SURFACE;
}

/**
 * The surface for a tile's GROUP (Slice #37.88) — the registry's answer
 * (`tileGroupOf`), never a tile's name inside a form, so a tile keeps its
 * colour wherever it is dragged.
 */
export function groupSurface(group: TileGroup): string {
  switch (group) {
    case "related": return RELATED_TILE_SURFACE;
    case "meta":    return META_TILE_SURFACE;
    case "fixed":   return PINNED_TILE_SURFACE;
    default:        return TILE_SURFACE;
  }
}

/**
 * The narrow strip a group's checkboxes stand in on the bar (Slice #37.88):
 * the group's fill and rim, rounded like the tiles.
 */
export function groupStrip(group: TileGroup): string {
  const colours: Record<TileGroup, string> = {
    record:  "border-card-rim bg-card dark:border-zinc-800 dark:bg-zinc-900",
    related: "border-card-related-rim bg-card-related dark:border-card-related-rim-dark dark:bg-card-related-dark",
    meta:    "border-card-meta-rim bg-card-meta dark:border-card-meta-rim-dark dark:bg-card-meta-dark",
    fixed:   "border-card-pinned-rim bg-card-pinned dark:border-card-pinned-rim-dark dark:bg-card-pinned-dark",
  };
  return `flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border px-2.5 py-1 ${colours[group]}`;
}
