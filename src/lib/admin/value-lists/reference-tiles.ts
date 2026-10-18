/**
 * The pure half of a Reference Data page's tiles.               (Slice #39.75)
 *
 * `ReferenceTiles` (src/app/admin/value-lists/_components/reference-tiles.tsx) draws them; this file says where their
 * places are kept, how many units the flow takes across, and how wide the allowed-uses grid's tile is — kept out of
 * the components so the tests can read them without a browser.
 */
import { MIN_TILE_UNITS, dialogUnits } from "@/lib/ui/field-widths";
import type { ScreenTiles } from "@/lib/ui/screen-tiles";

/**
 * The page's screen: its key, its tiles in reading order, the widest, and the first two tiles across. A `full` tile —
 * a line of its own across the row, the relationship triangle (#39.76) — sets neither the widest nor the flow: the
 * row is never held wider than the window for it, and the two tiles across are the first two under it.
 */
export function referenceScreen(page: string, tiles: readonly { key: string; units: number; full?: boolean }[]): ScreenTiles {
  const sized = tiles.filter((t) => !t.full);
  const widest = Math.max(...sized.map((t) => t.units));
  return {
    entity: `reference-${page}`,
    tiles: tiles.map((t) => t.key),
    units: widest,
    flowUnits: sized.length > 1 ? sized[0].units + sized[1].units : widest,
  };
}

/** The allowed-uses card's side padding (`px-5`), in rem. */
const TYPE_USES_PADDING_REM = 1.25;

/**
 * The allowed-uses grid's tile — the fewest units that hold the table as it reads (a column per use, so it grows with
 * the list), with the card's padding. `px` is the table's own width, measured at `max-content`.
 */
export function typeUsesUnits(px: number): number {
  return Math.max(MIN_TILE_UNITS, dialogUnits(px / 16, TYPE_USES_PADDING_REM));
}
