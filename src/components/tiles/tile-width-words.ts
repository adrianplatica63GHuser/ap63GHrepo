/**
 * The words a tile's width handle says — their shape, and the plain ones before a screen hands its own over.
 *                                                                                         (Slice 41.17)
 *
 * No next-intl here: the tile packing (use-tile-packing.ts) imports this, and a suite that imports the packing bare
 * (document-delete.test.ts) must not load next-intl's ES modules. The words in the screen's language come from
 * `useTileWidthWords` (use-tile-width-words.ts).
 */
export interface TileWidthWords {
  /** The handle's name: „Lățimea panoului {title}”. */
  handle: (title: string) => string;
  /** Its value: „3 unități”. */
  units: (count: number) => string;
}

/** Until a screen hands its words over: the tile's own name, the bare count. */
export const PLAIN_TILE_WIDTH_WORDS: TileWidthWords = { handle: (title) => title, units: (count) => String(count) };
