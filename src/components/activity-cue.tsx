"use client";

/**
 * ActivityCue — Slice #23.09.UX
 *
 * The in-progress cue for a dialog body: a blinking status line, optionally
 * over an indeterminate progress bar.
 *
 * Adrian's report was about `document-ai-interpret-dialog.tsx`'s
 * "Se citește documentul…", but every one of these cues used Tailwind's
 * pulse utility on `text-fade`, so they all had the same two problems: an
 * animation that only dips to 50% opacity, and text too muted to read at
 * full opacity. The blink lives in `.ga-cue-blink` (globals.css); the contrast
 * fix lives here, so a new dialog gets both by using the component rather than
 * by remembering a pair of class names.
 *
 * `role="status"` is polite, and it is `status` for every one of these —
 * never `alert`. The precedent is `scan-confidence-warning.tsx`
 * (Slice #23.03.Import), which uses `alert` only for a red warning that the
 * document type may be wrong. Something merely taking a while does not
 * interrupt a screen-reader user mid-sentence.
 *
 * Text and bar are deliberately ONE component rather than two things a call
 * site pairs up. Under `prefers-reduced-motion` the bar stops sliding, and a
 * motionless bar says nothing about running — the announced text is what
 * carries the meaning then, so it must not be possible to render the bar
 * without it. The bar is also named BY this text (`aria-labelledby`), so it
 * needs no i18n of its own.
 *
 * The component owns no strings: callers pass their own already-translated
 * text, so no Romanian wording changes and no e2e locator moves.
 */

import { useId, type ReactNode } from "react";

import { ProgressBar } from "@/components/progress-bar";

type Props = {
  /** Already-translated cue text, e.g. `t("running")`. */
  children: ReactNode;
  /** Render an indeterminate bar under the text. Omit for inline notes. */
  progress?: boolean;
  /** Layout-only extras (margins, text alignment). Never colour or weight. */
  className?: string;
};

export function ActivityCue({ children, progress = false, className }: Props) {
  const textId = useId();

  return (
    <div className={["space-y-2", className ?? ""].filter(Boolean).join(" ")}>
      <p
        id={textId}
        role="status"
        className="ga-cue-blink text-sm font-medium text-cta"
      >
        {children}
      </p>
      {progress && <ProgressBar indeterminate labelledBy={textId} />}
    </div>
  );
}
