"use client";

/**
 * ImportStepGate — the pause the user asked for.   (Slice #29.02)
 *
 * WHAT IT IS
 * ----------
 * Some of the wizard's transitions happen on their own: the preconditions
 * checklist, the three clean file checks and the end of the scan all move the
 * phase the instant their work comes back, so the stage that just passed is
 * replaced before anybody reads it. Adrian's report: those stages "just fly to
 * the next phase without any pause".
 *
 * With `Oprește-te după fiecare pas` ticked, each of them comes to rest on the
 * stage it has finished, and this card is what stands under that stage's own
 * screen: one green sentence saying what passed and that there is nothing for
 * the user to do, and one button naming where it goes next.
 *
 * ⚠️ **THE CLEAN ARCHIVE LOOKUP WAS THE SIXTH UNTIL SLICE #29.08, and this
 * header said "six" in three places.** That slice moved the classification in
 * front of the Evaluation screen, so a clean lookup now lands on the
 * Pre-existing report screen — which stops on the button that starts the billed
 * classification — and a stage that already stops is never gated.
 * `SELF_ADVANCING_TRANSITIONS` is the one place the count lives; a number
 * repeated in prose is a number that goes stale while the table stays right.
 *
 * WHY THE SENTENCE IS PER STAGE
 * -----------------------------
 * A single generic "everything is fine, press to continue" would be a small lie
 * twice over: the preconditions have nothing to do with the folder in File
 * Explorer, and the scan checked nothing at all — it classified. The whole
 * flow's rule is that a screen never claims more than actually ran, and a
 * sentence reused across unlike stages is exactly how that rule gets broken
 * quietly. So there is one line per stage, and each says that stage's own
 * conclusion in its own words.
 *
 * ⚠️ **IT DOES NOT REPEAT THE PANEL'S OWN ALL-CLEAR.** The stage above it is
 * already showing its emerald `clean` line — "Structura folderului este în
 * regulă." and its three siblings. Saying the same sentence twice on one screen
 * reads as a rendering fault, so these lines are written to add the second half
 * the panel does not carry: that there is nothing to go and fix, and that the
 * import is waiting on the user rather than on itself.
 *
 * ⚠️ **THE ANNOUNCEMENT IS NOT IN THIS FILE, AND THAT IS NOT AN OVERSIGHT.**
 * The first version of this card carried its own `role="status"`, which does
 * not work: a live region inserted into the DOM together with its text is not
 * reliably announced, because the region has to exist before its content
 * changes. So the wizard owns a permanently-mounted sr-only status paragraph
 * whose TEXT becomes this card's sentences — the same shape the four stage
 * panels already use one level down. Adding `role="status"` here as well would
 * be a second announcement of one event, and an unreliable one.
 *
 * ⚠️ **AND THE CARD REALLY HAS NONE, WHICH IT DID NOT UNTIL #32.03.** A
 * `role="status"` had been left on the `cleared` paragraph below, in flat
 * contradiction of the paragraph above it: the wizard's region already carried
 * that exact sentence, so the card's role was one event announced twice, by the
 * unreliable one of the two mechanisms. `sentences` above is plural because
 * #32.03 put `nextAction` and `why` into the region as well — the card's three
 * paragraphs are the region's three sentences, in the same order. The button's
 * own label is not among them, and does not need to be: a button is announced
 * when it is reached.
 *
 * ⚠️ **AND FOCUS IS DELIBERATELY NOT MOVED.** Most rests have a stage panel on
 * screen, which takes focus to its own `<h2 tabIndex={-1}>` —
 * the stage's own result is what the user should be reading first. Pulling
 * focus down here would skip past it to the button. The card is last in
 * document order, so it is the next thing in tab order after the panel it
 * follows.
 *
 * ⚠️ **KNOWN GAP, AND #32.03 MADE IT UNIVERSAL RATHER THAN CREATING IT.** At
 * the preconditions and scanning rests nothing focuses anything — neither
 * `preflight-checklist.tsx` nor `import-scanning-stage.tsx` does any focus
 * management, and the press that got the user there unmounted the element
 * holding the keyboard — so focus sits on `<body>` and reaching this button
 * costs a tab from the top of the document. Until #32.03 that healed by
 * accident on the common path: with the toggle unticked the phase moved
 * straight on to Structure, whose panel focuses its heading exactly when focus
 * is stranded. The default is ticked now, so the preconditions rest is the
 * first stop of every run.
 *
 * **#32.03 BUILT THE OBVIOUS FIX AND TOOK IT BACK OUT, WHICH IS WHY THIS
 * PARAGRAPH IS LONG.** A mount effect focusing this `<section>` when focus is
 * stranded costs eight lines and breaks three things: `focus()` scrolls, and
 * this card is the LAST element on both of those screens, so it drags the
 * preflight checklist — whose three-second dwell floor exists to make those
 * eight lines readable — and the whole unvirtualised `ScanTable` off the top,
 * for mouse users too, since `activeElement === body` is exactly a mouse
 * user's state there; it lands the screen reader past the very result the card
 * is drawn below; and it puts a focus move on the same commit as the region's
 * polite announcement, which is one of the two defects the role removal above
 * was for. `focus({ preventScroll: true })` fixes the first and neither of the
 * others. What actually closes this is the two screens focusing their own
 * headings the way the stage panels do — a change to them, not to this card —
 * and that is a slice, not a fix in passing.
 */

import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import type { WorkflowStageId } from "@/lib/import/workflow-stages";

/**
 * The rests that have something to say about what the button is FOR.
 *                                                            (Slice #32.03)
 *
 * At the preconditions rest the folder picker is the thing the user is looking
 * for and this screen has none — #32.03 stopped its all-clear sentence
 * promising one — so that rest gets one extra line saying where it actually is.
 *
 * ⚠️ **A LIST, NOT A LINE ON EVERY REST.** This card is drawn at every rest
 * `SELF_ADVANCING_TRANSITIONS` names; a generic "press Continue" on the rest of
 * them would be telling the reader what is already two centimetres below them.
 * A stage belongs here only when the NEXT screen holds something THIS one sent
 * them looking for. (Note that no sentence in this file counts those rests:
 * `SELF_ADVANCING_TRANSITIONS` is the one place the number lives, and this
 * file's header records what a number repeated in prose cost once already.)
 *
 * Exported because `import-wizard.tsx` reads it too — its permanently-mounted
 * sr-only region has to carry the same sentence, and "which rests have one" is
 * a rule that must not exist in two places.
 */
export const STAGES_WITH_NEXT_ACTION: readonly WorkflowStageId[] = ["preconditions"];

type Props = {
  /** The stage that has just finished — chooses the sentence. */
  stage: WorkflowStageId;
  /** The stage the button goes to — names the button. */
  nextStage: WorkflowStageId;
  onAdvance: () => void;
};

export function ImportStepGate({ stage, nextStage, onAdvance }: Props) {
  const t = useTranslations("adminImport.stepGate");
  const tStage = useTranslations("adminImport.workflow");

  /**
   * The button's label, built ONCE and read twice.        (Slice #32.03)
   *
   * ⚠️ **THE SENTENCE BELOW NAMES THIS BUTTON, AND IT MUST NOT NAME IT A SECOND
   * TIME IN THE MESSAGES FILE.** A literal copy of "Continuă la pasul
   * «Structură»" in `nextAction.preconditions` would be two strings with one
   * meaning, and the day either `advance` or the stage vocabulary is relabelled
   * the panel starts telling a business user to press a button that no longer
   * exists under that name. So the label is interpolated into the sentence, the
   * same value the button renders.
   */
  const advanceLabel = t("advance", { stage: tStage(`stage.${nextStage}`) });

  return (
    <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
      {/* ⚠️ **NO `role="status"`, AND #32.03 IS WHAT MADE THAT TRUE.** See the
          header: the wizard's permanently-mounted sr-only region carries this
          sentence, the `nextAction` one and `why`, and a live region inserted
          together with its text is not reliably announced anyway. A role here
          was one event announced twice, by the unreliable half of the pair. */}
      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
        {t(`cleared.${stage}`)}
      </p>

      {/* ⚠️ **ABOVE `why`, AND THAT ORDER IS THE POINT.**   (Slice #32.03)
          `cleared.<stage>` says the step passed and there is nothing to
          prepare, which raises "and now what"; this is the answer, so it sits
          beside the sentence that raised the question rather than below the
          explanation of why the run paused. */}
      {STAGES_WITH_NEXT_ACTION.includes(stage) && (
        <p className="mt-1.5 text-sm text-emerald-800 dark:text-emerald-200">
          {t(`nextAction.${stage}`, { button: advanceLabel })}
        </p>
      )}

      <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300">
        {t("why")}
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={onAdvance}
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {advanceLabel}
        </button>
      </div>
    </section>
  );
}
