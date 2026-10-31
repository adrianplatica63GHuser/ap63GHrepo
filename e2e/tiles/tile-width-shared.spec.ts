/**
 * Case:   TC-TILES-27 — „Adresă” lățită pe o persoană are aceeași lățime pe o proprietate, în locul ei; „Implicit” o uită pe amândouă
 * Source: docs/testing/cases/TC-TILES-27.md, „Last green" 2026-10-31
 *
 * Slice 41.19. An invented person and an invented property (created through the route, removed at the end), at
 * 1920 × 1080. Maps are blocked by default: no map, no Street View, no address look-up.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { pressTileButton } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-27`;
const STEP = 119 + 16;
const unitsPx = (n: number) => n * 119 + (n - 1) * 16;

/** The packed box holding the panel `panel`, and the width handle on its right edge. */
const tileOf = (page: Page, panel: string) =>
  page.evaluate((panel) => {
    const box = document.querySelector(`[data-panel="${panel}"]`)?.closest<HTMLElement>("[data-packed-col]");
    if (!box) return { width: -1, col: -1, handle: null as string | null };
    const r = box.getBoundingClientRect();
    const handle = [...document.querySelectorAll<HTMLElement>("[data-tile-handle]")].find((h) => {
      const x = h.getBoundingClientRect();
      return Math.abs(x.left + x.width / 2 - r.right) < 2 && Math.abs(x.top - r.top) < 2;
    });
    return { width: r.width, col: Number(box.dataset.packedCol), handle: handle?.dataset.tileHandle ?? null };
  }, panel);

// A natural person's home address and a property's address: one shared width (Ask first 3).
const PERSON = "addresses.HOME";
const PROPERTY = "address";

async function open(page: Page, url: string, panel: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator(`[data-panel="${panel}"]`)).toBeVisible({ timeout: 30_000 });
  await expect.poll(async () => (await tileOf(page, panel)).handle, { timeout: 15_000 }).not.toBeNull();
}

test.describe("TC-TILES-27 — o lățime pe toate formularele", () => {
  test("an address tile widened on a person is as wide on a property, in its own place; „Implicit” puts both back", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let person: string | undefined;
    let property: string | undefined;
    try {
      person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Lățime" });
      property = await createProperty(page.request, { nickname: `${MARK} Teren` });

      // Step 1 — the property's address tile as its screen draws it.
      await open(page, `/properties/${property}`, PROPERTY);
      const before = await tileOf(page, PROPERTY);
      const n = Math.round((before.width + 16) / STEP);
      expect(before.width).toBe(unitsPx(n));

      // Step 2 — on the person, its right edge a third of a unit right, held: the bubble says it is every form's.
      await open(page, `/natural-persons/${person}`, PERSON);
      const mine = await tileOf(page, PERSON);
      expect(mine.width).toBe(unitsPx(n));
      const edge = (await page.locator(`[data-tile-handle="${mine.handle}"]`).boundingBox())!;
      const x = edge.x + edge.width / 2;
      const y = edge.y + Math.min(30, edge.height / 2);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + STEP / 3, y, { steps: 6 });
      await expect(page.locator('[data-tile-width-note="bubble"]')).toContainText(/Lățimea se aplică panoului .+ pe toate formularele\./);
      await page.mouse.up();
      await expect.poll(async () => (await tileOf(page, PERSON)).width).toBe(unitsPx(n + 1));

      // Step 3 — the property: the same width, in its own place.
      await open(page, `/properties/${property}`, PROPERTY);
      await expect.poll(async () => (await tileOf(page, PROPERTY)).width).toBe(unitsPx(n + 1));
      expect((await tileOf(page, PROPERTY)).col).toBe(before.col);

      // Step 4 — „Implicit” on the property: back to its own width there, and on the person.
      await pressTileButton(page, "Implicit");
      await expect.poll(async () => (await tileOf(page, PROPERTY)).width).toBe(unitsPx(n));
      await open(page, `/natural-persons/${person}`, PERSON);
      await expect.poll(async () => (await tileOf(page, PERSON)).width).toBe(unitsPx(n));
    } finally {
      if (person) await removeRecord(page.request, "person", person);
      if (property) await removeRecord(page.request, "property", property);
    }
  });
});
