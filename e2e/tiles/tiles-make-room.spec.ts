/**
 * Case:   TC-TILES-24 — O fișă ținută peste alta îi face loc: fișa de dedesubt alunecă în jos, la primul loc liber
 * Source: docs/testing/cases/TC-TILES-24.md, „Last green" 2026-10-19
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-24` (records.ts).
 *   - Playwright's mouse drags and holds; the hold is 1,5 s, past the built-in
 *     1,0 s delay (MAKE_ROOM_DELAY_MS). Each reading is polled until it holds,
 *     so the 200-ms slide has ended before a place is read.
 *   - Which tiles the outline overlaps is computed from the places read in step
 *     1 and the outline's own rectangle, not written down.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-24`;
const KEY = "ga40-tile-positions-natural-person-v1";
const CHOICE = "ga40-tiles-natural-person-v1";
const GROUP_KEY = "ga40-tile-positions-admin-group-v1";
const GAP = 16;
/** Past the make-room delay, 1,0 s (39.91). */
const HOLD_MS = 1_500;

type Box = { x: number; y: number; w: number; h: number };

/** Every packed box of the row that is on screen, relative to the row, rounded; the dragged one is skipped while it moves. */
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

/** The drag outline: its verdict and its rectangle in the row. */
async function outline(page: Page): Promise<{ free: string | null } & Box> {
  return page.evaluate(() => {
    const o = document.querySelector<HTMLElement>("[data-tile-outline]");
    const n = (v: string | undefined) => Math.round(parseFloat(v ?? "NaN"));
    return { free: o?.dataset.free ?? null, x: n(o?.style.left), y: n(o?.style.top), w: n(o?.style.width), h: n(o?.style.height) };
  });
}

/** Do two rectangles share a column and come within PANEL_GAP of each other down the screen? */
function near(a: Box, b: Box): boolean {
  const across = a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1;
  return across && !(b.y >= a.y + a.h + GAP || a.y >= b.y + b.h + GAP);
}

/** A point in a box's left padding, half way down its visible part. */
async function padding(box: Locator): Promise<{ x: number; y: number }> {
  await box.scrollIntoViewIfNeeded();
  const r = await box.boundingBox();
  if (!r) throw new Error("box not on the page");
  return { x: r.x + 5, y: r.y + Math.min(r.height / 2, 120) };
}

/**
 * Presses at `p` inside `tile` and moves until the tile's top-left corner is at `target` (row
 * coordinates), then holds still for HOLD_MS. The button stays down: the caller releases or presses Esc.
 */
async function holdOver(page: Page, tile: Locator, p: { x: number; y: number }, target: { x: number; y: number }): Promise<void> {
  const [r0, row] = await Promise.all([tile.boundingBox(), page.locator("[data-tile-row]").boundingBox()]);
  const tx = (row?.x ?? 0) + target.x + (p.x - (r0?.x ?? 0));
  const ty = (row?.y ?? 0) + target.y + (p.y - (r0?.y ?? 0));
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 10, p.y + 10, { steps: 3 });
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.waitForTimeout(HOLD_MS);
}

test.describe("TC-TILES-24 — o fișă ținută peste alta îi face loc", () => {
  test("persoană fizică: „Act de identitate” ținută peste „Corelate”; lăsată; după reîncărcare; Esc pune totul înapoi", async ({ page }) => {
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

      // Step 1 — „Toate", „Interacțiuni" and „Arbore de moștenire" unticked: every tile where #37.75 places it.
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      await hideTile(page, "Interacțiuni");
      await hideTile(page, "Arbore de moștenire");
      await page.waitForTimeout(2500); // past the first layout's settling
      const rule = await boxes(page);
      expect(rule.related).toBeDefined();
      expect(rule.idCard).toBeDefined();

      // Step 2 — „Act de identitate" dragged until its top-left corner is at „Corelate"'s, and held: „Corelate" slides down out of its way.
      const card = region("Act de identitate");
      await holdOver(page, card, await padding(card), { x: rule.related.x, y: rule.related.y });
      await expect.poll(async () => (await outline(page)).free, { timeout: 5_000 }).toBe("true");
      const o = await outline(page);
      expect(o.x).toBe(rule.related.x);
      const under = Object.keys(rule).filter((id) => id !== "idCard" && near(rule[id], o));
      expect(under).toContain("related");
      // Settled: each tile that made room straight down, clear of the outline; every other tile where step 1 had it.
      await expect.poll(async () => {
        const now = await boxes(page);
        return under.every((id) => now[id].x === rule[id].x && now[id].y > rule[id].y && !near(now[id], o));
      }, { timeout: 5_000 }).toBe(true);
      const held = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "idCard" && !under.includes(k))) expect({ id, box: held[id] }).toEqual({ id, box: rule[id] });

      // Released: „Act de identitate" where the outline was; the tiles that made room stay where they slid.
      await page.mouse.up();
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.idCard.x, y: Math.abs(now.idCard.y - o.y) <= 1 };
      }).toEqual({ x: o.x, y: true });
      const dropped = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "idCard")) expect({ id, box: dropped[id] }).toEqual({ id, box: held[id] });

      // Step 3 — after a reload, both places hold.
      await page.reload();
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      const placeOf = (b: Record<string, Box>) => Object.fromEntries(["idCard", ...under].map((id) => [id, b[id] ? [b[id].x, b[id].y] : null]));
      await expect.poll(async () => placeOf(await boxes(page)), { timeout: 20_000 }).toEqual(placeOf(dropped));
      await page.waitForTimeout(2500); // past the settling
      const reloaded = await boxes(page);

      // Step 4 — „Act de identitate" held over „Identitate"; a tile makes room; Esc: every tile back where step 3 had it.
      const target = reloaded.identity;
      await holdOver(page, card, await padding(card), { x: target.x, y: target.y });
      await expect.poll(async () => (await outline(page)).free, { timeout: 5_000 }).toBe("true");
      await expect.poll(async () => {
        const now = await boxes(page);
        return Object.keys(reloaded).some((id) => id !== "idCard" && now[id] && now[id].y > reloaded[id].y);
      }, { timeout: 5_000 }).toBe(true);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect.poll(async () => JSON.stringify(await boxes(page)), { timeout: 5_000 }).toBe(JSON.stringify(reloaded));
    } finally {
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]).catch(() => undefined);
      await removeRecord(page.request, "person", person);
    }
  });

  test("ecranul unui grup (TileUnitRow): „Deja în grup” ținută peste „Membri disponibili…”; lăsată; după reîncărcare", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeGroupLeftovers(page.request, MARK);
    const ids: string[] = [];
    let groupId = "";
    try {
      const g = await page.request.post("/api/groups", { data: { targetType: "PROPERTY", description: `${MARK} Grup de test` } });
      expect(g.status()).toBe(201);
      groupId = ((await g.json()) as { id: string }).id;
      for (const n of ["A", "B"]) {
        const id = await createProperty(page.request, { nickname: `${MARK} Teren ${n}` });
        ids.push(id);
        const refs = (await (await page.request.get(`/api/properties/${id}/entity-references`)).json()) as { principalObjectId: string };
        expect((await page.request.post(`/api/metadata/${refs.principalObjectId}/groups`, { data: { groupId } })).ok()).toBeTruthy();
      }
      await page.setViewportSize({ width: 1920, height: 1000 });
      await page.goto(`/admin/groups/${groupId}`);
      await page.evaluate((k) => localStorage.removeItem(k), GROUP_KEY);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });
      const inGroup = region("Deja în grup");
      const available = region("Membri disponibili pentru includere");

      // Step 5 — „Deja în grup" by its bottom bar, its top-left corner to „Membri disponibili…"'s, held: that one slides down.
      await expect(inGroup.getByText(`${MARK} Teren B`)).toBeVisible({ timeout: 30_000 });
      await page.waitForTimeout(2500);
      const rule = await boxes(page);
      const bar = await inGroup.locator(":scope > div").last().boundingBox();
      if (!bar) throw new Error("„Deja în grup” has no bar on the page");
      await holdOver(page, inGroup, { x: bar.x + 4, y: bar.y + 4 }, { x: rule.available.x, y: rule.available.y });
      await expect.poll(async () => (await outline(page)).free, { timeout: 5_000 }).toBe("true");
      const o = await outline(page);
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.available.x, clear: now.available.y >= o.y + o.h + GAP - 1 };
      }, { timeout: 5_000 }).toEqual({ x: rule.available.x, clear: true });
      await page.mouse.up();
      await expect.poll(async () => { const b = (await boxes(page))["in-group"]; return { x: b.x, y: b.y }; }).toEqual({ x: o.x, y: o.y });
      const dropped = await boxes(page);
      expect(dropped.identity).toEqual(rule.identity);
      await expect(available).toBeVisible();

      // Step 6 — after a reload, both places hold.
      await page.reload();
      await expect(inGroup).toBeVisible({ timeout: 30_000 });
      const two = (b: Record<string, Box>) => ({ in: b["in-group"] && [b["in-group"].x, b["in-group"].y], av: b.available && [b.available.x, b.available.y] });
      await expect.poll(async () => two(await boxes(page)), { timeout: 20_000 }).toEqual(two(dropped));
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), GROUP_KEY).catch(() => undefined);
      if (groupId) await page.request.delete(`/api/groups/${groupId}`);
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
