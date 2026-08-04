"use client";

/**
 * CoordinatePropertyDialog — Slice #23.02.Import
 *
 * Applies one imported coordinate file's corners to the run's Property.
 *
 * This is the surviving half of the orphaned wizard's "Create Property from a
 * coordinate file" offer, and it is deliberately much smaller than that offer
 * was. Slice #23.00.Import already resolves the run's Property up front — the
 * picked folder IS one Property — so there is no property to create here and no
 * sibling documents to hunt for and associate (every document created by the
 * run was linked to that Property directly, before its tags). What is left is
 * exactly one question: should THIS file's corners become the Property's
 * corners?
 *
 * There is no "merge". PATCH /api/properties/[id] is replace-all, and a corner
 * list is an ORDERED polygon — unioning two corner sets produces invalid
 * geometry, not a better outline. So the only honest operations are "replace
 * the whole set" and "leave it alone", which is what this dialog offers.
 *
 * Four outcomes, decided before the user is asked anything:
 *
 *   1. The file parses to zero corners → say so and stop. A `.csv` of phone
 *      numbers and a `.csv` of corners are indistinguishable by name; "0
 *      corners" is the only thing that tells them apart (Slice #23.00.Import).
 *   2. The Property's corners are already exactly these → "already applied",
 *      and nothing is written. PATCHing identical corners would append a
 *      property_version recording a change nobody made.
 *   3. The Property has no corners → a plain confirmation, then write.
 *   4. The Property has DIFFERENT corners → the replace/keep prompt, worded and
 *      shaped like PropertyStepDialog's, defaulting to Keep. Replacing is
 *      destructive: it discards any hand-fixed corner order (the bow-tie fix),
 *      so it is never the default.
 *
 * Slice #23.06.Import adds a FIFTH outcome, checked before any of the above:
 *
 *   0. This file has already produced a DIFFERENT Property → say so, name it,
 *      and offer nothing. `property_corner_source` records which document
 *      built which Property, and UNIQUE(document_id) means one coordinate file
 *      can only ever be the origin of one. Checking it up front spares the
 *      user a replace/keep decision that would be refused anyway.
 *
 * and the write itself is now CLAIM-THEN-WRITE: the link is taken first, and
 * the corners are only PATCHed once it is held. Writing first would let a file
 * that belongs to another Property overwrite this one's geometry before anyone
 * noticed. The claim is idempotent for a link that already points here, so a
 * failed PATCH can simply be retried (see corner-source-client.ts).
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { FSFileEntry } from "@/lib/import/folder-utils";
import { cornersEqual } from "@/lib/import/coordinate-file";
import {
  claimCornerSource,
  fetchCornerSource,
  type CornerSourceLink,
} from "@/lib/import/corner-source-client";
import { ActivityCue } from "@/components/activity-cue";
import { buttonClass } from "@/lib/ui/button-styles";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A corner as parse-text returns it and PATCH accepts it. `originalIndex` is
 * carried through untouched so the file's own point labels survive on the
 * Property (Slice #15.17); cornersEqual ignores it on purpose.
 */
type Corner = { lat: number; lon: number; originalIndex: number | null };

export type CoordinateOutcome = {
  /** Corner count the Property has once this dialog is done. */
  cornerCount: number;
  /** True only when this dialog actually wrote — i.e. appended a version. */
  changed: boolean;
};

type Props = {
  propertyId: string;
  /**
   * The Document this row created during the import. Required: without it the
   * dialog cannot claim the coordinate-source link, and an unclaimed file is
   * exactly what let the Process panel build a duplicate Property.
   */
  documentId: string;
  entry: FSFileEntry;
  onDone: (outcome: CoordinateOutcome) => void;
  onClose: () => void;
};

/**
 * Everything the dialog can be showing. The decision (2/3/4 above) is taken
 * once, while loading, so the render body never has to re-derive it.
 */
type Phase =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "no-coordinates" }
  /** This file already built a different Property; nothing is offered. */
  | { kind: "claimed-elsewhere"; link: CornerSourceLink }
  | { kind: "already-applied"; count: number }
  | { kind: "write"; corners: Corner[] }
  | { kind: "conflict"; corners: Corner[]; existing: number }
  | { kind: "saving" }
  | { kind: "done"; count: number };

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

/**
 * The expired-Supabase-session tell (CLAUDE.md): the middleware redirects the
 * request to /sign-in and fetch follows it, so the response is a cheerful 200
 * full of sign-in HTML. Without this check the dialog reports success on a
 * write that never happened.
 */
function assertNotRedirected(res: Response, sessionMsg: string): void {
  if (res.redirected) throw new Error(sessionMsg);
}

async function parseCoordinateFile(file: File): Promise<Corner[]> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch("/api/properties/parse-text", { method: "POST", body: fd });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { corners?: Corner[] };
  return body.corners ?? [];
}

async function fetchPropertyCorners(propertyId: string): Promise<Corner[]> {
  const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { corners?: Corner[] };
  return body.corners ?? [];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CoordinatePropertyDialog({
  propertyId,
  documentId,
  entry,
  onDone,
  onClose,
}: Props) {
  const t = useTranslations("adminImport.wizard.importDialog.coordinates");

  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [replace, setReplace] = useState(false);

  // ── Decide which question to ask, on mount ───────────────────────────────
  //
  // Per-invocation `mounted` boolean rather than a shared ref: React Strict
  // Mode double-invokes effects in dev, and a shared ref would be left false by
  // the first invocation's cleanup. Every setState runs in an async
  // continuation, never synchronously in the effect body
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const file = await entry.handle.getFile();
        const parsed = await parseCoordinateFile(file);
        if (!mounted) return;

        if (parsed.length === 0) {
          setPhase({ kind: "no-coordinates" });
          return;
        }

        // Slice #23.06.Import — outcome 0. Ask BEFORE offering anything: a
        // file that already built a different Property cannot build this one,
        // so putting the replace/keep prompt in front of the user first would
        // be asking a question whose answer we would then refuse.
        //
        // A link pointing at THIS property is not a blocker — it means the
        // property step already used this same file, which is the ordinary
        // "already applied" case handled below.
        const claim = await fetchCornerSource(documentId);
        if (!mounted) return;

        if (claim && claim.propertyId !== propertyId) {
          setPhase({ kind: "claimed-elsewhere", link: claim });
          return;
        }

        const existing = await fetchPropertyCorners(propertyId);
        if (!mounted) return;

        if (cornersEqual(parsed, existing)) {
          // Same points, same order — this file has already been applied,
          // most likely at the property step before the import started.
          setPhase({ kind: "already-applied", count: existing.length });
        } else if (existing.length === 0) {
          setPhase({ kind: "write", corners: parsed });
        } else {
          setPhase({ kind: "conflict", corners: parsed, existing: existing.length });
        }
      } catch (err) {
        if (!mounted) return;
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : t("errorGeneric"),
        });
      }
    })();

    return () => {
      mounted = false;
    };
    // `entry` and `propertyId` are fixed for this dialog's lifetime — it is
    // mounted per row and unmounted on close.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Write ────────────────────────────────────────────────────────────────

  const handleApply = useCallback(
    async (corners: Corner[]) => {
      setPhase({ kind: "saving" });
      try {
        // Claim first. The link is the PERMISSION to write these corners, so
        // it has to be held before the PATCH, not recorded after it.
        //
        // `already-ours` is a success: the property step may have used this
        // same file, or a previous attempt may have claimed and then failed on
        // the PATCH. Either way the file belongs to this Property and writing
        // is legitimate. Only a link to a DIFFERENT Property stops us.
        const claim = await claimCornerSource(documentId, propertyId, t("errorSession"));
        if (claim.kind === "conflict") {
          setPhase({ kind: "error", message: t("errorClaimConflict") });
          return;
        }

        const res = await fetch(`/api/properties/${encodeURIComponent(propertyId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ corners }),
        });
        assertNotRedirected(res, t("errorSession"));
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        setPhase({ kind: "done", count: corners.length });
        onDone({ cornerCount: corners.length, changed: true });
      } catch (err) {
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : t("errorGeneric"),
        });
      }
    },
    [propertyId, documentId, onDone, t],
  );

  /**
   * Keep the existing corners. Nothing is written, so no version is appended —
   * but the row still records the outcome so it stops offering the action.
   */
  const handleKeep = useCallback(
    (existing: number) => {
      onDone({ cornerCount: existing, changed: false });
      onClose();
    },
    [onDone, onClose],
  );

  const handleAcknowledge = useCallback(
    (count: number) => {
      onDone({ cornerCount: count, changed: false });
      onClose();
    },
    [onDone, onClose],
  );

  const busy = phase.kind === "loading" || phase.kind === "saving";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("title")}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
    >
      <div className="flex w-full max-w-lg flex-col rounded-xl border border-card-rim bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
        {/* Header */}
        <div className="border-b border-card-rim px-5 py-4 dark:border-zinc-700">
          <h2 className="text-base font-semibold text-ink dark:text-zinc-100">
            {t("title")}
          </h2>
          <p className="mt-0.5 truncate font-mono text-xs text-fade" title={entry.path}>
            {entry.name}
          </p>
        </div>

        {/* Body */}
        <div className="space-y-3 px-5 py-4">
          {/*
            Slice #23.09.UX — both phases are a single opaque round trip (a
            parse-and-compare, then a PATCH), so both get the blink plus an
            indeterminate bar. Neither can honestly report a percentage.
          */}
          {phase.kind === "loading" && (
            <ActivityCue progress>{t("loading")}</ActivityCue>
          )}

          {phase.kind === "saving" && (
            <ActivityCue progress>{t("saving")}</ActivityCue>
          )}

          {phase.kind === "error" && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300"
            >
              {phase.message}
            </p>
          )}

          {phase.kind === "no-coordinates" && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
              {t("noCoordinates")}
            </p>
          )}

          {phase.kind === "claimed-elsewhere" && (
            <p
              role="alert"
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {t("claimedElsewhere", { code: phase.link.propertyCode })}
            </p>
          )}

          {phase.kind === "already-applied" && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              {t("alreadyApplied", { count: phase.count })}
            </p>
          )}

          {phase.kind === "write" && (
            <p className="text-sm text-ink dark:text-zinc-200">
              {t("writeBody", { parsed: phase.corners.length })}
            </p>
          )}

          {/* The conflict prompt — same shape and wording as
              PropertyStepDialog's, so the two places that can replace a
              property's corners look and read identically. */}
          {phase.kind === "conflict" && (
            <section className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/30">
              <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {t("conflictTitle")}
              </h3>
              <p className="text-sm text-amber-900 dark:text-amber-200">
                {t("conflictBody", {
                  existing: phase.existing,
                  parsed: phase.corners.length,
                })}
              </p>
              <div className="space-y-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <input
                    type="radio"
                    name="coordinate-corner-conflict"
                    checked={!replace}
                    onChange={() => setReplace(false)}
                  />
                  {t("conflictKeep")}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-amber-900 dark:text-amber-200">
                  <input
                    type="radio"
                    name="coordinate-corner-conflict"
                    checked={replace}
                    onChange={() => setReplace(true)}
                  />
                  {t("conflictReplace")}
                </label>
              </div>
            </section>
          )}

          {phase.kind === "done" && (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              {t("doneBody", { count: phase.count })}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-card-rim px-5 py-3 dark:border-zinc-700">
          {(phase.kind === "error" ||
            phase.kind === "no-coordinates" ||
            phase.kind === "claimed-elsewhere" ||
            phase.kind === "loading" ||
            phase.kind === "saving") && (
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className={buttonClass({ variant: "secondary", size: "lg" })}
            >
              {t("closeButton")}
            </button>
          )}

          {phase.kind === "already-applied" && (
            <button
              type="button"
              onClick={() => handleAcknowledge(phase.count)}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {t("closeButton")}
            </button>
          )}

          {phase.kind === "done" && (
            <button
              type="button"
              onClick={onClose}
              className={buttonClass({ variant: "primary", size: "lg" })}
            >
              {t("closeButton")}
            </button>
          )}

          {phase.kind === "write" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "secondary", size: "lg" })}
              >
                {t("cancelButton")}
              </button>
              <button
                type="button"
                onClick={() => void handleApply(phase.corners)}
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {t("applyButton")}
              </button>
            </>
          )}

          {phase.kind === "conflict" && (
            <>
              <button
                type="button"
                onClick={onClose}
                className={buttonClass({ variant: "secondary", size: "lg" })}
              >
                {t("cancelButton")}
              </button>
              <button
                type="button"
                onClick={() =>
                  replace
                    ? void handleApply(phase.corners)
                    : handleKeep(phase.existing)
                }
                className={buttonClass({ variant: "primary", size: "lg" })}
              >
                {replace ? t("replaceButton") : t("keepButton")}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
