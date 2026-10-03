"use client";

/**
 * „Câmpuri afișate" — a list's optional columns, chosen with ticks and
 * remembered per browser.                                        (Slice #37.60)
 *
 * The Natural Persons list had this picker inline; the Judicial Persons list
 * had none. Both now draw this one piece, each with its own fields and its own
 * remembered choice, rather than a second copy of the picker.
 *
 * ⚠️ **A STORED CHOICE IS FILTERED TO THE FIELDS THIS BUILD OFFERS.** A browser
 * that remembers „importance", „relevance" or „provenance" (offered until
 * #37.60) simply loses them: they are dropped on the first read and never
 * drawn, and the count beside the button counts only what is shown.
 */
import { useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { IconButton } from "@/lib/ui/icon-button";
import type { ColumnName } from "@/lib/ui/field-widths";

export type ChooserField = { key: string; label: string; column: ColumnName };

function readStored(storageKey: string, offered: readonly string[]): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string" && offered.includes(k)) : [];
  } catch {
    return [];
  }
}

/**
 * The ticked keys, in the order they were ticked, and the toggle. Starts empty
 * on the server and on the first client render (no hydration mismatch), then
 * reads the browser's choice.
 */
export function useFieldChooser(storageKey: string, offered: readonly string[], max: number) {
  const [visible, setVisible] = useState<string[]>([]);
  const offeredKey = offered.join("|");
  // After mount, in a timer: the same shape the lists used, so setState is in a
  // callback and `react-hooks/set-state-in-effect` has nothing to say.
  useEffect(() => {
    const id = setTimeout(() => setVisible(readStored(storageKey, offeredKey.split("|"))), 0);
    return () => clearTimeout(id);
  }, [storageKey, offeredKey]);

  function toggle(key: string) {
    setVisible((prev) => {
      let next: string[];
      if (prev.includes(key)) next = prev.filter((k) => k !== key);
      else if (prev.length < max) next = [...prev, key];
      else return prev;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* private window: the choice lasts the visit */ }
      return next;
    });
  }

  return { visible, toggle };
}

/** The button („Câmpuri afișate n/max") and its list of ticks, closed by a click outside it. */
export function FieldChooser({
  label,
  hint,
  fields,
  visible,
  max,
  onToggle,
}: {
  label: string;
  hint: string;
  fields: readonly ChooserField[];
  visible: readonly string[];
  max: number;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  if (fields.length === 0) return null;
  return (
    <div ref={ref} className="relative" data-field-chooser>
      {/* #37.42 (A013): Columns3. Its name and tooltip keep the count — „Câmpuri afișate 2/4". */}
      <IconButton
        icon={Columns3}
        label={`${label} ${visible.length}/${max}`}
        variant="secondary"
        size="md"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
      />
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-56 rounded-md border border-wire bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <p className="mb-2 text-xs text-fade dark:text-zinc-500">{hint}</p>
          {fields.map((f) => {
            const checked = visible.includes(f.key);
            const disabled = !checked && visible.length >= max;
            return (
              <label key={f.key} className="flex cursor-pointer items-center gap-2 py-0.5">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(f.key)}
                  className="h-4 w-4 rounded border-wire accent-cta disabled:opacity-40"
                />
                <span className="text-sm text-ink dark:text-zinc-100">{f.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
