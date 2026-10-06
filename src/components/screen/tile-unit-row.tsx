"use client";

/**
 * A screen's row of unit tiles, packed and dragged as on the record forms.
 *                                                              (Slice #38.12)
 *
 * `UnitRow`'s row — as many whole units as the window holds, never fewer than
 * the widest tile — with the forms' `useTilePacking` over it: each tile right
 * under the tile above it, dragged by its unused space, its place kept per
 * browser under the screen's own entity. The flow is held to `flowUnits`
 * across (`src/lib/ui/screen-tiles.ts`), so the screen opens in its default
 * columns at every width where they fit. Each tile names itself by `data-tile`;
 * a box without one is laid out but never stored.
 *
 * jsdom (jest) has no layout: there the row stays `UnitRow`'s flex-wrap.
 */
import { useRef, type ReactNode } from "react";
import { useTilePacking } from "@/components/tiles/use-tile-packing";
import { PANEL_GAP, screenRowStyle } from "@/lib/ui/field-widths";
import type { ScreenTiles } from "@/lib/ui/screen-tiles";

export function TileUnitRow({ screen, children }: { screen: ScreenTiles; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useTilePacking(ref, { entity: screen.entity, flowUnits: screen.flowUnits });
  return (
    <div style={screenRowStyle(screen.units)}>
      <div ref={ref} className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row data-tile-screen={screen.entity}>
        {children}
      </div>
    </div>
  );
}
