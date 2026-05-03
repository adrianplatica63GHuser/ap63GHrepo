"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, setLocaleCookie } from "@/lib/i18n/locale";

/** Flag emoji and accessible label per locale. */
const LOCALE_META: Record<string, { flag: string; label: string }> = {
  "en-GB": { flag: "🇬🇧", label: "English" },
  "ro-RO": { flag: "🇷🇴", label: "Română" },
};

/**
 * Flag-based locale switcher.
 *
 * - Active (current) locale: flag shown in greyscale, button disabled.
 * - Inactive locale: flag in full colour, clickable.
 *
 * Clicking writes the locale cookie and calls router.refresh() so server
 * components re-render with the new locale.
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
    <div className="inline-flex items-center gap-0.5">
      {SUPPORTED_LOCALES.map((locale) => {
        const { flag, label } = LOCALE_META[locale] ?? {
          flag: locale,
          label: locale,
        };
        const isActive = currentLocale === locale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            disabled={isActive}
            aria-pressed={isActive}
            title={label}
            aria-label={label}
            className={[
              "text-xl leading-none rounded p-0.5 transition-all select-none",
              isActive
                ? "grayscale opacity-50 cursor-default"
                : "cursor-pointer hover:scale-110 hover:opacity-90",
            ].join(" ")}
          >
            {flag}
          </button>
        );
      })}
    </div>
  );
}
