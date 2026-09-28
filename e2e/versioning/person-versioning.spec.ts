/**
 * Case:   TC-VER-01 — Versiunile unei persoane fizice: salvare, înapoi, „Fă curentă”
 * Source: docs/testing/cases/TC-VER-01.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Nume" is `TC-E2E-VER-01`, not `TC-VER-01` — a spec's rows carry the
 *     TC-E2E- marker (e2e/helpers/records.ts). So the headings read
 *     `Unu TC-E2E-VER-01` and so on.
 *   - The case's cleanup („Șterge", „Da") runs at the end, and a `finally`
 *     removes the person through the same DELETE route if the test stopped
 *     before that.
 *   - The case file's „Before promoting" note: a „Salvează" pressed the moment
 *     a new person's form appears can do nothing. So step 1 waits for the page
 *     to settle, and asserts the typed values are in the fields before saving.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const LAST_NAME = `${E2E_MARKER}VER-01`;
const named = (first: string) => `${first} ${LAST_NAME}`; // prenume first, as the list renders it

test.describe("TC-VER-01 — Versiunile unei persoane fizice: salvare, înapoi, „Fă curentă”", () => {
  test("trei versiuni, înapoi la v 0, „Fă curentă” o copiază în v 3", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, LAST_NAME);

    let personId: string | undefined;
    try {
      // Step 1 — create the person; the list reads „Nou!", `PPERS…`, `Unu TC-E2E-VER-01`.
      await page.goto("/natural-persons/new");
      await expect(page.getByRole("heading", { name: "Persoană fizică nouă" })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await page.getByLabel(/^Nume(\s|$)/).fill(LAST_NAME);
      await page.getByLabel(/^Prenume(\s|$)/).fill("Unu");
      await expect(page.getByLabel(/^Prenume(\s|$)/)).toHaveValue("Unu");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });
      const row = page.getByRole("row").filter({ hasText: named("Unu") });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row).toContainText("Nou!");
      await expect(row).toContainText(/PPERS\d+/);
      const href = await row.getByRole("link", { name: "Deschide" }).getAttribute("href");
      personId = href?.split("/").pop();

      // Step 2 — „v 0"; both arrows and „Fă curentă" disabled; „Salvează" disabled, „Șterge", „Anulează".
      await row.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: named("Unu") })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Versiunea anterioară" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Versiunea următoare" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Fă curentă" })).toBeDisabled();
      const save = page.getByRole("button", { name: "Salvează", exact: true });
      await expect(save).toBeDisabled();
      await expect(page.getByRole("button", { name: "Șterge", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Anulează", exact: true })).toBeVisible();

      // Step 3 — „Prenume" `Doi`, „Salvează": stays, `Doi …`, „v 1", chip „2 versiuni", no arrows.
      const firstName = page.locator('[name="firstName"]');
      await firstName.fill("Doi");
      await save.click();
      await expect(page.getByRole("heading", { name: named("Doi") })).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${personId}$`));
      await expect(page.getByText("v 1", { exact: true })).toBeAttached();
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Versiunea următoare" })).toHaveCount(0);

      // Step 4 — `Trei`: „v 2", „3 versiuni".
      await firstName.fill("Trei");
      await save.click();
      await expect(page.getByRole("heading", { name: named("Trei") })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 2", { exact: true })).toBeAttached();
      await expect(page.getByRole("button", { name: "3 versiuni" })).toBeVisible();

      // Step 5 — the chip: one step back, „v 1", `Doi`; arrows and „Fă curentă" enabled;
      // „Salvează" gone; the heading still reads the current name.
      await page.getByRole("button", { name: "3 versiuni" }).click();
      await expect(page.getByText("v 1", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(firstName).toHaveValue("Doi");
      await expect(page.getByRole("button", { name: "Versiunea anterioară" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Versiunea următoare" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Fă curentă" })).toBeEnabled();
      await expect(save).toHaveCount(0);
      await expect(page.getByRole("heading", { name: named("Trei") })).toBeVisible();

      // Step 6 — „Versiunea anterioară": „v 0", `Unu`; that arrow disabled.
      await page.getByRole("button", { name: "Versiunea anterioară" }).click();
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(firstName).toHaveValue("Unu");
      await expect(page.getByRole("button", { name: "Versiunea anterioară" })).toBeDisabled();

      // Step 7 — „Fă curentă": the question, its sentence, „Anulează" / „OK".
      await page.getByRole("button", { name: "Fă curentă" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Faceți această versiune curentă?");
      await expect(dialog).toContainText(
        "Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?",
      );
      await expect(dialog.getByRole("button", { name: "Anulează", exact: true })).toBeVisible();

      // Step 8 — „OK": `Unu …`, „v 3", „4 versiuni", `Unu`.
      await dialog.getByRole("button", { name: "OK", exact: true }).click();
      await expect(dialog).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: named("Unu") })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 3", { exact: true })).toBeAttached();
      await expect(page.getByRole("button", { name: "4 versiuni" })).toBeVisible();
      await expect(firstName).toHaveValue("Unu");

      // Step 9 — „4 versiuni": „v 2" still reads `Trei` — the replaced version is kept.
      await page.getByRole("button", { name: "4 versiuni" }).click();
      await expect(page.getByText("v 2", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(firstName).toHaveValue("Trei");

      // Step 10 — the list agrees with the record.
      await openFromSidebar(page, "Persoane Fizice");
      const listed = page.getByRole("row").filter({ hasText: LAST_NAME });
      await expect(listed).toHaveCount(1, { timeout: 30_000 });
      await expect(listed).toContainText(named("Unu"));
      await expect(listed).toContainText(/PPERS\d+/);

      // ── At the end — „Șterge", „Da" ───────────────────────────────────────
      await listed.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: named("Unu") })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Șterge", exact: true }).click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți persoana?" });
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/natural-persons$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: LAST_NAME })).toHaveCount(0);
    } finally {
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
