/**
 * Where Tab goes when a dialog is not allowed to let it out.    (Slice #34.28)
 *
 * ⚠️ **A PURE FUNCTION, BECAUSE THE THING WORTH TESTING IS THE ARITHMETIC.**
 * `ConfirmDialog` in `property-form.tsx` is module-private inside a component
 * that no suite in this repo imports — the four existing form components have
 * none between them; a byte count was here and went stale inside the same slice
 * that wrote it — and #34.28's out-of-scope list forbids
 * extracting it („improved in place or not at all"). So the wiring stays there
 * and the decision lives here, where a test can drive it against a real DOM
 * without a browser. `association-failure.ts` is the same move for the same
 * reason, one layer up.
 *
 * ⚠️ **WHY A TRAP AND NOT `inert`.** `document-persons-modal.tsx` keeps its own
 * modal promise with `inert` on the panel underneath, and that is the better
 * mechanism where it fits. It does not fit here, twice over: `ConfirmDialog`
 * renders as a CHILD of the `<form>` it covers, so `inert` on the form would
 * make the dialog itself inert; and the control this trap exists to fence off —
 * the ◀/▶ version nav — is portalled into the breadcrumb header, outside the
 * form entirely, so no single `inert` subtree covers both. A Tab cycle inside
 * the panel is indifferent to where the rest of the page lives.
 *
 * ⚠️ **NO VISIBILITY FILTER, AND THE OMISSION IS DELIBERATE.**
 * `discover-review-dialog.tsx:559` filters its candidates on
 * `el.offsetParent !== null || el === document.activeElement`, because its panel
 * renders controls that are conditionally hidden. ⚠️ **QUOTE BOTH HALVES — an
 * adversarial round caught this paragraph quoting only the first.** The `||` is
 * the load-bearing half: it keeps the CURRENTLY FOCUSED control in the list when
 * layout says it is hidden, and a caller told to „put the filter back" from a
 * one-clause version would put back a broken one.
 *
 * It is omitted here because a `ConfirmDialog` panel holds at most two buttons
 * and always renders both of the ones it declares, so the filter would have
 * nothing to do — and `offsetParent` is `null` for everything in jsdom, which
 * does no layout, so carrying it would have made this function untestable in the
 * environment the suite runs in. A third caller with hidden controls needs the
 * filter back, both clauses, and injected rather than hard-coded.
 */

/**
 * What counts as reachable by Tab.
 *
 * ⚠️ **THIS IS THE THIRD COPY OF THIS STRING, AND CENTRALISING IT IS A JOB THIS
 * SLICE DID NOT DO.** `discover-review-dialog.tsx:557` and
 * `document-type-form-editor.tsx:365` carry it byte-identically, each beside its
 * own `offsetParent !== null || el === document.activeElement` filter — which is
 * the half this module omits, for the reason written above. `C:\dev\CLAUDE.md`
 * says to centralise at the THIRD copy site, which is here; a sixth review round
 * called that, and the answer was that moving two unrelated dialogs onto a
 * constant whose filter differs from theirs is a slice of its own rather than a
 * line in this one. What #34.28 does instead is stop the drift:
 * `confirm-dialog-focus.test.ts` asserts this string appears verbatim in both
 * other files, so the day one of them changes, one of them fails.
 */
export const DIALOG_FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export type TabTrapMove = {
  /** Swallow the keypress — always true whenever focus is being placed. */
  preventDefault: boolean;
  /** Where to put focus, or `null` to leave it where the browser will. */
  focus: HTMLElement | null;
};

/** Tab is the browser's to handle: focus is already going somewhere legal. */
const RELEASE: TabTrapMove = { preventDefault: false, focus: null };

/**
 * Decide what a Tab (or Shift+Tab) inside `panel` should do.
 *
 * @param panel   the dialog container, or `null` when its ref is not attached
 * @param active  `document.activeElement` at the moment of the press
 * @param shiftKey  whether the press was Shift+Tab
 */
export function tabTrapMove(
  panel: HTMLElement | null,
  active: Element | null,
  shiftKey: boolean,
): TabTrapMove {
  // No panel means no promise to keep — the ref has not attached yet, or the
  // dialog is already going. Releasing is the same thing the browser would do.
  if (!panel) return RELEASE;

  const focusable = Array.from(panel.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE));

  // ⚠️ **PREVENT, DON'T RELEASE** — Slice #27.04's finding, restated because it
  // is exactly as live here. Both buttons are `disabled` while a save or a
  // delete is in flight, so this list is empty for precisely as long as the
  // write lasts. Releasing then hands Tab to the page underneath, where the
  // version nav sits — and stepping a version while a make-current is in flight
  // is the walk-out #34.17 closed on the click path. Nothing to move focus TO
  // is a reason to swallow Tab, not a reason to hand it away.
  //
  // ⚠️ **PARKED ON THE PANEL, NOT LEFT ON `<body>` — an adversarial round.** A
  // disabled button drops focus to `<body>` the moment it is disabled, so
  // returning `focus: null` here swallowed the key and left focus outside the
  // dialog for the whole of the write. `onDelete` never clears `submitting` on
  // its success path — it hands off to `router.push` — so a navigation that
  // stalls left the keyboard dead with no way out at all. The panel is
  // `tabIndex={-1}` precisely so it can hold focus, and parking there means the
  // press that lands after the buttons come back finds focus inside.
  if (focusable.length === 0) return { preventDefault: true, focus: panel };

  const first = focusable[0];
  const last = focusable[focusable.length - 1];

  // ⚠️ **`active === panel` IS THE SAME CASE AS `active` BEING OUTSIDE, AND
  // READING IT AS „somewhere in the middle" WAS A ONE-PRESS WALK-OUT.** Found by
  // an adversarial round on the first draft of this file. The dialog focuses its
  // own overlay on open — it has to, or an `aria-modal` nobody focuses announces
  // nothing — and `panel.contains(panel)` is `true`, so the pull-back below did
  // not fire, while the panel is neither `first` nor `last`, so neither wrap did
  // either. The function returned RELEASE, and the browser's sequential
  // navigation from a `tabindex="-1"` element goes to the previous tabbable in
  // DOCUMENT order — which, for a dialog rendered at the end of the form, is the
  // footer's last button. One Shift+Tab and one Enter from a fresh confirmation
  // reached „Anulează" and navigated away with the dialog still up. Exactly the
  // walk-out this module exists to stop, rebuilt by the fix for it.
  //
  // ⚠️ **AND IT IS DIRECTION-AWARE.** Shift+Tab from outside belongs on `last`,
  // not on `first`: the user asked to go backwards, and answering every
  // re-entry with `first` makes Shift+Tab and Tab do the same thing.
  const outside = !active || active === panel || !panel.contains(active);
  if (outside) return { preventDefault: true, focus: shiftKey ? last : first };

  if (shiftKey && active === first) return { preventDefault: true, focus: last };
  if (!shiftKey && active === last) return { preventDefault: true, focus: first };

  // Somewhere in the middle — the browser's own order is already correct.
  return RELEASE;
}
