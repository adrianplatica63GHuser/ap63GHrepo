"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { SegmentedSwitch } from "@/components/segmented-switch";
import { setLocaleCookie, type SupportedLocale } from "@/lib/i18n/locale";

/**
 * „RO | EN" — the language switch.                                                                     (Slice 40.58)
 *
 * Adrian, 2026-10-24 (GA40-Design-Improvements.docx, chapter 8a and „Choices only you can make"): „RO | EN", not the
 * flags. Two words in one two-part control (`SegmentedSwitch`): the language in use filled in slate, the other
 * outlined. No image and no request to any outside website — the flags came from flagcdn.com, and the language in use
 * was drawn grey, faded and disabled, so it read as „off".
 *
 * RO first, then EN (Ask first 2) — this overturns 40.28's English on top, which followed SUPPORTED_LOCALES' order;
 * the order here is the switch's own. One look for the sidebar and the login and sign-up pages: 40.19's `small` and
 * 40.28's `stacked` went with the flags (Ask first 3).
 *
 * Pressing the other language writes the locale cookie and calls router.refresh(), so server components re-render in
 * it.
 */
const ORDER: readonly { locale: SupportedLocale; text: string; label: string }[] = [
  { locale: "ro-RO", text: "RO", label: "Română" },
  { locale: "en-GB", text: "EN", label: "English" },
];

export function LocaleToggle() {
  const t = useTranslations("settings.account");
  const currentLocale = useLocale();
  const router = useRouter();
  return (
    <SegmentedSwitch
      label={t("language")}
      name="locale"
      options={ORDER.map((o) => ({ value: o.locale, text: o.text, label: o.label }))}
      value={currentLocale as SupportedLocale}
      onChange={(locale) => {
        setLocaleCookie(locale);
        router.refresh();
      }}
    />
  );
}
