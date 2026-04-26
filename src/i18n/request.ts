import { getRequestConfig } from "next-intl/server";

// Fallback default until [locale] routing lands in a later slice.
const DEFAULT_LOCALE = "en-GB";

export default getRequestConfig(async ({ requestLocale }) => {
  // requestLocale is `undefined` until middleware/routing is wired up.
  const locale = (await requestLocale) ?? DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
