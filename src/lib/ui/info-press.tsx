"use client";

/**
 * An ⓘ that shows a few lines on a PRESS, and hides them on Esc or a press outside.   (Slice #38.69)
 *
 * The app's ⓘ until now is HintBubble's (#32.10, #38.08): a hover tooltip, its text a single paragraph
 * that is always in the document as a control's description. Adrian asked for something else beside
 * two notes of the relationship triangle — „an information button which when clicked will provide more
 * information on how to configure those" — a few steps, with links in them. So this keeps HintBubble's
 * LOOK (the same 24 × 24 ghost pill and serif „i", `INFO_GLYPH`) and PressBubble's BEHAVIOUR
 * (`usePressAway`, #37.64: a press outside or Esc closes it, Esc putting the focus back on the button),
 * and takes its content as children. The button says whether it is showing it (`aria-expanded`).
 *
 * Like everything under `src/lib/ui/`, it takes its words as props.
 */

import { useId, useRef, useState, type ReactNode } from "react";
import { buttonClass } from "@/lib/ui/button-styles";
import { INFO_GLYPH, INFO_GLYPH_FONT } from "@/lib/ui/hint-bubble";
import { usePressAway } from "@/lib/ui/press-bubble";

export function InfoPress({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement | null>(null);
  const ref = usePressAway<HTMLSpanElement>(open, (how) => {
    setOpen(false);
    if (how === "escape") button.current?.focus();
  });
  return (
    <span ref={ref} className="relative inline-flex align-middle not-italic" data-info-press="">
      <button
        ref={button}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className={buttonClass({ variant: "ghost", size: "xs", pill: true, className: "h-6 w-6 shrink-0 leading-none" })}
      >
        <span aria-hidden="true" data-info-glyph="" className={INFO_GLYPH} style={INFO_GLYPH_FONT}>
          i
        </span>
      </button>
      {open && (
        <span
          id={id}
          role="dialog"
          aria-label={label}
          data-info-panel=""
          // Hanging to the button's left: the notes sit at the tile's right, so a panel hanging right would leave it.
          className="absolute right-0 top-full z-30 mt-1 block w-80 whitespace-normal rounded-md border border-card-rim bg-white p-3 text-xs leading-snug text-ink shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {children}
        </span>
      )}
    </span>
  );
}
