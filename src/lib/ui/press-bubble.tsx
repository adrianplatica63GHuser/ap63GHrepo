"use client";

/**
 * Something that opens on a PRESS and goes on a click outside or on Esc.
 *                                                                  (Slice #37.64)
 *
 * HintBubble (#32.10) and IconButton's label are hover tooltips: they open on a
 * mouse resting and close when it leaves. Adrian asked for two things on the
 * Document's rows that behave differently:
 *
 *  - „Acte corelate": „The relationship should not be listed. It should be a
 *    button before the view button. When this button is clicked it should show
 *    the text and then when clicking outside the text should disappear" —
 *    `PressBubble`.
 *  - „Persoane": the orange „Cotă" opens a small panel with the three share
 *    boxes, which closes the same way — `usePressAway`, which
 *    `document-persons-tab.tsx` puts round its button and panel.
 *
 * One hook for both, so „outside" and „Esc" mean the same thing in each:
 *
 *  - **Outside is decided on `pointerdown`, in the capture phase.** A click
 *    would be too late for the share panel: the press that lands on another
 *    row's „Cotă" must close this panel before that one opens, and the box
 *    being typed into must commit (`onBlur`) before anything re-renders.
 *  - **Esc is heard from the document** and not stopped — a dialog the row
 *    sits in is entitled to hear it too (the same courtesy `use-tooltip.ts`
 *    extends).
 *
 * Like everything under `src/lib/ui/`, it takes its words as props.
 */

import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

/**
 * While `open`, call `onClose` on a press outside the returned ref's element,
 * or on Escape. `onClose` is told which it was, so a caller can put the focus
 * back on its button after Esc (a press outside has already moved it).
 */
export function usePressAway<T extends HTMLElement>(
  open: boolean,
  onClose: (how: "outside" | "escape") => void,
) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => {
      const el = ref.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) onClose("outside");
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose("escape");
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose]);
  return ref;
}

/**
 * An icon button that shows a sentence in a bubble beside it while pressed,
 * and hides it on a click outside or on Esc. The sentence is in the document
 * only while shown — it is not a description of the button but what the button
 * reveals, so the button says whether it is showing it (`aria-expanded`).
 */
export function PressBubble({
  icon,
  label,
  text,
}: {
  icon: ComponentType<LucideProps>;
  /** The button's name and tooltip. */
  label: string;
  /** What it shows. */
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const button = useRef<HTMLButtonElement | null>(null);
  const ref = usePressAway<HTMLSpanElement>(open, (how) => {
    setOpen(false);
    if (how === "escape") button.current?.focus();
  });
  return (
    <span ref={ref} className="relative inline-flex">
      <IconButton
        ref={button}
        icon={icon}
        label={label}
        variant="secondary"
        size="xs"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <span
          id={id}
          role="status"
          data-press-bubble=""
          // Beside the button, hanging to its left: the slots are at the row's
          // right edge, so a bubble hanging right would leave the tile.
          className="absolute right-0 top-full z-30 mt-1 w-64 whitespace-normal rounded-md border border-card-rim bg-white p-2 text-xs leading-snug text-ink shadow-lg dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
        >
          {text}
        </span>
      )}
    </span>
  );
}
