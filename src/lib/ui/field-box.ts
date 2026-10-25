/**
 * Calm fields, and a field's label told apart from its value.                                          (Slice 40.56)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 1a): „I really, really love this calm fields … however,
 * I feel there is not a clear demarcation between the label of the field and the content of the field … So I am open
 * to use different fonts, different sizes, different colours". Of Figura 1.3: „I see a better demarcation between the
 * labels and the content".
 *
 * ONE BOX, SIX PLACES. Until this slice the box was a `BOX_CLASS` written out in natural-person-form.tsx,
 * judicial-person-form.tsx, property-form.tsx, document-form.tsx, the import's id-card-person-dialog.tsx and
 * address-block.tsx (the sixth, which the header's count missed). Each now imports `FIELD_BOX` and `fieldBorder`;
 * `field-box.test.ts` keeps it so.
 *
 *   at rest       no border, no fill, no shadow — the value reads as text on the tile
 *   hover         the white box with the grey border, so the mouse shows it can be changed (`enabled:` only —
 *                 a version being viewed or `?readonly=true` sits in a disabled <fieldset> and shows no box, Ask first 4)
 *   focus         the focus blue (#1A5296) border and a soft ring of the same blue
 *   empty         a dashed grey underline at rest (globals.css, `.ga-field`), and no placeholder word (Ask first 3) —
 *                 a text box, a text area or a drop-down on its blank choice; a date shows the browser's own mask
 *   red / orange  an error or an expired date, a date expiring within three months: the border stays at rest
 *
 * The label and the value (Ask first 1): the label in Roboto Condensed (the lists' column names' family, 40.18) at
 * 12 px, regular, a little letter-spacing, muted (`text-fade`, zinc-400 in dark); the value in the body font at the
 * body size, ink, weight 500. Two px between a label and its value (`STACKED_FIELD_CLASS`'s `gap-y-0.5`), eight
 * between one row of fields and the next (the panels' `gap-2`), so each pair reads as one unit. Both stay flush
 * left, which the widths assume.
 *
 * WHAT DOES NOT CHANGE: the padding and the 1 px border are there at rest, transparent, so no box changes size
 * between rest, hover and focus, and `field-widths.ts` sizes every box exactly as before. Arial has no 500, so the
 * value's weight draws as 400 today and measures as it always did. The version pulse (`ga-vpulse-*`) draws with
 * `outline` and `box-shadow`, so it shows on a borderless box; `usePulseRing` is unaffected.
 */

/** A field's label: Roboto Condensed, 12 px, muted. Stacked labels add their `self-end` (`STACKED_LABEL_CLASS`). */
export const FIELD_LABEL = "font-colhead text-xs font-normal tracking-[0.02em] text-fade dark:text-zinc-400";

/**
 * The box's own look; its width is never a class here — it comes from `boxStyle` / `stackedBoxStyle`, and its
 * border colour from `fieldBorder`. `ga-field` is the hook for the empty state's dashed underline (globals.css).
 *
 * `[&[disabled]]` and not `disabled:`: a box disabled ON ITS OWN („Data decesului" until „Decedat" is ticked) is
 * faded; a box that is disabled only because its <fieldset> is (a version, `?readonly=true`) keeps the value's ink,
 * because there the page is being read.
 */
export const FIELD_BOX =
  "ga-field rounded-md border bg-transparent px-2 py-1 font-medium text-ink shadow-none focus:outline-none " +
  "enabled:hover:bg-white enabled:hover:shadow-sm focus:bg-white focus:ring-2 focus:ring-focus/20 " +
  "disabled:cursor-default [&[disabled]]:text-fade " +
  "dark:text-zinc-100 dark:enabled:hover:bg-zinc-950 dark:focus:bg-zinc-950 dark:focus:ring-focus/40 dark:[&[disabled]]:text-zinc-500";

/**
 * The border's colour. Red for an error or an expired date and orange for one expiring soon, visible at rest
 * (they are information, not decoration); otherwise transparent at rest, grey on hover, blue in focus.
 */
export function fieldBorder(invalid: boolean, expiringSoon = false): string {
  if (invalid) return "border-red-500 focus:border-red-600";
  if (expiringSoon) return "border-orange-500 focus:border-orange-600";
  return "border-transparent enabled:hover:border-wire focus:border-focus dark:enabled:hover:border-zinc-700";
}

/**
 * A value that is shown and never typed in (the age, a computed code): the value's look, with the box's padding and
 * transparent border so it lines up with the boxes beside it.
 */
export const FIELD_READONLY =
  "rounded-md border border-transparent px-2 py-1 font-mono text-sm font-medium text-ink dark:text-zinc-100";

/** The placeholder every calm text box carries, so CSS can see it is empty (`:placeholder-shown`). Never a word. */
export const EMPTY_MARK = " ";
