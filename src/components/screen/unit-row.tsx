/**
 * A screen's row of unit tiles.                          (Slices #37.34, #37.35)
 *
 * As many whole width units as the window holds, never fewer than the widest
 * tile on it (`screenRowStyle`); the tiles — each `unitStyle(n)` or
 * `screenPanel(name, n)` — flow and wrap in reading order, with the unit gap
 * between them. `expectUnitGrid` reads the row through `data-tile-row`'s parent,
 * as it reads a detail screen's.
 */
import type { ReactNode } from "react";
import { PANEL_GAP, screenRowStyle } from "@/lib/ui/field-widths";

export function UnitRow({ units, children }: { units: readonly number[]; children: ReactNode }) {
  return (
    <div style={screenRowStyle(Math.max(...units))}>
      <div className="flex flex-wrap items-start" style={{ gap: PANEL_GAP }} data-tile-row>
        {children}
      </div>
    </div>
  );
}
