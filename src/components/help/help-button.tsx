"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { HelpCircle, X } from "lucide-react";
import { useHelpData, pickLocaleText } from "./use-help-data";
import type { HelpScreenKey } from "@/lib/help/registry";

type Props = {
  screenKey: HelpScreenKey;
  className?: string;
};

/**
 * Per-screen Help button: a small circular "?" icon that opens a
 * non-modal popover with a "Background" section and a "How To" section.
 *
 * Renders nothing at all when the registry has no content for this screen
 * (Adrian's decision: a screen with nothing non-obvious should not show an
 * empty popover button). Popover open/closed state always resets to closed
 * on navigation, via the derived-state-during-render pattern (matches
 * sidebar-nav.tsx) rather than a useEffect + setState, which would trip
 * react-hooks/set-state-in-effect.
 */
export function HelpButton({ screenKey, className }: Props) {
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

  const content = data?.content ?? null;
  const background = pickLocaleText(locale, content?.backgroundEn, content?.backgroundRo);
  const howTo = pickLocaleText(locale, content?.howToEn, content?.howToRo);

  if (!background && !howTo) return null;

  return (
    <div className={["relative inline-block", className].filter(Boolean).join(" ")}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={t("buttonLabel")}
        aria-expanded={isOpen}
        className="inline-flex items-center justify-center rounded-full w-7 h-7 text-fade hover:text-cta hover:bg-cta-pale transition-colors"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[70vh] overflow-auto rounded-lg border border-card-rim bg-white dark:bg-zinc-900 shadow-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h2 className="text-sm font-semibold text-ink dark:text-zinc-100">{t("title")}</h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label={t("close")}
                className="text-fade hover:text-ink dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {background && (
              <section className="mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fade mb-1">
                  {t("background")}
                </h3>
                <p className="text-sm text-ink dark:text-zinc-200 whitespace-pre-wrap">
                  {background}
                </p>
              </section>
            )}

            {howTo && (
              <section>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-fade mb-1">
                  {t("howTo")}
                </h3>
                <p className="text-sm text-ink dark:text-zinc-200 whitespace-pre-wrap">
                  {howTo}
                </p>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
