/**
 * Case:   TC-TILES-10 — „Conexiuni": etichete mici, „×" doar la mouse sau la focalizare
 * Source: docs/testing/cases/TC-TILES-10.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person carries `TC-E2E-TILES-10` (records.ts); the tags are the
 *     case's own, prefixed `tc-e2e-tiles-10` so a hand run and the spec never
 *     share one.
 *   - „Drawn" is read as the „×" wrapper's computed opacity — Playwright counts
 *     a transparent element as visible.
 *   - Step 3 reaches the „×" with `focus()`, the same focus Tab gives, since
 *     how many Tab presses lead there depends on the rest of the page.
 */

import { test, expect, type Locator } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-10`;
const TAGS = ["tc-e2e-tiles-10 arendă", "tc-e2e-tiles-10 moștenire", "tc-e2e-tiles-10 litigiu"];

async function opacity(remove: Locator): Promise<number> {
  return Number(await remove.evaluate((b) => getComputedStyle(b.parentElement as HTMLElement).opacity));
}

async function boxes(chips: Locator): Promise<string> {
  const all = await chips.evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  }));
  return JSON.stringify(all);
}

test.describe("TC-TILES-10 — etichete mici, „×” doar la mouse sau la focalizare", () => {
  test("trei etichete: niciun „×” în repaus, „×” la mouse și la focalizare, fără mișcare, și eliminarea", async ({ page }) => {
    test.slow();
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    try {
      const refs = (await (await page.request.get(`/api/people/${person}/entity-references`)).json()) as { principalObjectId: string };
      for (const tag of TAGS) {
        const res = await page.request.post(`/api/metadata/${refs.principalObjectId}/tags`, { data: { tag } });
        expect(res.ok()).toBeTruthy();
      }

      // Step 1 — three chips, no „×" drawn, padding 4–8 px every side.
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/natural-persons/${person}?tab=metadata`);
      const con = page.getByRole("region", { name: "Conexiuni", exact: true });
      const chips = con.locator("[data-tag-chip]");
      await expect(chips).toHaveText(TAGS, { timeout: 30_000 });
      // In view first, so the hovers below never scroll and every box is read from one place.
      await chips.nth(1).scrollIntoViewIfNeeded();
      await page.mouse.move(2, 2);
      const removes = TAGS.map((t) => con.getByRole("button", { name: `Elimină eticheta ${t}`, exact: true }));
      for (const r of removes) await expect.poll(() => opacity(r)).toBe(0);
      for (const pad of await chips.evaluateAll((els) => els.map((e) => {
        const s = getComputedStyle(e);
        return [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft].map((v) => parseFloat(v));
      }))) {
        for (const v of pad) {
          expect(v).toBeGreaterThanOrEqual(4);
          expect(v).toBeLessThanOrEqual(8);
        }
      }
      const atRest = await boxes(chips);

      // Step 2 — the mouse on „moștenire": its „×" over the top-right corner, the others not; nothing moved.
      await chips.nth(1).hover();
      await expect.poll(() => opacity(removes[1])).toBe(1);
      expect(await opacity(removes[0])).toBe(0);
      expect(await opacity(removes[2])).toBe(0);
      const x = await removes[1].boundingBox();
      const c = await chips.nth(1).boundingBox();
      expect(x!.x + x!.width).toBeGreaterThan(c!.x + c!.width - 4);
      expect(x!.y).toBeLessThan(c!.y + 4);
      expect(await boxes(chips)).toBe(atRest);

      // Step 3 — away, then focus on that „×": drawn while focused; nothing moved.
      await page.mouse.move(2, 2);
      await expect.poll(() => opacity(removes[1])).toBe(0);
      await removes[1].focus();
      await expect.poll(() => opacity(removes[1])).toBe(1);
      expect(await boxes(chips)).toBe(atRest);

      // Step 4 — the click removes „moștenire"; the other two stay.
      await chips.nth(1).hover();
      await removes[1].click();
      await expect(chips).toHaveText([TAGS[0], TAGS[2]], { timeout: 15_000 });
    } finally {
      await removeRecord(page.request, "person", person);
    }
  });
});
