"use client";

/**
 * A detail screen's tile row in two areas.                     (Slice #37.56)
 *
 * The left area is the row as it was: every tile flows and wraps, in the
 * registry's order. The right column holds the tiles the registry's
 * `placement.right` names (`src/lib/ui/tiles.ts`), one under another,
 * top-aligned with the row — a Document's page image; a Property's map, its
 * corners and Street View. It is as wide as its widest shown tile, and each
 * tile stands against the row's right edge (the 3-unit map over the 4-unit
 * corners), so a narrower one leaves its gap on the left, on a unit line.
 *
 * ⚠️ **A COLUMN, NOT A REORDERED ROW.** Putting the page image last in one
 * wrapping row would put it at the right only when it happened to end a line.
 *
 * ⚠️ **THE FORM'S TILES ARE PORTALLED INTO IT, NOT MOVED OUT OF THE FORM.** The
 * form is `display: contents` in the left area, so its right-hand tiles are
 * rendered by the form, as before — with its state, hidden rather than
 * unmounted when unticked — and placed here through `createPortal` into a
 * slot per tile. The slots are `display: contents` in placement order, so the
 * column reads in that order whatever order the form renders them in, and an
 * empty slot takes no room and no gap. A tile renders nothing until its slot
 * exists (the first commit), so a map is never mounted twice.
 *
 * A NARROW WINDOW: the left area is never narrower than its widest tile
 * (`min-width: min-content`), so when that tile and the column no longer fit
 * side by side the column wraps under the left area — the form first (#37.56's
 * Ask first). The row is still `unitRowStyle`'s whole units, and so, since the
 * column is whole units, is the left area.
 */
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { PANEL_GAP } from "@/lib/ui/field-widths";

/** What a form needs to place a tile in the right column. */
export interface RightColumn {
  /** The tile stands in the right column. */
  has: (tile: string) => boolean;
  /** Its slot, once the column has been committed; null before. */
  slot: (tile: string) => HTMLElement | null;
}

/** The left area: what is left of the row, never narrower than its widest tile. */
const LEFT_AREA_STYLE: CSSProperties = { gap: PANEL_GAP, flex: "1 1 0%", minWidth: "min-content" };

/** The right column's slots for the tiles `right` names, and what a form reads them through. */
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
  shownRight,
  slotRefs,
  children,
}: {
  /** Every tile that may stand in the right column, top to bottom. */
  right: readonly string[];
  /** How many of them are shown; none, and the column is not drawn. */
  shownRight: number;
  slotRefs: Readonly<Record<string, (el: HTMLElement | null) => void>>;
  /** The left area's tiles. */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row>
      <div className="flex flex-wrap items-start" style={LEFT_AREA_STYLE} data-tile-area="left">
        {children}
      </div>
      {right.length > 0 && (
        <div
          className={shownRight > 0 ? "flex flex-col items-end" : "hidden"}
          hidden={shownRight === 0}
          style={{ gap: PANEL_GAP }}
          data-tile-area="right"
        >
          {right.map((tile) => (
            <div key={tile} className="contents" data-tile-slot={tile} ref={slotRefs[tile]} />
          ))}
        </div>
      )}
    </div>
  );
}
