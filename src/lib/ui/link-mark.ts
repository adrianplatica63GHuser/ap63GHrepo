/**
 * The heavy yellow that marks the chosen link on „Roluri și legături".             (Slice #38.68)
 *
 * Adrian: the yellow „used to highlight alternatives for the location of the side road under
 * Tools / calculation of a side road" — `preview-map.tsx`'s offered sides and chosen corner: #facc15
 * with #111827 text and rim. Text on it stays dark: #111827 on #facc15 is about 12 : 1, white on it
 * about 1.6 : 1 (Adrian allowed white „if the background is too dark", and this one is not). The same
 * yellow in dark mode — it is a mark, not a surface, and it reads on zinc-900 as on white.
 *
 * The classes are spelled out whole so Tailwind's scanner finds them.
 */
export const LINK_MARK_FILL = "#facc15";
export const LINK_MARK_INK = "#111827";

/** A marked name or title: a filled rounded box, dark text, a dark rim — the column's look for the chosen list. */
export const LINK_MARK_BOX = "rounded-md bg-[#facc15] font-medium text-[#111827] ring-1 ring-inset ring-[#111827]";
