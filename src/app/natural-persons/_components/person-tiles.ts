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
  "related",
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
  // Slice #37.88: the coloured groups (the purple one arrives with #37.89).
  groups: {
    record: ["identity", "idCard", "contact", "addresses"],
    related: ["related"],
    meta: ["classification", "connections"],
    fixed: [],
  },
  // #37.63: META INFO is two tiles; #37.67: the three lists are „Corelate".
  renamed: {
    metadata: ["classification", "connections"],
    associations: "related",
    properties: "related",
    documents: "related",
  },
};

/**
 * `?tab=` still works: the tab it named adds its tile for this visit and
 * scrolls to it. The association screens' „Înapoi" links carry these values.
 */
// Slice #37.63: META INFO is two tiles — „Clasificări" and „Conexiuni".
// A browser that stored „metadata" opens with both ticked; `?tab=metadata` adds both.
// Slice #37.67: the association screens' „Anulează" (?tab=related, properties, document) lands on „Corelate".
export const NP_TILE_OF_TAB: Readonly<Record<string, NpTile | readonly NpTile[] | undefined>> = {
  related: "related",
  properties: "related",
  document: "related",
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
