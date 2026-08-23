"use client";

/**
 * ImportCheckResult — what a check looked at, on the screen that looked.
 *                                                            (Slice #29.11)
 *
 * WHAT IT IS
 * ----------
 * A stage that finds nothing wrong has, until now, said so in one emerald line
 * of four words — and on the common path (step-through unticked) not even that,
 * because the panel is replaced in the same commit that moves the phase on. All
 * the user was left with was a clause at the top of the NEXT stage's intro.
 * This card is the account: which rules ran, what the walk found, and — at
 * Structure — how the property folder's name was read.
 *
 * ⚠️ **TWO MOUNT POINTS, AND THEY ARE MUTUALLY EXCLUSIVE BY CONSTRUCTION.**
 *
 *  - INLINE, inside the stage's own panel, under its emerald all-clear. That is
 *    the case where the user is standing on the stage — a step-through pause, or
 *    a Structure verdict turned clean by answering STR-15 — and the panel's own
 *    `<h2>` and `clean` line have already said which stage this is and that it
 *    passed. Rendered with no `attribution`, so it adds only the detail.
 *  - ATTRIBUTED, under the panel of a LATER stage, for a check the user flew
 *    past. There the card has to name the stage itself, because the heading
 *    above it belongs to a different one. `attribution` carries both halves.
 *    Under rather than over: the panel focuses its own heading when it mounts
 *    and `focus()` scrolls, so a card drawn above it was pushed off the top of
 *    the screen by the very commit that created it — and reading forward from
 *    that heading never reached it. `import-wizard.tsx` records the round that
 *    found this.
 *
 * `import-wizard.tsx` decides which, from whether that stage's panel is mounted.
 * A card can therefore never appear twice on one screen, and the decision lives
 * in one place rather than in each panel.
 *
 * ⚠️ **IT IS NEVER RENDERED OVER A CHECK THAT IS RUNNING.** Both call sites are
 * behind `!busy`: the wizard hides the whole trail while any check is in
 * flight, and each panel's own `!busy && verdict.clean` guard — the one three
 * adversarial rounds put there — contains the inline case. A re-check can turn
 * a clean verdict dirty, and a card describing the previous round's folder is
 * exactly the confident-but-stale output those guards exist for.
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
  /**
   * Set only when the card is drawn away from its own stage's panel.
   *
   * `title` names the stage the result belongs to and `headline` is that
   * stage's own all-clear sentence — `adminImport.<stage>.clean`, the string it
   * has owned since #26.04, rather than a second set written for this card.
   */
  attribution?: { title: string; headline: string };
  facts: readonly CheckFact[];
  /** The folder-name readings at Structure; nothing at the other two stages. */
  children?: ReactNode;
};

export function ImportCheckResult({ attribution, facts, children }: Props) {
  return (
    <section
      className={[
        "rounded-xl border border-emerald-300 bg-emerald-50/60 p-4",
        "dark:border-emerald-800 dark:bg-emerald-950/20",
        // Inline it sits under the panel's own all-clear, which already has a
        // top margin of its own; attributed it is a card in its own right.
        attribution === undefined ? "mt-3" : "",
      ].join(" ")}
    >
      {attribution !== undefined && (
        <>
          {/* ⚠️ `<h2>`, not `<h3>`, and an adversarial round corrected it. The
              attributed card is a SIBLING of the stage panels, each of which is
              an `<h2>`-headed `<section>`; the wizard contributes no heading of
              its own, so an `<h3>` here made the document read h1 → h3 → h2 —
              a skip and a reversal, three times over when three cards stack. */}
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {attribution.title}
          </h2>
          <p className="mt-1 text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {attribution.headline}
          </p>
        </>
      )}

      <dl className={attribution === undefined ? "" : "mt-3"}>
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
      {/* ⚠️ `<h3>` at BOTH mount points, which is what makes one level right
          for both. Attributed, it sits under this card's own `<h2>`; inline, it
          sits under the stage panel's `<h2>`, alongside that panel's other
          `<h3>`s (the rules listing, the fix list). An `<h4>` — the first
          draft — skipped a level inline and then came out ABOVE the panel's
          own `<h3>` in document order. */}
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
