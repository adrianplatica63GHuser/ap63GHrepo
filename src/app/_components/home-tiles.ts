/**
 * The home page's tiles.                                       (Slice #37.36)
 *
 * The four sections of „Tablou de bord", ticked on and off with the detail
 * screens' own selector and remembered per browser under `home`. With nothing
 * stored all four show — exactly the page before this slice.
 */
import type { TileRegistry } from "@/lib/ui/tiles";

export const HOME_TILES = ["recentCounts", "staleMetadata", "expiringDocuments", "recentActivity"] as const;
export type HomeTile = (typeof HOME_TILES)[number];

export const HOME_TILE_REGISTRY: TileRegistry<HomeTile> = {
  entity: "home",
  all: HOME_TILES,
  defaults: HOME_TILES,
  form: [],
};
