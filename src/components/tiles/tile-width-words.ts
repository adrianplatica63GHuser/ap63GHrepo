/**
 * The words a tile's width handle says — their shape, and the plain ones before a screen hands its own over.
 *                                                                                         (Slice 41.17)
 *
 * No next-intl here: the tile packing (use-tile-packing.ts) imports this, and a suite that imports the packing bare
 * (document-delete.test.ts) must not load next-intl's ES modules. The words in the screen's language come from
 * `useTileWidthWords` (use-tile-width-words.ts).
 */
import type { WidthVerdict } from "@/lib/ui/tile-width-rules";

export interface TileWidthWords {
  /** The handle's name: „Lățimea panoului {title}”. */
  handle: (title: string) => string;
  /** Its value: „3 unități”. */
  units: (count: number) => string;
  /** 41.18: what a verdict says, a line per reason — nothing when the width is fine. */
  verdict: (v: WidthVerdict) => string[];
  /** 41.19: the line a shared tile's bubble adds — „Lățimea se aplică panoului {title} pe toate formularele”. */
  shared: (title: string) => string;
}

/** Until a screen hands its words over: the tile's own name, the bare count. */
export const PLAIN_TILE_WIDTH_WORDS: TileWidthWords = { handle: (title) => title, units: (count) => String(count), verdict: () => [], shared: () => "" };
