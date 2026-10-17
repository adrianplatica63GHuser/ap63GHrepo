"use client";

/**
 * „Despre limitele tarlalelor" — the six facts, shown prominently on the tarla list and on every tarla page.
 *                                                                                        (Slice #39.67)
 *
 * Adrian, on each of them in the research doc: „this is very important info; it should show prominently on the new
 * Tarla GUI". They say where tarla boundaries could come from and what is not available, so nobody spends an
 * afternoon looking for an outline that no public source holds. The words are messages (`tarla.info.*`), in both
 * languages; the order is the doc's.
 */
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

export const TARLA_INFO_FACTS = ["f1", "f2", "f3", "f4", "f5", "f6"] as const;

export function TarlaBoundariesInfo() {
  const t = useTranslations("tarla.info");
  return (
    <section
      aria-labelledby="tarla-boundaries-info-title"
      className="rounded-xl border-2 border-amber-300 bg-amber-50 px-5 py-4 text-ink dark:border-amber-700 dark:bg-amber-950 dark:text-zinc-100"
      data-tarla-boundaries-info=""
    >
      <h2 id="tarla-boundaries-info-title" className="flex items-center gap-2 text-base font-semibold">
        <Info className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        {t("title")}
      </h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6 text-sm">
        {TARLA_INFO_FACTS.map((k) => (
          <li key={k} data-tarla-fact={k}>
            {t(k)}
          </li>
        ))}
      </ol>
    </section>
  );
}
