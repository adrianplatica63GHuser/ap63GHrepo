"use client";

/**
 * „Cum lucrezi cu grupurile" — and, since 41.99, „Cum lucrezi cu ștampilele" — as a small wizard.     (Slice 41.84)
 *
 * It asks „Ce vrei să faci?" with the kind's choices under their headings, each with why one would do it; nothing is
 * chosen at first, so the tile shows the question and the choices only (Ask first 3). A choice shows only its steps, and
 * the members' (a stamp's „apply") choice a note that a record's „Etichete și grupuri" does it too. The choice is
 * remembered per browser, each kind's apart. All its text is #C00000 (Ask first 4, 41.83's token).
 *
 * Slice 41.99 — Adrian: „Turning the tile how you work with stamps into a radio button type of wizard". One component
 * for both kinds, driven by `WORKFLOW_WIZARDS` (group-workflows.ts), so the two cannot drift; 41.44's step list
 * (`WorkflowsList`) went with it.
 *
 * Slice 41.98 — Adrian: „When a radio button is clicked … the entire item must show that it was selected by having a beige
 * box as a background for a few seconds which can be set in the settings; for the same duration and starting at the same
 * moment The instructions that show up under the divider will be displayed in a similar beige box". Pressing a choice puts
 * its whole item and the steps under the line each on the note box (`HIGHLIGHT_ON`, the warning wash and rim — the note
 * Grupuri draws when opened from the map), from the same moment, for `workflow_choice_highlight` (Setări, 3 s by default,
 * 0 off), then it fades back. Another choice starts it again; a stored choice read on load does not flash. The padding and
 * the 1-px border are always there, transparent at rest, so nothing moves when it lights.
 */
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useWorkflowHighlightMs } from "@/components/screen/workflow-highlight";
import { TileTitle } from "@/components/tiles/tile-title";
import { screenPanel } from "@/lib/ui/field-widths";
import { WORKFLOW_WIZARDS, readWizardChoice, type WorkflowWizard } from "@/lib/ui/group-workflows";

/** The note box, lit — the warning wash and its rim (globals.css), as the „opened from the map" note. */
export const HIGHLIGHT_ON = "border-warning-rim bg-warning-wash";
const HIGHLIGHT_OFF = "border-transparent bg-transparent";
const HIGHLIGHT_BOX = "rounded-md border transition-colors duration-500";

// ── The choice made, per browser, per kind ───────────────────────────────────
const listeners = new Set<() => void>();
/** A private window, where storage throws: the choice holds for this visit. */
const memory = new Map<string, string>();
function subscribeChoice(l: () => void): () => void {
  listeners.add(l);
  window.addEventListener("storage", l);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", l);
  };
}
function readChoice(w: WorkflowWizard): string | null {
  try {
    return readWizardChoice(w, localStorage.getItem(w.storageKey));
  } catch {
    return memory.get(w.storageKey) ?? null;
  }
}
const noChoice = (): string | null => null;
function writeChoice(w: WorkflowWizard, c: string): void {
  memory.set(w.storageKey, c);
  try {
    localStorage.setItem(w.storageKey, c);
  } catch {
    // As above.
  }
  for (const l of listeners) l();
}

export function WorkflowsWizard({ kind, units, hidden = false }: { kind: "group" | "stamp"; units: number; hidden?: boolean }) {
  const w = WORKFLOW_WIZARDS[kind];
  // The namespace is one of two literals; next-intl's key types cannot follow a union, so the keys are read as strings.
  const tr = useTranslations(w.namespace) as unknown as (key: string) => string;
  const titleId = useId();
  const name = useId();
  // The browser's stored choice, read as an external store: none on the server and on the first render, so the two
  // agree; the browser's afterwards (Ask first 3).
  const choice = useSyncExternalStore(subscribeChoice, () => readChoice(w), noChoice);
  // 41.98: the choice just pressed, lit until the setting's time has passed; `n` so a press of the same choice restarts it.
  const highlightMs = useWorkflowHighlightMs();
  const [lit, setLit] = useState<{ choice: string; n: number } | null>(null);
  useEffect(() => {
    if (!lit) return;
    const id = window.setTimeout(() => setLit(null), highlightMs);
    return () => window.clearTimeout(id);
  }, [lit, highlightMs]);
  const choose = (c: string) => {
    writeChoice(w, c);
    if (highlightMs > 0) setLit((was) => ({ choice: c, n: (was?.n ?? 0) + 1 }));
  };
  const isLit = (c: string) => lit?.choice === c && choice === c;
  const stepText = (s: string, part: "title" | "body") => (w.of4144.includes(s) ? tr(`steps.${s}.${part}`) : tr(`wizard.steps.${s}.${part}`));
  const note = choice ? w.note[choice] : undefined;

  return (
    <section
      {...screenPanel(`${kind}-workflows`, units)}
      data-tile="workflows"
      data-group-wizard={kind === "group" ? (choice ?? "") : undefined}
      data-workflow-wizard={kind}
      data-wizard-choice-made={choice ?? ""}
      hidden={hidden}
      aria-labelledby={titleId}
      className="rounded-lg border border-card-rim bg-card px-5 py-4 text-sm text-admin-title"
    >
      <TileTitle id={titleId} title={tr("title")} className="mb-3" admin />
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 font-semibold">{tr("wizard.question")}</legend>
        {w.headings.map((h) => (
          <div key={h.heading} className="flex flex-col gap-1.5" data-wizard-heading={h.heading}>
            <p className="text-xs font-semibold uppercase tracking-[0.04em]">{tr(`wizard.headings.${h.heading}`)}</p>
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
                  <span className="font-medium">{tr(`wizard.choices.${c}.label`)}</span>
                  <span className="text-xs">{tr(`wizard.choices.${c}.why`)}</span>
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
            {(w.steps[choice] ?? []).map((s) => (
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
            {tr("wizard.noteTitle")}: {tr(`steps.${note}.title`)}
          </p>
          <p>{tr(`steps.${note}.body`)}</p>
        </div>
      )}
    </section>
  );
}

/** The groups' wizard (41.84) — `WorkflowsWizard` for groups. */
export function GroupWorkflowsWizard({ units, hidden = false }: { units: number; hidden?: boolean }) {
  return <WorkflowsWizard kind="group" units={units} hidden={hidden} />;
}
