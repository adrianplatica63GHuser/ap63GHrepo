/**
 * Case:   TC-TILES-21 — Un dublu-clic pe o fișă o urcă sub fișa de deasupra; o fișă trasă lasă locul gol
 * Source: docs/testing/cases/TC-TILES-21.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The record carries `TC-E2E-TILES-21` (records.ts).
 *   - Playwright's mouse drags and double-clicks. Each reading is polled until it holds.
 *   - A box is ticked or unticked until it STAYS so for a second (tiles-rise.spec.ts → setTile).
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-21`;
const KEY = "ga40-tile-positions-natural-person-v1";
const CHOICE = "ga40-tiles-natural-person-v1";
const GAP = 16;
const CORR = "addresses.CORRESPONDENCE";

type Box = { x: number; y: number; w: number; h: number };

/** Every packed box of the row that is on screen: its tile (or panel) and its rectangle relative to the row, rounded. */
async function boxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const out: Record<string, Box> = {};
    for (const e of document.querySelectorAll<HTMLElement>("[data-tile-row] [data-packed-col]")) {
      if (e.classList.contains("order-last") || e.offsetParent === null) continue;
      const r = e.getBoundingClientRect();
      out[e.dataset.tile ?? e.dataset.panel ?? "?"] = { x: Math.round(r.left - row.left), y: Math.round(r.top - row.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  });
}

/** „Right under": the lowest bottom of the other boxes above `id` in its columns, plus PANEL_GAP (or the row's top). */
function rightUnder(all: Record<string, Box>, id: string): number {
  const me = all[id];
  const above = Object.entries(all).filter(([k, b]) => k !== id && b.x < me.x + me.w && me.x < b.x + b.w && b.y < me.y);
  return above.length ? Math.max(...above.map(([, b]) => b.y + b.h)) + GAP : 0;
}

/** Ticked or unticked, and still so a second later. */
async function setTile(page: Page, name: string, on: boolean): Promise<void> {
  const box = tileBox(page, name);
  const region = page.getByRole("region", { name, exact: true });
  await expect(async () => {
    if ((await box.isChecked()) !== on) await box.click();
    if (on) await expect(region).toBeVisible({ timeout: 2_000 });
    else await expect(region).toBeHidden({ timeout: 2_000 });
    await page.waitForTimeout(1_000);
    expect(await box.isChecked()).toBe(on);
    expect(await region.isVisible()).toBe(on);
  }).toPass({ timeout: 30_000 });
}

/** A point in a box's left padding, half way down its visible part. */
async function padding(box: Locator): Promise<{ x: number; y: number }> {
  await box.scrollIntoViewIfNeeded();
  const r = await box.boundingBox();
  if (!r) throw new Error("box not on the page");
  return { x: r.x + 5, y: r.y + Math.min(r.height / 2, 120) };
}

test.describe("TC-TILES-21 — un dublu-clic urcă o fișă; o fișă trasă lasă locul gol", () => {
  test("„Act de identitate” trasă sub „Corelate”; „Adresă corespondență” rămâne, apoi urcă la dublu-clic; după reîncărcare", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1300 });
    const person = await createNaturalPerson(page.request, { lastName: `${MARK} Unu`, firstName: "Ion" });
    try {
      await page.goto(`/natural-persons/${person}`);
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });
      const corr = page.locator(`[data-tile-row] [data-packed-col][data-panel="${CORR}"]`);

      // Step 1 — „Toate", „Interacțiuni" unticked: „Adresă corespondență" right under „Act de identitate".
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      await setTile(page, "Interacțiuni", false);
      await page.waitForTimeout(2500); // past the first layout's settling
      const rule = await boxes(page);
      expect(rule[CORR].x).toBe(rule.idCard.x);
      expect(rule[CORR].y).toBe(rule.idCard.y + rule.idCard.h + GAP);

      // Step 2 — „Act de identitate" dragged to „Corelate"'s left edge, 60 px under it: it stays there; nothing else moves.
      const card = region("Act de identitate");
      const p = await padding(card);
      const [r0, row] = await Promise.all([card.boundingBox(), page.locator("[data-tile-row]").boundingBox()]);
      const tx = (row?.x ?? 0) + rule.related.x + (p.x - (r0?.x ?? 0));
      const ty = (row?.y ?? 0) + rule.related.y + rule.related.h + 60 + (p.y - (r0?.y ?? 0));
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 10, p.y + 10, { steps: 3 });
      await page.mouse.move(tx, ty, { steps: 12 });
      const outline = await page.evaluate(() => {
        const o = document.querySelector<HTMLElement>("[data-tile-outline]");
        return { free: o?.dataset.free ?? null, x: Math.round(parseFloat(o?.style.left ?? "NaN")), y: Math.round(parseFloat(o?.style.top ?? "NaN")) };
      });
      await page.mouse.up();
      expect(outline.free).toBe("true");
      expect(outline.x).toBe(rule.related.x);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.idCard.x, y: Math.abs(now.idCard.y - outline.y) <= 1 };
      }).toEqual({ x: rule.related.x, y: true });
      const dropped = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "idCard")) expect({ id, box: dropped[id] }).toEqual({ id, box: rule[id] });
      expect(dropped[CORR].y).toBeGreaterThan(rightUnder(dropped, CORR)); // the space „Act de identitate" left stays empty

      // Step 3 — a double-click on „Adresă corespondență"'s left padding: it rises right under the lowest tile above it.
      const q = await padding(corr);
      await page.mouse.dblclick(q.x, q.y);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now[CORR].x, under: now[CORR].y - rightUnder(now, CORR) };
      }).toEqual({ x: dropped[CORR].x, under: 0 });
      const risen = await boxes(page);
      expect(risen[CORR].y).toBeLessThan(dropped[CORR].y);
      for (const id of Object.keys(dropped).filter((k) => k !== CORR)) expect({ id, box: risen[id] }).toEqual({ id, box: dropped[id] });

      // Step 4 — again: nothing moves.
      const q2 = await padding(corr);
      await page.mouse.dblclick(q2.x, q2.y);
      await page.waitForTimeout(500);
      expect(await boxes(page)).toEqual(risen);

      // Step 5 — after a reload, both places hold.
      await page.reload();
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => {
        const now = await boxes(page);
        return now.idCard && now[CORR] ? { card: [now.idCard.x, now.idCard.y], corr: [now[CORR].x, now[CORR].y] } : null;
      }, { timeout: 20_000 }).toEqual({ card: [risen.idCard.x, risen.idCard.y], corr: [risen[CORR].x, risen[CORR].y] });
    } finally {
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]).catch(() => undefined);
      await removeRecord(page.request, "person", person);
    }
  });
});
