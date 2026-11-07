"use client";

/**
 * How long a choice in „Cum lucrezi cu …" stands on the note box.                                   (Slice 41.98)
 *
 * The value saved in „Setări" („Praguri de timp" → „Fișe", `workflow_choice_highlight`), read once per page load through
 * a module-level promise, as `make-room-delay.ts` reads its delay — the wizard is drawn in jest with no
 * QueryClientProvider. Until the read answers, and whenever it fails or holds nothing usable, it is the built-in 3 s. A
 * save on „Setări" calls `forgetWorkflowHighlight()`, so the next screen reads afresh. 0 turns the highlight off.
 */
import { useEffect, useState } from "react";
import { SECONDS_MAX_MS, TIME_FRAME_DEFAULTS, WORKFLOW_HIGHLIGHT_KEY } from "@/lib/time-frames/config";

/** The built-in length, migration_129's seed: 3 s. */
export const WORKFLOW_HIGHLIGHT_MS = TIME_FRAME_DEFAULTS[WORKFLOW_HIGHLIGHT_KEY].value;

let pending: Promise<number> | null = null;
let current = WORKFLOW_HIGHLIGHT_MS;

/** A saved value, if it is one the editor could have saved (0 – 10 s); anything else is the built-in 3 s. */
export function usableHighlight(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= SECONDS_MAX_MS ? value : WORKFLOW_HIGHLIGHT_MS;
}

/** Reads the saved length, once per page load (until forgotten). */
export function loadWorkflowHighlight(): Promise<number> {
  if (pending) return pending;
  pending =
    typeof fetch !== "function"
      ? Promise.resolve(WORKFLOW_HIGHLIGHT_MS)
      : fetch("/api/time-frames")
          .then((r) => (r.ok ? (r.json() as Promise<{ items?: { key: string; value: unknown }[] }>) : { items: [] }))
          .then((j) => usableHighlight(j.items?.find((i) => i.key === WORKFLOW_HIGHLIGHT_KEY)?.value))
          .catch(() => WORKFLOW_HIGHLIGHT_MS);
  pending.then((ms) => {
    current = ms;
  });
  return pending;
}

/** After „Setări" saves the thresholds: the next screen reads the length afresh. */
export function forgetWorkflowHighlight(): void {
  pending = null;
}

/** The length now, in ms — the built-in 3 s until the saved value has been read. */
export function useWorkflowHighlightMs(): number {
  const [ms, setMs] = useState(current);
  useEffect(() => {
    let live = true;
    void loadWorkflowHighlight().then((v) => {
      if (live) setMs(v);
    });
    return () => {
      live = false;
    };
  }, []);
  return ms;
}
