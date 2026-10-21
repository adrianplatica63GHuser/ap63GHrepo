/**
 * A screen tile's title row: its name — what the tile's region is named by
 * (`aria-labelledby` the `id`) — and, for a list, its count.
 *                                                    (Slices #38.12, #38.13)
 *
 * The group screen's and the stamp applicator's tiles draw it; its free part
 * is the tile's unused space, where a drag starts (`tile-drag-surface.ts`).
 *
 * Slice 40.18: the name in Roboto Slab 16 px, 500, navy — alternative 13's kind 7b (`SCREEN_TILE_TITLE_TYPE`); it was
 * `text-sm font-semibold text-ink dark:text-zinc-100`.
 */
import type { ReactNode } from "react";
import { SCREEN_TILE_TITLE_TYPE } from "@/lib/ui/title-type";

export function TileTitle({ id, title, count }: { id: string; title: ReactNode; count?: number }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-card-rim px-4 py-2 dark:border-zinc-800">
      <span id={id} className={SCREEN_TILE_TITLE_TYPE}>{title}</span>
      {count !== undefined && <span className="text-xs text-fade dark:text-zinc-400">{count}</span>}
    </div>
  );
}
