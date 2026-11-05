/**
 * A calm row: its buttons faint at rest, at full colour on the row under the mouse.            (Slice 41.90)
 *
 * 40.60 made the four lists' rows calm, and 40.96 „Legături"'s (`OneLineRow`'s `quiet`): the buttons at 35 % until the
 * row is hovered or holds the focus, while one of them is pressed or its dialog open (an open „Previzualizare"), and
 * always on a screen with no hover. Adrian, 2026-11-05: „On the Pages tile the list containing the pages must become
 * „calm" … Exactly like this is done for the Links tile". That was the recipe's sixth copy, past the third-copy rule,
 * so it is written once, here — the row itself carries `group/row` (`QUIET_ROW`).
 */

/** The row: the group its buttons read. */
export const QUIET_ROW = "group/row";

/** The row's buttons. */
export const QUIET_ROW_BUTTONS =
  "opacity-35 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 has-[[aria-pressed=true]]:opacity-100 has-[[aria-expanded=true]]:opacity-100 [@media(hover:none)]:opacity-100";

/** What the specs read the buttons' calm by. */
export const QUIET_ROW_MARK = "quiet";
