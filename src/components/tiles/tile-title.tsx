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
 * its own — and is cut with an ellipsis, its full text in the tooltip (41.46: TextTooltip's bubble).
 *
 * ⚠️ **IT SHOWS WHENEVER THE TITLE SHOWS** (the header's Ask first 1). A line
 * that came and went with the window's width would move the fields under it.
 *
 * `children` sit in the title's line after the text. (#37.57 put the system ID's
 * corner there on each record's first tile; 41.22 moved it to the page bar.)
 *
 * Slice 40.06: every record and dashboard tile draws its title through this piece — the inheritance tree tile and
 * Tarla's tiles included — so one class string changes them all. `tile-heading-one-piece.test.ts` keeps it so. `id`
 * is the `h2`'s, for a tile that names itself with `aria-labelledby`.
 */
import type { ReactNode } from "react";
import { ADMIN_TILE_TITLE_TYPE, TILE_TITLE_TYPE } from "@/lib/ui/title-type";
import { TextTooltip } from "@/lib/ui/text-tooltip";

/**
 * The title's classes. Slice 40.18: set in Roboto Slab, navy, as alternative 13 draws kinds 1, 2 and 4
 * (`TILE_TITLE_TYPE`, src/lib/ui/title-type.ts) — before it, 14-px Arial semibold in ink (zinc-400 in dark). The line
 * is 24 px, so a tile's title is 4 px taller than it was.
 */
export const TILE_TITLE_CLASS = `flex items-center gap-2 ${TILE_TITLE_TYPE}`;
/** Slice 41.83: a tile's title under Administrare — the same, in #C00000. */
export const ADMIN_TILE_TITLE_CLASS = `flex items-center gap-2 ${ADMIN_TILE_TITLE_TYPE}`;

/** The subtitle's classes: one line, cut with an ellipsis, adding no width. 40.95: the header's navy (`text-label`). */
export const TILE_SUBTITLE_CLASS =
  "w-0 min-w-full truncate text-xs font-normal normal-case tracking-normal text-label";

export function TileSubtitle({ text }: { text: string | undefined }) {
  if (!text) return null;
  return (
    // A `div`, not a `p`: the tiles' own specs read their paragraphs as a list
    // (TC-TILES-08's empty-state sentences), and this line is not one of them.
    // 41.46: its whole text in the icon buttons' bubble when it is cut (TextTooltip), not the browser's small title.
    <TextTooltip as="div" className={TILE_SUBTITLE_CLASS} text={text} data-tile-subtitle="">
      {text}
    </TextTooltip>
  );
}

export function TileTitle({
  title,
  subtitle,
  className = "mb-2",
  id,
  children,
  action,
  hint,
  admin = false,
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
   * Slice 40.72: a control at the tile's top right — „Editează" (src/components/tiles/read-edit-tile.tsx). Outside the
   * heading, so its name stays the tile's own. Slice 41.38 — Adrian: „move the Edit button up so it has the same gap to
   * the upper edge of the tile as it has to the right edge": it is on the heading's row now, at its right end, its top
   * at the tile's padding as its right is; the title wraps before it, and the subtitle takes the whole width under them.
   * (Until 41.38 it sat on the subtitle's line, ≈36 px from the top and 13 from the right.)
   */
  action?: ReactNode;
  /**
   * Slice 41.37: an „i" (a HintBubble) right after the title's text, on its line — Clasificare's. Outside the `h2`, so
   * the heading's name stays the tile's own.
   */
  hint?: ReactNode;
  /** Slice 41.83: a tile under Administrare — its title in #C00000. */
  admin?: boolean;
}) {
  // 41.38: beside a 30-px action the title's first line (24 px) is centred on it — 3 px down — so a tile without one
  // keeps today's title height.
  const heading = (
    <h2 id={id} className={`${admin ? ADMIN_TILE_TITLE_CLASS : TILE_TITLE_CLASS} min-w-0${action ? " mt-[3px]" : ""}`}>
      {title}
      {children}
    </h2>
  );
  return (
    <div className={`min-w-0 ${className}`} data-tile-title="">
      {hint || action ? (
        <div className="flex items-start gap-1.5" data-tile-title-line="">
          {heading}
          {hint && <div className={`flex shrink-0 items-center${action ? " mt-[3px]" : ""}`}>{hint}</div>}
          {action && (
            <div className="ml-auto shrink-0 pl-0.5" data-tile-title-action="">
              {action}
            </div>
          )}
        </div>
      ) : (
        heading
      )}
      <TileSubtitle text={subtitle} />
    </div>
  );
}
