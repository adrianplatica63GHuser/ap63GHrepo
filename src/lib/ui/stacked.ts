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

/**
 * One row of stacked fields.
 *
 * RULE 19 — A LABEL WITH NOTHING TO ITS RIGHT DOES NOT WRAP (Slice #37.52).
 * Adrian: „It should not wrap. It's fine if it goes a bit past the end of the
 * field." So the row's LAST field is not as wide as its box (`width: auto`,
 * important over the field's inline box width) and its column is `auto`: it
 * takes its label's one-line width when the panel has room for it, and only
 * the room up to the panel's inner edge when it has not — there, and only
 * there, the label wraps. The box inside keeps its own width (every box
 * carries it inline). Every other field is as wide as its box, as before, so a
 * label with a field to its right still wraps at its box and never runs under
 * its neighbour. `justify-start`, because `auto` columns would otherwise
 * stretch to fill the row and pull the fields apart.
 *
 * Measured on the four forms in #37.52, applied and taken off again: not one
 * box moved or changed width; two labels came onto one line („Nr. registru
 * comerțului", „Suprafață calculată (m²)"); a label made longer than the room
 * wrapped exactly at the panel's inner edge.
 */
export const STACKED_ROW_CLASS =
  "grid grid-flow-col auto-cols-auto justify-start grid-rows-[auto_auto_auto] gap-x-2 gap-y-0.5 [&>:last-child]:w-auto!";

/** One field — label, box, hint — spanning a row's three tracks. Its width is the box's, an inline style. */
export const STACKED_FIELD_CLASS = "row-span-3 grid grid-rows-subgrid items-start gap-y-0.5 text-sm";

/** The label: at the bottom of the row's label track, next to its box. */
export const STACKED_LABEL_CLASS = "self-end font-medium text-ink dark:text-zinc-300";
