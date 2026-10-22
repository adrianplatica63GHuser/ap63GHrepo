"use client";

/**
 * „Noapte" — one checkbox, drawn in the sidebar under „GA40" and in „Setări" under the language.  (Slices 40.19, 40.28)
 *
 * Both read and write the one choice (`useTheme`, src/components/providers/theme-provider.tsx): ticked, the whole app
 * is dark at once; unticked, light. `compact` is the sidebar's: a smaller box and an `xs` label, „Noapte" / „Night"
 * (theme.night), with the long words — „Noapte (Mod Întunecat)" — as its tooltip, so the short one still explains
 * itself on hover (40.28, Ask first 4). „Setări" draws the long words as the label itself (theme.nightLong).
 */
import { useTranslations } from "next-intl";
import { useTheme } from "@/components/providers/theme-provider";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  return (
    <label
      className={`flex cursor-pointer select-none items-center gap-1.5 ${compact ? "text-xs" : "text-sm"} text-ink dark:text-zinc-300`}
      data-theme-toggle={compact ? "sidebar" : "settings"}
      title={compact ? t("nightLong") : undefined}
    >
      <input
        type="checkbox"
        checked={theme === "dark"}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
        className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} accent-cta`}
      />
      {compact ? t("night") : t("nightLong")}
    </label>
  );
}
