"use client";

/**
 * Slice 41.41 — Adrian: „For Groups stamps and tags I would like to have tiles, and I would like to implement the feature
 * panels functionality as for the principal objects tiles".
 *
 * The record screens' tile choice on an admin screen: `useTileChoice` (the choice per screen, in localStorage),
 * `useTilesMenu` + `TilesMenuButton` („Panouri", in the page bar) and `TileSelector` (its panel: the boxes, „Toate",
 * „Implicit" — which also puts the dragged places back). `TileUnitRow` still does the packing and the drag.
 */
import { PageBarControls } from "@/components/page-bar-slot";
import { TileSelector } from "@/components/tiles/tile-selector";
import { TilesMenuButton, useTilesMenu, type TilesMenu } from "@/components/tiles/tiles-menu";
import { useTileChoice, type TileChoice } from "@/components/tiles/use-tile-choice";
import type { TileRegistry } from "@/lib/ui/tiles";

export type AdminTiles<K extends string> = { choice: TileChoice<K>; menu: TilesMenu };

/** The screen's choice and its „Panouri". `visit`: tiles shown for this visit only, never stored (41.45). */
export function useAdminTiles<K extends string>(registry: TileRegistry<K>, visit: readonly K[] = []): AdminTiles<K> {
  const choice = useTileChoice(registry, visit);
  const menu = useTilesMenu();
  return { choice, menu };
}

/** „Panouri" in the page bar, and its panel under the screen's header. */
export function AdminTilesBar<K extends string>({
  registry,
  labels,
  tiles,
}: {
  registry: TileRegistry<K>;
  labels: Readonly<Record<K, string>>;
  tiles: AdminTiles<K>;
}) {
  return (
    <>
      <PageBarControls>
        <TilesMenuButton menu={tiles.menu} />
      </PageBarControls>
      <TileSelector all={registry.all} labels={labels} choice={tiles.choice} menu={tiles.menu} />
    </>
  );
}
