/**
 * Case:   TC-TILES-13 — O fișă trasă de spațiul ei gol într-un loc liber rămâne acolo; peste altă fișă nu se poate
 * Source: docs/testing/cases/TC-TILES-13.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The record carries `TC-E2E-TILES-13` (records.ts).
 *   - Playwright's mouse drags; the hand run dispatched pointer events from a
 *     script, since the desktop pane's emulated viewport drops clicks
 *     (FU-290). Each reading is polled until it holds.
 *   - The browser's stored arrangement is its own profile's; the spec clears
 *     it first, as the case's „Before you start" asks.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-13`;
const KEY = "ga40-tile-positions-natural-person-v1";

type Box = { x: number; y: number; w: number; h: number };

/** Every packed box of the row: its tile (or panel) and its rectangle relative to the row, rounded — the page scrolls in a pane, not the window. */
async function boxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const out: Record<string, Box> = {};
    for (const e of document.querySelectorAll<HTMLElement>("[data-tile-row] [data-packed-col]")) {
      if (e.classList.contains("order-last")) continue;
      const r = e.getBoundingClientRect();
      out[e.dataset.tile ?? e.dataset.panel ?? "?"] = { x: Math.round(r.left - row.left), y: Math.round(r.top - row.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  });
}

/** Presses at (`x`, `y`) — page coordinates of the viewport — moves in steps to (`tx`, `ty`), and returns the outline's verdict before releasing. */
async function drag(page: Page, x: number, y: number, tx: number, ty: number): Promise<string | null> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 10, y + 10, { steps: 3 });
  await page.mouse.move(tx, ty, { steps: 12 });
  // Read without waiting: no outline at all (a press that starts no drag) reads as null.
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

test.describe("TC-TILES-13 — o fișă trasă de spațiul ei gol", () => {
  test("„Conexiuni” sub „Corelate”; refuzat peste „Corelate”; un câmp nu trage; după reîncărcare; „Implicit”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1300 });
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    try {
      await page.goto(`/natural-persons/${person}`);
      await page.evaluate((k) => localStorage.removeItem(k), KEY);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });

      // Step 1 — „Toate": every tile, each where #37.75 puts it.
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await expect(region("Corelate")).toContainText("Nimic corelat încă.", { timeout: 30_000 });
      await page.waitForTimeout(2500); // past the first layout's settling
      const rule = await boxes(page);

      // Step 2 — „Conexiuni" by its padding, to under „Corelate": it stays there, nothing else moves.
      const conn = region("Conexiuni");
      const p = await padding(conn);
      await page.mouse.move(p.x, p.y);
      await expect.poll(() => conn.evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");
      const related = rule.related;
      const [r0, rr] = await Promise.all([conn.boundingBox(), region("Corelate").boundingBox()]);
      // The tile's top-left corner to 60 px under „Corelate", on its left edge; the pointer keeps its place in the tile.
      const tx = (rr?.x ?? 0) + (p.x - (r0?.x ?? 0));
      const ty = (rr?.y ?? 0) + (rr?.height ?? 0) + 60 + (p.y - (r0?.y ?? 0));
      expect(await drag(page, p.x, p.y, tx, ty)).toBe("true");
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.connections.x, belowRelated: now.connections.y >= related.y + related.h + 16 };
      }).toEqual({ x: related.x, belowRelated: true });
      const dropped = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "connections")) expect({ id, box: dropped[id] }).toEqual({ id, box: rule[id] });

      // Step 3 — onto „Corelate": the outline says not free; released, it goes back.
      const q = await padding(conn);
      const onto = await region("Corelate").boundingBox();
      expect(await drag(page, q.x, q.y, (onto?.x ?? 0) + 20, (onto?.y ?? 0) + 20)).toBe("false");
      await expect.poll(async () => (await boxes(page)).connections).toEqual(dropped.connections);

      // Step 4 — a press on a field, or on a label, starts no drag; the field takes focus.
      const nume = region("Identitate").getByLabel("Nume", { exact: true });
      const f = await nume.boundingBox();
      await page.mouse.move((f?.x ?? 0) + 10, (f?.y ?? 0) + 5);
      await page.mouse.down();
      await page.mouse.move((f?.x ?? 0) + 200, (f?.y ?? 0) + 150, { steps: 8 });
      await expect(page.locator("[data-tile-outline]")).toHaveCount(0);
      await page.mouse.up();
      await expect(nume).toBeFocused();
      const label = region("Identitate").locator("label", { hasText: /^Nume$/ }).first();
      const l = await label.boundingBox();
      expect(await drag(page, (l?.x ?? 0) + 4, (l?.y ?? 0) + 4, (l?.x ?? 0) + 300, (l?.y ?? 0) + 200)).toBeNull();
      expect((await boxes(page)).identity).toEqual(rule.identity);

      // Step 5 — after a reload the arrangement holds.
      await page.reload();
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => (await boxes(page)).connections, { timeout: 20_000 }).toEqual(dropped.connections);

      // Step 6 — „Implicit", then „Toate": #37.75's places again.
      await page.getByRole("button", { name: "Implicit", exact: true }).click();
      await expect(region("Conexiuni")).toBeHidden();
      await page.getByRole("button", { name: "Toate", exact: true }).click();
      await expect(region("Conexiuni")).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => (await boxes(page)).connections, { timeout: 20_000 }).toEqual(rule.connections);
      expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), KEY).catch(() => undefined);
      await removeRecord(page.request, "person", person);
    }
  });
});
