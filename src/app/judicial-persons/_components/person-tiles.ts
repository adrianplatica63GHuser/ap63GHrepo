/**
 * The Judicial Person's tiles.                                 (Slice #37.18)
 *
 * #37.17 built the tiles; this file only declares them. It replaces the tab
 * row (Detalii, Asocieri, Proprietăți, Acte, META INFO). The three FORM tiles
 * are the Detalii tab's panels — Adrese is two of them, the registered address
 * and the correspondence panel — and the default set is exactly them, so
 * nobody sees a changed screen until they tick something.
 *
 * Its own remembered choice: the entity kind is the storage key's, so ticking
 * „Acte" on a company changes nothing on a Natural Person.
 */
import type { TileRegistry } from "@/lib/ui/tiles";

export const JP_TILES = [
  "identity",
  "contactPersons",
  "addresses",
  "associations",
  "properties",
  "documents",
  "classification",
  "connections",
] as const;
export type JpTile = (typeof JP_TILES)[number];

export const JP_FORM_TILES: readonly JpTile[] = ["identity", "contactPersons", "addresses"];

export const JP_TILE_REGISTRY: TileRegistry<JpTile> = {
  entity: "judicial-person",
  all: JP_TILES,
  defaults: JP_FORM_TILES,
  form: JP_FORM_TILES,
  renamed: { metadata: ["classification", "connections"] },
};

/**
 * `?tab=` still works: the tab it named adds its tile for this visit and
 * scrolls to it. The association screens' „Înapoi" links carry these values.
 */
// Slice #37.63: META INFO is two tiles — „Clasificare subiectivă" and „Conexiuni".
// A browser that stored „metadata" opens with both ticked; `?tab=metadata` adds both.
export const JP_TILE_OF_TAB: Readonly<Record<string, JpTile | readonly JpTile[] | undefined>> = {
  related: "associations",
  properties: "properties",
  document: "documents",
  metadata: ["classification", "connections"],
};

/**
 * The form tile a field lives on — where a validation error has to be shown.
 * The two contact-person slots are on „Persoane de contact"; everything under
 * `addresses.` and the same-as-registered checkbox is on „Adrese"; the rest is
 * the identity panel („Persoană juridică").
 */
export function jpTileOfField(path: string): JpTile {
  const root = path.split(".")[0];
  if (root.startsWith("contactPerson")) return "contactPersons";
  if (root === "addresses" || root === "correspondenceSameAsHq") return "addresses";
  return "identity";
}
