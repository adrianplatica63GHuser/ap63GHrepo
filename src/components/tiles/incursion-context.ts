"use client";

/**
 * Which row's „Incursiune" is open on a list.                        (Slice #38.72)
 *
 * The eye on a row of the four principal lists (`IncursionButton`) shows, beside the list, the one tile that
 * says most about that object — `ListPreviews` holds the choice and draws the tile. ONE at a time (Ask first
 * #1): pressing another row's eye moves it there. While one is open every magnifier on the list is released,
 * its preview closed, and disabled (`PreviewButton` reads this). Nothing is stored: a reload closes it.
 *
 * Its own module, so the eye's button, the list's previews and the tile (which lives under `src/app/`, because
 * it reuses the detail screens' tiles) can all reach it without importing each other.
 */
import { createContext, useContext, type ComponentType } from "react";
import type { PreviewTarget } from "@/lib/ui/previews";

export interface Incursion {
  /** The row whose Incursiune is open, or none. */
  open: PreviewTarget | null;
  /** The eye pressed: opens this row's, moves it here from another row, or — the same row — closes it. */
  toggle: (target: PreviewTarget) => void;
}

export const IncursionContext = createContext<Incursion | null>(null);

/** The list's Incursiune, or null outside a list that offers one (a detail screen's association tiles). */
export function useIncursion(): Incursion | null {
  return useContext(IncursionContext);
}

/** The tile a list draws for an open Incursiune — `src/app/_components/incursion-tile.tsx`. */
export type IncursionTileComponent = ComponentType<{ target: PreviewTarget; onClose: () => void }>;
