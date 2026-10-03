/**
 * The Natural Person's tiles.                                  (Slice #37.17)
 *
 * Replaces the tab row (Detalii, Asocieri, Proprietăți, Acte, META INFO). The
 * four FORM tiles are the Detalii tab's panels; the default set is exactly
 * them, so nobody sees a changed screen until they tick something.
 */
import type { TileRegistry } from "@/lib/ui/tiles";

export const NP_TILES = [
  "identity",
  "idCard",
  "contact",
  "addresses",
  "associations",
  "properties",
  "documents",
  "classification",
  "connections",
] as const;
export type NpTile = (typeof NP_TILES)[number];

export const NP_FORM_TILES: readonly NpTile[] = ["identity", "idCard", "contact", "addresses"];

export const NP_TILE_REGISTRY: TileRegistry<NpTile> = {
  entity: "natural-person",
  all: NP_TILES,
  defaults: NP_FORM_TILES,
  form: NP_FORM_TILES,
  renamed: { metadata: ["classification", "connections"] },
};

/**
 * `?tab=` still works: the tab it named adds its tile for this visit and
 * scrolls to it. The association screens' „Înapoi" links carry these values.
 */
// Slice #37.63: META INFO is two tiles — „Clasificare subiectivă" and „Conexiuni".
// A browser that stored „metadata" opens with both ticked; `?tab=metadata` adds both.
export const NP_TILE_OF_TAB: Readonly<Record<string, NpTile | readonly NpTile[] | undefined>> = {
  related: "associations",
  properties: "properties",
  document: "documents",
  metadata: ["classification", "connections"],
};

const IDENTITY = new Set([
  "lastName", "firstName", "nickname", "cnp", "gender", "dateOfBirth",
  "physicalPersonTypeId", "placeOfBirth", "notes",
]);
const ID_CARD = new Set([
  "idDocumentType", "idDocumentNumber", "idCardNumber", "idValidFrom", "idValidUntil",
  "citizenshipId", "idIssuingAuthority", "idMrzRaw",
]);

/**
 * The form tile a field lives on — where a validation error has to be shown.
 * The contact panel holds the phones and the emails; everything under
 * `addresses.` and the same-as-home checkbox is on Adrese.
 */
export function npTileOfField(path: string): NpTile {
  const root = path.split(".")[0];
  if (IDENTITY.has(root)) return "identity";
  if (ID_CARD.has(root)) return "idCard";
  if (root === "addresses" || root === "correspondenceSameAsHome") return "addresses";
  return "contact";
}
