/**
 * The app's light or dark look, as the „Mod întunecat" box sets it.                                  (Slice 40.19)
 *
 * Since 40.19 dark mode is the `dark` class on <html>, from the ga40-theme cookie — not the OS setting — so
 * `page.emulateMedia({ colorScheme })` no longer turns the app. `setLook` does what ticking the box does, on the page
 * already open; `lookOnLoad` stores the cookie so the next page loads in that look.
 */
import { test, type Page } from "@playwright/test";

export type Look = "light" | "dark";

export async function setLook(page: Page, look: Look): Promise<void> {
  await page.evaluate((l) => {
    document.cookie = `ga40-theme=${l}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.classList.toggle("dark", l === "dark");
    document.documentElement.style.colorScheme = l;
  }, look);
}

export async function lookOnLoad(page: Page, look: Look): Promise<void> {
  const base = test.info().project.use.baseURL ?? process.env.E2E_BASE_URL ?? "http://localhost:3000";
  await page.context().addCookies([{ name: "ga40-theme", value: look, url: base }]);
}
