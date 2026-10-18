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

/**
 * Slice #39.77 — a tarla's page (/tarlale/[id]). Adrian, 2026-10-17: every panel a third of a maximized window, the
 * properties and the documents half of it. In whole units (Ask first 1): at 1920 px with the sidebar open the page holds
 * ten units (1624 px), a third of which rounds to 3 units (476 px) and a half to 5 (804 px). At 1366 px it holds six:
 * two thirds side by side, or a half.
 */
export const TARLA_THIRD_UNITS = 3;
export const TARLA_HALF_UNITS = 5;

export const TARLA_SCREEN: ScreenTiles = {
  entity: "tarla",
  tiles: ["identity", "outline", "properties", "plans", "parcels", "documents"],
  units: TARLA_HALF_UNITS,
  flowUnits: 10,
};
