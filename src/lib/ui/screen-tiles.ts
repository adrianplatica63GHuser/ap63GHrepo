/**
 * AN ADMINISTRATION SCREEN'S TILES ON THE FORMS' DRAG AND PACKING.  (Slice #38.12)
 *
 * The group screen (Administrare → Grupuri → a group) draws its three tiles
 * through the record forms' own mechanism — `useTilePacking`: each tile right
 * under the tile above it (#37.75), dragged by its unused space (#37.76), its
 * place kept per browser under `tilePositionsKey(entity)`. Unlike the forms it
 * has no checkbox bar: every tile always shows.
 *
 * THE DEFAULT PLACEMENT is #37.75's rule over the tiles in their reading
 * order, with the FLOW held to `flowUnits` — two tiles across — so the third
 * tile wraps under the first: „Identitatea grupului" and, under it, „Deja în
 * grup" in column 1; „Membri disponibili pentru includere" in column 2. A wider
 * window does not put the three in one row; the free space at the right is the
 * row's, and a tile may be dragged there (`useTilePacking`'s `flowUnits`).
 *
 * #38.13 — the stamp applicator (Administrare → Ștampile → „Aplică"): four
 * tiles, „Descrierea ștampilei" and „Tip element" where they stood, „Elemente
 * deja ștampilate" under the first and „Elemente disponibile pentru
 * ștampilare" under the second — the same rule, the tiles in that reading
 * order.
 *
 * PURE — `group-screen-tiles.test.tsx` covers it; the stored places are
 * `tilePositionsKey(GROUP_SCREEN.entity)`.
 */
export interface ScreenTiles {
  /** Where the arrangement is kept: `tilePositionsKey(entity)`. */
  entity: string;
  /** Every tile's `data-tile`, in reading (DOM) order. */
  tiles: readonly string[];
  /** Each tile's width in units. */
  units: number;
  /** How many units the flow may take across: two tiles, so the third wraps under the first. */
  flowUnits: number;
}

/** Administrare → Grupuri → a group. */
export const GROUP_SCREEN: ScreenTiles = {
  entity: "admin-group",
  tiles: ["identity", "available", "in-group"],
  units: 3,
  flowUnits: 2 * 3,
};

/** Administrare → Ștampile → „Aplică" (#38.13). */
export const STAMP_SCREEN: ScreenTiles = {
  entity: "admin-stamp",
  tiles: ["description", "type", "stamped", "available"],
  units: 3,
  flowUnits: 2 * 3,
};
