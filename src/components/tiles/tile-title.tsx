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
 *
 * Slice 40.06: every record and dashboard tile draws its title through this piece — the inheritance tree tile and
 * Tarla's tiles included — so one class string changes them all. `tile-heading-one-piece.test.ts` keeps it so. `id`
 * is the `h2`'s, for a tile that names itself with `aria-labelledby`.
 */
import type { ReactNode } from "react";
import { TILE_TITLE_TYPE } from "@/lib/ui/title-type";

/**
 * The title's classes. Slice 40.18: set in Roboto Slab, navy, as alternative 13 draws kinds 1, 2 and 4
 * (`TILE_TITLE_TYPE`, src/lib/ui/title-type.ts) — before it, 14-px Arial semibold in ink (zinc-400 in dark). The line
 * is 24 px, so a tile's title is 4 px taller than it was.
 */
export const TILE_TITLE_CLASS = `flex items-center gap-2 ${TILE_TITLE_TYPE}`;

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
  id,
  children,
  action,
}: {
  title: ReactNode;
  /** One line saying what the tile holds; absent, the title stands alone. */
  subtitle?: string;
  /** The block's margin — `mb-2` like the headings it replaces, `mb-3` where those had it. */
  className?: string;
  /** The heading's id, for a tile labelled by it (`aria-labelledby`). */
  id?: string;
  children?: ReactNode;
  /**
   * Slice 40.72: a control at the right of the line under the heading — „Editează"
   * (src/components/tiles/read-edit-tile.tsx). Outside the heading, so its name stays the tile's own, and under it,
   * so the heading's own corner (the system ID, #37.57) keeps the tile's top-right corner.
   */
  action?: ReactNode;
}) {
  return (
    <div className={`min-w-0 ${className}`} data-tile-title="">
      <h2 id={id} className={TILE_TITLE_CLASS}>
        {title}
        {children}
      </h2>
      {action ? (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <TileSubtitle text={subtitle} />
          </div>
          <div className="shrink-0">{action}</div>
        </div>
      ) : (
        <TileSubtitle text={subtitle} />
      )}
    </div>
  );
}
