/**
 * The left sidebar, as a person sees it  (Slice #36.06)
 *
 * Every case in docs/testing/cases/ starts „Presses „…" in the left sidebar".
 * The sidebar's sections are ordinary words — „Acte", „Persoane Fizice" — that
 * a page's own body may also print, so a bare `page.getByRole("link", …)` is
 * one dashboard tile away from a strict-mode failure. This scopes to the
 * `<nav>` that holds the „Admin-Operațiuni" section instead.
 *
 * Not scoped by the nav's `aria-label`: that is „Main navigation", in English,
 * in `components/sidebar/sidebar-nav.tsx` — a Romanian-primacy defect noted in
 * the 36.06 handover, and a locator that would break the day it is fixed.
 */

import type { Locator, Page } from "@playwright/test";

export function sidebar(page: Page): Locator {
  // A RegExp, not a string: string `hasText` is case-INSENSITIVE, and the
  // breadcrumb on the persons screens reads „Persoane fizice" — two <nav>s, and
  // a strict-mode failure. The breadcrumb never carries „Admin-Operațiuni".
  return page.locator("nav").filter({ hasText: /Admin-Operațiuni/ });
}

/** Press a sidebar entry by its visible Romanian label. */
export async function openFromSidebar(page: Page, label: string): Promise<void> {
  await sidebar(page).getByRole("link", { name: label, exact: true }).click();
}
