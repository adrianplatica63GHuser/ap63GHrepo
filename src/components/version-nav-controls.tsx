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
// larger than the base small controls; the ◀/▶ arrow buttons are the large
// icon size — Lucide's StepBack / StepForward since #37.44, which replaced the
// thick-stroked drawing (itself the replacement for hairline ←/→ glyphs).

import type { HighlightColor } from "@/lib/versioning/field-diff";
import { ArchiveRestore, StepBack, StepForward } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";

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

// Slice #37.44 (A030, A029): the arrows are Lucide's StepBack / StepForward
// and „Fă curentă" is ArchiveRestore, all through IconButton — so they take
// the shared tooltip, and the hand-drawn arrow and history glyph this file
// used to hold are gone. The enabled / disabled rules are unchanged: the same
// `canPrev`, `canNext` and `canMakeCurrent` decide them.

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
        {/* sr-only version label — the chip's visible text is a total COUNT
            ("2 versiuni"), not the current version number, so a screen-reader
            user on latest has no way to hear which version they're viewing.
            This mirrors the "v N" text shown in the full strip (below) without
            changing anything sighted users see. Also the anchor Playwright's
            e2e suite (e2e/helpers/version-nav.ts) matches against — it needs
            to find "v N" regardless of which of these two branches rendered,
            since which one is showing depends on version count, not on
            anything the test controls. */}
        <span className="sr-only">{labels.versionLabel}</span>
        {/* The chip's words are its count („2 versiuni"), so they stay its
            name (#37.44: StepBack before them); what pressing it does —
            „Versiunea anterioară", which was its `title` — is the tooltip's
            second line and its description. */}
        <IconButton
          icon={StepBack}
          label={labels.historyChip}
          note={labels.prevVersion}
          showLabel
          variant="secondary"
          size="xs"
          pill
          onClick={nav.onPrev}
          disabled={!nav.canPrev}
        />
      </div>
    );
  }

  return (
    <div className="pointer-events-auto flex items-center">
      <IconButton
        icon={StepBack}
        label={labels.prevVersion}
        variant="bare"
        size="lg"
        onClick={nav.onPrev}
        disabled={!nav.canPrev}
      />
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
      <IconButton
        icon={StepForward}
        label={labels.nextVersion}
        variant="bare"
        size="lg"
        onClick={nav.onNext}
        disabled={!nav.canNext}
      />
      {/* „Fă curentă" (A029): ArchiveRestore; its words the name, its hint
          (the old `title`) the tooltip's second line. */}
      <IconButton
        icon={ArchiveRestore}
        label={labels.makeCurrent}
        note={labels.makeCurrentHint}
        variant="secondary"
        size="lg"
        className="ml-4"
        onClick={nav.onMakeCurrent}
        disabled={!nav.canMakeCurrent}
      />
    </div>
  );
}
