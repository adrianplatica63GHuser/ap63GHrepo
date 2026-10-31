/**
 * Case:   TC-TILES-26 — Lățimea unei plăci, trasă de marginea dreaptă: se prinde la unități întregi, rămâne după reîncărcare, „Implicit” o uită
 * Source: docs/testing/cases/TC-TILES-26.md, „Last green" 2026-10-31
 *
 * Slice 41.17. On an invented property (created through the route, removed at the end) at 1920 × 1080: the first tile
 * whose handle allows a unit either way and that holds a field box. A third of a unit left is one unit fewer; a third
 * right, twice, one more than it had; a reload keeps it; „Implicit” forgets it; the keyboard steps a unit and Home
 * gives the tile its own width back. The field box keeps its width throughout. 41.18: past its narrowest the drag is
 * refused, and says why; two units past what it needs it is advised against, and taken. The map tile is not drawn (maps are
 * blocked by default): no map, no Street View, no address look-up.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { pressTileButton } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-26`;
const UNIT = 119;
const GAP = 16;
const unitsPx = (n: number) => n * UNIT + (n - 1) * GAP;

/** The row box of tile `id` — the element the packing places — and its first box of a fixed width. */
const measure = (page: Page, id: string) =>
  page.evaluate((id) => {
    const tile = document.querySelector(`[data-tile="${id}"]`)?.closest<HTMLElement>("[data-packed-col]");
    const field = [...(tile?.querySelectorAll<HTMLElement>("[data-width-field]") ?? [])].find((f) => /rem$/.test(f.style.width));
    return { tile: tile?.getBoundingClientRect().width ?? -1, field: field?.getBoundingClientRect().width ?? -1 };
  }, id);

/** 41.18: press the edge and move it `dx` without letting go — the bubble is read while it is held. */
async function holdEdge(page: Page, id: string, dx: number): Promise<void> {
  const box = (await page.locator(`[data-tile-handle="${id}"]`).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(40, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
}

const bubble = (page: Page) => page.locator('[data-tile-width-note="bubble"]');

async function dragEdge(page: Page, id: string, dx: number): Promise<void> {
  const box = (await page.locator(`[data-tile-handle="${id}"]`).boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(40, box.height / 2);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 4 });
  await page.mouse.move(x + dx, y, { steps: 4 });
  await page.mouse.up();
}

test.describe("TC-TILES-26 — lățimea unei plăci", () => {
  test("a dragged right edge snaps to whole units, a reload keeps it, „Implicit” forgets it", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let id: string | undefined;
    try {
      id = await createProperty(page.request, { nickname: `${MARK} Teren` });
      await page.goto(`/properties/${id}`);
      const handles = page.locator("[data-tile-handle]");
      await expect(handles.first()).toBeAttached({ timeout: 30_000 });

      // Step 1 — every tile has its handle, a separator named for it; the first that can go a unit either way.
      const seen: { tile: string; now: number; min: number; max: number; field: number }[] = [];
      for (const h of await handles.all()) {
        await expect(h).toHaveAttribute("role", "separator");
        await expect(h).toHaveAttribute("aria-label", /^Lățimea panoului \S/);
        await h.focus();
        const tile = (await h.getAttribute("data-tile-handle"))!;
        const [now, min, max] = await Promise.all(["aria-valuenow", "aria-valuemin", "aria-valuemax"].map((a) => h.getAttribute(a)));
        seen.push({ tile, now: Number(now), min: Number(min), max: Number(max), field: (await measure(page, tile)).field });
      }
      const pick = seen.find((s) => s.now >= 2 && s.min <= s.now - 1 && s.max >= s.now + 1 && s.field > 0);
      expect(pick, JSON.stringify(seen)).toBeTruthy();
      const tile = pick!.tile;
      const n = pick!.now;
      const before = await measure(page, tile);
      expect(before.tile).toBe(unitsPx(n));

      // Step 2 — a third of a unit left: one unit fewer, the field box as it was.
      await dragEdge(page, tile, -(UNIT + GAP) / 3);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n - 1));
      expect((await measure(page, tile)).field).toBe(before.field);

      // Step 3 — a third right, twice: its own width, then one unit more.
      await dragEdge(page, tile, (UNIT + GAP) / 3);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n));
      await dragEdge(page, tile, (UNIT + GAP) / 3);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      expect((await measure(page, tile)).field).toBe(before.field);
      const kept = await page.evaluate((tile) => {
        for (const k of Object.keys(localStorage).filter((x) => x.startsWith("ga40-tile-positions-"))) {
          const v = JSON.parse(localStorage.getItem(k) ?? "{}")[tile];
          if (v) return v.units ?? null;
        }
        return null;
      }, tile);
      expect(kept).toBe(n + 1);

      // Step 4 — a reload keeps it.
      await page.reload();
      await expect(page.locator(`[data-tile-handle="${tile}"]`)).toBeAttached({ timeout: 30_000 });
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      expect((await measure(page, tile)).field).toBe(before.field);

      // Step 5 — „Implicit” forgets it with the places.
      await pressTileButton(page, "Implicit");
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n));

      // Step 6 — the keyboard: Right one unit more, Home its own width again.
      const handle = page.locator(`[data-tile-handle="${tile}"]`);
      await handle.focus();
      await page.keyboard.press("ArrowRight");
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      await expect(handle).toBeFocused();
      await page.keyboard.press("Home");
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n));
      expect((await measure(page, tile)).field).toBe(before.field);

      // Step 7 (41.18) — two units left, past its narrowest: refused, and why — the edge stops, the width stays there.
      await holdEdge(page, tile, -2 * (UNIT + GAP));
      await expect(bubble(page)).toHaveText(/^Panoul nu poate fi mai îngust de (o unitate|\d+ unități|\d+ de unități): rândul «[^»]+» are nevoie de \d+ px\.$/);
      await expect(bubble(page)).toHaveAttribute("data-verdict", "refused");
      await expect(page.locator('[data-tile-width-note="live"]')).toHaveText(/^Panoul nu poate fi mai îngust/);
      await page.mouse.up();
      await expect(bubble(page)).toHaveCount(0);
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n - 1));

      // Step 8 (41.18) — two units past what it needs: advised against, and taken.
      await holdEdge(page, tile, 2 * (UNIT + GAP));
      await expect(bubble(page)).toHaveText(/Cu 2 unități mai lat decât îi trebuie: rămâne loc gol în dreapta câmpurilor\./);
      await expect(bubble(page)).toHaveAttribute("data-verdict", "advised");
      await page.mouse.up();
      await expect.poll(async () => (await measure(page, tile)).tile).toBe(unitsPx(n + 1));
      expect((await measure(page, tile)).field).toBe(before.field);
    } finally {
      if (id) await removeRecord(page.request, "property", id);
    }
  });
});
