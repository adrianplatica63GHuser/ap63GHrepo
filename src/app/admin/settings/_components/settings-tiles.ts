/**
 * Setări's tiles, ticked on and off like a record's.               (Slice #39.17)
 *
 * The screen's own tiles in the plain group, then „Costuri" — one tile per
 * provider that can cost money (`src/lib/costs/catalogue.ts`) — in the yellow
 * group, so the bar shows them as one set. With nothing stored every tile shows,
 * so the screen opens as it did before this slice, with the cost tiles under it,
 * each collapsed to one line. Remembered per browser under `settings`.
 */
import type { TileRegistry } from "@/lib/ui/tiles";
import { COST_PROVIDERS } from "@/lib/costs/catalogue";

export const SETTINGS_OWN_TILES = ["account", "timeFrames", "backups", "about"] as const;
export const SETTINGS_TILES = [...SETTINGS_OWN_TILES, ...COST_PROVIDERS] as const;
export type SettingsTile = (typeof SETTINGS_TILES)[number];

export const SETTINGS_TILE_REGISTRY: TileRegistry<SettingsTile> = {
  entity: "settings",
  all: SETTINGS_TILES,
  defaults: SETTINGS_TILES,
  form: [],
  groups: { record: SETTINGS_OWN_TILES, related: [], meta: COST_PROVIDERS, family: [], fixed: [] },
};
