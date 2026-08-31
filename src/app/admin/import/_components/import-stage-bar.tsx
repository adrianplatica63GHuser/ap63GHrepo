"use client";

/**
 * ImportStageBar — the shell's header.   (Slice #26.03)
 *
 * Adapts the workflow catalogue to the shared `StageIndicator` and hangs the
 * Cancel beside it. The adapting is here rather than in the indicator because
 * the indicator must not know that an import exists, and here rather than in
 * `ImportWizard` because the wizard is already the longest file in the folder.
 *
 * THE CANCEL IS DISABLED WHILE A MODAL IS OPEN, AND THAT IS NOT A COMPROMISE
 * -------------------------------------------------------------------------
 * The first version of this file merely rendered the button behind the modal
 * overlay and reasoned that being visually covered was enough. It is not:
 * `aria-modal` hides the background from an assistive-technology cursor and
 * does nothing whatever to sequential keyboard focus, and none of this app's
 * dialogs traps focus or sets `inert`. The stage bar is the first child of the
 * wizard, so from any control inside `BulkImportDialog` a Shift+Tab lands here
 * — and confirming would unmount the dialog mid-loop, leaving a document with
 * three of its five pages uploaded and no record of it anywhere. A `disabled`
 * button is not focusable at all, which is the only thing that actually closes
 * that route.
 *
 * So during the three modal phases the button is inert. It carries no
 * explanatory note, and that is on purpose after one was written and removed:
 * all three dialogs are `fixed inset-0 bg-black/40`, so the whole stage bar —
 * button and note alike — sits under a 40% scrim, and a `disabled` button is
 * not focusable, so no keyboard or screen-reader user can arrive at the note
 * either. Copy nobody can read is not an explanation; it is two more strings to
 * translate and keep true.
 *
 * (The `inert` wrapper in `ImportWizard` closes the mirror route — reaching
 * the wizard's own controls FROM the open confirmation. Both are needed: this
 * one stops the dialog being opened over a modal, that one stops a modal being
 * opened under the dialog.)
 */

import { useId } from "react";
import { useTranslations } from "next-intl";

import {
  StageIndicator,
  type StageIndicatorLine,
} from "@/components/stage-indicator";
import { buttonClass } from "@/lib/ui/button-styles";
import { HintBubble } from "@/lib/ui/hint-bubble";
import {
  WORKFLOW_LINE_IDS,
  stageForPhase,
  stageStatuses,
  stagesOnLine,
  type ImportPhase,
} from "@/lib/import/workflow-stages";

/**
 * The phases whose screen is a modal dialog with its own way out. Exported so
 * the wizard can assert the same set rather than keeping a second copy.
 */
export const MODAL_PHASES: readonly ImportPhase[] = [
  "property",
  "tag-dialog",
  "importing",
  // Slice #26.10 — the run has finished but a modal still owns the screen:
  // `BulkImportDialog` as the result table, and the concluding message after
  // it. The Shift+Tab route this list exists to close is open in both, and
  // there is a second reason here: cancelling a run that is OVER cannot undo
  // anything, so the button would offer a remedy for a state that has none.
  "result",
];

type Props = {
  phase: ImportPhase;
  onCancel: () => void;
  /** Slice #29.02 — is the run stopping after every stage that passes? */
  stepThrough: boolean;
  onStepThroughChange: (next: boolean) => void;
  /**
   * Slice #32.10 — does a step open with its listing in view?
   *
   * A DEFAULT, not a lock: it decides the state each of the four listings is in
   * when its step is first reached, and a user who opens the rules on one step
   * has not re-ticked this. See `import-wizard.tsx`, where the tick and the four
   * per-step booleans are written together.
   */
  rulesShown: boolean;
  onRulesShownChange: (next: boolean) => void;
};

export function ImportStageBar({
  phase,
  onCancel,
  stepThrough,
  onStepThroughChange,
  rulesShown,
  onRulesShownChange,
}: Props) {
  const t = useTranslations("adminImport.workflow");
  const tc = useTranslations("adminImport.cancel");
  const tg = useTranslations("adminImport.stepGate");
  const stepId = useId();
  const stepHintId = useId();
  const rulesId = useId();
  const rulesHintId = useId();

  const current = stageForPhase(phase);
  const statuses = stageStatuses(current);
  const inModal = MODAL_PHASES.includes(phase);

  const lines: StageIndicatorLine[] = WORKFLOW_LINE_IDS.map((lineId) => ({
    id: lineId,
    label: t(`line.${lineId}`),
    steps: stagesOnLine(lineId).map((stage) => ({
      id: stage.id,
      label: t(`stage.${stage.id}`),
      status: statuses[stage.id],
      // The note is what keeps a not-yet-built stage from reading as a step
      // that is merely far away. It is drawn from `plannedIn` being present,
      // never from the slice number, which is a developer's fact.
      note: stage.plannedIn ? t("planned") : undefined,
    })),
  }));

  return (
    <section className="rounded-xl border border-card-rim bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start justify-between gap-4">
        <StageIndicator
          className="min-w-0 flex-1"
          lines={lines}
          label={t("indicatorLabel")}
          announcement={t("announcement", { stage: t(`stage.${current}`) })}
          statusLabels={{
            pending: t("statusPending"),
            current: t("statusCurrent"),
            done: t("statusDone"),
          }}
        />

        <div className="shrink-0">
          {/*
            `danger-link` at `md`, not `bare-danger` at `xs`.   (Slice #26.11)

            Adrian's report: "the Cancel import link must be more visible and
            have a red colour of the fonts, and when hovering over it it should
            become a big red button like other cancel buttons". The old pairing
            was the quietest treatment the helper offers — 12px, no padding, no
            surface — on the one control in the whole flow that abandons a run,
            sitting in the corner of a card carrying a ten-pill indicator. It
            lost every contest for the eye it was in.

            The size is the helper's `md` rather than a `text-*` appended
            through `className`: `size` exists precisely because appending a
            conflicting utility resolves on Tailwind's emission order, which is
            the bet the helper's contract forbids. `whitespace-nowrap` conflicts
            with nothing it emits, and the hit target now comes from the
            variant's own `px-3 py-1.5` instead of the `min-h-6` the bare
            variant needed.
          */}
          <button
            type="button"
            onClick={onCancel}
            disabled={inModal}
            className={buttonClass({
              variant: "danger-link",
              size: "md",
              className: "whitespace-nowrap",
            })}
          >
            {tc("button")}
          </button>

          {/*
            ── Step-through   (Slice #29.02) ──────────────────────────────

            Adrian asked for it here, "under the Cancel Import link on the
            first Import page", and here is where that is: the Cancel does not
            live on the Information page, it lives in this bar, which is
            rendered above every phase. So the control is on the first page as
            asked AND stays reachable for the rest of the run — which is the
            point, because a user four stages in who realises they wanted to
            watch can tick it without starting again. It is read at the moment
            of each transition, never earlier.

            ⚠️ **DISABLED IN A MODAL PHASE, for the Cancel's own reason and one
            of its own.** The reason above applies unchanged — none of this
            app's dialogs traps focus, so a Shift+Tab from inside
            `BulkImportDialog` lands in this bar — and on top of that there is
            no self-advancing transition left after `ready`, so the control
            could not change anything even if it were pressed. A `disabled`
            input is not focusable, which is what actually closes the route.

            It carries no note while disabled, for the same reason the Cancel
            carries none: the whole bar is under a 40% scrim and unreachable by
            keyboard, so copy placed here would be copy nobody can read.
          */}
          {/*
            ── The two ticks, each explaining itself in a bubble  (#32.10) ──

            Adrian: the paragraph under "Oprește-te după fiecare pas" was "text
            that shows all the time", and he asked for it on hover instead. Both
            ticks now carry a `HintBubble`, which opens on hover, on keyboard
            focus and from its own ⓘ — see that component for why hover alone is
            not an answer.

            ⚠️ **THE HINT IS STILL THE TICK'S `aria-describedby`, AND THAT IS THE
            ONE THING THIS CHANGE COULD HAVE QUIETLY BROKEN.** The string has not
            moved and its key has not changed; what changed is whether it is
            PAINTED. `HintBubble` keeps the paragraph in the document either way
            — `sr-only` when closed — so the pointer below never dangles.

            ⚠️ **BOTH ARE DISABLED IN A MODAL PHASE, and the bubbles with them.**
            The Cancel's argument at the top of this file applies unchanged, and
            a bubble under a 40% scrim that no keyboard can reach is copy nobody
            can read. `disabled` on `HintBubble` suppresses every open path.
          */}
          <div className="mt-3 max-w-56">
            <HintBubble
              id={stepHintId}
              text={tg("toggleHint")}
              triggerLabel={tg("hintTrigger", { control: tg("toggle") })}
              disabled={inModal}
            >
              <input
                id={stepId}
                type="checkbox"
                checked={stepThrough}
                disabled={inModal}
                onChange={(e) => onStepThroughChange(e.target.checked)}
                aria-describedby={stepHintId}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-wire accent-cta disabled:cursor-not-allowed"
              />
              <label
                htmlFor={stepId}
                className="cursor-pointer select-none text-xs font-medium text-ink dark:text-zinc-200"
              >
                {tg("toggle")}
              </label>
            </HintBubble>

            {/*
              ── Show the rules   (Slice #32.10) ──────────────────────────

              Ticked by default, and NOT persisted, for the reason its neighbour
              is not: `IMPORT_SESSION_KEY` holds a finished run's report, and a
              viewing preference is not part of a report. It starts ticked at
              the beginning of every run and `handleCancelConfirmed` resets it
              with the rest.
            */}
            <div className="mt-2">
              <HintBubble
                id={rulesHintId}
                text={tg("rulesToggleHint")}
                triggerLabel={tg("hintTrigger", { control: tg("rulesToggle") })}
                disabled={inModal}
              >
                <input
                  id={rulesId}
                  type="checkbox"
                  checked={rulesShown}
                  disabled={inModal}
                  onChange={(e) => onRulesShownChange(e.target.checked)}
                  aria-describedby={rulesHintId}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-wire accent-cta disabled:cursor-not-allowed"
                />
                <label
                  htmlFor={rulesId}
                  className="cursor-pointer select-none text-xs font-medium text-ink dark:text-zinc-200"
                >
                  {tg("rulesToggle")}
                </label>
              </HintBubble>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
