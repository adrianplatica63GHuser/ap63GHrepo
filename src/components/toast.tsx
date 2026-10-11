"use client";

import { useRef, useState, type ReactNode } from "react";
import { CircleCheck } from "lucide-react";

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
