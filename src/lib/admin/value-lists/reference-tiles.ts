/**
 * The pure half of a Reference Data page's tiles.               (Slice #39.75)
 *
 * `ReferenceTiles` (src/app/admin/value-lists/_components/reference-tiles.tsx) draws them; this file says where their
 * places are kept, how many units the flow takes across, and how wide the allowed-uses grid's tile is — kept out of
 * the components so the tests can read them without a browser.
 */
import { MIN_TILE_UNITS, dialogUnits } from "@/lib/ui/field-widths";
import type { ScreenTiles } from "@/lib/ui/screen-tiles";

/** The page's screen: its key, its tiles in reading order, the widest, and the first two tiles across. */
export function referenceScreen(page: string, tiles: readonly { key: string; units: number }[]): ScreenTiles {
  const widest = Math.max(...tiles.map((t) => t.units));
  return {
    entity: `reference-${page}`,
    tiles: tiles.map((t) => t.key),
    units: widest,
    flowUnits: tiles.length > 1 ? tiles[0].units + tiles[1].units : widest,
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
