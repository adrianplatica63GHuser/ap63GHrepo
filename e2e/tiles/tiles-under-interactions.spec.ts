/**
 * Case:   TC-TILES-22 — O fișă trasă sub „Interacțiuni” rămâne acolo, și după reîncărcare, pe ambele fișe de persoană
 * Source: docs/testing/cases/TC-TILES-22.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-22` (records.ts).
 *   - The window is 2400 px tall, so the whole row is on screen and a drag never scrolls the page.
 *   - Each reading is polled until it holds.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-22`;
const GAP = 16;

type Box = { x: number; y: number; w: number; h: number };

/** A box's rectangle in page px, rounded. */
async function rect(page: Page, selector: string): Promise<Box> {
  const b = await page.locator(selector).first().boundingBox();
  if (!b) throw new Error(`${selector} not on the page`);
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}

const INTER = '[data-tile="interactions"]';
const BAR = "[data-tile-row] [data-packed-col].order-last";

/** Steps 2/5: the left area's second tile dragged by its left padding to „Interacțiuni"'s left edge, 120 px under it. */
async function dropUnder(page: Page): Promise<string> {
  const tile = page.locator("[data-tile-area=left] [data-packed-col][data-tile]").nth(1);
  const name = (await tile.getAttribute("data-tile"))!;
  const r = (await tile.boundingBox())!;
  const i = await rect(page, INTER);
  const px = r.x + 5, py = r.y + 30;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 10, py + 10, { steps: 3 });
  await page.mouse.move(i.x + 5, i.y + i.h + 120, { steps: 12 });
  const free = await page.evaluate(() => document.querySelector<HTMLElement>("[data-tile-outline]")?.dataset.free ?? null);
  await page.mouse.up();
  await page.mouse.move(1, 1);
  expect(free).toBe("true");
  return name;
}

/** Where tile `name` stands against „Interacțiuni": its left edge on it, and how far under its bottom. */
async function under(page: Page, name: string): Promise<{ x: number; below: number }> {
  const t = await rect(page, `[data-tile-area=left] [data-tile="${name}"]`);
  const i = await rect(page, INTER);
  return { x: t.x - i.x, below: t.y - (i.y + i.h) };
}

for (const kind of ["Persoană fizică", "Persoană juridică"] as const) {
  test.describe(`TC-TILES-22 — o fișă trasă sub „Interacțiuni” (${kind})`, () => {
    test("lângă coloană la 1920 și sub fișe la 1366: rămâne sub „Interacțiuni”, și după reîncărcare", async ({ page }) => {
      test.slow();
      await removeLeftovers(page.request, MARK);
      const np = kind === "Persoană fizică";
      const id = np
        ? await createNaturalPerson(page.request, { lastName: `${MARK} Unu`, firstName: "Ion" })
        : await createCompany(page.request, { name: `${MARK} SRL` });
      const entity = np ? "natural-person" : "judicial-person";
      const forget = () => page.evaluate((e) => {
        localStorage.removeItem(`ga40-tile-positions-${e}-v1`);
        localStorage.removeItem(`ga40-tiles-${e}-v1`);
      }, entity);
      const ready = async () => {
        await expect(page.locator(INTER)).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(2500); // past the first layout's settling
      };
      try {
        // Step 1 — 1920: „Interacțiuni" beside the left tiles.
        await page.setViewportSize({ width: 1920, height: 2400 });
        await page.goto(`/${np ? "natural-persons" : "judicial-persons"}/${id}`);
        await forget();
        await page.reload();
        await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
        await ready();
        const left = await rect(page, "[data-tile-area=left]");
        expect((await rect(page, INTER)).x).toBeGreaterThanOrEqual(left.x + left.w);

        // Step 2 — dropped under it: it stays there.
        let name = await dropUnder(page);
        await expect.poll(async () => { const u = await under(page, name); return { x: u.x, under: u.below >= GAP }; }).toEqual({ x: 0, under: true });
        const beside = await under(page, name);

        // Step 3 — after a reload, the same place.
        await page.reload();
        await ready();
        await expect.poll(() => under(page, name), { timeout: 20_000 }).toEqual(beside);

        // Step 4 — 1366, nothing stored: „Interacțiuni" under the left tiles, the bar under it.
        await forget();
        await page.setViewportSize({ width: 1366, height: 2400 });
        await page.reload();
        await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
        await ready();
        const row = await rect(page, "[data-tile-row]");
        await expect.poll(async () => (await rect(page, INTER)).x).toBe(row.x);
        const i4 = await rect(page, INTER);
        expect((await rect(page, BAR)).y).toBeGreaterThanOrEqual(i4.y + i4.h + GAP);

        // Step 5 — dropped under it: it stays there, the bar under it.
        name = await dropUnder(page);
        await expect.poll(async () => { const u = await under(page, name); return { x: u.x, under: u.below >= GAP }; }).toEqual({ x: 0, under: true });
        const wrapped = await under(page, name);
        const t5 = await rect(page, `[data-tile-area=left] [data-tile="${name}"]`);
        expect((await rect(page, BAR)).y).toBeGreaterThanOrEqual(t5.y + t5.h + GAP);

        // Step 6 — after a reload, the same place, and „Interacțiuni" where step 4 had it.
        await page.reload();
        await ready();
        await expect.poll(async () => ({ under: await under(page, name), inter: (await rect(page, INTER)).y }), { timeout: 20_000 }).toEqual({ under: wrapped, inter: i4.y });
      } finally {
        await forget().catch(() => undefined);
        await removeRecord(page.request, "person", id).catch(() => undefined);
      }
    });
  });
}
