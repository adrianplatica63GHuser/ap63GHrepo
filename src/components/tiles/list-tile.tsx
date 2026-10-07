/**
 * The frame of a LIST tile — an association list or META INFO.  (Slice #37.17)
 *
 * A list tile holds no form state, so one that is not ticked is not rendered.
 * It is as wide as what it holds — the association lists are tables of fixed
 * columns (#37.16) — and never narrower than a panel, so an empty list reads as
 * a tile rather than a strip. `data-tile` and the region name are how the specs
 * and a `?tab=` find it.
 *
 * `units` (Slice #37.27): a tile of that many width units instead — the
 * Natural Person's tiles line up on one grid, and their tables fill them.
 */
import type { ReactNode } from "react";
import { PANEL_STYLE, WIDE_TILE_STYLE, unitStyle } from "@/lib/ui/field-widths";
import { TILE_SURFACE } from "@/lib/ui/tile-surface";
import { TileTitle } from "./tile-title";

export function ListTile({
  tile,
  title,
  subtitle,
  wide = false,
  units,
  panel,
  surface = TILE_SURFACE,
  children,
}: {
  tile: string;
  title: string;
  /** Slice #38.30: the grey line under the title saying what the tile holds. */
  subtitle?: string;
  /** A fixed two-panel tile, for content that is not a table of fixed columns (META INFO). */
  wide?: boolean;
  /** Slice #37.27: exactly this many width units wide (`unitsRem`). */
  units?: number;
  /** Slice #37.36: also a `data-panel`, for the screens whose width checks read that mark (the home page). */
  panel?: string;
  /** Slice #37.88: the tile's group's surface (`groupSurface`) — the card's grey-blue when absent. */
  surface?: string;
  children: ReactNode;
}) {
  return (
    <section
      data-tile={tile}
      data-panel={panel}
      aria-label={title}
      className={`${wide || units ? "" : "w-fit "}max-w-full ${surface}`}
      style={units ? unitStyle(units) : wide ? WIDE_TILE_STYLE : { minWidth: PANEL_STYLE.width }}
    >
      <TileTitle title={title} subtitle={subtitle} />
      {children}
    </section>
  );
}
