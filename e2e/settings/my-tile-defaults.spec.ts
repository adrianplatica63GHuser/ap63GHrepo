/**
 * Case:   TC-SET-03 — „Implicitele mele”: setul salvat e ce arată „Implicit”, și după o reîncărcare
 * Source: docs/testing/cases/TC-SET-03.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.41). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The natural person is created through the API, as every TC-E2E- record is,
 *     and removed in `finally`; the saved set is forgotten through the API first
 *     and last, so a red run leaves the built-in set standing.
 */

import { test, expect, type Page } from "@playwright/test";
import { createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { TILE_GROUP, tileBox } from "../helpers/tiles";

const LAST_NAME = "TC-E2E-TILEDEF";
const ROW = "Persoană fizică";

async function forgetNaturalPersonSet(page: Page): Promise<void> {
  const r = await page.request.delete("/api/account/tile-defaults?kind=natural-person");
  expect(r.status()).toBe(204);
}

function kindRow(page: Page) {
  return page
    .locator("main")
    .getByRole("region", { name: "Contul meu", exact: true })
    .getByRole("group", { name: new RegExp(`^${ROW}`) });
}

/**
 * „Implicit”, until the boxes read as `on` and `off` say. The screen reads the
 * saved set once per page load, after it is drawn; a press that lands before
 * that read returns to the built-in set, so the press is repeated until it holds.
 */
async function pressDefault(page: Page, on: string, off: string): Promise<void> {
  await expect(async () => {
    await page.getByRole("group", { name: TILE_GROUP }).getByRole("button", { name: "Implicit", exact: true }).click();
    await expect(tileBox(page, on)).toBeChecked({ timeout: 1_000 });
    await expect(tileBox(page, off)).not.toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
}

test.describe("TC-SET-03 — „Implicitele mele”", () => {
  test("a saved set is what „Implicit” shows on a record screen, after a reload too", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, LAST_NAME);
    await forgetNaturalPersonSet(page);
    let personId: string | undefined;
    try {
      personId = await createNaturalPerson(page.request, { lastName: LAST_NAME, firstName: "Implicit" });

      // Step 1 — „Contul meu”, the „Persoană fizică” row: the built-in set is ticked.
      await page.goto("/admin/settings");
      const row = kindRow(page);
      await expect(row.getByRole("checkbox", { name: "Act de identitate", exact: true })).toBeChecked({ timeout: 30_000 });
      await expect(row.getByRole("checkbox", { name: "Legături", exact: true })).not.toBeChecked();
      await expect(row.getByRole("button", { name: "Revino la implicit", exact: true })).toHaveCount(0);

      // Step 2 — „Act de identitate” off, „Legături” on, „Salvează”.
      await row.getByRole("checkbox", { name: "Act de identitate", exact: true }).uncheck();
      await row.getByRole("checkbox", { name: "Legături", exact: true }).check();
      const put = page.waitForResponse((r) => r.url().includes("/api/account/tile-defaults") && r.request().method() === "PUT");
      await row.getByRole("button", { name: "Salvează", exact: true }).click();
      expect((await put).status()).toBe(204);
      await expect(row.getByRole("status")).toHaveText("Salvat.");
      await expect(row.getByRole("button", { name: "Revino la implicit", exact: true })).toBeVisible();

      // Step 3 — the person's screen: „Implicit” shows the saved set.
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("group", { name: TILE_GROUP })).toBeVisible({ timeout: 30_000 });
      await pressDefault(page, "Legături", "Act de identitate");
      await expect(tileBox(page, "Identitate")).toBeChecked();

      // Step 4 — „Toate”, a reload, then „Implicit” again: the same set.
      await page.getByRole("group", { name: TILE_GROUP }).getByRole("button", { name: "Toate", exact: true }).click();
      await expect(tileBox(page, "Act de identitate")).toBeChecked();
      await page.reload();
      await expect(page.getByRole("group", { name: TILE_GROUP })).toBeVisible({ timeout: 30_000 });
      await pressDefault(page, "Legături", "Act de identitate");

      // Step 5 — „Revino la implicit” in „Contul meu”; on the screen „Implicit” is the built-in set again.
      await page.goto("/admin/settings");
      const del = page.waitForResponse((r) => r.url().includes("/api/account/tile-defaults") && r.request().method() === "DELETE");
      await kindRow(page).getByRole("button", { name: "Revino la implicit", exact: true }).click({ timeout: 30_000 });
      expect((await del).status()).toBe(204);
      await expect(kindRow(page).getByRole("status")).toHaveText("Revenit la implicit.");
      await expect(kindRow(page).getByRole("checkbox", { name: "Act de identitate", exact: true })).toBeChecked();
      await page.goto(`/natural-persons/${personId}`);
      await expect(page.getByRole("group", { name: TILE_GROUP })).toBeVisible({ timeout: 30_000 });
      await pressDefault(page, "Act de identitate", "Legături");
    } finally {
      await forgetNaturalPersonSet(page);
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
