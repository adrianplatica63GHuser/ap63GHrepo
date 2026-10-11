"use client";

import { useCallback, useId, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { buttonClass } from "@/lib/ui/button-styles";
import { usePressAway } from "@/lib/ui/press-bubble";
import { screenBox, type ScreenField } from "@/lib/ui/field-widths";

/**
 * A search box over one of the archive's own searches, and the list of what it finds.   (Slice #38.86)
 *
 * The log form links a record to documents and a property that are already in the archive; it finds them with the
 * same searches the association screens use (`/api/documents/search`, `/api/properties/search`, src/app/*\/[id]/
 * associate-*) — no search of its own. Choosing a hit hands it back; nothing is created here.
 */
export interface Hit {
  id: string;
  name: string;
}

export function RecordSearch({
  endpoint,
  label,
  placeholder,
  width,
  exclude = [],
  toHit,
  onPick,
  inputId,
}: {
  endpoint: "/api/documents/search" | "/api/properties/search";
  label: string;
  placeholder: string;
  width: ScreenField;
  exclude?: readonly string[];
  toHit: (item: Record<string, unknown>) => Hit;
  onPick: (hit: Hit) => void;
  inputId?: string;
}) {
  const t = useTranslations("interactions.log");
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const listId = useId();
  const close = useCallback(() => setOpen(false), []);
  const ref = usePressAway<HTMLDivElement>(open, close);
  const term = text.trim();
  const hits = useQuery<Hit[]>({
    queryKey: ["interactions-record-search", endpoint, term],
    enabled: open && term.length > 0,
    queryFn: async () => {
      const res = await fetch(`${endpoint}?${new URLSearchParams({ q: term, limit: "8" }).toString()}`);
      if (!res.ok || res.redirected) throw new Error(`${endpoint} ${res.status}`);
      return ((await res.json()) as { items: Record<string, unknown>[] }).items.map(toHit);
    },
  });
  const shown = (hits.data ?? []).filter((h) => !exclude.includes(h.id));
  return (
    <div ref={ref} className="relative inline-flex" data-record-search={endpoint}>
      <input
        id={inputId}
        type="search"
        role="combobox"
        aria-label={label}
        aria-expanded={open && term.length > 0}
        aria-controls={listId}
        placeholder={placeholder}
        value={text}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-ink placeholder:text-fade dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        {...screenBox(width)}
      />
      {open && term.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          {...screenBox(width)}
        >
          {hits.isPending && <li className="px-3 py-1.5 text-fade dark:text-zinc-400">{t("searching")}</li>}
          {hits.data && shown.length === 0 && <li className="px-3 py-1.5 text-fade dark:text-zinc-400">{t("noHits")}</li>}
          {shown.map((h) => (
            <li key={h.id} role="option" aria-selected={false}>
              <button
                type="button"
                onClick={() => {
                  onPick(h);
                  setText("");
                  setOpen(false);
                }}
                className={buttonClass({ variant: "bare", size: "sm", className: "w-full hover:bg-slate-50 dark:hover:bg-zinc-800" })}
              >
                <span className="min-w-0 flex-1 truncate text-left">{h.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
