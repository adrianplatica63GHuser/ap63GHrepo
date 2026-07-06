"use client";

// ---------------------------------------------------------------------------
// VersionNavControls — shared version navigation strip  (Slice #18.05 / #18.06)
// ---------------------------------------------------------------------------
//
// Renders the ◀ / version-N label / ▶ / "Make Current" controls used by every
// versioned detail form (Property, Natural Person, Judicial Person, Document).
// Portalled by the form into the detail-tabs header slot so it sits on the
// entity-name line.
//
// The label colour is green for version 0 / additions-only and red when the
// viewed version modified or deleted a field (see field-diff helpers). Labels
// are passed in already-localised so this component is namespace-agnostic.
// `pointer-events-auto` re-enables clicks because the header slot is
// pointer-events-none (so its empty width never blocks the title).
//
// Sizing (Adrian's spec): the version label and "Make Current" button are 25%
// larger than the base small controls; the ◀/▶ arrow buttons are 50% larger,
// and the arrows themselves are drawn as thick-stroked SVGs (far heavier and
// more visible than the hairline ←/→ unicode glyphs they replaced).

import type { HighlightColor } from "@/lib/versioning/field-diff";

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
  /**
   * Discovery chip label shown on the latest version when history exists,
   * e.g. "4 versiuni". Clicking it navigates one step back. If omitted the
   * chip falls back to the full strip (old behaviour).
   */
  historyChip?:    string;
};

// Thick-stroked directional arrow (shaft + head). 28px — bare, no button
// chrome around it; strokeWidth 3 keeps it bold and clearly visible.
// Colour follows the button text via `currentColor`.
function NavArrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {dir === "left" ? (
        <path d="M20 12 H5 M11 6 L5 12 L11 18" />
      ) : (
        <path d="M4 12 H19 M13 6 L19 12 L13 18" />
      )}
    </svg>
  );
}

// ◀/▶ arrow button — bare (no border / background / shadow); just the SVG
// arrow with hover opacity and disabled state.
const ARROW_BTN_CLASS =
  "inline-flex items-center justify-center p-0 text-ink hover:opacity-70 disabled:opacity-30 disabled:cursor-not-allowed";

// Small counterclockwise-rotate icon for the history discovery chip.
function HistoryIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {/* counterclockwise arc arrow */}
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

export function VersionNavControls({
  nav,
  labels,
}: {
  nav:    VersionNavView;
  labels: VersionNavLabels;
}) {
  // Discovery chip: shown on the latest version when there is at least one
  // prior version (nav.current >= 1) and a chip label was supplied. Clicking
  // steps back to the previous version so the user sees the diff highlights.
  const isOnLatest = !nav.canNext;
  if (isOnLatest && nav.current >= 1 && labels.historyChip) {
    return (
      <div className="pointer-events-auto flex items-center">
        <button
          type="button"
          onClick={nav.onPrev}
          disabled={!nav.canPrev}
          title={labels.prevVersion}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-2.5 py-0.5 text-xs font-medium text-zinc-500 shadow-sm transition-colors hover:border-zinc-400 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-200"
        >
          <HistoryIcon />
          {labels.historyChip}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex items-center">
      <button
        type="button"
        onClick={nav.onPrev}
        disabled={!nav.canPrev}
        aria-label={labels.prevVersion}
        title={labels.prevVersion}
        className={ARROW_BTN_CLASS}
      >
        <NavArrow dir="left" />
      </button>
      {/* Version label — tightly flanked by the bare arrows. */}
      <span
        className={[
          "mx-1 text-[0.9375rem] font-semibold whitespace-nowrap",
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
        className={ARROW_BTN_CLASS}
      >
        <NavArrow dir="right" />
      </button>
      {/* "Make Current" — 25% larger than the base small button (text + padding). */}
      <button
        type="button"
        onClick={nav.onMakeCurrent}
        disabled={!nav.canMakeCurrent}
        title={labels.makeCurrentHint}
        className="ml-4 rounded-md border border-cta bg-white px-[0.9375rem] py-[0.3125rem] text-[0.9375rem] font-medium text-cta shadow-sm hover:bg-cta-pale disabled:opacity-30 disabled:cursor-not-allowed dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800"
      >
        {labels.makeCurrent}
      </button>
    </div>
  );
}
