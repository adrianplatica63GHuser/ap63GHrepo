/**
 * Case:   TC-TILES-20 — O fișă trasă sub două fișe urcă sub cea rămasă când una dintre ele nu e afișată
 * Source: docs/testing/cases/TC-TILES-20.md, „Last green" 2026-10-08
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

/** Presses at (`x`, `y`), moves in steps to (`tx`, `ty`), and returns the outline's verdict and place in the row before releasing. */
async function drag(page: Page, x: number, y: number, tx: number, ty: number): Promise<{ free: string | null; x: number; y: number }> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 3 });
  await page.mouse.move(tx, ty, { steps: 12 });
  const out = await page.evaluate(() => {
    const o = document.querySelector<HTMLElement>("[data-tile-outline]");
    return { free: o?.dataset.free ?? null, x: Math.round(parseFloat(o?.style.left ?? "NaN")), y: Math.round(parseFloat(o?.style.top ?? "NaN")) };
  });
  await page.mouse.up();
  return out;
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
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      await setTile(page, "Interacțiuni", false);
      await page.waitForTimeout(2500); // past the first layout's settling
      const rule = await boxes(page);
      expect(rule.classification.x).toBe(0);
      expect(rule.classification.y).toBe(rightUnder(rule, "classification"));

      // Step 2 — one unit right of „Clasificări", 60 px under the lowest other tile in those columns: free; released, it stays
      // where the outline showed it (#38.45 — it no longer „rises right under „Clasificări"", as #38.16 had it).
      const unit = (rule.identity.w + GAP) / 3;
      const x0 = rule.classification.x + unit;
      const x1 = x0 + rule.connections.w;
      const spanned = Object.entries(rule).filter(([id, b]) => id !== "connections" && b.x < x1 && x0 < b.x + b.w);
      expect(spanned.map(([id]) => id)).toEqual(expect.arrayContaining(["classification", "addresses.CORRESPONDENCE"]));
      const y0 = Math.max(...spanned.map(([, b]) => b.y + b.h)) + 60;
      const conn = region("Etichete și grupuri");
      const p = await padding(conn);
      const [r0, row] = await Promise.all([conn.boundingBox(), page.locator("[data-tile-row]").boundingBox()]);
      const tx = (row?.x ?? 0) + x0 + (p.x - (r0?.x ?? 0));
      const ty = (row?.y ?? 0) + y0 + (p.y - (r0?.y ?? 0));
      const outline = await drag(page, p.x, p.y, tx, ty);
      expect(outline.free).toBe("true");
      expect(outline.x).toBe(Math.round(x0));
      const underClassification = rule.classification.y + rule.classification.h + GAP;
      // Where it lands: the pointer near the window's bottom scrolls the page until the release, so it may land lower
      // than the outline read above — but never risen: a rise would put it exactly PANEL_GAP under „Clasificări".
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.connections.x, below: now.connections.y >= Math.min(outline.y, underClassification + 40) };
      }).toEqual({ x: Math.round(x0), below: true });
      await page.waitForTimeout(500);
      const dropped = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "connections")) expect({ id, box: dropped[id] }).toEqual({ id, box: rule[id] });
      // The space the user left between „Clasificări" and „Conexiuni".
      const space = dropped.connections.y - underClassification;
      expect(space).toBeGreaterThan(GAP);

      // Step 3 — the second record, „Clasificări" unticked: „Conexiuni" keeps its left edge, and rises only by what
      // „Clasificări" gave up — the same space above it, under the tiles left in its columns (#38.45; #38.16 closed it).
      await page.goto(`/natural-persons/${second}`);
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(1500);
      await setTile(page, "Clasificare", false);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.connections.x, space: Math.abs(now.connections.y - rightUnder(now, "connections") - space) <= 1, classification: "classification" in now };
      }, { timeout: 20_000 }).toEqual({ x: dropped.connections.x, space: true, classification: false });
      const left = await boxes(page);
      expect(left.connections.y).toBeLessThan(dropped.connections.y); // it rose by what „Clasificări" gave up

      // Step 4 — „Clasificări" ticked again: where step 1 had it, and „Conexiuni" where step 2 left it.
      await setTile(page, "Clasificare", true);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { cx: now.classification?.x, cy: now.classification?.y, x: now.connections.x, y: Math.abs(now.connections.y - dropped.connections.y) <= 1 };
      }, { timeout: 20_000 }).toEqual({ cx: rule.classification.x, cy: rule.classification.y, x: dropped.connections.x, y: true });
      const back = await boxes(page);

      // Step 5 — after a reload, where step 4 had it.
      await page.reload();
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
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
