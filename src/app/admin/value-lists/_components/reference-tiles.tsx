"use client";

/**
 * A Reference Data page's lists as tiles.                       (Slice #39.75)
 *
 * Adrian, 2026-10-17: „turn all the three panels into tiles the way we use for principal object forms … we can move it
 * around and double click will move them up to the edge”. The forms' own mechanism, through `TileUnitRow` (#38.12):
 * each tile right under the tile above it, dragged by its unused space, lifted to the edge by a double-click on it
 * (#38.45), its place kept per browser under the page's own key, `reference-<page>` — and „Implicit” at the top right
 * puts them back.
 *
 * WIDTHS ARE UNITS, NEVER PERCENTAGES (Ask first 2): each tile is the fewest whole units its table needs
 * (`valueListCardUnits`, `typeUsesUnits`), and its list fills it, so the gap between the list and the tile's edge is
 * the card's padding on both sides — since #39.88 one standard gap on every page but the roles' and the links'
 * (`REFERENCE_GAP_REM`, `referenceTileFill`, `referenceTileWidth`). The flow takes the first two tiles across (`flowUnits`): at 1920 px — the side is
 * eight units there — „Tipuri de Proprietate” (5) and „Categorii Folosință” (3) stand side by side, and the grid under
 * the first. At 1366 px the side holds five units and the tiles stand one under another.
 *
 * One piece for every page of Reference Data: 39.76 hands it the other pages' tiles.
 */
import type { ReactNode } from "react";
import { TileUnitRow } from "@/components/screen/tile-unit-row";
import { TilePositionsReset } from "@/components/screen/tile-positions-reset";
import { rem, unitStyle } from "@/lib/ui/field-widths";
import { referenceScreen } from "@/lib/admin/value-lists/reference-tiles";

export interface ReferenceTile {
  /** The tile's `data-tile`, the name its dragged place is kept under. */
  key: string;
  /** Its width in whole units. */
  units: number;
  /**
   * Slice #39.88: a width off the unit grid — „Cetățenie" and „Relația cu firma", whose tile is their list and two
   * standard gaps (`referenceTileWidth`). `units` is then the whole units that hold it, for the flow.
   */
  widthRem?: number;
  node: ReactNode;
  /** Slice #39.76: kept in the page but not shown — the role form's tile while no form is open. */
  hidden?: boolean;
  /**
   * Slice #39.76: a line of its own across the row (`basis-full`, which the packing lays out full width and never
   * drags) — the relationship triangle, at the width #38.77 gave it.
   */
  full?: boolean;
}

export function ReferenceTiles({ page, tiles }: { page: string; tiles: readonly ReferenceTile[] }) {
  // The flow's two tiles are the first two SHOWN: a hidden tile takes no room (`findBoxes` skips it).
  const screen = referenceScreen(page, tiles.filter((t) => !t.hidden));
  return (
    <div className="flex flex-col gap-3" data-reference-tiles={page}>
      <div className="flex justify-end">
        <TilePositionsReset entity={screen.entity} />
      </div>
      <TileUnitRow screen={screen}>
        {tiles.map((t) => (
          <div
            key={t.key}
            data-tile={t.key}
            data-tile-units={t.full ? undefined : t.units}
            data-tile-full={t.full ? "" : undefined}
            className={t.full ? "basis-full" : undefined}
            style={t.full ? undefined : t.widthRem !== undefined ? { width: rem(t.widthRem) } : unitStyle(t.units)}
            hidden={t.hidden}
          >
            {t.node}
          </div>
        ))}
      </TileUnitRow>
    </div>
  );
}
