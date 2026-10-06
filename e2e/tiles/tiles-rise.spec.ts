/**
 * Case:   TC-TILES-20 — O fișă trasă sub două fișe urcă sub cea rămasă când una dintre ele nu e afișată
 * Source: docs/testing/cases/TC-TILES-20.md, „Last green" 2026-10-06
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-20` (records.ts).
 *   - Playwright's mouse drags; the hand runs dispatched pointer events from a
 *     script, since the desktop pane's emulated viewport drops clicks
 *     (FU-290). Each reading is polled until it holds.
 *   - A box is ticked or unticked until it STAYS so for a second: a click while
 *     the page hydrates can be undone (helpers/tiles.ts → showTile), and the
 *     second record's untick was measured undone that way (Slice #38.16).
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-20`;
const KEY = "ga40-tile-positions-natural-person-v1";
const CHOICE = "ga40-tiles-natural-person-v1";
const GAP = 16;

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

/** Presses at (`x`, `y`), moves in steps to (`tx`, `ty`), and returns the outline's verdict before releasing. */
async function drag(page: Page, x: number, y: number, tx: number, ty: number): Promise<string | null> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 3 });
  await page.mouse.move(tx, ty, { steps: 12 });
  const free = await page.evaluate(() => document.querySelector<HTMLElement>("[data-tile-outline]")?.dataset.free ?? null);
  await page.mouse.up();
  return free;
}

/** A point in a tile's left padding, half way down its visible part. */
async function padding(tile: Locator): Promise<{ x: number; y: number }> {
  await tile.scrollIntoViewIfNeeded();
  const r = await tile.boundingBox();
  if (!r) throw new Error("tile not on the page");
  return { x: r.x + 5, y: r.y + Math.min(r.height / 2, 120) };
}

test.describe("TC-TILES-20 — o fișă trasă sub două fișe urcă sub cea rămasă", () => {
  test("„Conexiuni” sub „Clasificări” și „Adresă corespondență”; pe al doilea dosar, fără „Clasificări”, sub adrese; înapoi; după reîncărcare", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1300 });
    const first = await createNaturalPerson(page.request, { lastName: `${MARK} Unu`, firstName: "Ion" });
    const second = await createNaturalPerson(page.request, { lastName: `${MARK} Doi`, firstName: "Ana" });
    try {
      await page.goto(`/natural-persons/${first}`);
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });

      // Step 1 — „Toate", „Interacțiuni" unticked: every tile where #37.75 puts it, „Clasificări" at the left edge.
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await setTile(page, "Interacțiuni", false);
      await page.waitForTimeout(2500); // past the first layout's settling
      const rule = await boxes(page);
      expect(rule.classification.x).toBe(0);
      expect(rule.classification.y).toBe(rightUnder(rule, "classification"));

      // Step 2 — one unit right of „Clasificări", 60 px under the lowest other tile in those columns: free; it rises right under „Clasificări".
      const unit = (rule.identity.w + GAP) / 3;
      const x0 = rule.classification.x + unit;
      const x1 = x0 + rule.connections.w;
      const spanned = Object.entries(rule).filter(([id, b]) => id !== "connections" && b.x < x1 && x0 < b.x + b.w);
      expect(spanned.map(([id]) => id)).toEqual(expect.arrayContaining(["classification", "addresses.CORRESPONDENCE"]));
      const y0 = Math.max(...spanned.map(([, b]) => b.y + b.h)) + 60;
      const conn = region("Conexiuni");
      const p = await padding(conn);
      const [r0, row] = await Promise.all([conn.boundingBox(), page.locator("[data-tile-row]").boundingBox()]);
      const tx = (row?.x ?? 0) + x0 + (p.x - (r0?.x ?? 0));
      const ty = (row?.y ?? 0) + y0 + (p.y - (r0?.y ?? 0));
      expect(await drag(page, p.x, p.y, tx, ty)).toBe("true");
      const underClassification = rule.classification.y + rule.classification.h + GAP;
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.connections.x, y: now.connections.y };
      }).toEqual({ x: Math.round(x0), y: underClassification });
      const dropped = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "connections")) expect({ id, box: dropped[id] }).toEqual({ id, box: rule[id] });

      // Step 3 — the second record, „Clasificări" unticked: „Conexiuni" keeps its left edge, right under the tiles left in its columns.
      await page.goto(`/natural-persons/${second}`);
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      await setTile(page, "Clasificări", false);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.connections.x, gap: now.connections.y - rightUnder(now, "connections"), classification: "classification" in now };
      }, { timeout: 20_000 }).toEqual({ x: dropped.connections.x, gap: 0, classification: false });
      const left = await boxes(page);
      expect(left.connections.y).toBeLessThan(dropped.connections.y); // it rose: no empty space above it

      // Step 4 — „Clasificări" ticked again: where step 1 had it, and „Conexiuni" right under it again.
      await setTile(page, "Clasificări", true);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { cx: now.classification?.x, cy: now.classification?.y, x: now.connections.x, under: now.classification ? now.connections.y - (now.classification.y + now.classification.h + GAP) : null };
      }, { timeout: 20_000 }).toEqual({ cx: rule.classification.x, cy: rule.classification.y, x: dropped.connections.x, under: 0 });
      const back = await boxes(page);

      // Step 5 — after a reload, where step 4 had it.
      await page.reload();
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => {
        const now = await boxes(page);
        return now.connections ? { x: now.connections.x, y: now.connections.y } : null;
      }, { timeout: 20_000 }).toEqual({ x: back.connections.x, y: back.connections.y });
    } finally {
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]).catch(() => undefined);
      await removeRecord(page.request, "person", first);
      await removeRecord(page.request, "person", second);
    }
  });
});
