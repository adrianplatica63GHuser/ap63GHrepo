/**
 * A tile's surface — its fill, rim, corners, padding and shadow.  (Slice #37.78)
 *
 * The tiles of the right column (the registry's `placement.right`,
 * `src/lib/ui/tiles.ts`: the Property's „Hartă", „Puncte de contur" and
 * „Street View"; the Document's „Pagini"; a person's „Interacțiuni") were
 * tinted a light purple because they never moved. Since Slice 40.32 they move
 * like any tile, starting at the right edge; the purple stays as their group's
 * colour („the peek-inside tiles", 40.32's Ask first 5). Every other tile keeps
 * its group's.
 *
 * WHICH TILES is the registry's answer, never a second list: a form asks
 * `RightColumn.has(tile)` (`src/components/tiles/tile-areas.tsx`), so a tile
 * added to `placement.right` later is tinted by itself, and a right tile stays
 * tinted when a narrow window wraps the column under the left area.
 *
 * THE COLOUR (`src/app/globals.css`): each purple has the OKLCH lightness of
 * the grey it stands beside, so the tint reads as a hue, not a shade.
 *   fill  `--color-card-pinned`          #F6F0FE  L 0.964 C 0.020 h 305 — the card #EEF4FA is L 0.964
 *   rim   `--color-card-pinned-rim`      #DACBEE  L 0.865 C 0.050 h 305 — the rim  #C6D4E8 is L 0.866
 *   dark  `--color-card-pinned-dark`     #1C1523  L 0.211 C 0.029 h 307 — zinc-900 #18181B is L 0.210
 *   dark rim `--color-card-pinned-rim-dark` #2C2237 L 0.273 C 0.040 h 306 — zinc-800 #27272A is L 0.274
 * Slice #37.88 gives every tile its group's colour (`groupSurface`): the record's
 * own data in the card's grey-blue, „Corelate" light green, „Clasificări" and
 * „Conexiuni" light yellow, the right column purple — all four at one lightness:
 *   green  `--color-card-related`  #EBF7ED / rim #BBDDC2 / dark #0F1C11 / dark rim #182D1D (h 151)
 *   yellow `--color-card-meta`     #F8F3E5 / rim #DDD3AE / dark #1D1808 / dark rim #2E270D (h 93)
 * Slice #38.15 makes „Corelate" one step stronger and gives its rows their own,
 * calmer green (Adrian: „a slightly stronger green… the rows a green a little
 * lighter than the tile's current colour"):
 *   tile  `--color-card-related`      #DDF0E1 L 0.937 / rim #AFD5B7 L 0.837 (the card's rim step, ΔL 0.099)
 *   dark  `--color-card-related-dark` #0F2314 L 0.234 / rim #183520 L 0.299
 *   rows  `--color-card-related-row`  #F4FBF5 L 0.981 / dark #101711 L 0.195 (`RELATED_ROWS_SURFACE`)
 * so the green is no longer at the other groups' lightness; text keeps at least
 * 4.5:1 on all three (`tile-surface.test.ts`).
 * Only the tile's own surface changes: the map's and Street View's frames,
 * the corner table's white body and the page viewer's white box keep theirs.
 *
 * Slice 41.68 — THE COLOUR IS SEPARATED FROM THE GROUP. Adrian, 2026-11-03: „We are changing the tile colours to match
 * the choices of colours for the principal objects' icons; however, we will not be using the exact hues […] we will just
 * switch them around". So a group keeps its name, its order and its placement, and its HUE is chosen per screen in
 * `SCREEN_HUES` (`tileHue`): on the four record screens „Legături" wears the card's grey-blue, „Hartă", „Colțuri" and
 * „Street View" the green „Legături" wore, „Interacțiuni" and „Arbore de moștenire" the purple, a document's „Pagini"
 * the blue the tree wore; „Clasificări" and „Conexiuni" stay yellow. The tile (`groupSurface`), its strip on the bar
 * (`groupStrip`) and its rectangle in „Panouri" (`groupColours`) all read the same table by the screen's entity — the
 * registry's `entity` — so they cannot disagree, and a tile keeps its colour wherever it is dragged. With no entity (the
 * dashboard, Setări) a group takes its old hue. The tokens keep their names and values: `card-related` is the green,
 * `card-family` the blue, `card-pinned` the purple, whatever group wears them. „Legături"'s rows stand on a lighter row
 * of the card (`--color-card-row`), as its rows were a lighter green on the green tile.
 */

import type { TileGroup } from "@/lib/ui/tiles";

/** Every tile that can move: the card. */
export const TILE_SURFACE =
  "rounded-md border border-card-rim bg-card p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** A right-hand tile (`placement.right`): the same box, tinted purple — its group's colour, since 40.32 movable. */
export const PINNED_TILE_SURFACE =
  "rounded-md border border-card-pinned-rim bg-card-pinned p-3 shadow-sm dark:border-card-pinned-rim-dark dark:bg-card-pinned-dark";

/** Slice #37.88: „Corelate", the same box in light green. */
export const RELATED_TILE_SURFACE =
  "rounded-md border border-card-related-rim bg-card-related p-3 shadow-sm dark:border-card-related-rim-dark dark:bg-card-related-dark";

/**
 * Slice #38.15: the rows inside „Corelate" — a calmer green, rimmed with the tile's green. Slice 41.68: „Legături" wears
 * the card now, so its rows are a lighter row of the card (`--color-card-row`), rimmed with the card's rim (it read
 * `border-card-related-rim bg-card-related-row … dark:bg-card-related-row-dark`).
 */
export const RELATED_ROWS_SURFACE =
  "rounded-md border border-card-rim bg-card-row shadow-sm dark:border-zinc-800 dark:bg-card-row-dark";

/** Slice #37.88: „Clasificări" and „Conexiuni", the same box in light yellow. */
export const META_TILE_SURFACE =
  "rounded-md border border-card-meta-rim bg-card-meta p-3 shadow-sm dark:border-card-meta-rim-dark dark:bg-card-meta-dark";

/**
 * Slice #39.12: a natural person's „Arbore de moștenire" — „light blue as light as the other coloured tiles" (Adrian).
 *   fill `--color-card-family` #DFF0FB / rim #A9CFE6 / dark #0B1B26 / dark rim #142B3B (h 235) — a clear sky blue
 *   beside the card's grey-blue #EEF4FA, at the coloured groups' lightness.
 */
export const FAMILY_TILE_SURFACE =
  "rounded-md border border-card-family-rim bg-card-family p-3 shadow-sm dark:border-card-family-rim-dark dark:bg-card-family-dark";

/** Slice 41.68: the five tile colours, by hue — the tokens behind them keep their names (the file note). */
export type TileHue = "card" | "green" | "yellow" | "blue" | "purple";

const HUE_SURFACE: Readonly<Record<TileHue, string>> = {
  card: TILE_SURFACE,
  green: RELATED_TILE_SURFACE,
  yellow: META_TILE_SURFACE,
  blue: FAMILY_TILE_SURFACE,
  purple: PINNED_TILE_SURFACE,
};

const HUE_COLOURS: Readonly<Record<TileHue, string>> = {
  card:   "border-card-rim bg-card dark:border-zinc-800 dark:bg-zinc-900",
  green:  "border-card-related-rim bg-card-related dark:border-card-related-rim-dark dark:bg-card-related-dark",
  yellow: "border-card-meta-rim bg-card-meta dark:border-card-meta-rim-dark dark:bg-card-meta-dark",
  blue:   "border-card-family-rim bg-card-family dark:border-card-family-rim-dark dark:bg-card-family-dark",
  purple: "border-card-pinned-rim bg-card-pinned dark:border-card-pinned-rim-dark dark:bg-card-pinned-dark",
};

/** The four record screens, as their registries' `entity` names them (a document's is `document-<type>`). */
export type TileScreen = "property" | "natural-person" | "judicial-person" | "document";

/** A group's hue where no screen is named — the dashboard, Setări: the colours before 41.68. */
const DEFAULT_HUES: Readonly<Record<TileGroup, TileHue>> = { record: "card", related: "green", meta: "yellow", family: "blue", fixed: "purple" };

/**
 * Slice 41.68: each record screen's groups → hues, Adrian's list. `family` exists only on a natural person; elsewhere it
 * keeps the default.
 */
export const SCREEN_HUES: Readonly<Record<TileScreen, Readonly<Record<TileGroup, TileHue>>>> = {
  property:          { ...DEFAULT_HUES, related: "card", fixed: "green" },
  "natural-person":  { ...DEFAULT_HUES, related: "card", family: "purple", fixed: "purple" },
  "judicial-person": { ...DEFAULT_HUES, related: "card", fixed: "purple" },
  document:          { ...DEFAULT_HUES, related: "card", fixed: "blue" },
};

/** The record screen a registry's entity names, or none. */
export function tileScreenOf(entity: string | undefined): TileScreen | undefined {
  if (!entity) return undefined;
  if (entity === "document" || entity.startsWith("document-")) return "document";
  return entity in SCREEN_HUES ? (entity as TileScreen) : undefined;
}

/** Slice 41.68: the hue a group wears on the screen whose registry entity is `entity`. */
export function tileHue(group: TileGroup, entity?: string): TileHue {
  const screen = tileScreenOf(entity);
  return (screen ? SCREEN_HUES[screen] : DEFAULT_HUES)[group];
}

/** A hue's tile surface. */
export function hueSurface(hue: TileHue): string {
  return HUE_SURFACE[hue];
}

/**
 * The surface for a tile: the `fixed` group's when it stands in the right column, else the card. Slice 41.68: on the
 * screen `entity` names — a property's right tiles are green, a document's „Pagini" blue.
 */
export function tileSurface(pinned: boolean, entity?: string): string {
  return pinned ? groupSurface("fixed", entity) : TILE_SURFACE;
}

/**
 * The surface for a tile's GROUP (Slice #37.88) — the registry's answer
 * (`tileGroupOf`), never a tile's name inside a form, so a tile keeps its
 * colour wherever it is dragged. Slice 41.68: in the hue the screen `entity` gives that group.
 */
export function groupSurface(group: TileGroup, entity?: string): string {
  return HUE_SURFACE[tileHue(group, entity)];
}

/**
 * The narrow strip a group's checkboxes stand in on the bar (Slice #37.88):
 * the group's fill and rim, rounded like the tiles — 41.68: in the screen's hue for it.
 */
export function groupStrip(group: TileGroup, oneLine = false, entity?: string): string {
  // Slice 40.41: `oneLine` — a strip of the two-row bar never wraps inside: its boxes are measured whole, and a group
  // too wide for a row is split into two strips instead (tile-bar-rows.ts).
  return `flex ${oneLine ? "flex-nowrap whitespace-nowrap" : "flex-wrap"} items-center gap-x-4 gap-y-1 rounded-md border px-2.5 py-1 ${groupColours(group, entity)}`;
}

/**
 * A group's fill and rim, light and dark — the bar's strips and, since Slice 40.42, the tiles diagram's rectangles.
 * Slice 41.68: in the screen's hue for it.
 */
export function groupColours(group: TileGroup, entity?: string): string {
  return HUE_COLOURS[tileHue(group, entity)];
}
