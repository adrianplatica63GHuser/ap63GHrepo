/**
 * The left sidebar, as a person sees it  (Slices #36.06, #38.20)
 *
 * Every case in docs/testing/cases/ starts „Presses „…" in the left sidebar".
 * The sidebar's words — „Acte", „Persoane Fizice" — are ordinary words a page's
 * own body may also print, so a bare `page.getByRole("link", …)` is one
 * dashboard tile away from a strict-mode failure. This scopes to the sidebar's
 * own `<nav>` (`data-sidebar-nav`, Slice #38.20 — its name is Romanian now,
 * „Navigare principală", but a locator by attribute survives a rename).
 *
 * Since #38.20 the sidebar is nine sections, and the screens are items INSIDE
 * them: „Acte" is under „Domeniu", „Etichete" under „Administrare". A section
 * shows its items only while it is open (one at a time), so `openFromSidebar`
 * opens the section that holds the item first — by name when told, otherwise
 * by trying the closed ones in turn.
 */

import { expect, type Locator, type Page } from "@playwright/test";

export function sidebar(page: Page): Locator {
  return page.locator("nav[data-sidebar-nav]");
}

/** Open sidebar section `name` („Domeniu", „Administrare" …) if it is not open. */
export async function openSection(page: Page, name: string): Promise<void> {
  const header = sidebar(page).getByRole("button", { name, exact: true });
  await expect(header).toBeVisible({ timeout: 30_000 });
  if ((await header.getAttribute("aria-expanded")) !== "true") await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "true");
}

/**
 * Press a sidebar entry by its visible Romanian label — an item inside a
 * section (opened first: `section`, or each closed one in turn), or a section
 * that is itself a link („Tablou de bord", „Setări").
 */
export async function openFromSidebar(page: Page, label: string, section?: string): Promise<void> {
  const nav = sidebar(page);
  await expect(nav).toBeVisible({ timeout: 30_000 });
  const link = nav.getByRole("link", { name: label, exact: true });
  if (section) await openSection(page, section);
  if (!(await link.isVisible())) {
    // Named first, then opened one by one: opening a section closes the one open before it.
    const names = (await nav.locator("button[aria-expanded]").allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    for (const name of names) {
      if (await link.isVisible()) break;
      await openSection(page, name);
    }
  }
  await link.click();
}
