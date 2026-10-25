"use client";

/**
 * The app's look — light or dark — in its two places.                                    (Slices 40.19, 40.28, 40.59)
 *
 * Both read and write the one choice (`useTheme`, src/components/providers/theme-provider.tsx): dark, the whole app is
 * dark at once; light, light.
 *
 *   - `ThemeSwitch` — „Zi | Noapte", the two-part control of „RO | EN" (`SegmentedSwitch`, 40.58), in the account menu
 *     at the bottom of the sidebar (40.59, Ask first 1). It replaced the sidebar's „Noapte" checkbox under „GA40"
 *     (40.19's „I should be able to switch to this dark mode with a checkbox", revisited by Adrian's choice of the
 *     account menu, Figura 8.3).
 *   - `ThemeToggle` — „Setări"'s checkbox, „Noapte (Mod Întunecat)", which stays (40.59's „Out of scope").
 */
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/providers/theme-provider";
import { SegmentedSwitch } from "@/components/segmented-switch";

/** „Zi | Noapte" — the account menu's. */
export function ThemeSwitch() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  return (
    <SegmentedSwitch
      label={t("appearance")}
      name="theme"
      options={[
        { value: "light", text: t("day") },
        { value: "dark", text: t("night") },
      ]}
      value={theme}
      onChange={setTheme}
    />
  );
}

/** „Noapte (Mod Întunecat)" — „Setări"'s checkbox. */
export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  return (
    <label className="flex cursor-pointer select-none items-center gap-1.5 text-sm text-ink dark:text-zinc-300" data-theme-toggle="settings">
      <input
        type="checkbox"
        checked={theme === "dark"}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
        className="h-4 w-4 accent-cta"
      />
      {t("nightLong")}
    </label>
  );
}
