/**
 * Case:   TC-DOC-13 — Un tip fără formular: fără „Descoperire AI”; superuserul vede unde se face formularul, nu pe o carte de identitate
 * Source: docs/testing/cases/TC-DOC-13.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-13` (records.ts).
 *   - Step 4 clicks the link with Playwright's real mouse, which finds the
 *     words; the hand run's pane needed the link's own `click()`.
 *   - Step 3 opens `/documents/new` directly, the address „Adaugă act" leads to.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, documentTypeIdFor, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-13`;
const LINE = "Acest tip nu are încă formular; formularul se construiește în Distilare Tipizate.";

async function typeField(page: Page) {
  const field = page.getByLabel(/^Tip document/);
  await expect(field).not.toHaveValue("", { timeout: 30_000 });
  return field;
}

test.describe("TC-DOC-13 — un tip fără formular, fără „Descoperire AI”", () => {
  test("superuserul vede unde se face formularul; cartea de identitate nu", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await removeLeftovers(page.request, MARK);
    const certificate = await createDocumentOfType(page.request, "CERTIFICAT_MOSTENITOR", `${MARK} Certificat`);
    let card: string | undefined;
    try {
      card = await createDocumentOfType(page.request, "CARTE_IDENTITATE", `${MARK} Carte de identitate`);
      const certificateType = await documentTypeIdFor(page.request, "CERTIFICAT_MOSTENITOR");

      // Step 1 — „TC-DOC-13 Certificat": the line, its link, no button, not the old sentence.
      await page.goto(`/documents/${certificate}`);
      await typeField(page);
      await expect(page.getByText(LINE)).toBeVisible({ timeout: 30_000 });
      const link = page.getByRole("link", { name: "Distilare Tipizate", exact: true });
      await expect(link).toHaveAttribute("href", `/admin/doc-type-engine?type=${certificateType}`);
      await expect(page.getByRole("button", { name: "Descoperire AI" })).toHaveCount(0);
      await expect(page.getByText("Acest tip de document nu are formular propriu", { exact: false })).toHaveCount(0);

      // Step 2 — the identity card: nothing under „Tip document", no button.
      await page.goto(`/documents/${card}`);
      const cardType = await typeField(page);
      await expect(cardType.locator("option:checked")).toHaveText("Carte de Identitate");
      await expect(cardType).not.toHaveAttribute("aria-describedby", /.+/);
      await expect(page.getByText(LINE)).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Descoperire AI" })).toHaveCount(0);

      // Step 3 — „Adaugă act", „Certificat de Moștenitor": the same line, no button.
      await page.goto("/documents/new");
      await page.getByLabel(/^Tip document/).selectOption({ label: "Certificat de Moștenitor" });
      await expect(page.getByText(LINE)).toBeVisible();
      await expect(page.getByRole("button", { name: "Descoperire AI" })).toHaveCount(0);

      // Step 4 — back on the certificate, „Distilare Tipizate" opens the engine on that type.
      // „Leaves without saving": the browser's leave-page question is answered yes.
      page.on("dialog", (dialog) => void dialog.accept());
      await page.goto(`/documents/${certificate}`, { waitUntil: "commit" });
      await typeField(page);
      await page.getByRole("link", { name: "Distilare Tipizate", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/doc-type-engine\\?type=${certificateType}$`), { timeout: 30_000 });
      await expect(page.getByLabel("Tipul de document care primește formularul").locator("option:checked"))
        .toHaveText("Certificat de Moștenitor", { timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "document", certificate);
      if (card) await removeRecord(page.request, "document", card);
    }
  });
});
