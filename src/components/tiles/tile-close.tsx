"use client";

/**
 * „Închide — <tile>": an X in a tile's top-right corner.                                            (Slice 41.91)
 *
 * Adrian, 2026-11-05: „Any tile that is in a calm state AKA has an Edit button the top right corner shall move that
 * button to the left, and shall have a „close tile" button at the old place of the edit button; The gap between the
 * buttons is the usual one; The „close tile" button is an X similar to the cancel button used elsewhere; Clicking the
 * „close tile" button will close the tile, and this will reflect also in the panels checkboxes; when a tile is in edit
 * mode the Close Tile button will not be shown. The „close tile" button will also be shown at the same position (the
 * corner top right) on the other tiles".
 *
 * X, secondary, sm — „Editează"'s size, „Renunță"'s icon (Ask first 2). It is the rightmost thing in the corner; what
 * stood there keeps its order to its left, at the corner's gap (8 px). Pressing it is the screen's own untick
 * (`use-tile-choice.ts`'s `tileCloserFor`), and the focus moves to „Panouri". It shows only on a tile „Panouri" can
 * hide, while it is shown and is not the last one shown, and not while the tile is in edit (`hidden`, the caller's).
 *
 * WHICH TILE: `tile` when the caller knows it; otherwise the nearest `[data-tile]` around the button, read once it is
 * on the page — so `TileTitle` draws it for every tile that names itself by its title, with no prop threaded through.
 * `firstTitle`: drawn by a title, only the tile's first one (an address block's second title gets none). An
 * Incursiune keeps its own close; its tiles are no registry's, so they get none.
 */
import { useCallback, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import { subscribeTileClosers, tileClosable, tileCloserFor, tileClosersVersion } from "./use-tile-choice";

const noVersion = () => 0;

export function TileCloseButton({
  tile,
  title,
  hidden = false,
  firstTitle = false,
  untitled = false,
}: {
  /** The registry's key; found from the nearest `[data-tile]` when absent. */
  tile?: string;
  /** The tile's name, for „Închide — <tile>"; the tile's region name when absent. */
  title?: string;
  /** The tile is in edit: no X. */
  hidden?: boolean;
  /** Drawn by a tile's title: only by the tile's first one. */
  firstTitle?: boolean;
  /** Drawn by a folded tile's one line: only where the tile shows no title (which draws its own). */
  untitled?: boolean;
}) {
  const t = useTranslations("shared.readEdit");
  useSyncExternalStore(subscribeTileClosers, tileClosersVersion, noVersion);
  const [where, setWhere] = useState<{ key: string; name: string } | null>(tile && title ? { key: tile, name: title } : null);
  const anchor = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      const box = el.closest<HTMLElement>("[data-tile]");
      const key = tile ?? box?.getAttribute("data-tile") ?? null;
      if (!key) return;
      if (firstTitle && box && box.querySelector("[data-tile-title]") !== el.closest("[data-tile-title]")) return;
      if (untitled && box?.querySelector("[data-tile-title]")) return;
      const name = title ?? box?.getAttribute("aria-label") ?? key;
      setWhere((w) => (w && w.key === key && w.name === name ? w : { key, name }));
    },
    [tile, title, firstTitle, untitled],
  );
  const closer = where ? tileCloserFor(where.key) : undefined;
  const show = !hidden && where !== null && tileClosable(closer, where.key);
  return (
    <span ref={anchor} className="contents" data-tile-close-anchor="">
      {show && where && closer && (
        <IconButton
          icon={X}
          label={t("closeTile", { tile: where.name })}
          variant="secondary"
          size="sm"
          data-tile-close={where.key}
          onClick={() => {
            closer.close(where.key);
            // A timer, not a frame: the desktop app's browser pane gets no animation frames (58fb1aa8).
            setTimeout(() => document.querySelector<HTMLElement>("[data-tiles-menu-button]")?.focus(), 0);
          }}
        />
      )}
    </span>
  );
}
