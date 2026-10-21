"use client";

/**
 * „Mod întunecat" — one checkbox, drawn under the flags in the sidebar and in „Setări" under the language.
 *                                                                                                    (Slice 40.19)
 *
 * Both read and write the one choice (`useTheme`, src/components/providers/theme-provider.tsx): ticked, the whole app
 * is dark at once; unticked, light. `compact` is the sidebar's: a smaller box and an `xs` label, on a line of its own
 * under the flags (Ask first 3).
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
    >
      <input
        type="checkbox"
        checked={theme === "dark"}
        onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
        className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} accent-cta`}
      />
      {t("darkMode")}
    </label>
  );
}
