/**
 * Case:   TC-PERS-09 — O firmă cu telefonul și e-mailul ei, păstrate după reîncărcare și în istoric
 * Source: docs/testing/cases/TC-PERS-09.md, „Last green" 2026-10-07
 *
 * A translation of the case file, step for step (Slice #38.31). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 1's company is created through its route, with a `TC-E2E-PERS-09`
 *     name (e2e/helpers/records.ts), and removed in `finally`.
 */

import { test, expect, type Locator } from "@playwright/test";
import { E2E_MARKER, createCompany, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-09`;
const NAME = `${MARK} SRL`;
const PHONE = "0722 000 009";
const EMAIL = "office@tc-pers-09.ro";
const GREEN = /ring-green-500|ga-vpulse-green/;

test.describe("TC-PERS-09 — O firmă cu telefonul și e-mailul ei, păstrate după reîncărcare și în istoric", () => {
  test("telefonul și e-mailul salvate, un e-mail greșit refuzat, „v 0” goală și „v 1” marcată", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const id = await createCompany(page.request, { name: NAME });
    try {
      // Step 1 — „v 0"; the two boxes, empty, above „Persoană de contact 1".
      await page.goto(`/judicial-persons/${id}`);
      await expect(page.getByRole("heading", { name: NAME })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 0", { exact: true }).first()).toBeAttached({ timeout: 30_000 });
      const tile = await showTile(page, "Reprezentanți și contact");
      // By the box, not the label: an error inside the <label> joins the box's
      // accessible name („E-mail firmă Adresa de e-mail nu pare…").
      await expect(tile.getByText("Telefon firmă", { exact: true })).toBeVisible();
      await expect(tile.getByText("E-mail firmă", { exact: true })).toBeVisible();
      const phone: Locator = tile.locator('[data-width-field="phone"]');
      const email: Locator = tile.locator('[data-width-field="email"]');
      await expect(phone).toHaveValue("");
      await expect(email).toHaveValue("");
      const [pBox, cBox] = [await phone.boundingBox(), await tile.getByText("Persoană de contact 1").first().boundingBox()];
      expect((pBox?.y ?? 0) < (cBox?.y ?? 0)).toBe(true);

      // Step 2 — an e-mail without the shape of one: the Romanian message, nothing saved.
      await phone.fill(PHONE);
      await email.fill("firma-tc");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(tile.getByText("Adresa de e-mail nu pare corectă — de exemplu office@firma.ro")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("v 0", { exact: true }).first()).toBeAttached();

      // Step 3 — a real one: „v 1", „2 versiuni".
      await email.fill(EMAIL);
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.getByText("2 versiuni")).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 1", { exact: true }).first()).toBeAttached();

      // Step 4 — after a reload, both are there.
      await page.reload();
      const after = await showTile(page, "Reprezentanți și contact");
      await expect(after.locator('[data-width-field="phone"]')).toHaveValue(PHONE, { timeout: 30_000 });
      await expect(after.locator('[data-width-field="email"]')).toHaveValue(EMAIL);

      // Step 5 — „Versiunea anterioară": „v 0", both empty.
      await page.getByRole("button", { name: "Versiunea anterioară", exact: true })
        .or(page.getByRole("button", { name: /^\d+ versiuni$/ })).first().click();
      await expect(page.getByText("v 0", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(after.locator('[data-width-field="phone"]')).toHaveValue("");
      await expect(after.locator('[data-width-field="email"]')).toHaveValue("");

      // Step 6 — „Versiunea următoare": „v 1", both filled and framed in green.
      await page.getByRole("button", { name: "Versiunea următoare" }).click();
      await expect(page.getByText("v 1", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(after.locator('[data-width-field="phone"]')).toHaveValue(PHONE);
      await expect(after.locator('[data-width-field="phone"]')).toHaveClass(GREEN);
      await expect(after.locator('[data-width-field="email"]')).toHaveClass(GREEN);
    } finally {
      await removeRecord(page.request, "company", id);
    }
  });
});
