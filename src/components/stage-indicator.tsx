"use client";

/**
 * StageIndicator — the app's first multi-stage progress primitive. (Slice #26.03)
 *
 * WHY A NEW COMPONENT
 * -------------------
 * The app had exactly two progress primitives before this slice —
 * `progress-bar.tsx` (one bar, one number or one indeterminate slide) and
 * `activity-cue.tsx` (one blinking line over one bar). Neither can say "you are
 * at step 2 of 10, these three are behind you and these five are ahead", which
 * is the whole content of the import shell. So this is built as a shared
 * component from the start rather than inline in the wizard: the same shape is
 * already wanted by the redesign's later slices, and the second copy is where
 * two implementations start disagreeing.
 *
 * IT OWNS NO LIST AND NO STRINGS
 * ------------------------------
 * Callers pass already-translated labels and an explicit status per step. The
 * import workflow's list lives in `src/lib/import/workflow-stages.ts`; nothing
 * about "information comes before preconditions" is knowable from here, and it
 * must stay that way or a second copy of the order exists.
 *
 * THE CURRENT STEP PULSES, AND IT IS NOT A DIPPING OPACITY
 * --------------------------------------------------------
 * `.ga-stage-pulse` (globals.css) radiates an amber halo out of the pill —
 * `box-shadow` spread, the same technique as `.ga-vpulse-*`. A fading opacity
 * was the obvious choice and is the wrong one twice over: this codebase already
 * retired the fade-and-return cue as unnoticeable, and fading a pill also fades
 * the label inside it, so the one step the user most needs to read becomes the
 * hardest to. The halo moves outside the pill and leaves the text at full
 * contrast throughout.
 *
 * Under `prefers-reduced-motion` the halo freezes as a steady ring at full
 * strength — not "no animation", which would leave the current step looking
 * like any other amber thing on the screen.
 *
 * ONE LIVE REGION, NOT ONE PER STEP
 * ---------------------------------
 * Ten steps each announcing their own state change would read a whole
 * paragraph on every transition. The status is announced once, for the current
 * step only, by the single `role="status"` line — the same rule the scan table
 * follows for its rows. Every step still carries its state in text (`sr-only`)
 * so a user navigating the list hears it on arrival, and `✓ ● ○` carries it
 * visually, so colour is never the only signal.
 *
 * The live region is the FIRST child, not the last, and that is a layout fact
 * rather than a preference: Tailwind v4 emits `space-y-*` as a margin on
 * `:not(:last-child)`, so a trailing `sr-only` paragraph — which is absolutely
 * positioned and contributes no height — would leave the last visible row still
 * carrying its bottom margin, i.e. a permanent dead gap under the bar.
 */

import { useId } from "react";

export type StageStatus = "pending" | "current" | "done";

export type StageIndicatorStep = {
  id: string;
  /** Already-translated step name. */
  label: string;
  status: StageStatus;
  /**
   * Already-translated micro-annotation shown after the label, e.g. "în curând"
   * for a stage whose screen a later slice builds. Purely descriptive — it does
   * not change how the step is drawn.
   */
  note?: string;
};

export type StageIndicatorLine = {
  id: string;
  /** Already-translated name of the group, e.g. "Pregătire și verificare". */
  label: string;
  steps: StageIndicatorStep[];
};

type Props = {
  lines: StageIndicatorLine[];
  /** Accessible name for the whole indicator, e.g. "Pașii importului". */
  label: string;
  /** Announced when the current step changes. Already translated. */
  announcement: string;
  /** Already-translated state words, read by screen readers per step. */
  statusLabels: Record<StageStatus, string>;
  /** Layout-only extras (margins, flex). Never colour. */
  className?: string;
};

/**
 * Colour per state. Amber and emerald are used literally rather than through a
 * palette token because the app has no semantic token for either — the resume
 * chip in the wizard and the checklist's pips already reach for the same two
 * scales, and inventing a token for one component would leave three spellings
 * of the same amber.
 */
const PILL: Record<StageStatus, string> = {
  pending:
    "border-wire bg-white text-fade dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  current:
    "ga-stage-pulse border-amber-400 bg-amber-50 text-amber-900 " +
    "dark:border-amber-500 dark:bg-amber-950/40 dark:text-amber-200",
  done:
    "border-emerald-400 bg-emerald-50 text-emerald-800 " +
    "dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
};

/** Shape, so the state survives a monochrome screen and a colour-blind reader. */
const GLYPH: Record<StageStatus, string> = {
  pending: "○",
  current: "●",
  done: "✓",
};

export function StageIndicator({
  lines,
  label,
  announcement,
  statusLabels,
  className,
}: Props) {
  const idPrefix = useId();

  return (
    <nav
      aria-label={label}
      className={["space-y-3", className ?? ""].filter(Boolean).join(" ")}
    >
      {/*
        The only live region in the indicator, and the first child — see the
        note above for why its position is load-bearing. `status` and not
        `alert`: moving from one step to the next is progress, not a warning,
        and must not interrupt a screen-reader user mid-sentence.
      */}
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {lines.map((line) => (
        <div key={line.id} className="flex flex-wrap items-center gap-x-2 gap-y-2">
          <span
            id={`${idPrefix}-${line.id}`}
            className="w-full text-xs font-semibold uppercase tracking-wide text-fade dark:text-zinc-400 sm:w-52 sm:shrink-0"
          >
            {line.label}
          </span>

          {/*
            Named by its own line label. Without it a screen reader announces
            two anonymous lists of five and the user has no way to tell the
            preparation line from the classification one.
          */}
          <ol
            aria-labelledby={`${idPrefix}-${line.id}`}
            // `gap-x-2 gap-y-3` rather than a uniform `gap-1.5`: the current
            // pill's halo reaches 6px past its edge, and a 6px gap put it
            // exactly on its neighbours — including the row above once the
            // line wraps, which it does at the 768–1023px widths this app is
            // routinely used at.
            className="flex flex-wrap items-center gap-x-2 gap-y-3"
          >
            {line.steps.map((step, index) => (
              <li key={step.id} className="flex items-center gap-2">
                {index > 0 && (
                  <span aria-hidden="true" className="text-fade dark:text-zinc-500">
                    ›
                  </span>
                )}
                <span
                  // `aria-current="step"` is the standard way to say "this one",
                  // and it is set on the element carrying the label rather than
                  // on the <li>, so a screen reader reports it with the name.
                  aria-current={step.status === "current" ? "step" : undefined}
                  className={[
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    PILL[step.status],
                  ].join(" ")}
                >
                  <span aria-hidden="true">{GLYPH[step.status]}</span>
                  <span>{step.label}</span>
                  {/*
                    Italic and light, never `opacity-*`. Opacity composites the
                    RENDERED colour, so it lowers contrast multiplicatively —
                    the same failure this repo recorded for a `text-fade` label
                    inside a coloured button. At 70% this note measured 3.24:1
                    on white at 12px, under the 4.5:1 the palette commits to;
                    inheriting the pill's own colour keeps it at the pill's
                    ratio. Slant and a separator carry the distinction, NOT
                    weight: `body` sets Arial, which ships 400 and 700 only, so
                    500 resolves down to 400 and `font-medium` on the label
                    renders identically to `font-normal` here.
                  */}
                  {step.note && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-normal italic">{step.note}</span>
                    </>
                  )}
                  <span className="sr-only">{statusLabels[step.status]}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </nav>
  );
}
