/**
 * Case:   TC-TILES-25 — Un dreptunghi din harta fișelor se trage ca fișa lui: cele de dedesubt alunecă, fișa se mută
 * Source: docs/testing/cases/TC-TILES-25.md, „Last green" 2026-10-24
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-25` (records.ts).
 *   - Playwright's mouse drags and holds; the hold is the delay saved in „Setări" (39.92, `tile_make_room_delay`, read
 *     through the API) plus 0,75 s, and never under 1,5 s, as TC-TILES-24's spec holds. The red rim before the hold is
 *     read only when the saved delay is at least 0,8 s — under it the rim may have gone before it can be read.
 *   - „On „Corelate"'s place" is read as the outline's left edge on „Corelate"'s and its top within 24 px of it: the
 *     pointer's whole pixels in a diagram a twentieth of the screen's size, then the 8-px row step.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile, openTiles, pressTileButton } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-25`;
const KEY = "ga40-tile-positions-natural-person-v1";
const CHOICE = "ga40-tiles-natural-person-v1";
const GAP = 16;

type Box = { x: number; y: number; w: number; h: number };

async function delayOf(page: Page): Promise<number> {
  const res = await page.request.get("/api/time-frames");
  const items = res.ok() ? ((await res.json()) as { items: { key: string; value: number }[] }).items : [];
  return items.find((i) => i.key === "tile_make_room_delay")?.value ?? 1_000;
}

/** Every packed box of the row that is on screen, relative to the row, rounded. */
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

/** Every rectangle of the diagram, on the page (fractional), and the one being dragged with its verdict. */
async function rects(page: Page): Promise<{ at: Record<string, Box>; dragged: { id: string; how: string } | null }> {
  return page.evaluate(() => {
    const at: Record<string, Box> = {};
    let dragged: { id: string; how: string } | null = null;
    for (const e of document.querySelectorAll<HTMLElement>("[data-tiles-diagram] [data-diagram-rect]")) {
      const r = e.getBoundingClientRect();
      at[e.dataset.diagramRect!] = { x: r.left, y: r.top, w: r.width, h: r.height };
      if (e.dataset.diagramDragged) dragged = { id: e.dataset.diagramRect!, how: e.dataset.diagramDragged };
    }
    return { at, dragged };
  });
}

/** The drag outline on the screen: its verdict and its rectangle in the row. */
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

/**
 * Presses inside rectangle `id` of the diagram and moves until its top-left corner is at `target`'s (page px). The
 * button stays down: the caller holds, releases or presses Esc.
 */
async function dragRect(page: Page, id: string, target: Box): Promise<void> {
  const { at } = await rects(page);
  const r = at[id];
  if (!r) throw new Error(`no rectangle for ${id} in the diagram`);
  const p = { x: r.x + Math.min(2, r.w / 2), y: r.y + Math.min(2, r.h / 2) };
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 4, p.y + 4, { steps: 2 });
  await page.mouse.move(target.x + (p.x - r.x), target.y + (p.y - r.y), { steps: 10 });
}

test.describe("TC-TILES-25 — un dreptunghi din harta fișelor se trage ca fișa lui", () => {
  test("persoană fizică: „Acte de identitate” trasă în hartă peste „Corelate”; lăsată; după reîncărcare; Esc, o eliberare afară și un clic nu mută nimic", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1300 });
    const person = await createNaturalPerson(page.request, { lastName: `${MARK} Unu`, firstName: "Ion" });
    const delay = await delayOf(page);
    const HOLD_MS = Math.max(1_500, delay + 750);
    try {
      await page.goto(`/natural-persons/${person}`);
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });

      // Step 1 — „Toate", „Interacțiuni" and „Arbore de moștenire" unticked: every tile where #37.75 places it; the diagram.
      await pressTileButton(page, "Toate", { timeout: 30_000 });
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      await hideTile(page, "Interacțiuni");
      await hideTile(page, "Arbore de moștenire");
      await page.waitForTimeout(2500); // past the first layout's settling
      await openTiles(page); // 40.57: the diagram is in the „Panouri" panel
      await expect(page.locator("[data-tiles-diagram]")).toHaveAttribute("data-room", "yes", { timeout: 15_000 });
      const rule = await boxes(page);
      expect(rule.related).toBeDefined();
      expect(rule.idCard).toBeDefined();
      const r0 = await rects(page);
      expect(r0.at.related).toBeDefined();
      expect(r0.at.idCard).toBeDefined();
      expect(r0.dragged).toBeNull();

      // Step 2 — „Acte de identitate"'s rectangle laid on „Corelate"'s: the tile moves with it, the outline on „Corelate".
      await dragRect(page, "idCard", r0.at.related);
      const first = await outline(page);
      expect(first.x).toBe(rule.related.x);
      expect(Math.abs(first.y - rule.related.y)).toBeLessThanOrEqual(24);
      expect((await boxes(page)).idCard).not.toEqual(rule.idCard);
      if (delay >= 800) {
        expect(first.free).toBe("false");
        expect((await rects(page)).dragged).toEqual({ id: "idCard", how: "refused" });
      }
      // Held: „Corelate" slides down on the screen and in the diagram; the outline turns free, the rim goes.
      await page.waitForTimeout(HOLD_MS);
      await expect.poll(async () => (await outline(page)).free, { timeout: 5_000 }).toBe("true");
      const o = await outline(page);
      const under = Object.keys(rule).filter((id) => id !== "idCard" && near(rule[id], o));
      expect(under).toContain("related");
      await expect.poll(async () => {
        const now = await boxes(page);
        return under.every((id) => now[id].x === rule[id].x && now[id].y > rule[id].y && !near(now[id], o));
      }, { timeout: 5_000 }).toBe(true);
      await expect.poll(async () => {
        const d = await rects(page);
        return { slid: d.at.related.y > r0.at.related.y + 0.5, dragged: d.dragged };
      }, { timeout: 5_000 }).toEqual({ slid: true, dragged: { id: "idCard", how: "free" } });
      const held = await boxes(page);

      // Released, inside the diagram: „Acte de identitate" where the outline was; „Corelate" where it slid; redrawn.
      await page.mouse.up();
      await expect.poll(async () => {
        const now = await boxes(page);
        return { x: now.idCard.x, y: Math.abs(now.idCard.y - o.y) <= 1 };
      }).toEqual({ x: o.x, y: true });
      const dropped = await boxes(page);
      for (const id of Object.keys(rule).filter((k) => k !== "idCard")) expect({ id, box: dropped[id] }).toEqual({ id, box: held[id] });
      await expect.poll(async () => {
        const d = await rects(page);
        return { dragged: d.dragged, across: Math.abs(d.at.idCard.x - r0.at.related.x) < 1 };
      }, { timeout: 5_000 }).toEqual({ dragged: null, across: true });

      // Step 3 — after a reload, both places hold.
      await page.reload();
      await expect(region("Etichete și grupuri")).toBeVisible({ timeout: 30_000 });
      const placeOf = (b: Record<string, Box>) => Object.fromEntries(["idCard", ...under].map((id) => [id, b[id] ? [b[id].x, b[id].y] : null]));
      await expect.poll(async () => placeOf(await boxes(page)), { timeout: 20_000 }).toEqual(placeOf(dropped));
      await page.waitForTimeout(2500); // past the settling
      const reloaded = await boxes(page);
      await openTiles(page); // 40.57: the diagram is in the „Panouri" panel
      await expect(page.locator("[data-tiles-diagram]")).toHaveAttribute("data-room", "yes", { timeout: 15_000 });

      // Step 4 — dragged over „Identitate"'s rectangle; a tile makes room; Esc: every tile back where step 3 had it.
      const r3 = await rects(page);
      expect(r3.at.identity).toBeDefined();
      await dragRect(page, "idCard", r3.at.identity);
      await page.waitForTimeout(HOLD_MS);
      await expect.poll(async () => {
        const now = await boxes(page);
        return Object.keys(reloaded).some((id) => id !== "idCard" && now[id] && now[id].y > reloaded[id].y);
      }, { timeout: 5_000 }).toBe(true);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect.poll(async () => JSON.stringify(await boxes(page)), { timeout: 5_000 }).toBe(JSON.stringify(reloaded));
      await expect.poll(async () => (await rects(page)).dragged, { timeout: 5_000 }).toBeNull();

      // Step 5 — over „Identitate"'s again, then well below the diagram, released there: everything back.
      await dragRect(page, "idCard", r3.at.identity);
      const dg = await page.locator("[data-tiles-diagram]").boundingBox();
      if (!dg) throw new Error("the diagram has no box");
      await page.mouse.move(dg.x + dg.width / 2, dg.y + dg.height + 200, { steps: 6 });
      await page.mouse.up();
      await expect.poll(async () => JSON.stringify(await boxes(page)), { timeout: 5_000 }).toBe(JSON.stringify(reloaded));

      // Step 6 — a click on „Identitate"'s rectangle: nothing moves.
      const r5 = await rects(page);
      await page.mouse.click(r5.at.identity.x + Math.min(2, r5.at.identity.w / 2), r5.at.identity.y + Math.min(2, r5.at.identity.h / 2));
      await page.waitForTimeout(500);
      expect(JSON.stringify(await boxes(page))).toBe(JSON.stringify(reloaded));
    } finally {
      await page.evaluate(([k, c]) => {
        localStorage.removeItem(k);
        localStorage.removeItem(c);
      }, [KEY, CHOICE]).catch(() => undefined);
      await removeRecord(page.request, "person", person);
    }
  });
});
