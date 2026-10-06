/**
 * Case:   TC-TAG-03 — „Etichete": doar norul se derulează; titlul și cele două butoane rămân la vedere
 * Source: docs/testing/cases/TC-TAG-03.md, „Last green" 2026-10-06
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property and the tags carry `TC-E2E-TAG-03` (records.ts): the tags
 *     are `tc-e2e-tag-03-001` … `-200`.
 *   - Playwright's mouse wheels the cloud to its end and double-clicks; the hand
 *     runs set the box's scroll by script (FU-290).
 *   - Slice #38.19's pictures, not steps of the case: the cloud at the top and
 *     at the bottom of its scroll, at 1366 and 1920 px, into
 *     `playwright-report/tag-cloud-scroll/`.
 */

import fs from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TAG-03`;
const TAG = (n: number) => `${MARK.toLowerCase()}-${String(n).padStart(3, "0")}`;
const LAST = TAG(200);
const SHOTS = "playwright-report/tag-cloud-scroll";

/** Wholly inside the window. */
async function inSight(page: Page, l: Locator): Promise<boolean> {
  const r = await l.boundingBox();
  const h = page.viewportSize()!.height;
  return !!r && r.height > 0 && r.y >= 0 && r.y + r.height <= h;
}

/** The app's content column: where it is scrolled, and how much more it could scroll. */
async function pageScroll(page: Page): Promise<{ top: number; more: number }> {
  return page.locator("[data-tag-cloud-scroll]").evaluate((box) => {
    let s: HTMLElement | null = box.parentElement;
    while (s && !["auto", "scroll"].includes(getComputedStyle(s).overflowY)) s = s.parentElement;
    const el = s ?? (document.scrollingElement as HTMLElement);
    return { top: Math.round(el.scrollTop), more: Math.max(0, Math.round(el.scrollHeight - el.clientHeight)) };
  });
}

async function photograph(page: Page, name: string, toEnd: boolean): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  const box = page.locator("[data-tag-cloud-scroll]");
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: width === 1366 ? 768 : 1080 });
    await page.waitForTimeout(400);
    await box.evaluate((b, end) => { b.scrollTop = end ? b.scrollHeight : 0; }, toEnd);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 768 });
}

test.describe("TC-TAG-03 — doar norul de etichete se derulează", () => {
  test("200 de etichete: norul derulat până la capăt, ultima selectată, „Redenumește etichetă” la vedere", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 768 });
    let propertyId = "";
    try {
      const res = await page.request.post("/api/properties", { data: { nickname: `${MARK} Teren`, provenance: "MANUAL" } });
      expect(res.ok()).toBeTruthy();
      const p = ((await res.json()) as { property: { id: string; principalObjectId: string } }).property;
      propertyId = p.id;
      for (let i = 1; i <= 200; i += 20) {
        const batch = await Promise.all(
          Array.from({ length: 20 }, (_, k) => page.request.post(`/api/metadata/${p.principalObjectId}/tags`, { data: { tag: TAG(i + k) } })),
        );
        for (const r of batch) expect(r.ok()).toBeTruthy();
      }

      // Step 1 — the header and the explanation in sight; the chips' own scroll bar; the page does not scroll.
      await page.goto("/admin/tags");
      const box = page.locator("[data-tag-cloud-scroll]");
      const last = page.locator(`[data-tag-chip="${LAST}"]`);
      await expect(last).toHaveCount(1, { timeout: 30_000 });
      const title = page.getByRole("heading", { name: "Nor de etichete", exact: true });
      const rename = page.getByRole("button", { name: "Redenumește etichetă", exact: true });
      const merge = page.getByRole("button", { name: "Fuzionează etichete", exact: true });
      const note = page.getByText("fără nicio etichetă selectată, ambele sunt inactive.", { exact: false });
      await expect(rename).toBeDisabled();
      await expect(merge).toBeDisabled();
      for (const l of [title, rename, merge, note]) expect(await inSight(page, l)).toBe(true);
      await expect.poll(() => box.evaluate((b) => b.scrollHeight > b.clientHeight + 1), { timeout: 10_000 }).toBe(true);
      expect(await inSight(page, box)).toBe(true);
      expect(await pageScroll(page)).toEqual({ top: 0, more: 0 });
      await photograph(page, "top", false);

      // Step 2 — the wheel over the chips to the end: the last chip in sight; the header still; the page unscrolled.
      await box.evaluate((b) => { b.scrollTop = 0; });
      await box.hover();
      await expect.poll(async () => {
        await page.mouse.wheel(0, 2000);
        return inSight(page, last);
      }, { timeout: 20_000 }).toBe(true);
      expect(await box.evaluate((b) => Math.abs(b.scrollHeight - b.clientHeight - b.scrollTop) <= 2)).toBe(true);
      expect(await box.locator("[data-tag-chip]").last().getAttribute("data-tag-chip")).toBe(LAST);
      for (const l of [title, rename, merge, note]) expect(await inSight(page, l)).toBe(true);
      expect(await pageScroll(page)).toEqual({ top: 0, more: 0 });

      // Step 3 — double-clicked: pressed; „Redenumește etichetă" in sight and active.
      await last.dblclick();
      await expect(last).toHaveAttribute("aria-pressed", "true");
      await expect(rename).toBeEnabled();
      expect(await inSight(page, rename)).toBe(true);
      expect(await pageScroll(page)).toEqual({ top: 0, more: 0 });
      await photograph(page, "bottom-selected", true);

      // Step 4 — the rename box inside the cloud's visible part, the page still; Escape gives the chip back, pressed.
      await rename.click();
      const field = page.getByRole("textbox", { name: `Noul nume pentru „${LAST}”`, exact: true });
      await expect(field).toBeFocused();
      await expect(field).toHaveValue(LAST);
      const [f, b] = await Promise.all([field.boundingBox(), box.boundingBox()]);
      expect(f!.y).toBeGreaterThanOrEqual(b!.y - 1);
      expect(f!.y + f!.height).toBeLessThanOrEqual(b!.y + b!.height + 1);
      expect(await pageScroll(page)).toEqual({ top: 0, more: 0 });
      await page.keyboard.press("Escape");
      await expect(last).toHaveAttribute("aria-pressed", "true");
    } finally {
      if (propertyId) await removeRecord(page.request, "property", propertyId);
    }
  });
});
