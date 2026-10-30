"use client";

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
 *
 * Slice 41.10 — `readEdit`: a list tile whose content reads and edits as a gray form tile does (40.72) — „Clasificare".
 * The tile's chrome is the frame's, its state the content's, so the frame hands the content three things through
 * `useTileChrome`: the place for „Editează" at the right of the subtitle's line (`TileAction` portals into it), the
 * blue outline while editing, and the fold to one line when there is nothing to read (40.64's `EmptyTileLine`, drawn
 * by the content with the frame's title, the frame's own title then left out).
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { PANEL_STYLE, WIDE_TILE_STYLE, unitStyle } from "@/lib/ui/field-widths";
import { TILE_SURFACE } from "@/lib/ui/tile-surface";
import { TileTitle } from "./tile-title";
import { TILE_EDITING_CLASS } from "./read-edit-tile";

export type TileChrome = {
  /** The tile's title, for „Editează"'s name and the folded line. */
  title: string;
  /** Where „Editează" goes; null until the frame has drawn it. */
  actionSlot: HTMLElement | null;
  setEditing: (editing: boolean) => void;
  setFolded: (folded: boolean) => void;
};

const TileChromeContext = createContext<TileChrome | null>(null);

/** The frame's chrome, for a `readEdit` tile's content; null outside one. */
export function useTileChrome(): TileChrome | null {
  return useContext(TileChromeContext);
}

/** „Editează" in the frame's corner — or in place, with no frame around (a jest render of the content alone). */
export function TileAction({ children }: { children: ReactNode }) {
  const chrome = useTileChrome();
  if (!chrome) return <div className="flex justify-end">{children}</div>;
  return chrome.actionSlot ? createPortal(children, chrome.actionSlot) : null;
}

export function ListTile({
  tile,
  title,
  subtitle,
  wide = false,
  units,
  panel,
  surface = TILE_SURFACE,
  readEdit = false,
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
  /** Slice 41.10: the content reads and edits as a gray form tile — see above. */
  readEdit?: boolean;
  children: ReactNode;
}) {
  const [actionSlot, setActionSlot] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState(false);
  const [folded, setFolded] = useState(false);
  const chrome = useMemo<TileChrome>(() => ({ title, actionSlot, setEditing, setFolded }), [title, actionSlot]);
  return (
    <section
      data-tile={tile}
      data-panel={panel}
      aria-label={title}
      className={`${wide || units ? "" : "w-fit "}max-w-full ${surface}${readEdit && editing ? ` ${TILE_EDITING_CLASS}` : ""}`}
      style={units ? unitStyle(units) : wide ? WIDE_TILE_STYLE : { minWidth: PANEL_STYLE.width }}
      data-tile-editing={readEdit && editing ? "" : undefined}
      data-tile-folded={readEdit && folded ? "" : undefined}
    >
      {readEdit ? (
        <>
          {!folded && <TileTitle title={title} subtitle={subtitle} action={<span ref={setActionSlot} className="flex items-center" data-tile-action-slot="" />} />}
          <TileChromeContext.Provider value={chrome}>{children}</TileChromeContext.Provider>
        </>
      ) : (
        <>
          <TileTitle title={title} subtitle={subtitle} />
          {children}
        </>
      )}
    </section>
  );
}
