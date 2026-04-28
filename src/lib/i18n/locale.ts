/**
 * Locale constants and helpers shared by client and server.
 *
 * Slice #1 uses cookie-based locale persistence (no [locale] URL segment).
 * The server reads the cookie in `src/i18n/request.ts`; the client toggle
 * writes to it via `setLocaleCookie` and triggers `router.refresh()`.
 */

export const SUPPORTED_LOCALES = ["en-GB", "ro-RO"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "en-GB";

export const LOCALE_COOKIE_NAME = "NEXT_LOCALE";

export function isSupportedLocale(
  value: string | undefined,
): value is SupportedLocale {
  return SUPPORTED_LOCALES.includes(value as SupportedLocale);
}

/**
 * Set the locale cookie from the browser. Caller is responsible for
 * triggering a re-render afterwards (e.g. `router.refresh()`).
 */
export function setLocaleCookie(locale: string): void {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${oneYear}; SameSite=Lax`;
}
