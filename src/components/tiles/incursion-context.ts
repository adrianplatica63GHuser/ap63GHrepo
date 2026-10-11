"use client";

/**
 * Which row's tiles are open on a list.                                (Slice #38.72, #38.76, #39.04)
 *
 * The four principal lists' rows carry three toggles — the magnifier („Previzualizare", `PreviewButton`), the eye
 * („Incursiune", `IncursionButton`) and the chain link („Legături", `LinksButton`). `ListPreviews` holds which row
 * and which of its tiles are open (`@/lib/ui/row-tiles`) and draws them in one column beside the list.
 *
 * Slice #39.04 replaced #38.72's „one eye or chain link per list, the magnifiers locked while it is open" and
 * #38.71's „two previews from any rows": now ONE row at a time and, on that row, any subset of the three; while
 * any is open, the three on every other row are disabled. Nothing is stored: a reload, a page change, a search or a
 * filter closes them.
 *
 * Its own module, so the buttons, the list's column and the tile (which lives under `src/app/`, because it reuses
 * the detail screens' tiles) can all reach it without importing each other.
 */
import { createContext, useContext, type ComponentType } from "react";
import type { PreviewTarget } from "@/lib/ui/previews";
import type { RowTile, RowTiles } from "@/lib/ui/row-tiles";

/** The two tiles from inside the object — the eye's („peek") and the chain link's „Legături" („links"). */
export type IncursionView = Exclude<RowTile, "preview">;

export interface Incursion {
  /** The open row and its open tiles. */
  state: RowTiles;
  /** A row's button pressed: opens or closes that tile on that row (nothing on a locked row). */
  toggle: (target: PreviewTarget, tile: RowTile) => void;
  /** A tile's „Închide": releases its button. */
  close: (tile: RowTile) => void;
  /** Whether the list draws the eye and the chain link — it passed `ListPreviews` an Incursiune tile. */
  offersIncursion: boolean;
}

export const IncursionContext = createContext<Incursion | null>(null);

/** The list's row tiles, or null outside a list (a detail screen's association tiles). */
export function useIncursion(): Incursion | null {
  return useContext(IncursionContext);
}

/** The tile a list draws for an open eye or chain link — `src/app/_components/incursion-tile.tsx`. */
export type IncursionTileComponent = ComponentType<{ target: PreviewTarget; view: IncursionView; onClose: () => void }>;
