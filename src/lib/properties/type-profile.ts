/**
 * What a property's type shows and hides on the Property screen.  (Slice #38.03)
 *
 * The rule already exists: `lookup_property_type` carries three flags
 * (migration_041, #19.02), edited in Date de referință → Tipuri proprietate,
 * and property-form.tsx turns them into `typeConfig`:
 *
 *   show_address       → the „Adresă" tile
 *   show_street_view   → the „Street View" tile
 *   show_tarla_parcela → Tarla/Solă and Parcelă inside „Date cadastrale" (two
 *                        fields, not a tile)
 *
 * No type chosen: everything shows. This module only RESTATES those flags as
 * the two tiles a type shows or hides and whether the two fields appear, so
 * the heading's explanation (#38.03) is built from the flags themselves —
 * never from a hand-written list per type, and a type changed in Date de
 * referință explains itself. #38.04's disabled tile boxes read the same.
 */

/** A type's three flags, and its name — what the form knows of the type chosen on it now. */
export type PropertyTypeProfile = {
  id: string;
  name: string;
  showTarlaParcela: boolean;
  showAddress: boolean;
  showStreetView: boolean;
};

/** The two tiles a type can hide, in the order the screen draws them. */
export const TYPE_TILES = ["address", "streetView"] as const;
export type TypeTile = (typeof TYPE_TILES)[number];

export type TypeShows = {
  /** The tiles this type shows, in screen order. */
  shown: TypeTile[];
  /** The tiles it does not show, in screen order. */
  hidden: TypeTile[];
  /** Tarla/Solă and Parcelă appear in „Date cadastrale". */
  tarlaParcela: boolean;
};

const FLAG: Record<TypeTile, keyof Pick<PropertyTypeProfile, "showAddress" | "showStreetView">> = {
  address: "showAddress",
  streetView: "showStreetView",
};

/** What `type` shows — or, with no type, everything. */
export function typeShows(type: PropertyTypeProfile | null): TypeShows {
  if (!type) return { shown: [...TYPE_TILES], hidden: [], tarlaParcela: true };
  return {
    shown: TYPE_TILES.filter((tile) => type[FLAG[tile]]),
    hidden: TYPE_TILES.filter((tile) => !type[FLAG[tile]]),
    tarlaParcela: type.showTarlaParcela,
  };
}

/** Two profiles describe the same type as the screen sees it. */
export function sameProfile(a: PropertyTypeProfile | null, b: PropertyTypeProfile | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.showTarlaParcela === b.showTarlaParcela &&
    a.showAddress === b.showAddress &&
    a.showStreetView === b.showStreetView
  );
}
