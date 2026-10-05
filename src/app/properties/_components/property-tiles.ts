/**
 * The Property's tiles.                                        (Slice #37.19)
 *
 * #37.17 built the tiles; this file only declares them. It replaces the tab
 * row (Detalii, Asocieri, Persoane, Acte, META INFO). Detalii's panels become
 * five tiles — Date cadastrale, Puncte de contur, Adresă, Hartă and Street
 * View — so the map and Street View can sit beside the cadastral data and the
 * owners, or be switched off.
 *
 * Three kinds of tile:
 * - FORM tiles (`form`) — cadastral data, the corners, the address — hold the
 *   form's inputs, so an unticked one is hidden, never unmounted (#37.17).
 * - MAP tiles — Hartă, Street View — hold no form state (the map draws the
 *   corners it is given). AN UNTICKED MAP COSTS NOTHING: neither is mounted
 *   while unticked, so neither makes a Google Maps request of its own.
 * - LIST tiles — Corelate (#37.66: „Proprietăți corelate", Persoane and Acte
 *   in one), Clasificări and Conexiuni (META INFO until #37.63).
 *
 * Nothing stored shows what Detalii showed: the cadastral data, the corners,
 * the address and the map. Street View was a button there, off on open; it is
 * off by default here too, and the button ticks its tile. The choice is its
 * own (`ga40-tiles-property-v1`).
 */
import type { TileRegistry } from "@/lib/ui/tiles";

// Slice #37.88: in the groups' order — the record's own data, „Corelate",
// „Clasificări" and „Conexiuni", then the fixed right-hand column.
export const PROP_TILES = [
  "cadastral",
  "address",
  "related",
  "classification",
  "connections",
  "map",
  "corners",
  "streetView",
] as const;
export type PropTile = (typeof PROP_TILES)[number];

export const PROP_FORM_TILES: readonly PropTile[] = ["cadastral", "corners", "address"];

export const PROP_TILE_REGISTRY: TileRegistry<PropTile> = {
  entity: "property",
  all: PROP_TILES,
  defaults: ["cadastral", "corners", "address", "map"],
  form: PROP_FORM_TILES,
  // Slice #37.56: Hartă at the right, Puncte de contur under it, Street View
  // under that when ticked — one column; the cadastral data, the address and
  // the lists to their left.
  placement: { right: ["map", "corners", "streetView"] },
  // Slice #37.88: the four coloured groups of the checkbox bar and the tiles.
  groups: {
    record: ["cadastral", "address"],
    related: ["related"],
    meta: ["classification", "connections"],
    fixed: ["map", "corners", "streetView"],
  },
  // #37.63: META INFO is two tiles; #37.66: the three lists are „Corelate".
  renamed: {
    metadata: ["classification", "connections"],
    associations: "related",
    persons: "related",
    documents: "related",
  },
};

/**
 * `?tab=` still works: the tab it named adds its tile for this visit and
 * scrolls to it. The association screens' „Înapoi" links carry these values.
 */
// Slice #37.63: META INFO is two tiles — „Clasificări" and „Conexiuni".
// A browser that stored „metadata" opens with both ticked; `?tab=metadata` adds both.
// Slice #37.66: the association screens' „Anulează" (?tab=related, persons, document) lands on „Corelate".
export const PROP_TILE_OF_TAB: Readonly<Record<string, PropTile | readonly PropTile[] | undefined>> = {
  related: "related",
  persons: "related",
  document: "related",
  metadata: ["classification", "connections"],
};

/**
 * The form tile a field lives on — where a validation error has to be shown.
 * Everything under `address.` is on „Adresă"; every other field is on „Date
 * cadastrale". The corners are not react-hook-form fields.
 */
export function propTileOfField(path: string): PropTile {
  return path.split(".")[0] === "address" ? "address" : "cadastral";
}
