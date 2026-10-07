/**
 * Case:   TC-LAYOUT-04 — „Recente": o singură bară, pliată, deasupra „Schimbă parola" / „Ieșire"
 * Source: docs/testing/cases/TC-LAYOUT-04.md, „Last green" 2026-10-07
 *
 * A translation of the case file, step for step (Slice #38.28). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The two records are this spec's own, created through the POST route the
 *     „Adaugă" form calls and removed in `finally`, both marked
 *     TC-E2E-LAYOUT-04.
 *   - The footer's height is measured (the bounding box of „Schimbă parola")
 *     where the hand run looked.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers } from "../helpers/records";

const MARK = `${E2E_MARKER}LAYOUT-04`;
const ONE = `${MARK} Proprietate unu`;
const TWO = `${MARK} Proprietate doi`;

const aside = (page: Page) => page.locator("aside");
const bar = (page: Page) => aside(page).getByRole("button", { name: "Recente", exact: true });
const footerTop = async (page: Page) => (await aside(page).getByRole("link", { name: "Schimbă parola" }).or(aside(page).getByRole("button", { name: "Schimbă parola" })).first().boundingBox())!.y;
/** Removes the browser's list of visits, so the two this spec makes are the ones it reads. */
const forgetVisits = (page: Page) => page.evaluate(() => localStorage.removeItem("ga40_recently_viewed"));

test.describe("TC-LAYOUT-04 — „Recente” într-o singură bară", () => {
  test("pliată la o încărcare nouă; un clic arată cele două înregistrări deasupra, al doilea le ascunde; subsolul nu se mișcă", async ({ page, request }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/");
    await forgetVisits(page);
    const ids: string[] = [];
    try {
      ids.push(await createProperty(request, { nickname: ONE }));
      ids.push(await createProperty(request, { nickname: TWO }));

      // Step 1 — the two records opened, one after the other.
      for (const [id, name] of [[ids[0], ONE], [ids[1], TWO]] as const) {
        await page.goto(`/properties/${id}`);
        // The screen has registered the visit when the browser's list names it.
        await expect
          .poll(() => page.evaluate(() => localStorage.getItem("ga40_recently_viewed") ?? ""), { timeout: 30_000 })
          .toContain(name);
      }

      // Step 2 — a fresh load: one bar „Recente", folded; no record's name in the sidebar.
      await page.goto("/");
      await expect(bar(page)).toBeVisible({ timeout: 30_000 });
      await expect(bar(page)).toHaveAttribute("aria-expanded", "false");
      await expect(aside(page).getByText(ONE)).toHaveCount(0);
      await expect(aside(page).getByText(TWO)).toHaveCount(0);
      // The ten specs' mask still finds it.
      await expect(page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) })).toHaveCount(1);
      const folded = await footerTop(page);
      const barTop = (await bar(page).boundingBox())!.y;

      // Step 3 — a click: both names above the bar; the footer has not moved.
      await bar(page).click();
      await expect(bar(page)).toHaveAttribute("aria-expanded", "true");
      await expect(aside(page).getByRole("link", { name: ONE })).toBeVisible();
      await expect(aside(page).getByRole("link", { name: TWO })).toBeVisible();
      expect((await aside(page).getByRole("link", { name: TWO }).boundingBox())!.y).toBeLessThan((await bar(page).boundingBox())!.y);
      expect(await footerTop(page)).toBe(folded);
      expect((await bar(page).boundingBox())!.y).toBe(barTop);

      // Step 4 — a second click folds it again.
      await bar(page).click();
      await expect(bar(page)).toHaveAttribute("aria-expanded", "false");
      await expect(aside(page).getByRole("link", { name: ONE })).toHaveCount(0);

      // Step 5 — collapsed to icons: the icon alone; a click opens the sidebar with the list unfolded.
      await aside(page).getByRole("button", { name: "Restrânge bara laterală" }).click();
      await aside(page).getByRole("button", { name: "Recente" }).click();
      await expect(bar(page)).toHaveAttribute("aria-expanded", "true");
      await expect(aside(page).getByRole("link", { name: ONE })).toBeVisible();
    } finally {
      await page.evaluate(() => localStorage.setItem("sidebar-collapsed", "false")).catch(() => undefined);
      await removeLeftovers(request, MARK);
    }
  });
});
