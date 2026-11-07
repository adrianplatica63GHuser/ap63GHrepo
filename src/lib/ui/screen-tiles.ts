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
  /** Each tile's width in units — and, since 41.42, the widest tile's, which the row never goes under. */
  units: number;
  /** 41.42: a tile whose width is not `units`, by its `data-tile`. */
  tileUnits?: Readonly<Record<string, number>>;
  /** How many units the flow may take across: two tiles, so the third wraps under the first. */
  flowUnits: number;
}

/**
 * Slice 41.41: the five admin screens' tile registries — the record screens' choice („Panouri", `useTileChoice`), kept
 * per screen in localStorage under `ga40-tiles-<entity>-v1`. No form tiles; at least one tile stays (`toggleTile`).
 */
export type AdminTileRegistry<K extends string> = {
  entity: string;
  all: readonly K[];
  defaults: readonly K[];
  form: readonly K[];
  /** 41.42: a tile name stored before a rename, read as the new one (`parseStoredTiles`). */
  renamed?: Readonly<Record<string, K | readonly K[]>>;
};
const adminRegistry = <K extends string>(entity: string, all: readonly K[]): AdminTileRegistry<K> => ({ entity, all, defaults: all, form: [] });

/** Administrare → Grupuri: what a group is, how you work with groups (41.44), and the list. */
export const ADMIN_GROUPS_REGISTRY = adminRegistry("admin-groups", ["about", "workflows", "list"] as const);
/** Administrare → Ștampile: what a stamp is, how you work with stamps (41.44), and the list. */
export const ADMIN_STAMPS_REGISTRY = adminRegistry("admin-stamps", ["about", "workflows", "list"] as const);
/** Administrare → Etichete: the page's note, and the cloud. */
export const ADMIN_TAGS_REGISTRY = adminRegistry("admin-tags", ["note", "cloud"] as const);

/** The list screens' packed rows: what it is (7 units), the list (or the cloud) beside or under it. */
// Slice 41.98: on Grupuri „Ce este un Grup?" is a line of its own across the row (`basis-full`), then the 3-unit wizard
// with the list beside it at 75 % of its old units (ADMIN_GROUPS_LIST_UNITS): the flow is the two.
export const ADMIN_GROUPS_WIZARD_UNITS = 3;
export const ADMIN_GROUPS_LIST_UNITS = 4;
export const ADMIN_GROUPS_SCREEN: ScreenTiles = {
  entity: "admin-groups",
  tiles: ["about", "workflows", "list"],
  units: ADMIN_GROUPS_LIST_UNITS,
  tileUnits: { workflows: ADMIN_GROUPS_WIZARD_UNITS, list: ADMIN_GROUPS_LIST_UNITS },
  flowUnits: ADMIN_GROUPS_WIZARD_UNITS + ADMIN_GROUPS_LIST_UNITS,
};
// Slice 41.99: Ștampile as Grupuri — „Ce este o Ștampilă?" across the row, the 3-unit wizard, the list at 75 % of its
// old units (6 → 4) beside it.
export const ADMIN_STAMPS_WIZARD_UNITS = 3;
export const ADMIN_STAMPS_LIST_UNITS = 4;
export const ADMIN_STAMPS_SCREEN: ScreenTiles = {
  entity: "admin-stamps",
  tiles: ["about", "workflows", "list"],
  units: ADMIN_STAMPS_LIST_UNITS,
  tileUnits: { workflows: ADMIN_STAMPS_WIZARD_UNITS, list: ADMIN_STAMPS_LIST_UNITS },
  flowUnits: ADMIN_STAMPS_WIZARD_UNITS + ADMIN_STAMPS_LIST_UNITS,
};
export const ADMIN_TAGS_SCREEN: ScreenTiles = { entity: "admin-tags", tiles: ["note", "cloud"], units: 7, flowUnits: 14 };

/**
 * 41.42: the compact identity tile — „GRP-001 · Proprietate", the description, „Salvează grupul" — 2 units (254 px).
 * Adrian: „I would like to have the “group identity” tile much more compact then it is now".
 */
export const IDENTITY_UNITS = 2;
/**
 * 41.42: the two-list tile — two lists of 3 units with the buttons between them (src/components/screen/two-lists.tsx):
 * 7 units, 929 px — 903 inside, two lists of ≈391 px and a 104-px column of buttons with 8 px either side.
 */
export const TWO_LISTS_UNITS = 7;

/**
 * Administrare → Grupuri → a group. 41.42: two tiles — „Identitatea grupului" (2 units) and „Membrii grupului" (the two
 * lists, 7 units); side by side where 9 units fit, the members under the identity where they do not (1366 px holds 8).
 */
export const GROUP_SCREEN: ScreenTiles = {
  entity: "admin-group",
  tiles: ["identity", "members", "workflows"],
  units: TWO_LISTS_UNITS,
  // 41.44: „Cum lucrezi cu grupurile", as wide as the two lists.
  tileUnits: { identity: IDENTITY_UNITS, members: TWO_LISTS_UNITS, workflows: TWO_LISTS_UNITS },
  flowUnits: IDENTITY_UNITS + TWO_LISTS_UNITS,
};

/**
 * 41.41: one group's screen — its tiles chosen with „Panouri", under the screen's own entity. 41.42: „Membri disponibili…"
 * and „Deja în grup" are one tile, „members" — a choice stored under either old name reads as it; a place stored under
 * them names no tile any more and is not read (the record screens' renamed tiles, #37.54).
 */
export const GROUP_REGISTRY: AdminTileRegistry<"identity" | "members" | "workflows"> = {
  ...adminRegistry(GROUP_SCREEN.entity, ["identity", "members", "workflows"] as const),
  renamed: { available: "members", "in-group": "members" },
};

/**
 * Administrare → Ștampile → „Aplică" (#38.13). 41.43: two tiles, as a group's — „Descrierea ștampilei" (2 units) and
 * „Elementele ștampilei" (7): „Tip element" over the two lists, the stamped left, the available right.
 */
export const STAMP_SCREEN: ScreenTiles = {
  entity: "admin-stamp",
  tiles: ["description", "records", "workflows"],
  units: TWO_LISTS_UNITS,
  // 41.44: „Cum lucrezi cu ștampilele", as wide as the two lists.
  tileUnits: { description: IDENTITY_UNITS, records: TWO_LISTS_UNITS, workflows: TWO_LISTS_UNITS },
  flowUnits: IDENTITY_UNITS + TWO_LISTS_UNITS,
};

/**
 * 41.41: one stamp's screen — its tiles chosen with „Panouri". 41.43: „Tip element" and the two lists are one tile,
 * „records"; a choice stored under the old names reads as it, a place stored under them is not read (as 41.42).
 */
export const STAMP_REGISTRY: AdminTileRegistry<"description" | "records" | "workflows"> = {
  ...adminRegistry(STAMP_SCREEN.entity, ["description", "records", "workflows"] as const),
  renamed: { type: "records", stamped: "records", available: "records" },
};

/**
 * Slice #39.77 — a tarla's page (/tarlale/[id]). Adrian, 2026-10-17: every panel a third of a maximized window, the
 * properties and the documents half of it. In whole units (Ask first 1): at 1920 px with the sidebar open the page holds
 * 1624 px — ten units of 148 px until 40.98, a third of which rounded to 3 units (476 px) and a half to 5 (804 px).
 */
// 40.98: a 1920-px row holds 12 units of 119 px — a third is 4 (524 px), a half 6 (794 px).
export const TARLA_THIRD_UNITS = 4;
export const TARLA_HALF_UNITS = 6;

/**
 * Slice #39.87 — „Despre limitele tarlalelor" is a tile of the page too, the first, a third wide (Adrian, 2026-10-18: „the
 * same width as the "outline" and "one plan parcelar" tiles; of course it will become much taller"). On the tarla list
 * it stays across the page.
 */
export const TARLA_SCREEN: ScreenTiles = {
  entity: "tarla",
  tiles: ["facts", "identity", "outline", "properties", "plans", "parcels", "documents"],
  units: TARLA_HALF_UNITS,
  flowUnits: 12, // 40.98: the 1920-px row's 12 units (10 of 148 px)
};
