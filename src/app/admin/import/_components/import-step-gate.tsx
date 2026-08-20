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
 * whose TEXT becomes this card's sentence — the same shape the four stage
 * panels already use one level down. Adding `role="status"` here as well would
 * be a second announcement of one event, and an unreliable one.
 *
 * ⚠️ **AND FOCUS IS DELIBERATELY NOT MOVED.** Most of the rests mount a stage
 * panel, which takes focus to its own `<h2 tabIndex={-1}>` — the stage's own
 * result is what the user should be reading first. Pulling focus down here
 * would skip past it to the button. The card is last in document order, so it
 * is the next thing in tab order after the panel it follows.
 */

import { useTranslations } from "next-intl";

import { buttonClass } from "@/lib/ui/button-styles";
import type { WorkflowStageId } from "@/lib/import/workflow-stages";

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

  return (
    <section className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-800 dark:bg-emerald-950/30">
      <p
        role="status"
        className="text-sm font-medium text-emerald-800 dark:text-emerald-200"
      >
        {t(`cleared.${stage}`)}
      </p>

      <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-300">
        {t("why")}
      </p>

      <div className="mt-4">
        <button
          type="button"
          onClick={onAdvance}
          className={buttonClass({ variant: "primary", size: "lg" })}
        >
          {t("advance", { stage: tStage(`stage.${nextStage}`) })}
        </button>
      </div>
    </section>
  );
}
