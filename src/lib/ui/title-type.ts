/**
 * How every kind of title is set — alternative 13 of 40.05's Font.Alternatives.docx, in Adrian's colours.
 *                                                                                                    (Slice 40.18)
 *
 * Adrian, 2026-10-21: „I have made my choice to go with alternative #13 Roboto Slab Titles, and with: the colour
 * #1E3A8A dark Navy blue for the Tiles titles (1,2,4,5,7a,7b) and the currently existing black for the list column
 * titles (3,6)".
 *
 * One class per kind, here, and nowhere else (Ask first 4). The pieces that draw a title read their kind's constant —
 * `TILE_TITLE_CLASS` (src/components/tiles/tile-title.tsx), `LIST_HEAD` (src/components/list/list-fit.tsx), the
 * screens' `TileTitle` (src/components/screen/tile-title.tsx) — and so do the few places that write a title of their
 * own; `title-type.test.ts` keeps it so.
 *
 *   kind                                              family            size     weight  case      spacing  colour
 *   1 dashboard tiles, 2 record form tiles, 4 tree    Roboto Slab       16 px    600     UPPER     0.04 em  navy
 *   3 the lists' column names, 6 Date de referință's  Roboto Condensed  13.5 px  600     UPPER     0.04 em  ink
 *   5 Date de referință's left panel                  Roboto Slab       13 px    600     UPPER     0.08 em  navy
 *   7a Grupuri / Ștampile page heading                Roboto Slab       20 px    600     Sentence  0        navy
 *   7b a group's and a stamp's screen tiles           Roboto Slab       16 px    500     Sentence  0        navy
 *
 * Navy is `--color-navy` (#1E3A8A), ink `--color-ink` (#3C4149, today's black). In dark mode the navy titles take
 * #BFDBFE (13's dark colour for 7a, readable on zinc-900 — written out: Tailwind 4's `blue-200` is an oklch near it, not it) and the column names today's zinc-300 (Ask
 * first 2). Line heights are 13's: 24 px at 16 px, 18 px at 13 and 13.5 px, 28 px at 20 px. 13.5 px is written out,
 * not rounded (Ask first 3). The two families are `font-title` and `font-colhead` (globals.css's @theme), loaded by
 * next/font in src/app/layout.tsx — latin and latin-ext, so ă â î ș ț come from their own files.
 */

/** Kinds 1, 2 and 4: a tile's title. */
export const TILE_TITLE_TYPE = "font-title text-base font-semibold uppercase tracking-[0.04em] text-navy dark:text-[#BFDBFE]";

/**
 * Kinds 3 and 6 without their case: the family, size, line, weight and colour. A plainer head with no band (three of
 * Date de referință's editors) takes this and keeps its own case.
 *
 * ⚠️ `[&_th]:font-semibold` is not a repeat: a `<th>` is bold by the browser's own style sheet, so a weight set on the
 * `thead` or the `tr` never reaches it — measured on the runner's first run of TC-LAYOUT-05 step 15, the names came out
 * at 700 (they had been 700 Arial all along, whatever `font-medium` said). 600 is 13's, and the only weight loaded.
 */
export const COLUMN_NAMES_FACE = "font-colhead text-[13.5px] leading-[18px] font-semibold [&_th]:font-semibold text-ink dark:text-zinc-300";

/** Kinds 3 and 6: a list's column names. */
export const COLUMN_NAMES_TYPE = `${COLUMN_NAMES_FACE} uppercase tracking-[0.04em]`;

/** Kinds 3 and 6 on today's band (#DEE6EF, dark #27272A). `LIST_HEAD` is this, kept at its frame's top. */
export const COLUMN_NAMES_BAND = `bg-cap text-left ${COLUMN_NAMES_TYPE} dark:bg-zinc-800`;

/** Kind 5: a panel's heading — Date de referință's left column, and the Settings page's headings that copy it. */
export const PANEL_TITLE_TYPE = "font-title text-[13px] leading-[18px] font-semibold uppercase tracking-[0.08em] text-navy dark:text-[#BFDBFE]";

/** Kind 7a: the heading of „Grupuri" and of „Ștampile". */
export const PAGE_HEADING_TYPE = "font-title text-xl font-semibold text-navy dark:text-[#BFDBFE]";

/** Kind 7b: a group's and a stamp's screen tiles. */
export const SCREEN_TILE_TITLE_TYPE = "font-title text-base font-medium text-navy dark:text-[#BFDBFE]";
