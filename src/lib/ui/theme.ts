/**
 * The light or dark look, one choice per browser.                                                    (Slice 40.19)
 *
 * Adrian, 2026-10-21: „I would like to have a "dark mode" and I should be able to switch to this dark mode with a
 * checkbox that shows up in two places: … under the flags on the top left Corner … under Settings - below the
 * language item".
 *
 * The choice is a cookie of its own (Ask first 1), like the language's `NEXT_LOCALE` — a year, `SameSite=Lax`, the
 * whole site — so the root layout reads it on the server and writes the `dark` class on <html> in the first byte: a
 * dark load is never white first. No cookie, or anything but `dark`, is light: Windows' own setting no longer decides
 * (Ask first 2; globals.css's `@custom-variant dark`).
 */

export const THEME_COOKIE_NAME = "ga40-theme";

export type Theme = "light" | "dark";

/** What a cookie's value means: `dark` is dark, anything else — nothing, a typo — is light. */
export function themeOf(value: string | undefined | null): Theme {
  return value === "dark" ? "dark" : "light";
}

/** The class <html> carries for a theme: `dark`, or none. */
export function themeClass(theme: Theme): string {
  return theme === "dark" ? "dark" : "";
}

/** The cookie line that stores a theme for a year (the language's, `setLocaleCookie`, is the model). */
export function themeCookie(theme: Theme): string {
  const oneYear = 60 * 60 * 24 * 365;
  return `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${oneYear}; SameSite=Lax`;
}

/** Stores the choice and turns the page at once — no reload: the class on <html> is all `dark:` reads. */
export function applyTheme(theme: Theme, doc: Document = document): void {
  doc.cookie = themeCookie(theme);
  doc.documentElement.classList.toggle("dark", theme === "dark");
  doc.documentElement.style.colorScheme = theme;
}
