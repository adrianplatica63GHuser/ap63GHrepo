/**
 * Case:   TC-LAYOUT-08 — O coloană trasă de nume în banda gri: rândurile o urmează, ordinea rămâne, „Ordinea implicită” o pune la loc
 * Source: docs/testing/cases/TC-LAYOUT-08.md, „Last green" 2026-10-21
 *
 * A translation of the case file, step for step (Slice 40.25). The columns are chosen by writing each list's stored
 * choice before the page loads, as TC-LAYOUT-05 does. Only the band and the cells' boxes are read — no record's text.
 */
import { test, expect, type Page } from "../helpers/test";

const heads = (page: Page) => page.locator("main thead th[data-col-drag]").evaluateAll((ths) => ths.map((t) => (t as HTMLElement).dataset.colDrag));
const head = (page: Page, key: string) => page.locator(`main thead th[data-col-drag="${key}"]`);

/** A drag with the mouse, in small steps, from a name cell's middle to `x`. */
async function dragTo(page: Page, key: string, x: number, release = true) {
  const box = (await head(page, key).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i++) await page.mouse.move(box.x + box.width / 2 + ((x - box.x - box.width / 2) * i) / steps, box.y + box.height / 2);
  if (release) await page.mouse.up();
}
/** The middle of the boundary after `key`'s cell. */
const rightEdge = async (page: Page, key: string) => {
  const b = (await head(page, key).boundingBox())!;
  return b.x + b.width - 2;
};

test.describe("TC-LAYOUT-08 — o coloană mutată de nume", () => {
  test("Proprietăți: trasă, păstrată, pusă la loc; de la tastatură; Escape", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("tc-layout-08")) return;
      sessionStorage.setItem("tc-layout-08", "1");
      localStorage.setItem("ga40-col-property-v4", JSON.stringify(["tarlaSola", "parcela", "propertyType"]));
      localStorage.removeItem("ga40-colorder-property-v1");
    });
    await page.goto("/properties");
    // 40.47: a row of the list's own, not the „Se încarcă…" row, which a slow first answer leaves on screen (it read
    // `main tbody tr` first, visible).
    await expect(page.locator("main tbody tr td[data-col]").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => heads(page), { timeout: 10_000 }).toEqual(["nickname", "tarlaSola", "parcela", "propertyType"]);

    // Step 1 — Poreclă dragged two places right, past Parcelă: the band and the rows in the new order.
    await dragTo(page, "nickname", await rightEdge(page, "parcela"));
    await expect.poll(() => heads(page)).toEqual(["tarlaSola", "parcela", "nickname", "propertyType"]);
    const lined = await page.evaluate(() => {
      const th = document.querySelector<HTMLElement>('main thead th[data-col-drag="nickname"]')!.getBoundingClientRect();
      const td = document.querySelector<HTMLElement>('main tbody tr td[data-col="nickname"]')!.getBoundingClientRect();
      return Math.abs(th.left - td.left) <= 1 && Math.abs(th.width - td.width) <= 1;
    });
    expect(lined).toBe(true);
    await expect(page.locator("[data-column-order-said]")).toHaveText("Coloana Poreclă, a 3-a din 4");

    // Step 2 — a reload keeps it.
    await page.reload();
    await expect(page.locator("main tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => heads(page), { timeout: 10_000 }).toEqual(["tarlaSola", "parcela", "nickname", "propertyType"]);

    // Step 3 — „Ordinea implicită", the last line of „Câmpuri afișate": the default order, and the line gone.
    await page.locator("main").getByRole("button", { name: /^Câmpuri afișate \d\/4$/ }).click();
    await page.locator("[data-reset-order]").getByRole("button", { name: "Ordinea implicită" }).click();
    await expect.poll(() => heads(page)).toEqual(["nickname", "tarlaSola", "parcela", "propertyType"]);
    await expect(page.locator("[data-reset-order]")).toHaveCount(0);
    await page.getByRole("heading", { level: 1 }).first().click();

    // Step 4 — from the keyboard: Alt+→ twice, then Alt+←; the focus stays on the cell, the place said aloud.
    await head(page, "nickname").focus();
    await page.keyboard.press("Alt+ArrowRight");
    await page.keyboard.press("Alt+ArrowRight");
    await expect.poll(() => heads(page)).toEqual(["tarlaSola", "parcela", "nickname", "propertyType"]);
    await page.keyboard.press("Alt+ArrowLeft");
    await expect.poll(() => heads(page)).toEqual(["tarlaSola", "nickname", "parcela", "propertyType"]);
    await expect(head(page, "nickname")).toBeFocused();
    await expect(page.locator("[data-column-order-said]")).toHaveText("Coloana Poreclă, a 2-a din 4");

    // Step 5 — a drag cancelled with Escape, and one dropped far below the band: nothing moves.
    await dragTo(page, "tarlaSola", await rightEdge(page, "propertyType"), false);
    await expect(page.locator("[data-column-drop-line]")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(page.locator("[data-column-ghost]")).toHaveCount(0);
    const b = (await head(page, "tarlaSola").boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 60, b.y + 300, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => heads(page)).toEqual(["tarlaSola", "nickname", "parcela", "propertyType"]);
  });

  test("Acte: o coloană trasă; un clic pe pâlnie deschide filtrul, fără să mute nimic", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.addInitScript(() => {
      if (sessionStorage.getItem("tc-layout-08")) return;
      sessionStorage.setItem("tc-layout-08", "1");
      localStorage.setItem("ga40-col-document-v3", JSON.stringify(["nrDocument", "dateDocument", "pageCount"]));
      localStorage.removeItem("ga40-colorder-document-v1");
    });
    await page.goto("/documents");
    await expect(page.locator("main tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => heads(page), { timeout: 10_000 }).toEqual(["type", "title", "nrDocument", "dateDocument", "pageCount"]);

    // Step 6 — #Document two places right, past Pagini.
    await dragTo(page, "nrDocument", await rightEdge(page, "pageCount"));
    await expect.poll(() => heads(page)).toEqual(["type", "title", "dateDocument", "pageCount", "nrDocument"]);

    // Step 7 — the funnel under „Data", pressed: its filter opens; the order is as it was.
    await head(page, "dateDocument").locator("[data-head-funnel] button").click();
    await expect(page.locator('[data-filter-editor="dateDocument"]')).toBeVisible({ timeout: 10_000 });
    expect(await heads(page)).toEqual(["type", "title", "dateDocument", "pageCount", "nrDocument"]);
  });
});
