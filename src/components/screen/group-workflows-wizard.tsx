"use client";

/**
 * „Cum lucrezi cu grupurile" as a small wizard.                                                       (Slice 41.84)
 *
 * It asks „Ce vrei să faci?" with the choices of `GROUP_WIZARD` under their headings, each with why one would do it;
 * nothing is chosen at first, so the tile shows the question and the choices only (Ask first 3). A choice shows only
 * its steps (`GROUP_WIZARD_STEPS`), and the members' choice a note that a member can also be added from a record's
 * „Etichete și grupuri". The choice is remembered per browser. All its text is #C00000 (Ask first 4, 41.83's token).
 * The same tile stands on „Grupuri" and on a group's screen; „Ștampile" keeps 41.44's list (workflows-tile.tsx).
 *
 * Slice 41.98 — Adrian: „When a radio button is clicked … the entire item must show that it was selected by having a beige
 * box as a background for a few seconds which can be set in the settings; for the same duration and starting at the same
 * moment The instructions that show up under the divider will be displayed in a similar beige box". Pressing a choice puts
 * its whole item and the steps under the line each on the note box (`HIGHLIGHT_ON`, the warning wash and rim — the note
 * this page draws when opened from the map), from the same moment, for `workflow_choice_highlight` (Setări, 3 s by
 * default, 0 off), then it fades back. Another choice starts it again; a stored choice read on load does not flash. The
 * padding and the 1-px border are always there, transparent at rest, so nothing moves when it lights.
 */
/** The note box, lit — the warning wash and its rim (globals.css), as the „opened from the map" note. */
export const HIGHLIGHT_ON = "border-warning-rim bg-warning-wash";
const HIGHLIGHT_OFF = "border-transparent bg-transparent";
const HIGHLIGHT_BOX = "rounded-md border transition-colors duration-500";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useWorkflowHighlightMs } from "@/components/screen/workflow-highlight";
import { useTranslations } from "next-intl";
import { TileTitle } from "@/components/tiles/tile-title";
import { screenPanel } from "@/lib/ui/field-widths";
import {
  GROUP_STEPS_OF_41_44,
  GROUP_WIZARD,
  GROUP_WIZARD_KEY,
  GROUP_WIZARD_NOTE,
  GROUP_WIZARD_STEPS,
  readGroupWizardChoice,
  type GroupWizardChoice,
  type GroupWizardStep,
} from "@/lib/ui/group-workflows";

// ── The choice made, per browser ─────────────────────────────────────────────
const listeners = new Set<() => void>();
/** A private window, where storage throws: the choice holds for this visit. */
let memory: GroupWizardChoice | null = null;
function subscribeChoice(l: () => void): () => void {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}
function readChoice(): GroupWizardChoice | null {
  try {
    return readGroupWizardChoice(localStorage.getItem(GROUP_WIZARD_KEY));
  } catch {
    return memory;
  }
}
const noChoice = (): GroupWizardChoice | null => null;
function writeChoice(c: GroupWizardChoice): void {
  memory = c;
  try {
    localStorage.setItem(GROUP_WIZARD_KEY, c);
  } catch {
    // As above.
  }
  for (const l of listeners) l();
}

export function GroupWorkflowsWizard({ units, hidden = false }: { units: number; hidden?: boolean }) {
  const t = useTranslations("group.workflows");
  const titleId = useId();
  const name = useId();
  // The browser's stored choice, read as an external store: none on the server and on the first render, so the two
  // agree; the browser's afterwards (Ask first 3).
  const choice = useSyncExternalStore(subscribeChoice, readChoice, noChoice);
  // 41.98: the choice just pressed, lit until the setting's time has passed; `n` so a press of the same choice restarts it.
  const highlightMs = useWorkflowHighlightMs();
  const [lit, setLit] = useState<{ choice: GroupWizardChoice; n: number } | null>(null);
  useEffect(() => {
    if (!lit) return;
    const id = window.setTimeout(() => setLit(null), highlightMs);
    return () => window.clearTimeout(id);
  }, [lit, highlightMs]);
  const choose = (c: GroupWizardChoice) => {
    writeChoice(c);
    if (highlightMs > 0) setLit((was) => ({ choice: c, n: (was?.n ?? 0) + 1 }));
  };
  const isLit = (c: GroupWizardChoice) => lit?.choice === c && choice === c;
  const stepText = (s: GroupWizardStep, part: "title" | "body") =>
    GROUP_STEPS_OF_41_44.includes(s) ? t(`steps.${s}.${part}`) : t(`wizard.steps.${s}.${part}`);
  const note = choice ? GROUP_WIZARD_NOTE[choice] : undefined;

  return (
    <section
      {...screenPanel("group-workflows", units)}
      data-tile="workflows"
      data-group-wizard={choice ?? ""}
      hidden={hidden}
      aria-labelledby={titleId}
      className="rounded-lg border border-card-rim bg-card px-5 py-4 text-sm text-admin-title"
    >
      <TileTitle id={titleId} title={t("title")} className="mb-3" admin />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">{t("wizard.question")}</legend>
        {GROUP_WIZARD.map((h) => (
          <div key={h.heading} className="flex flex-col gap-1.5" data-wizard-heading={h.heading}>
            <p className="text-xs font-semibold uppercase tracking-[0.04em]">{t(`wizard.headings.${h.heading}`)}</p>
            {h.choices.map((c) => (
              <label
                key={c}
                className={`-mx-2 flex cursor-pointer items-start gap-2 px-2 py-1 ${HIGHLIGHT_BOX} ${isLit(c) ? HIGHLIGHT_ON : HIGHLIGHT_OFF}`}
                data-wizard-choice={c}
                data-wizard-lit={isLit(c) ? "" : undefined}
              >
                <input
                  type="radio"
                  name={name}
                  value={c}
                  checked={choice === c}
                  onChange={() => choose(c)}
                  className="mt-0.5 shrink-0 accent-current"
                />
                <span className="flex flex-col">
                  <span className="font-medium">{t(`wizard.choices.${c}.label`)}</span>
                  <span className="text-xs">{t(`wizard.choices.${c}.why`)}</span>
                </span>
              </label>
            ))}
          </div>
        ))}
      </fieldset>
      {choice && (
        <div className="mt-4 border-t border-card-rim pt-3">
          <ol
            className={`flex flex-col gap-2.5 px-4 py-2 ${HIGHLIGHT_BOX} ${isLit(choice) ? HIGHLIGHT_ON : HIGHLIGHT_OFF}`}
            data-wizard-steps={choice}
            data-wizard-lit={isLit(choice) ? "" : undefined}
          >
            {GROUP_WIZARD_STEPS[choice].map((s) => (
              <li key={s} data-workflow-step={s}>
                <p className="font-semibold">{stepText(s, "title")}</p>
                <p>{stepText(s, "body")}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {note && (
        <div className="mt-3 rounded-md border border-card-rim bg-raised px-3 py-2" data-workflow-note={note}>
          <p className="font-semibold">
            {t("wizard.noteTitle")}: {t(`steps.${note}.title`)}
          </p>
          <p>{t(`steps.${note}.body`)}</p>
        </div>
      )}
    </section>
  );
}
