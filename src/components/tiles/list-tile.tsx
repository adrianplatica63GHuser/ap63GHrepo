/**
 * The frame of a LIST tile — an association list or META INFO.  (Slice #37.17)
 *
 * A list tile holds no form state, so one that is not ticked is not rendered.
 * It is as wide as what it holds — the association lists are tables of fixed
 * columns (#37.16) — and never narrower than a panel, so an empty list reads as
 * a tile rather than a strip. `data-tile` and the region name are how the specs
 * and a `?tab=` find it.
 */
import type { ReactNode } from "react";
import { PANEL_STYLE, WIDE_TILE_STYLE } from "@/lib/ui/field-widths";

export function ListTile({
  tile,
  title,
  wide = false,
  children,
}: {
  tile: string;
  title: string;
  /** A fixed two-panel tile, for content that is not a table of fixed columns (META INFO). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      data-tile={tile}
      aria-label={title}
      className={`${wide ? "" : "w-fit "}max-w-full rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900`}
      style={wide ? WIDE_TILE_STYLE : { minWidth: PANEL_STYLE.width }}
    >
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}
