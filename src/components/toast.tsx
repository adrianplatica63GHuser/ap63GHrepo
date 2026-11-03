"use client";

import { useRef, useState, type ReactNode } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

/** How long a toast stays, in ms. */
export const TOAST_MS = 4000;

/**
 * A toast: one short sentence that confirms something has happened, then leaves.   (Slice #38.85)
 *
 * The app had none; „Interacțiuni" needs one (spec §4: „a toast confirms ‚Interaction logged'"). It is built once,
 * here, for whatever screen needs one next. The live region is always in the page and only its words change, so a
 * screen reader announces each one; the words leave after `TOAST_MS`. `show` from an event handler, never from an
 * effect.
 */
export function useToast(): { toast: ReactNode; show: (text: string) => void } {
  const [shown, setShown] = useState<{ text: string; n: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (text: string) => {
    if (timer.current) clearTimeout(timer.current);
    setShown((prev) => ({ text, n: (prev?.n ?? 0) + 1 }));
    timer.current = setTimeout(() => setShown(null), TOAST_MS);
  };
  const toast = (
    <div role="status" aria-live="polite" data-toast="" className="pointer-events-none fixed bottom-4 right-4 z-50">
      {shown && (
        <div
          key={shown.n}
          className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-ink shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <CircleCheck aria-hidden="true" size={18} className="text-green-700 dark:text-[#52a16f]" />
          {shown.text}
        </div>
      )}
    </div>
  );
  return { toast, show };
}

/**
 * A notice: the toast's warning sibling — amber, a TriangleAlert, and it STAYS until closed.           (Slice 41.51)
 *
 * Adrian, 2026-11-02: saving a change in „Cetățenie" or „Țara adresei" must say, at that moment, that the sister list
 * may need the same change. A sentence that asks the user to go and do something cannot leave after four seconds, so
 * it stays, with a close button (`closeLabel`), until it is closed or a newer one replaces it. Same corner, same live
 * region (`role="status"`), the toast's look in the warning tokens. `show` from an event handler, never from an effect.
 */
export function useNotice(closeLabel: string): { notice: ReactNode; show: (text: string) => void } {
  const [shown, setShown] = useState<{ text: string; n: number } | null>(null);
  const show = (text: string) => setShown((prev) => ({ text, n: (prev?.n ?? 0) + 1 }));
  const notice = (
    <div role="status" aria-live="polite" data-notice="" className="fixed bottom-4 right-4 z-50">
      {shown && (
        <div
          key={shown.n}
          className="flex max-w-[28rem] items-start gap-2 rounded-lg border border-warning-rim bg-warning-wash px-4 py-3 text-sm font-medium text-warning shadow-lg"
          data-notice-text=""
        >
          <TriangleAlert aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">{shown.text}</span>
          <button
            type="button"
            onClick={() => setShown(null)}
            aria-label={closeLabel}
            title={closeLabel}
            className="-mr-1 shrink-0 rounded p-0.5 hover:bg-warning-rim/40 focus-visible:outline-2 focus-visible:outline-focus"
            data-notice-close=""
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      )}
    </div>
  );
  return { notice, show };
}
