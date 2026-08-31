"use client";

/**
 * ImportListingControls — the one row that sits under a step's listing.
 *                                                            (Slice #32.10)
 *
 * Four panels — Structure, Constraints, Duplicates, Already in the system —
 * carry what is structurally the same row: show/hide the listing on the left,
 * "Save … as a page" beside it, the Save hint underneath. They differed only in
 * their message keys and in which boolean they read, which is `CLAUDE.md`'s
 * "centralise a bypass rule at the third copy site, not the fourth" with the
 * word "rule" swapped for "row". This slice is the third copy site, so the row
 * is centralised here rather than written out a fourth time.
 *
 * ⚠️ **THE ORDER IT SITS IN IS THE POINT OF THE SLICE, NOT A DETAIL.** Adrian
 * asked for the take-away to move ABOVE the acknowledgement tick, so a user who
 * has hidden the rules can still save them without walking past a tick that
 * asks them to confirm they have read what is not on screen. That makes this
 * row the first thing a keyboard reaches after the listing — hence one
 * separator above it and the gate's own separator below, where before this
 * slice there was one before the gate and one before a take-away block that no
 * longer exists.
 *
 * ⚠️ **`showToggle` IS NOT "does this panel have a listing".** Every caller has
 * one. It is false only where the listing is FORCED open by something other
 * than the user's choice — a failed archive lookup, a re-check with nothing on
 * screen — and there the disclosure would report `aria-expanded="false"` over an
 * expanded region, offer to show what is already shown, and relabel itself when
 * pressed. That defect is older than this slice; the panels' own notes record
 * finding it. The Save half stays up in those windows, which is why the flag is
 * on the button rather than on the row.
 *
 * ⚠️ **`busy` DISABLES SAVE, AND IT SURVIVED THE MOVE ON PURPOSE.** A Save
 * pressed during a check writes "nothing has been checked yet" into a dated page
 * while the screen behind it still shows the previous round's fix list — the one
 * thing the user actually carries into File Explorer. Each panel's own note
 * records the window; this prop is where the four of them now meet.
 */

import { buttonClass } from "@/lib/ui/button-styles";

type Props = {
  /** Is the listing open? The panel owns the state; the wizard hoists it. */
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** See the module note — false only while the listing is forced open. */
  showToggle: boolean;
  /**
   * The two labels, in the term THAT step uses for its own listing: rules,
   * constraints or explanations. Passed in rather than derived, because the
   * term is the panel's fact and this component has no namespace of its own.
   */
  showLabel: string;
  hideLabel: string;
  saveLabel: string;
  saveHint: string;
  onSave: () => void;
  /** A check is running: see the module note. */
  busy: boolean;
};

export function ImportListingControls({
  open,
  onOpenChange,
  showToggle,
  showLabel,
  hideLabel,
  saveLabel,
  saveHint,
  onSave,
  busy,
}: Props) {
  return (
    <div className="mt-5 border-t border-crease pt-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-3">
        {showToggle && (
          <button
            type="button"
            onClick={() => onOpenChange(!open)}
            aria-expanded={open}
            // `ghost` against the Save's `secondary`: two buttons of equal
            // weight side by side would make the row compete with the primary
            // below it, and of the two this is the one that changes nothing but
            // the view. Through `buttonClass` rather than the bare text link it
            // replaced, because Adrian asked for a button beside Save and a
            // hand-written class string is the bet that helper exists to forbid.
            className={buttonClass({ variant: "ghost", size: "md" })}
          >
            {open ? hideLabel : showLabel}
          </button>
        )}
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className={buttonClass({ variant: "secondary", size: "md" })}
        >
          {saveLabel}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-fade dark:text-zinc-400">{saveHint}</p>
    </div>
  );
}
