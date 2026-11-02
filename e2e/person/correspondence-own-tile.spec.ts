/**
 * Case:   TC-PERS-20 — Adresa de corespondență se editează singură: „Editează", „Salvează", „Renunță" ale ei
 *
 * Slice 41.34 — Adrian: „tile Correspondence Address is missing Edit Save and Cancel buttons … the same is true for the
 * correspondence address of a juridical person". On an invented natural person and an invented juridical person
 * (created through the routes, removed at the end): the correspondence address opened with its „Adaugă" puts only that
 * tile in edit; its „Salvează" saves it; a reload shows it, the home address (the registered office) unchanged; its own
 * „Editează" opens it again, and „Renunță" puts the value back. No map, no Street View, no address look-up.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { emptyTileLine } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-20`;
const value = (page: Page, path: string) => page.locator(`[data-read-value="${path}"]`);

async function correspondenceOnItsOwn(page: Page, first: "home" | "headquarters"): Promise<void> {
  // Opened with its line's „Adaugă": only the correspondence tile is in edit.
  await emptyTileLine(page, "correspondence").locator("[data-empty-tile-add]").click();
  await expect(page.locator('[data-tile-edit-bar="correspondence"]')).toBeVisible();
  await expect(page.locator(`[data-tile-edit-bar="${first}"]`)).toHaveCount(0);
  await page.locator('input[name="addresses.CORRESPONDENCE.locality"], textarea[name="addresses.CORRESPONDENCE.locality"]').fill(`${MARK} Ploiești`);
  await page.locator('input[name="addresses.CORRESPONDENCE.country"], textarea[name="addresses.CORRESPONDENCE.country"]').fill("România");
  await page.locator('[data-tile-save="correspondence"]').click();
  await expect(page.locator('[data-tile-edit-bar="correspondence"]')).toHaveCount(0, { timeout: 30_000 });

  await page.reload();
  await expect(value(page, "addresses.CORRESPONDENCE.locality")).toHaveText(`${MARK} Ploiești`, { timeout: 30_000 });

  // Its own „Editează"; „Renunță" puts the saved value back.
  await page.locator('[data-tile-edit="correspondence"]').click();
  await expect(page.locator('[data-tile-edit-bar="correspondence"]')).toBeVisible();
  await expect(page.locator(`[data-tile-edit-bar="${first}"]`)).toHaveCount(0);
  await page.locator('input[name="addresses.CORRESPONDENCE.locality"], textarea[name="addresses.CORRESPONDENCE.locality"]').fill("Altceva");
  await page.locator('[data-tile-cancel="correspondence"]').click();
  await expect(value(page, "addresses.CORRESPONDENCE.locality")).toHaveText(`${MARK} Ploiești`);
}

test.describe("TC-PERS-20 — adresa de corespondență, tile-ul ei", () => {
  test("persoana fizică și persoana juridică", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let personId: string | undefined;
    let companyId: string | undefined;
    try {
      personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Corespondență" });
      await page.goto(`/natural-persons/${personId}`);
      await expect(emptyTileLine(page, "correspondence")).toBeVisible({ timeout: 30_000 });
      await correspondenceOnItsOwn(page, "home");
      // The home address is still empty — one line.
      await expect(emptyTileLine(page, "home")).toBeVisible();

      companyId = await createCompany(page.request, {
        name: `${MARK} SRL`,
        addresses: [{ kind: "HEADQUARTERS", locality: `${MARK} Cluj`, country: "România" }],
      });
      await page.goto(`/judicial-persons/${companyId}`);
      await expect(emptyTileLine(page, "correspondence")).toBeVisible({ timeout: 30_000 });
      await correspondenceOnItsOwn(page, "headquarters");
      // The registered office unchanged.
      await expect(value(page, "addresses.HEADQUARTERS.locality")).toHaveText(`${MARK} Cluj`);
    } finally {
      if (personId) await removeRecord(page.request, "person", personId);
      if (companyId) await removeRecord(page.request, "company", companyId);
    }
  });
});
