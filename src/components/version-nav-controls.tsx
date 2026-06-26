"use client";

// ---------------------------------------------------------------------------
// VersionNavControls — shared version navigation strip  (Slice #18.05)
// ---------------------------------------------------------------------------
//
// Renders the ◀ / version-N label / ▶ / "Make Current" controls used by the
// versioned detail forms (Natural Person, Judicial Person — and mirrors the
// Property layout from Slice #18.UX.04). Portalled by the form into the
// detail-tabs header slot so it sits on the person-name line.
//
// The label colour is green for version 0 / additions-only and red when the
// viewed version modified or deleted a field (see version-diff helpers).
// Labels are passed in already-localised so this component is namespace-
// agnostic. `pointer-events-auto` re-enables clicks because the header slot is
// pointer-events-none (so its empty width never blocks the title).

import type { HighlightColor } from "@/lib/persons/version-diff";

export type VersionNavView = {
  current:        number;
  color:          HighlightColor;
  canPrev:        boolean;
  canNext:        boolean;
  canMakeCurrent: boolean;
  onPrev:         () => void;
  onNext:         () => void;
  onMakeCurrent:  () => void;
};

export type VersionNavLabels = {
  /** Already-formatted, e.g. "version 3". */
  versionLabel:    string;
  prevVersion:     string;
  nextVersion:     string;
  makeCurrent:     string;
  makeCurrentHint: string;
};

export function VersionNavControls({
  nav,
  labels,
}: {
  nav:    VersionNavView;
  labels: VersionNavLabels;
}) {
  return (
    <div className="pointer-events-auto flex items-center">
      <button
        type="button"
        onClick={nav.onPrev}
        disabled={!nav.canPrev}
        aria-label={labels.prevVersion}
        title={labels.prevVersion}
        className="rounded-md border border-wire bg-white px-2 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        ←
      </button>
      <span
        className={[
          "ml-4 text-xs font-semibold whitespace-nowrap",
          nav.color === "red"
            ? "text-red-600 dark:text-red-400"
            : "text-green-600 dark:text-green-400",
        ].join(" ")}
      >
        {labels.versionLabel}
      </span>
      <button
        type="button"
        onClick={nav.onNext}
        disabled={!nav.canNext}
        aria-label={labels.nextVersion}
        title={labels.nextVersion}
        className="ml-4 rounded-md border border-wire bg-white px-2 py-1 text-xs font-medium text-ink shadow-sm hover:bg-canvas disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        →
      </button>
      <button
        type="button"
        onClick={nav.onMakeCurrent}
        disabled={!nav.canMakeCurrent}
        title={labels.makeCurrentHint}
        className="ml-4 rounded-md border border-cta bg-white px-3 py-1 text-xs font-medium text-cta shadow-sm hover:bg-cta-pale disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        {labels.makeCurrent}
      </button>
    </div>
  );
}
