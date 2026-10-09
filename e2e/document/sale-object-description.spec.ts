/**
 * Case:   TC-DOC-22 — „Obiectul vânzării” spune ce se vinde: descrierea compusă din proprietăți, „Recompune” după o schimbare
 * Source: docs/testing/cases/TC-DOC-22.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-22` (records.ts); the properties are linked through the API.
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-22`;

test.describe("TC-DOC-22 — „Descrierea obiectului”", () => {
  test("o proprietate: descrierea ei; a doua legată, „Recompune”: amândouă, în total", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const doc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Contract`);
    const one = await createProperty(page.request, { nickname: `${MARK} Teren 1`, parcela: "34", surfaceAreaMp: 5000 });
    const two = await createProperty(page.request, { nickname: `${MARK} Teren 2`, parcela: "35", surfaceAreaMp: 2400 });
    try {
      const link = async (id: string) => {
        const res = await page.request.post(`/api/documents/${doc}/properties`, { data: { propertyIds: [id] } });
        expect(res.status()).toBe(204);
      };
      await link(one);

      // Step 1 — opened: the empty field shows the one property's description; nothing unsaved.
      await page.goto(`/documents/${doc}`);
      // „Obiectul vânzării" is a tile of the contract's screen (#38.33), not shown by default: ticked here.
      await page.getByRole("checkbox", { name: "Obiectul vânzării", exact: true }).check({ timeout: 30_000 });
      const field = page.getByLabel("Descrierea obiectului", { exact: true });
      await expect(field).toBeVisible();
      await expect(field).toHaveValue(/5\.000 mp, P 34/, { timeout: 30_000 });
      await expect(page.getByText("Modificări nesalvate")).toHaveCount(0);

      // Step 2 — a second property linked, „Recompune": both, summed.
      await link(two);
      await page.getByRole("button", { name: "Recompune", exact: true }).click();
      await expect(field).toHaveValue(/^2 imobile, 7\.400 mp în total/, { timeout: 30_000 });

      // Step 3 — saved, reloaded: the text holds, and it was the one written.
      await page.getByRole("button", { name: /^Salvează/ }).click();
      await page.reload();
      await expect(page.getByLabel("Descrierea obiectului", { exact: true })).toHaveValue(/^2 imobile, 7\.400 mp în total/, { timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "document", doc).catch(() => undefined);
      for (const id of [one, two]) await removeRecord(page.request, "property", id).catch(() => undefined);
    }
  });
});
