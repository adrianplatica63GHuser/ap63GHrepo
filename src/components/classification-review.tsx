"use client";

/**
 * „Clasificare" reviewed as one block.                                                        (Slice 41.59)
 *
 * Adrian, 2026-11-02: „I don't really want the granularity of the three items; it's too much! I need to treat all
 * three as one metadata item Therefore I need only one review button and some more communication to the user that when
 * the save button is pressed or when the review button is pressed This will apply to all three items … Let's give the
 * user the chance to go back and make sure it reviews all three".
 *
 * So: one line under the three items — „(actualizat …)" of the OLDEST of the three stamps (`oldestStamp`), and one
 * „Marchează ca verificat" at its right end; the red warning under it. Both „Marchează ca verificat" and „Salvează"
 * open `ClassificationConfirm` first: the three values, the changed ones marked, „Confirmă" / „Înapoi" (Esc).
 *
 * Apart from `entity-metadata-tab.tsx` so they render under Jest without its queries: they take their words as props.
 */

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { MarkReviewedButton } from "@/components/metadata-buttons";
import { buttonClass } from "@/lib/ui/button-styles";

export function ClassificationReviewLine({
  daysText,
  warning,
  today,
  labels,
  onReview,
  confirm,
}: {
  /** „(actualizat acum N zile)" of the oldest of the three, or null when one was never stamped. */
  daysText: string | null;
  /** Non-null past the review threshold — shown in red, never on a block reviewed today. */
  warning: string | null;
  /** All three stamped today — the button is drawn reviewed, „Verificat azi", disabled. */
  today: boolean;
  labels: { mark: string; marking: string; marked: string; today: string };
  /** Opens the confirmation; the review itself is its „Confirmă". */
  onReview: () => void;
  /** The confirmation, anchored to the button while open. */
  confirm?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5" data-classification-review="">
      <div className="relative flex items-center gap-2">
        <span className="min-w-0 flex-1 text-xs text-fade" data-classification-date="">
          {daysText}
        </span>
        <MarkReviewedButton reviewed={false} today={today} reviewing={false} labels={labels} onClick={onReview} />
        {confirm}
      </div>
      {warning && !today && (
        <p className="px-2 text-xs font-medium text-red-600 dark:text-red-400" data-classification-warning="">
          {warning}
        </p>
      )}
    </div>
  );
}

export type ConfirmItem = { key: string; label: string; value: string; changed?: boolean };

export function ClassificationConfirm({
  heading,
  note,
  items,
  changedLabel,
  labelOk,
  labelBack,
  busy = false,
  onOk,
  onBack,
  placement = "below",
}: {
  /** „Confirmați că toate trei sunt încă valabile azi:" */
  heading: string;
  /** On „Salvează": that the save also confirms the three as checked today. */
  note?: string;
  items: ConfirmItem[];
  /** The mark beside a value changed in this edit — „modificat". */
  changedLabel: string;
  labelOk: string;
  labelBack: string;
  busy?: boolean;
  onOk: () => void;
  /** „Înapoi" and Esc: nothing sent, the tile as it was — an edit stays open. */
  onBack: () => void;
  /** Under the review button, or over the edit bar. */
  placement?: "below" | "above";
}) {
  const okRef = useRef<HTMLButtonElement>(null);
  const [headingId] = useState(() => `classification-confirm-${Math.random().toString(36).slice(2)}`);
  useEffect(() => {
    okRef.current?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Escape") return;
    // Esc is „Înapoi" — it must not reach the tile, whose Esc would also close the edit.
    e.preventDefault();
    e.stopPropagation();
    onBack();
  }

  return (
    <div
      role="dialog"
      aria-labelledby={headingId}
      onKeyDown={onKeyDown}
      className={`absolute right-0 z-30 w-64 rounded-md border border-wire bg-white p-3 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${
        placement === "above" ? "bottom-full mb-1" : "top-full mt-1"
      }`}
      data-classification-confirm={placement === "above" ? "save" : "review"}
    >
      <p id={headingId} className="font-semibold text-ink dark:text-zinc-100">
        {heading}
      </p>
      <ul className="mt-1.5 flex flex-col gap-0.5">
        {items.map((it) => (
          <li key={it.key} className="flex gap-1.5" data-confirm-item={it.key} data-changed={it.changed ? "" : undefined}>
            <span className="text-fade">{it.label}:</span>
            <span className={it.changed ? "font-semibold text-ink dark:text-zinc-100" : "text-ink dark:text-zinc-100"}>
              {it.value || "—"}
            </span>
            {it.changed && <span className="text-xs italic text-fade">({changedLabel})</span>}
          </li>
        ))}
      </ul>
      {note && <p className="mt-1.5 text-xs text-fade">{note}</p>}
      <div className="mt-2 flex justify-end gap-2">
        <button type="button" className={buttonClass({ variant: "secondary", size: "sm" })} onClick={onBack}>
          {labelBack}
        </button>
        <button ref={okRef} type="button" className={buttonClass({ variant: "primary", size: "sm" })} onClick={onOk} disabled={busy}>
          {labelOk}
        </button>
      </div>
    </div>
  );
}
