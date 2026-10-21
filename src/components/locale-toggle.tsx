"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { SUPPORTED_LOCALES, setLocaleCookie } from "@/lib/i18n/locale";

/** Flag image URL and accessible label per locale. */
const LOCALE_META: Record<string, { flagSrc: string; label: string }> = {
  "en-GB": {
    flagSrc: "https://flagcdn.com/w40/gb.png",
    label: "English",
  },
  "ro-RO": {
    flagSrc: "https://flagcdn.com/w40/ro.png",
    label: "Română",
  },
};

/**
 * Flag-based locale switcher.
 *
 * - Active (current) locale: flag shown in greyscale + faded, button disabled.
 * - Inactive locale: flag in full colour, clickable with a subtle scale-up.
 *
 * Clicking writes the locale cookie and calls router.refresh() so server
 * components re-render with the new locale.
 *
 * Slice 40.19: `small` is the sidebar's — 24 × 16 px, so „Mod întunecat" fits on a line under them (Adrian: „we have
 * to make the flags a little bit smaller"); the login and signup pages keep 30 × 20.
 */
export const FLAG_PX = { regular: { width: 30, height: 20 }, small: { width: 24, height: 16 } } as const;

export function LocaleToggle({ small = false }: { small?: boolean }) {
  const flag = small ? FLAG_PX.small : FLAG_PX.regular;
  const currentLocale = useLocale();
  const router = useRouter();

  const switchTo = (locale: string) => {
    if (locale === currentLocale) return;
    setLocaleCookie(locale);
    router.refresh();
  };

  return (
    <div className="inline-flex items-center gap-1">
      {SUPPORTED_LOCALES.map((locale) => {
        const meta = LOCALE_META[locale] ?? { flagSrc: "", label: locale };
        const isActive = currentLocale === locale;
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            disabled={isActive}
            aria-pressed={isActive}
            title={meta.label}
            aria-label={meta.label}
            className={[
              "rounded p-0.5 transition-all",
              isActive
                ? "grayscale opacity-50 cursor-default"
                : "cursor-pointer hover:scale-110",
            ].join(" ")}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meta.flagSrc}
              alt={meta.label}
              style={{ width: flag.width, height: flag.height, objectFit: "fill" }}
              className="block rounded-sm"
            />
          </button>
        );
      })}
    </div>
  );
}
