"use client";

/**
 * A detail screen's tile row.                         (Slices #37.56, 40.32)
 *
 * Slice 40.32 (Adrian, 2026-10-22: „Currently, we have a rule that the "peek
 * inside" tiles … cannot be moved from the right edge; I would like them to be
 * movable and to start as default position on the right edge"): ONE AREA. The
 * tiles the registry's `placement.right` names (`src/lib/ui/tiles.ts`) — a
 * person's „Interacțiuni", a property's map, corners and Street View, a
 * document's „Pagini" — are boxes of the same packed area as every other tile
 * (`useTilePacking`'s `right`): each starts against the row's right edge, one
 * under another, top-aligned with the row, as the column stood — and is
 * grabbed, dragged, dropped and stored like any other. „Implicit" sends them
 * back. Until 40.32 they stood in a column of their own beside the left area,
 * fixed boxes nothing could move (#37.56, #37.79); the description below of
 * how they reach the area is still true.
 *
 * ⚠️ **THE FORM'S TILES ARE PORTALLED INTO IT, NOT MOVED OUT OF THE FORM.** The
 * form is `display: contents` in the area, so its right-hand tiles are
 * rendered by the form, as before — with its state, hidden rather than
 * unmounted when unticked — and placed here through `createPortal` into a
 * slot per tile. The slots are `display: contents`, in placement order, inside
 * the area, so the packing finds each tile as a box of its own; an empty slot
 * takes no room. A tile renders nothing until its slot exists (the first
 * commit), so a map is never mounted twice.
 *
 * A NARROW WINDOW: the area is never narrower than its widest tile
 * (`min-width`, `fitWidest`); when the widest left tile and the widest
 * right-hand one no longer fit side by side, the right-hand tiles start under
 * the left ones instead (#38.46's `fitsBeside`, made by the packing hook).
 */
import { useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTilePacking } from "./use-tile-packing";
import { PANEL_GAP } from "@/lib/ui/field-widths";

/** What a form needs to place a right-hand tile in its slot. */
export interface RightColumn {
  /** The tile is a right-hand one (`placement.right`): portalled into its slot. */
  has: (tile: string) => boolean;
  /** Its slot, once the column has been committed; null before. */
  slot: (tile: string) => HTMLElement | null;
}

/** The area: the whole row, never narrower than its widest tile. */
const LEFT_AREA_STYLE: CSSProperties = { gap: PANEL_GAP, flex: "1 1 0%", minWidth: "min-content" };

/** The slots for the tiles `right` names, and what a form reads them through. */
export function useRightColumn(right: readonly string[]): {
  column: RightColumn;
  slotRefs: Readonly<Record<string, (el: HTMLElement | null) => void>>;
} {
  const [slots, setSlots] = useState<Readonly<Record<string, HTMLElement>>>({});
  // One stable callback per tile: a new one each render would be called with
  // null and the element again, and each call would set state.
  const slotRefs = useMemo(
    () =>
      Object.fromEntries(
        right.map((tile) => [
          tile,
          (el: HTMLElement | null) =>
            setSlots((prev) => {
              if (el ? prev[tile] === el : !(tile in prev)) return prev;
              const next = { ...prev };
              if (el) next[tile] = el;
              else delete next[tile];
              return next;
            }),
        ]),
      ),
    [right],
  );
  const column = useMemo<RightColumn>(
    () => ({ has: (tile) => right.includes(tile), slot: (tile) => slots[tile] ?? null }),
    [right, slots],
  );
  return { column, slotRefs };
}

export function TileAreas({
  right,
  slotRefs,
  entity,
  children,
}: {
  /** Every right-hand tile, top to bottom at its starting place (`placement.right`). */
  right: readonly string[];
  slotRefs: Readonly<Record<string, (el: HTMLElement | null) => void>>;
  /** The tile choice's entity (per document type): the dragged arrangement is stored under it (#37.76). */
  entity: string;
  /** The other tiles. */
  children: ReactNode;
}) {
  // Slice #37.75: each box stands right under the box above it (`useTilePacking`); out of the flow, the boxes no
  // longer give the area its min-content width, so the hook gives it its widest box's. 40.32: the right-hand tiles
  // are boxes of it too.
  const areaRef = useRef<HTMLDivElement>(null);
  useTilePacking(areaRef, { fitWidest: true, entity, right });
  return (
    <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row>
      <div ref={areaRef} className="flex flex-wrap items-start" style={LEFT_AREA_STYLE} data-tile-area="left">
        {children}
        {right.length > 0 && (
          <div className="contents" data-tile-area="right">
            {right.map((tile) => (
              <div key={tile} className="contents" data-tile-slot={tile} ref={slotRefs[tile]} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
