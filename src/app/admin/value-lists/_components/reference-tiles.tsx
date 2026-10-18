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
 * the card's padding on both sides. The flow takes the first two tiles across (`flowUnits`): at 1920 px — the side is
 * eight units there — „Tipuri de Proprietate” (5) and „Categorii Folosință” (3) stand side by side, and the grid under
 * the first. At 1366 px the side holds five units and the tiles stand one under another.
 *
 * One piece for every page of Reference Data: 39.76 hands it the other pages' tiles.
 */
import type { ReactNode } from "react";
import { TileUnitRow } from "@/components/screen/tile-unit-row";
import { TilePositionsReset } from "@/components/screen/tile-positions-reset";
import { unitStyle } from "@/lib/ui/field-widths";
import { referenceScreen } from "@/lib/admin/value-lists/reference-tiles";

export interface ReferenceTile {
  /** The tile's `data-tile`, the name its dragged place is kept under. */
  key: string;
  /** Its width in whole units. */
  units: number;
  node: ReactNode;
}

export function ReferenceTiles({ page, tiles }: { page: string; tiles: readonly ReferenceTile[] }) {
  const screen = referenceScreen(page, tiles);
  return (
    <div className="flex flex-col gap-3" data-reference-tiles={page}>
      <div className="flex justify-end">
        <TilePositionsReset entity={screen.entity} />
      </div>
      <TileUnitRow screen={screen}>
        {tiles.map((t) => (
          <div key={t.key} data-tile={t.key} data-tile-units={t.units} style={unitStyle(t.units)}>
            {t.node}
          </div>
        ))}
      </TileUnitRow>
    </div>
  );
}
