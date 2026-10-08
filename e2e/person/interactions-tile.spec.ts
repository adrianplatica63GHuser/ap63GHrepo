/**
 * Case:   TC-PERS-07 — „Interacțiuni”, o fișă fixă la dreapta pe persoane; prima fișă a persoanei juridice se numește „Identitate”
 * Source: docs/testing/cases/TC-PERS-07.md, „Last green" 2026-10-08 (step 2 follows Slice #38.06, step 4 #38.46)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PERS-07` (records.ts).
 *   - The sizes are compared with the document's „Pagini" as measured in this
 *     run, not with the case's 640 × 420 written as numbers alone; both are asserted.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile, tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-07`;
const PURPLE = "rgb(246, 240, 254)";
const RIM = "rgb(218, 203, 238)";
const TEXT = "Modulul de gestionare a interacțiunilor va fi dezvoltat în viitor.";

async function size(l: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const r = await l.boundingBox();
  return { x: Math.round(r?.x ?? -1), y: Math.round(r?.y ?? -1), w: Math.round(r?.width ?? -1), h: Math.round(r?.height ?? -1) };
}
/**
 * FU-312: a tile's place once it holds still — the same box read twice, 500 ms apart. The document's
 * „Pagini" was read once, right after it became visible, and was caught at y 109 and 155 while the
 * screen above it was still settling (164 once settled), so the person's tile, polled, never matched.
 */
async function settledSize(l: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  let last = await size(l);
  for (let i = 0; i < 40; i++) {
    await l.page().waitForTimeout(500);
    const now = await size(l);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
}
const clearChoices = (page: Page) =>
  page.evaluate(() => { localStorage.removeItem("ga40-tiles-natural-person-v1"); localStorage.removeItem("ga40-tiles-judicial-person-v1"); });

test.describe("TC-PERS-07 — „Interacțiuni” pe cele două fișe de persoană", () => {
  test("fixă la dreapta, cât „Pagini”, mov; debifată dispare; la 1366 sub formular; „Identitate” pe persoana juridică", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const np = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const jp = await createCompany(page.request, { name: `${MARK} SRL` });
    const doc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Act`);
    try {
      await page.setViewportSize({ width: 1920, height: 1080 });
      // Step 1 — the document's „Pagini", no page: 640 × 436 (420 before #38.30's subtitle line).
      await page.goto(`/documents/${doc}`);
      const pages = page.locator('[data-tile="pages"]');
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Nicio pagină adăugată")).toBeVisible({ timeout: 30_000 });
      const pages1920 = await settledSize(pages);
      // 420 px in the pane, 422 on the runner's server before #38.30; + the 16 px subtitle line. Within 4 px is „Pagini"'s height.
      expect(pages1920.w).toBe(640);
      expect(Math.abs(pages1920.h - 436)).toBeLessThanOrEqual(4);

      // Step 2 — the person: the last box ticked in the purple strip; the tile at „Pagini"'s size and place.
      await page.goto(`/natural-persons/${np}`);
      await clearChoices(page);
      await page.reload();
      // Slice #38.30: not ticked by default any more („off by default until it is built") — tick it.
      const tile = page.getByRole("region", { name: "Interacțiuni", exact: true });
      await expect(tileBox(page, "Interacțiuni")).not.toBeChecked({ timeout: 30_000 });
      await expect(tile).toHaveCount(0);
      await showTile(page, "Interacțiuni");
      await expect(tile).toBeVisible({ timeout: 30_000 });
      const boxes = page.locator("[data-tile-selector] label");
      await expect(boxes.last()).toHaveText("Interacțiuni");
      await expect(page.locator('[data-tile-group="fixed"] label')).toHaveText(["Interacțiuni"]);
      expect(await page.locator('[data-tile-group="fixed"]').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PURPLE);
      await expect(tile).toContainText(TEXT);
      // Slice #38.06: the sentence in italics and in parentheses.
      const note = tile.locator("[data-interactions-note]");
      await expect(note).toHaveText(`(${TEXT})`);
      await expect(note).toHaveCSS("font-style", "italic");
      expect(await tile.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopColor])).toEqual([PURPLE, RIM]);
      await expect.poll(async () => {
        const s = await size(tile);
        return { x: s.x, y: s.y, w: s.w, hClose: Math.abs(s.h - pages1920.h) <= 4 };
      }, { timeout: 15_000 }).toEqual({ x: pages1920.x, y: pages1920.y, w: pages1920.w, hClose: true });

      // Step 3 — unticked, the tile and the column go; ticked, it is back.
      await tileBox(page, "Interacțiuni").click();
      await expect(tile).toHaveCount(0);
      await expect(page.locator('[data-tile-area="right"]')).toBeHidden();
      await tileBox(page, "Interacțiuni").click();
      await expect(tile).toBeVisible();

      // Step 4 — 1366: under the left tiles, the action bar under it (#38.46 — it read „under the left area", which
      // was the column wrapped as a line of its own, outside the packing), still „Pagini"'s size, purple.
      await page.setViewportSize({ width: 1366, height: 1080 });
      await expect.poll(async () => {
        const t = await size(tile);
        const bottoms = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-tile-area="left"] [data-packed-col]')]
          .filter((e) => !e.classList.contains("order-last")).map((e) => e.getBoundingClientRect().bottom));
        const bar = await size(page.locator("[data-tile-row] [data-packed-col].order-last"));
        return { underTiles: t.y >= Math.max(...bottoms), barUnder: bar.y >= t.y + t.h };
      }, { timeout: 15_000 }).toEqual({ underTiles: true, barUnder: true });
      const at1366 = await size(tile);
      expect(at1366.w).toBe(640);
      expect(Math.abs(at1366.h - pages1920.h)).toBeLessThanOrEqual(4);
      expect(await tile.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PURPLE);

      // Step 5 — the company: „Identitate" first, „Interacțiuni" at the right, the same size.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/judicial-persons/${jp}`);
      await expect(page.getByRole("region", { name: "Interacțiuni", exact: true })).toBeVisible({ timeout: 30_000 });
      // Slice #38.30: „Date de înregistrare" (was „Identitate"), „Reprezentanți și contact"; the Judicial Person keeps „Interacțiuni" ticked.
      await expect(boxes).toHaveText(["Date de înregistrare", "Reprezentanți și contact", "Adrese", "Legături", "Clasificare", "Etichete și grupuri", "Interacțiuni"]);
      await expect(page.locator('[data-panel="identity"] h2').first()).toContainText("Date de înregistrare");
      const jpTile = await size(page.getByRole("region", { name: "Interacțiuni", exact: true }));
      expect({ x: jpTile.x, y: jpTile.y, w: jpTile.w, hClose: Math.abs(jpTile.h - pages1920.h) <= 4 }).toEqual({ x: pages1920.x, y: pages1920.y, w: pages1920.w, hClose: true });
    } finally {
      await clearChoices(page).catch(() => undefined);
      await removeRecord(page.request, "person", np);
      await removeRecord(page.request, "company", jp);
      await removeRecord(page.request, "document", doc);
    }
  });
});
