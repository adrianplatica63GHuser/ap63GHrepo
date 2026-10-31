/**
 * Case:   TC-TILES-27 — „Legături” lățită pe o persoană are aceeași lățime pe o proprietate, în locul ei; „Implicit” o uită pe amândouă
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

const related = (page: Page) =>
  page.evaluate(() => {
    const tile = document.querySelector('[data-tile="related"]')?.closest<HTMLElement>("[data-packed-col]");
    const r = tile?.getBoundingClientRect();
    return { width: r?.width ?? -1, col: Number(tile?.dataset.packedCol ?? -1) };
  });

async function open(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('[data-tile-handle="related"]')).toBeAttached({ timeout: 30_000 });
}

test.describe("TC-TILES-27 — o lățime pe toate formularele", () => {
  test("Legături widened on a person is as wide on a property, in its own place; „Implicit” puts both back", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let person: string | undefined;
    let property: string | undefined;
    try {
      person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Lățime" });
      property = await createProperty(page.request, { nickname: `${MARK} Teren` });

      // Step 1 — the property's „Legături” as its screen draws it.
      await open(page, `/properties/${property}`);
      const before = await related(page);
      expect(before.width).toBeGreaterThan(0);
      const n = Math.round((before.width + 16) / STEP);
      expect(before.width).toBe(unitsPx(n));

      // Step 2 — on the person, its right edge a third of a unit right, held: the bubble says it is every form's.
      await open(page, `/natural-persons/${person}`);
      expect((await related(page)).width).toBe(unitsPx(n));
      const edge = (await page.locator('[data-tile-handle="related"]').boundingBox())!;
      const x = edge.x + edge.width / 2;
      const y = edge.y + Math.min(30, edge.height / 2);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + STEP / 3, y, { steps: 6 });
      await expect(page.locator('[data-tile-width-note="bubble"]')).toContainText(/Lățimea se aplică panoului .+ pe toate formularele\./);
      await page.mouse.up();
      await expect.poll(async () => (await related(page)).width).toBe(unitsPx(n + 1));

      // Step 3 — the property: the same width, in its own place.
      await open(page, `/properties/${property}`);
      await expect.poll(async () => (await related(page)).width).toBe(unitsPx(n + 1));
      expect((await related(page)).col).toBe(before.col);

      // Step 4 — „Implicit” on the property: back to its own width there, and on the person.
      await pressTileButton(page, "Implicit");
      await expect.poll(async () => (await related(page)).width).toBe(unitsPx(n));
      await open(page, `/natural-persons/${person}`);
      await expect.poll(async () => (await related(page)).width).toBe(unitsPx(n));
    } finally {
      if (person) await removeRecord(page.request, "person", person);
      if (property) await removeRecord(page.request, "property", property);
    }
  });
});
