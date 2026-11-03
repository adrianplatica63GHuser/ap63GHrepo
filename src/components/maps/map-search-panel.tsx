"use client";

/**
 * „Caută pe hartă" — the big map's search box, under its magnifier.                                (Slice 41.70)
 *
 * Adrian, 2026-11-03: „When displaying the search box: there should be an information message above the search box
 * that will specify that this type of search is ideal for one item, one property, and that the user can search for
 * multiple items, multiple properties using the Global search functionality - followed by a link that opens the global
 * search functionality".
 *
 * The box only takes the text and says how it went: what the text means, and where the camera goes, is the map's
 * (`onSearch`, property-map.tsx, over `src/lib/geo/map-search.ts`). Enter or the magnifier searches; Escape closes it;
 * a find with no other matches closes it too, and a find with others keeps it open with the line that counts them,
 * „Căutare globală" its link (Ask first 4). It lives inside the toolbar's `data-map-ui`, so a click in it never
 * reaches the ruler or the angles tool (Ask first 6).
 */
import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { IconButton } from "@/lib/ui/icon-button";
import { globalSearchHref } from "@/lib/geo/map-search";

/** How a search went: found (and how many other matches), nothing found, or the look-up failed. */
export type MapSearchOutcome = { kind: "found"; more: number } | { kind: "none" } | { kind: "failed" };

export function MapSearchPanel({
  onSearch,
  onClose,
}: {
  onSearch: (text: string) => Promise<MapSearchOutcome>;
  onClose: () => void;
}) {
  const t = useTranslations("property.map.search");
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<{ text: string; result: MapSearchOutcome } | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    try {
      const result = await onSearch(q);
      if (result.kind === "found" && result.more === 0) {
        onClose();
        return;
      }
      setOutcome({ text: q, result });
    } finally {
      setBusy(false);
    }
  };

  const globalLink = (chunks: React.ReactNode) => (
    <Link href={globalSearchHref(outcome?.text ?? text)} className="font-medium text-cta underline hover:text-cta-d" data-map-search-global="">
      {chunks}
    </Link>
  );

  return (
    <div
      data-map-search=""
      className="absolute left-0 top-full mt-1 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded border border-wire bg-white p-3 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <p className="text-xs leading-snug text-ink dark:text-zinc-200" data-map-search-intro="">
        {t.rich("intro", { link: globalLink })}
      </p>
      <form onSubmit={submit} className="flex items-center gap-2" role="search">
        <label htmlFor={inputId} className="sr-only">
          {t("inputLabel")}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="search"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOutcome(null);
          }}
          placeholder={t("placeholder")}
          autoComplete="off"
          data-map-search-input=""
          className="min-w-0 flex-1 rounded-md border border-wire bg-white px-3 py-1.5 text-sm shadow-sm placeholder:text-fade focus:border-focus focus:outline-none dark:border-zinc-700 dark:bg-zinc-950"
        />
        <IconButton icon={Search} label={t("submit")} busy={busy} busyLabel={t("searching")} variant="primary" size="sm" type="submit" disabled={!text.trim()} />
      </form>
      {outcome && (
        <p role="status" className="text-xs leading-snug text-fade dark:text-zinc-400" data-map-search-result={outcome.result.kind}>
          {outcome.result.kind === "found"
            ? t.rich("more", { count: outcome.result.more, link: globalLink })
            : outcome.result.kind === "failed"
              ? t("failed")
              : t("notFound", { text: outcome.text })}
        </p>
      )}
    </div>
  );
}
