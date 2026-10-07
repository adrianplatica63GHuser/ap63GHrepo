/**
 * A tile's title, and the one grey line under it saying what the tile holds.
 *                                                              (Slice #38.30)
 *
 * The title is what it always was — uppercase, `text-sm`, semibold — so a
 * locator reading the tile's `h2` keeps matching. The subtitle is a second
 * line, `text-xs`, in the fade colour, in sentence case and with no full stop.
 *
 * ⚠️ **THE SUBTITLE NEVER WIDENS A TILE.** A list tile is `w-fit`: its width is
 * what it holds. A line that took part in that measure would make a long
 * subtitle the widest thing in the tile and push the tile wider, which would
 * move every tile packed after it. So the line is `width: 0` with
 * `min-width: 100%` — it takes the width the tile already has and adds none of
 * its own — and is cut with an ellipsis, its full text in the tooltip.
 *
 * ⚠️ **IT SHOWS WHENEVER THE TITLE SHOWS** (the header's Ask first 1). A line
 * that came and went with the window's width would move the fields under it.
 *
 * `children` sit in the title's line after the text — the system ID's corner
 * (#37.57) on the first tile of each record.
 */
import type { ReactNode } from "react";

/** The title's classes — those of every tile heading before #38.30. */
export const TILE_TITLE_CLASS =
  "flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink dark:text-zinc-400";

/** The subtitle's classes: one grey line, cut with an ellipsis, adding no width. */
export const TILE_SUBTITLE_CLASS =
  "w-0 min-w-full truncate text-xs font-normal normal-case tracking-normal text-fade dark:text-zinc-500";

export function TileSubtitle({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    // A `div`, not a `p`: the tiles' own specs read their paragraphs as a list
    // (TC-TILES-08's empty-state sentences), and this line is not one of them.
    <div className={TILE_SUBTITLE_CLASS} title={text} data-tile-subtitle="">
      {text}
    </div>
  );
}

export function TileTitle({
  title,
  subtitle,
  className = "mb-2",
  children,
}: {
  title: ReactNode;
  /** One line saying what the tile holds; absent, the title stands alone. */
  subtitle?: string;
  /** The block's margin — `mb-2` like the headings it replaces, `mb-3` where those had it. */
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`} data-tile-title="">
      <h2 className={TILE_TITLE_CLASS}>
        {title}
        {children}
      </h2>
      <TileSubtitle text={subtitle} />
    </div>
  );
}
