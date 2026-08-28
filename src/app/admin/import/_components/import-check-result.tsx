"use client";

/**
 * ImportCheckResult — what a check looked at, on the screen that looked.
 *                                                            (Slice #29.11)
 *
 * WHAT IT IS
 * ----------
 * A stage that finds nothing wrong said so, until #29.11, in one emerald line
 * of four words — and on the path the run took by itself, not even that,
 * because the panel is replaced in the same commit that moves the phase on. All
 * the user was left with was a clause at the top of the NEXT stage's intro.
 * This card is the account: which rules ran, what the walk found, and — at
 * Structure — how the property folder's name was read.
 *
 * ⚠️ **AND IT NO LONGER COVERS THE PATH IT WAS WRITTEN FOR, WHICH IS #32.03'S
 * DECISION AND NOT AN OVERSIGHT.** #29.11 reached the self-advancing user
 * through the ATTRIBUTED trail; #32.03 made step-through the DEFAULT — so a
 * clean check now rests on its own stage and is read here — and removed the
 * trail, which had become three green memos stacked above the screen the user
 * was actually there to read. A user who unticks the control therefore gets no
 * account at Constraints or Duplication, exactly as before #29.11 — those two
 * checks self-advance and their panels are replaced in the commit that moves
 * the phase on. Do not read the paragraph above as a promise this component
 * still keeps for them: `import-wizard.tsx`'s memo note states the decision in
 * full, and a slice that wants to serve that user should put the account where
 * they are standing rather than restore a trail.
 *
 * ⚠️ **STRUCTURE IS THE EXCEPTION, AND IT HAS NOTHING TO DO WITH THE TOGGLE.**
 * A walk that finds only STR-15 violations rests on `structure-report`, and
 * answering the last one turns `structureVerdict` clean with no re-walk and no
 * phase change — see `import-structure-stage.tsx`'s `cleanVerdict` block, which
 * records that #28.02 made that state reachable on purpose. `gated` is false
 * there, so `resultOnly` is false and the panel keeps its work blocks; this
 * card renders under the all-clear all the same. That route is why
 * `checkAccountsSettled` is a BELT on the panel's own guard rather than a
 * duplicate of it: it is also the route on which a re-check can fail without
 * clearing `entries`, and the panel cannot see that. Do not delete the belt on
 * the argument that only a gated rest can mount this card.
 *
 * ⚠️ **ONE MOUNT POINT, INSIDE THE PANEL OF THE CHECK THAT JUST RAN.** The card
 * sits under that panel's emerald all-clear, whose `<h2>` and `clean` line have
 * already said which stage this is and that it passed — so the card carries no
 * heading of its own and adds only the detail.
 *
 * ⚠️ **IT HAD A SECOND, ATTRIBUTED MODE UNTIL #32.03, AND THAT MODE IS NOT
 * COMING BACK BY ACCIDENT.** An `attribution` prop drew this card under a LATER
 * stage's panel, naming the stage it belonged to, for a check the user had flown
 * past — the retrospective trail. #32.03 made step-through the default, so every
 * clean check now rests on its own stage and gives its account here; the trail
 * became three green "everything was fine" memos stacked above the screen that
 * was actually asking for something, and it went. The prop went with it rather
 * than being kept "in case", because a component with one live mode and one
 * dormant one is a component the next reader has to work out.
 *
 * ⚠️ **IT IS NEVER RENDERED OVER A CHECK THAT IS RUNNING.** All three call
 * sites — one per file check, and `import-check-result-copy.test.ts` pins the
 * count — are behind `!busy` twice over: `checkAccountsSettled` in the wizard, which also
 * sees a walk that FAILED, and the panel's own `!busy && verdict.clean` guard —
 * the one three adversarial rounds put there. A re-check can turn a clean
 * verdict dirty, and a card describing the previous round's folder is exactly
 * the confident-but-stale output those guards exist for.
 *
 * ⚠️ **NO `role="status"`.** The stage panels and the step-gate card already own
 * permanently-mounted live regions for their own sentences, and this card
 * carries no conclusion of its own — it is the evidence under a sentence that
 * has already been announced. A second live region inserted together with its
 * text is both unreliable and a repeat; see `import-step-gate.tsx`.
 */

import type { ReactNode } from "react";

import type { PropertyNameReading } from "@/lib/import/check-summary";

export type CheckFact = {
  /** Already translated. */
  label: string;
  /** Already formatted — this component does no number or plural work. */
  value: string;
};

type Props = {
  facts: readonly CheckFact[];
  /** The folder-name readings at Structure; nothing at the other two stages. */
  children?: ReactNode;
};

export function ImportCheckResult({ facts, children }: Props) {
  return (
    <section
      className={[
        "mt-3 rounded-xl border border-emerald-300 bg-emerald-50/60 p-4",
        "dark:border-emerald-800 dark:bg-emerald-950/20",
      ].join(" ")}
    >
      <dl>
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex items-baseline justify-between gap-4 border-b border-emerald-200/70 py-1.5 last:border-0 dark:border-emerald-900/60"
          >
            <dt className="text-sm text-emerald-900/80 dark:text-emerald-200/80">
              {fact.label}
            </dt>
            <dd className="text-right font-mono text-sm text-emerald-900 dark:text-emerald-100">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      {children}
    </section>
  );
}

/**
 * How each property folder's name was read.   (Slice #29.11)
 *
 * ⚠️ **THE ONE THING ON THIS CARD THAT IS NOT A COUNT, and the reason the card
 * exists at all.** `parsePropertyFolderName` splits positionally on the first
 * two hyphens and never interprets what follows the second — so
 * `47per2-225per3per24-2000 Hascu` becomes tarla 47/2, parcela 225/3/24, and
 * "2000 Hascu" is discarded, where the user who typed it meant an area and a
 * locality. Until this slice the first place that reading appeared was the
 * property dialog, five stages and one paid classification later. It is shown
 * here, at the stage whose walk performed it, while renaming the folder in File
 * Explorer is still free.
 *
 * ⚠️ **THE ARROW IS DRAWN ONLY WHEN `per` ACTUALLY MOVED.** `perToSlash` changes
 * a string only where `per` sits between two digits, so most names come through
 * untouched — and `225D → 225D` printed on every row would teach the eye to skip
 * the one row where the transformation is real.
 *
 * Nothing here is a control: renaming happens in File Explorer, and the
 * "Verifică din nou" the stage already owns is what reads the new name.
 */
export function PropertyNameReadings({
  readings,
  strings,
}: {
  readings: readonly PropertyNameReading[];
  /** Every sentence pre-translated — this component composes, it does not name keys. */
  strings: {
    title: string;
    /** How the split works, said once above the list. */
    rule: string;
    tarla: string;
    parcela: string;
    description: string;
    /** Shown in place of the description when the name carries none. */
    noDescription: string;
    /** Appended when more folders exist than are listed. */
    more: string | null;
  };
}) {
  if (readings.length === 0) return null;

  return (
    <div className="mt-4">
      {/* ⚠️ `<h3>`, not `<h4>`. This card carries no heading of its own, so
          these readings sit directly under the stage panel's `<h2>`, alongside
          that panel's other `<h3>`s (the rules listing, the fix list). An
          `<h4>` — the first draft — skipped a level and then came out ABOVE the
          panel's own `<h3>` in document order. (It was `<h3>` at the attributed
          mount point too, under that card's own `<h2>`; #32.03 removed that
          mount point and the level is unchanged.) */}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
        {strings.title}
      </h3>
      <p className="mt-1 text-xs text-emerald-900/80 dark:text-emerald-200/80">
        {strings.rule}
      </p>
      <ul className="mt-2 space-y-2">
        {readings.map((reading) => (
          <li
            key={reading.folderName}
            className="rounded-md border border-emerald-200 bg-white px-3 py-2 dark:border-emerald-900 dark:bg-zinc-900"
          >
            <p className="font-mono text-xs text-ink dark:text-zinc-200">
              📁 {reading.folderName}
            </p>
            <dl className="mt-1.5 space-y-0.5">
              <ReadingRow
                label={strings.tarla}
                written={reading.tarlaWritten}
                stored={reading.tarlaStored}
              />
              <ReadingRow
                label={strings.parcela}
                written={reading.parcelaWritten}
                stored={reading.parcelaStored}
              />
              <div className="flex flex-wrap items-baseline gap-x-2">
                <dt className="text-xs text-fade dark:text-zinc-400">
                  {strings.description}
                </dt>
                <dd className="min-w-0 text-xs text-ink dark:text-zinc-200">
                  {reading.description === null ? (
                    <span className="text-fade dark:text-zinc-400">
                      {strings.noDescription}
                    </span>
                  ) : (
                    <span className="font-mono">{reading.description}</span>
                  )}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      {strings.more !== null && (
        <p className="mt-2 text-xs text-fade dark:text-zinc-400">{strings.more}</p>
      )}
    </div>
  );
}

/** One identifier, and the value the database will hold when the two differ. */
function ReadingRow({
  label,
  written,
  stored,
}: {
  label: string;
  written: string;
  stored: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <dt className="text-xs text-fade dark:text-zinc-400">{label}</dt>
      <dd className="min-w-0 font-mono text-xs text-ink dark:text-zinc-200">
        {written}
        {stored !== written && (
          <>
            {" → "}
            <span className="font-semibold">{stored}</span>
          </>
        )}
      </dd>
    </div>
  );
}
