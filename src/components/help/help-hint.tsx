"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Lightbulb, X } from "lucide-react";
import { useHelpData, pickLocaleText } from "./use-help-data";
import type { HelpScreenKey } from "@/lib/help/registry";

type Props = {
  screenKey: HelpScreenKey;
  hintKey: string;
  className?: string;
};

/**
 * Inline micro-hint: a small lightbulb icon placed right next to a specific
 * piece of hidden mouse behavior (e.g. drag-to-select on the Properties Map,
 * wheel-zoom/pan on the Document big-page viewer, the OCR extract button on
 * Admin Import). Lighter-weight than <HelpButton> — a single short tip, no
 * Background/How-To split.
 *
 * Renders nothing when the registry has no matching hint or the DB has no
 * content for it yet. Same navigation-reset pattern as <HelpButton>.
 */
export function HelpHint({ screenKey, hintKey, className }: Props) {
  const t = useTranslations("help");
  const locale = useLocale();
  const pathname = usePathname();
  const { data } = useHelpData(screenKey);

  const [isOpen, setIsOpen] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setIsOpen(false);
  }

  const hint = data?.hints.find((h) => h.hintKey === hintKey) ?? null;
  const text = pickLocaleText(locale, hint?.textEn, hint?.textRo);

  if (!text) return null;

  return (
    <span className={["relative inline-block", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t("hintLabel")}
        aria-expanded={isOpen}
        className="inline-flex items-center justify-center rounded-full w-5 h-5 text-amber-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
      >
        <Lightbulb className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-lg border border-card-rim bg-white dark:bg-zinc-900 shadow-xl p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs text-ink dark:text-zinc-200 whitespace-pre-wrap">{text}</p>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("close")}
                className="text-fade hover:text-ink dark:hover:text-zinc-200 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </span>
  );
}
