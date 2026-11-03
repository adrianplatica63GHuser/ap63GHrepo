/**
 * Case:   TC-TILES-28 — Textele la trecerea mouse-ului apar în bula butoanelor-icon, la mărimea lor, pe mai multe rânduri
 * Source: docs/testing/cases/TC-TILES-28.md, „Last green" 2026-11-02
 *
 * Slice 41.46. An invented person (created through the route, removed at the end), at 1920 × 1080. Maps are blocked
 * by default: no map, no Street View, no address look-up.
 */
import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { emptyFieldsLink } from "../helpers/empty-fields";

const MARK = `${E2E_MARKER}TILES-28`;

type Bubble = { fontSize: string; fontWeight: string; lineHeight: number; width: number; height: number; text: string; textPx: number };

/** The open bubble (`selector`): its type, its box, and how wide its text would be on one line. */
async function bubble(page: Page, selector: string): Promise<Bubble> {
  const tip = page.locator(selector);
  await expect(tip).toHaveCount(1, { timeout: 10_000 });
  return tip.evaluate((el) => {
    const cs = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const r = el.getBoundingClientRect();
    return {
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      lineHeight: parseFloat(cs.lineHeight),
      width: r.width,
      height: r.height,
      text: el.textContent ?? "",
      textPx: ctx.measureText(el.textContent ?? "").width,
    };
  });
}

async function hover(page: Page, target: Locator): Promise<void> {
  await page.mouse.move(0, 0);
  await target.hover();
}

test.describe("TC-TILES-28 — o singură bulă, la mărimea butoanelor", () => {
  test("a cut subtitle and „Arată N câmpuri goale” open the icon buttons' bubble, its size, wrapping", async ({ page }) => {
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let person: string | undefined;
    try {
      person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Bulă", personalPhone2: "0700 000 002" });
      await page.goto(`/natural-persons/${person}`);
      const contact = page.locator('[data-panel="contact"]');
      await expect(contact).toBeVisible({ timeout: 30_000 });

      // Step 1 — an icon button's hint: the size every other bubble is held to.
      const edit = contact.locator("[data-tile-title-action] button").first();
      await expect(edit).toBeVisible({ timeout: 30_000 });
      await hover(page, edit);
      const model = await bubble(page, "[data-icon-tooltip]");
      expect(model.fontSize).toBe("12px");

      // Step 2 — a subtitle that fits says nothing; cut short, it opens the same bubble with its whole text.
      const subtitle = contact.locator("[data-tile-subtitle]");
      const whole = await subtitle.getAttribute("data-hint");
      expect(whole).toBeTruthy();
      await expect(subtitle).not.toHaveAttribute("title");
      await subtitle.evaluate((el) => {
        el.style.minWidth = "0";
        el.style.width = "40px";
      });
      await hover(page, subtitle);
      const cut = await bubble(page, "[data-text-tooltip]");
      expect([cut.fontSize, cut.fontWeight, cut.text]).toEqual([model.fontSize, model.fontWeight, whole]);
      await page.keyboard.press("Escape");
      await expect(page.locator("[data-text-tooltip]")).toHaveCount(0);

      // Step 3 — „Arată N câmpuri goale” and its grey names: the same bubble, always; a long one wraps at 320 px.
      const link = emptyFieldsLink(contact, "contact");
      await expect(link).toBeVisible({ timeout: 30_000 });
      await expect(link).not.toHaveAttribute("title");
      await expect(link).toHaveAttribute("data-hint", /^Câmpuri goale: /);
      await hover(page, link);
      const all = await bubble(page, "[data-text-tooltip]");
      expect([all.fontSize, all.fontWeight]).toEqual([model.fontSize, model.fontWeight]);
      expect(all.text).toBe(await link.getAttribute("data-hint"));
      expect(all.width).toBeLessThanOrEqual(320.5);
      // Wider than the bubble's 304 px of text room on one line → more than one line.
      if (all.textPx > 304) expect(all.height).toBeGreaterThan(all.lineHeight * 1.5);
      await hover(page, contact.locator("[data-empty-fields-names]"));
      const names = await bubble(page, "[data-text-tooltip]");
      expect([names.fontSize, names.fontWeight]).toEqual([model.fontSize, model.fontWeight]);
    } finally {
      if (person) await removeRecord(page.request, "person", person);
    }
  });
});
