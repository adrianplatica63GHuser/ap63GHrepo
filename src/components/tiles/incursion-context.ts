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
 *
 * Slice #38.76: and WHICH TILE — the eye's („peek") or the chain link's, „Legături" („links"). One choice per
 * list, shared: at most one eye or chain link is pressed on the whole list, and pressing either closes whatever
 * the other had open. One context, so #38.72's magnifier lock covers both.
 */
import { createContext, useContext, type ComponentType } from "react";
import { previewKey, type PreviewTarget } from "@/lib/ui/previews";

/** Slice #38.76: the tile an open row shows — the eye's („peek") or the chain link's „Legături" („links"). */
export type IncursionView = "peek" | "links";

/** The open row and the tile it shows. */
export type IncursionOpen = PreviewTarget & { view: IncursionView };

export interface Incursion {
  /** The row whose Incursiune is open, and which tile, or none. */
  open: IncursionOpen | null;
  /**
   * The eye or the chain link pressed: opens this row's tile, moves it here from another row or another button,
   * or — the same row and the same button — closes it.
   */
  toggle: (target: PreviewTarget, view: IncursionView) => void;
}

/** Whether `open` is this row's `view` — the button that opened it reads pressed. */
export function isOpenFor(open: IncursionOpen | null, target: PreviewTarget, view: IncursionView): boolean {
  return open !== null && open.view === view && previewKey(open) === previewKey(target);
}

export const IncursionContext = createContext<Incursion | null>(null);

/** The list's Incursiune, or null outside a list that offers one (a detail screen's association tiles). */
export function useIncursion(): Incursion | null {
  return useContext(IncursionContext);
}

/** The tile a list draws for an open Incursiune — `src/app/_components/incursion-tile.tsx`. */
export type IncursionTileComponent = ComponentType<{ target: PreviewTarget; view: IncursionView; onClose: () => void }>;
