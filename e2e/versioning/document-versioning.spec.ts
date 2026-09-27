/**
 * Case:   TC-VER-02 — Versiunile unui act: salvare, înapoi, „Fă curentă”
 * Source: docs/testing/cases/TC-VER-02.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Etichetă scurtă" is `TC-E2E-VER-02 Unu` (then `Doi`, `Trei`) — the
 *     TC-E2E- marker (e2e/helpers/records.ts).
 *   - The case's cleanup runs at the end; a `finally` removes the document
 *     through the same DELETE route if the test stopped before that.
 *   - On the document's own screen the „Etichetă scurtă" input is found by its
 *     `name`, `title`: the saved screen's label is not tied to it, so it has no
 *     accessible name of its own (seen while driving it, 2026-09-26).
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}VER-02`;
const titled = (n: string) => `${MARK} ${n}`;

test.describe("TC-VER-02 — Versiunile unui act: salvare, înapoi, „Fă curentă”", () => {
  test("trei versiuni ale unui act, înapoi la v 0, „Fă curentă” o copiază în v 3", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);

    let documentId: string | undefined;
    try {
      // Step 1 — create the document; „Acte" reads „Nou!", `DOC…`, „Adeverință", the title.
      await page.goto("/documents/new");
      await expect(page.getByRole("heading", { name: "Act nou" })).toBeVisible({ timeout: 30_000 });
      await page.waitForLoadState("networkidle");
      await page.getByRole("combobox", { name: "Tip document" }).selectOption({ label: "Adeverință" });
      await page.getByLabel("Etichetă scurtă").fill(titled("Unu"));
      await expect(page.getByLabel("Etichetă scurtă")).toHaveValue(titled("Unu"));
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
      const row = page.getByRole("row").filter({ hasText: titled("Unu") });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row).toContainText("Nou!");
      await expect(row).toContainText(/DOC\d+/);
      await expect(row).toContainText("Adeverință");
      const href = await row.getByRole("link", { name: "Deschide" }).getAttribute("href");
      documentId = href?.split("/").pop();

      // Step 2 — headed with the title, „Stare procesare: Neprocesat", „v 0", „Fă curentă" disabled.
      await row.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: titled("Unu") })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Stare procesare:")).toBeVisible();
      await expect(page.getByText("Neprocesat", { exact: true })).toBeVisible();
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Fă curentă" })).toBeDisabled();

      // Step 3 — `Doi`, „Salvează": stays, „v 1", „2 versiuni".
      const title = page.locator('input[name="title"]');
      const save = page.getByRole("button", { name: "Salvează", exact: true });
      await title.fill(titled("Doi"));
      await save.click();
      await expect(page.getByRole("heading", { name: titled("Doi") })).toBeVisible({ timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(`/documents/${documentId}$`));
      await expect(page.getByText("v 1", { exact: true })).toBeAttached();
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible();

      // Step 4 — `Trei`: „v 2", „3 versiuni".
      await title.fill(titled("Trei"));
      await save.click();
      await expect(page.getByRole("heading", { name: titled("Trei") })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 2", { exact: true })).toBeAttached();
      await expect(page.getByRole("button", { name: "3 versiuni" })).toBeVisible();

      // Step 5 — „3 versiuni": „v 1", `Doi`, „Salvează" gone, the heading still current.
      await page.getByRole("button", { name: "3 versiuni" }).click();
      await expect(page.getByText("v 1", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(title).toHaveValue(titled("Doi"));
      await expect(save).toHaveCount(0);
      await expect(page.getByRole("heading", { name: titled("Trei") })).toBeVisible();

      // Step 6 — „Versiunea anterioară": „v 0", `Unu`.
      await page.getByRole("button", { name: "Versiunea anterioară" }).click();
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(title).toHaveValue(titled("Unu"));

      // Step 7 — „Fă curentă": the question and its sentence.
      await page.getByRole("button", { name: "Fă curentă" }).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("Faceți această versiune curentă?");
      await expect(dialog).toContainText(
        "Versiunea 0 va fi copiată într-o nouă versiune 3, care devine versiunea curentă. Continuați?",
      );
      await expect(dialog.getByRole("button", { name: "Anulează", exact: true })).toBeVisible();

      // Step 8 — „OK": `Unu`, „v 3", „4 versiuni".
      await dialog.getByRole("button", { name: "OK", exact: true }).click();
      await expect(dialog).toHaveCount(0, { timeout: 15_000 });
      await expect(page.getByRole("heading", { name: titled("Unu") })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 3", { exact: true })).toBeAttached();
      await expect(page.getByRole("button", { name: "4 versiuni" })).toBeVisible();

      // Step 9 — „4 versiuni": „v 2" still reads `Trei`.
      await page.getByRole("button", { name: "4 versiuni" }).click();
      await expect(page.getByText("v 2", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(title).toHaveValue(titled("Trei"));

      // Step 10 — „Acte" reads `DOC…`, „Adeverință", `… Unu`.
      await openFromSidebar(page, "Acte");
      const listed = page.getByRole("row").filter({ hasText: MARK });
      await expect(listed).toHaveCount(1, { timeout: 30_000 });
      await expect(listed).toContainText(titled("Unu"));
      await expect(listed).toContainText("Adeverință");
      await expect(listed).toContainText(/DOC\d+/);

      // ── At the end — „Șterge", „Da" to „Ștergeți actul?" ─────────────────
      await listed.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: titled("Unu") })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Șterge", exact: true }).last().click();
      const confirm = page.getByRole("dialog", { name: "Ștergeți actul?" });
      await confirm.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
      await expect(page.getByRole("row").filter({ hasText: MARK })).toHaveCount(0);
    } finally {
      if (documentId) await removeRecord(page.request, "document", documentId);
    }
  });
});
