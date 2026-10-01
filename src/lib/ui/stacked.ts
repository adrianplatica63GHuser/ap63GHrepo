/**
 * Labels above their boxes: the classes every stacked form shares.
 *                                                   (Slice #37.26; #37.29, rule 16)
 *
 * A LABEL SITS ABOVE ITS BOX, left-aligned, and the pair is exactly as wide as
 * the box: a long label wraps inside that width rather than widening the row.
 *
 * RULE 16 — A ROW'S BOXES START ON ONE LINE. A label is only as wide as its
 * box, so at M „Nr. înregistrare (CUI)" takes two lines where „ID" takes one.
 * A row of plain flex columns then starts the CUI box a line lower than the ID
 * box beside it. So a row is a grid of three tracks — the labels, the boxes,
 * the hints and errors under them — and each field spans all three as a
 * SUBGRID (`grid-rows-subgrid`): the labels of a row share one height and each
 * sits at the bottom of it (`self-end`), next to its box; the boxes all start
 * on the second track; a hint (the CUI lock) or an error below one box makes
 * only the third track taller. A field outside a row (Note, Denumire) is a
 * grid on its own and simply stacks.
 *
 * Shared, so the Natural Person gets it too (#37.29 allows exactly this one
 * change to it): its rows never wrapped a label, so it looks the same.
 */

/** One row of stacked fields. */
export const STACKED_ROW_CLASS = "grid grid-flow-col auto-cols-max grid-rows-[auto_auto_auto] gap-x-2 gap-y-0.5";

/** One field — label, box, hint — spanning a row's three tracks. Its width is the box's, an inline style. */
export const STACKED_FIELD_CLASS = "row-span-3 grid grid-rows-subgrid items-start gap-y-0.5 text-sm";

/** The label: at the bottom of the row's label track, next to its box. */
export const STACKED_LABEL_CLASS = "self-end font-medium text-ink dark:text-zinc-300";
