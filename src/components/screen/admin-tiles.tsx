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

/**
 * The screen's choice and its „Panouri". 41.45 — `only`: the tiles a `?tiles=` names, the screen opened from a record —
 * these and no other for this visit, nothing stored (`useTileChoice`'s `only`).
 */
export function useAdminTiles<K extends string>(registry: TileRegistry<K>, only: readonly K[] = []): AdminTiles<K> {
  const choice = useTileChoice(registry, [], [], only);
  const menu = useTilesMenu();
  return { choice, menu };
}

/** „Panouri" in the page bar, and its panel under the screen's header. */
export function AdminTilesBar<K extends string>({
  registry,
  labels,
  tiles,
  allUp = false,
}: {
  registry: TileRegistry<K>;
  labels: Readonly<Record<K, string>>;
  tiles: AdminTiles<K>;
  /**
   * Slice 41.98 — Adrian: „Please add to the Groups screen, the Panels function: the All up and All left buttons with the
   * three chevrons". „Toate sus" and „Toate la stânga", as on the record screens — on Grupuri, a group's screen, Ștampile
   * and a stamp's screen.
   */
  allUp?: boolean;
}) {
  return (
    <>
      <PageBarControls>
        <TilesMenuButton menu={tiles.menu} />
      </PageBarControls>
      <TileSelector all={registry.all} labels={labels} choice={tiles.choice} menu={tiles.menu} allUp={allUp} />
    </>
  );
}

/** 41.45: `?tiles=identity,members` → the registry's tiles it names, in no particular order; nothing else. */
export function tilesParam<K extends string>(raw: string | string[] | undefined, all: readonly K[]): K[] {
  const text = Array.isArray(raw) ? raw.join(",") : raw ?? "";
  const names = text.split(",").map((s) => s.trim());
  return all.filter((k) => names.includes(k));
}
