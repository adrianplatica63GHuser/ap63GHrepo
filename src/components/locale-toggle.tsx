"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, setLocaleCookie } from "@/lib/i18n/locale";

/**
 * EN / RO toggle. The active locale's button is disabled (per the mockup);
 * clicking the inactive one writes the cookie and triggers `router.refresh()`
 * so server components re-render with the new locale.
 *
 * The button label is derived from the locale code: "en-GB" → "EN", "ro-RO" → "RO".
 */
export function LocaleToggle() {
  const currentLocale = useLocale();
  const router = useRouter();

  const switchTo = (locale: string) => {
    if (locale === currentLocale) return;
    setLocaleCookie(locale);
    router.refresh();
  };

  return (
    <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
      {SUPPORTED_LOCALES.map((locale) => {
        const label = locale.split("-")[0].toUpperCase();
        const isActive = currentLocale === locale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            disabled={isActive}
            aria-pressed={isActive}
            className={[
              "px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-zinc-200 text-zinc-500 cursor-default dark:bg-zinc-800 dark:text-zinc-400"
                : "bg-white text-zinc-900 hover:bg-zinc-50 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
