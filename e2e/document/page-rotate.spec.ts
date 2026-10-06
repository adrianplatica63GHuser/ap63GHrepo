/**
 * Case:   TC-DOC-17 — „Pagini": pagina rotită la dreapta și rotirea salvată
 * Source: docs/testing/cases/TC-DOC-17.md, „Last green" 2026-10-06
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-17` (records.ts).
 *   - „The arrow points up / right / down / left" is read as the turn the
 *     viewer draws the image at (`data-rotation`, 0 / 90 / 180 / 270) — what
 *     the hand run read too — plus the turned picture's rectangle: wider than
 *     tall at 0° and 180°, taller than wide at 90°, and inside the viewer.
 *   - Step 4 waits for the save's answer before step 5 reloads (the hand run waited 1.5 s).
 *   - Pictures for Slice #38.17's handover go to playwright-report/page-rotate.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-17`;
const PAGE_FILE = path.join(process.cwd(), "e2e", "fixtures", "tc-e2e-pagina-peisaj.png");
const SHOTS = "playwright-report/page-rotate";

/** The page's image in a viewer, its turn, and whether the turned picture lies inside the viewer's box. */
async function drawn(viewer: Locator): Promise<{ rotation: string | null; wide: boolean; inside: boolean }> {
  return viewer.evaluate((box) => {
    const img = box.querySelector<HTMLImageElement>("img[data-rotation]");
    if (!img) return { rotation: null, wide: false, inside: false };
    const r = img.getBoundingClientRect();
    const b = box.getBoundingClientRect();
    return {
      rotation: img.dataset.rotation ?? null,
      wide: r.width > r.height,
      inside: r.width > 50 && r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1,
    };
  });
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1200 });
    await page.waitForTimeout(400);
    // Synthetic data only in pictures: the signed-in name and „Recente" are painted over.
    await page.screenshot({
      path: `${SHOTS}/${name}-${width}.png`,
      mask: [
        page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
        page.locator("aside").getByText(/^Autentificat ca/),
      ],
    });
  }
  await page.setViewportSize({ width: 1920, height: 1200 });
}

test.describe("TC-DOC-17 — pagina rotită la dreapta", () => {
  test("rotită de două ori, salvată, după reîncărcare și în „Pagini extinse”; o rotire nesalvată se pierde", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
    const docId = await createSaleContract(page.request, `${MARK} Act`);
    try {
      const up = await page.request.post(`/api/documents/${docId}/pages`, {
        multipart: { file: { name: "tc-e2e-pagina-peisaj.png", mimeType: "image/png", buffer: fs.readFileSync(PAGE_FILE) }, pageNumber: "1" },
      });
      expect(up.ok()).toBeTruthy();

      // Step 1 — the page as stored; „Rotește la dreapta" enabled, „Salvează rotirea" disabled.
      await page.goto(`/documents/${docId}`);
      const pages = page.getByRole("region", { name: "Pagini", exact: true }).first();
      const viewer = pages.locator(".min-h-\\[320px\\]").first();
      const rotate = page.getByRole("button", { name: "Rotește la dreapta", exact: true });
      const save = page.getByRole("button", { name: "Salvează rotirea", exact: true });
      await expect(rotate).toBeEnabled({ timeout: 30_000 });
      await expect(save).toBeDisabled();
      await expect.poll(() => drawn(viewer), { timeout: 20_000 }).toEqual({ rotation: "0", wide: true, inside: true });
      await shot(page, "before-tile");

      // Step 2 — a quarter turn: the arrow to the right, taller than wide, fitted; „Salvează rotirea" enabled.
      await rotate.click();
      await expect.poll(() => drawn(viewer), { timeout: 10_000 }).toEqual({ rotation: "90", wide: false, inside: true });
      await expect(save).toBeEnabled();

      // Step 3 — again: the arrow down, wider than tall, fitted.
      await rotate.click();
      await expect.poll(() => drawn(viewer), { timeout: 10_000 }).toEqual({ rotation: "180", wide: true, inside: true });

      // Step 4 — „Salvează rotirea": disabled again.
      // The button is disabled while the PATCH is in flight too, so the reload below waits for the
      // answer, not only for the button — a reload sooner would abort the save.
      const saved = page.waitForResponse((r) => r.request().method() === "PATCH" && /\/pages\//.test(r.url()));
      await save.click();
      expect((await saved).ok()).toBeTruthy();
      await expect(save).toBeDisabled({ timeout: 10_000 });

      // Step 5 — after a reload the page opens turned 180°.
      await page.reload();
      await expect(rotate).toBeEnabled({ timeout: 30_000 });
      await expect.poll(() => drawn(viewer), { timeout: 20_000 }).toEqual({ rotation: "180", wide: true, inside: true });
      await expect(save).toBeDisabled();
      await shot(page, "after-tile");

      // Step 6 — „Pagini extinse": the tall column draws it turned 180°, fitted.
      await page.getByRole("button", { name: "Pagini extinse", exact: true }).click();
      const big = page.locator(".h-full.w-full.overflow-hidden.rounded-md").filter({ has: page.locator("img[data-rotation]") }).first();
      await expect.poll(() => drawn(big), { timeout: 20_000 }).toEqual({ rotation: "180", wide: true, inside: true });
      await shot(page, "after-big");
      await page.getByRole("button", { name: "Restrânge", exact: true }).first().click();

      // Step 7 — a turn not saved is dropped by the next visit, without a question.
      await expect(rotate).toBeEnabled({ timeout: 10_000 });
      await rotate.click();
      await expect.poll(() => drawn(viewer), { timeout: 10_000 }).toMatchObject({ rotation: "270" });
      await expect(save).toBeEnabled();
      let asked = false;
      page.on("dialog", (d) => {
        asked = true;
        void d.dismiss();
      });
      await page.reload();
      await expect(rotate).toBeEnabled({ timeout: 30_000 });
      await expect.poll(() => drawn(viewer), { timeout: 20_000 }).toEqual({ rotation: "180", wide: true, inside: true });
      expect(asked).toBe(false);
    } finally {
      await removeRecord(page.request, "document", docId);
    }
  });
});
