/**
 * Case:   TC-STAMP-02 — Aplicarea unei ștampile: patru fișe cu nume în două coloane, trase ca pe formulare
 * Source: docs/testing/cases/TC-STAMP-02.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The stamp and the persons carry `TC-E2E-STAMP-02` (records.ts); the
 *     `finally` removes the stamp through DELETE /api/stamps/[id] even when an
 *     assertion failed first (`removeStampLeftovers`) — a stamp is shared state.
 *   - Playwright's mouse drags; the hand run dispatched pointer events from a
 *     script (FU-290). Each reading is polled until it holds.
 *   - The places are read relative to the row, in px; the expected ones are
 *     computed from the tiles' own sizes, not written down.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord, removeStampLeftovers } from "../helpers/records";

const MARK = `${E2E_MARKER}STAMP-02`;
const KEY = "ga40-tile-positions-admin-stamp-v1";
const GAP = 16;

type Box = { x: number; y: number; w: number; h: number };

/** Every tile of the row, relative to the row. */
async function boxes(page: Page): Promise<Record<string, Box>> {
  return page.evaluate(() => {
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const out: Record<string, Box> = {};
    for (const e of document.querySelectorAll<HTMLElement>("[data-tile-row] [data-tile]")) {
      const r = e.getBoundingClientRect();
      out[e.dataset.tile!] = { x: Math.round(r.left - row.left), y: Math.round(r.top - row.top), w: Math.round(r.width), h: Math.round(r.height) };
    }
    return out;
  });
}

/** The default places, from the tiles' own sizes. */
function defaults(b: Record<string, Box>) {
  return {
    description: { x: 0, y: 0 },
    type: { x: b.description.w + GAP, y: 0 },
    stamped: { x: 0, y: b.description.h + GAP },
    available: { x: b.description.w + GAP, y: b.type.h + GAP },
  };
}
const at = (b: Record<string, Box>) => Object.fromEntries(["description", "type", "stamped", "available"].map((k) => [k, { x: b[k]?.x, y: b[k]?.y }]));
const same = (b: Record<string, Box>) => JSON.stringify(at(b)) === JSON.stringify(defaults(b));

test.describe("TC-STAMP-02 — aplicarea unei ștampile: patru fișe", () => {
  test("1366 și 1920: locurile implicite; „Elemente deja ștampilate” trasă, după reîncărcare, „Implicit”", async ({ page }) => {
    test.slow();
    await removeStampLeftovers(page.request, MARK);
    await removeLeftovers(page.request, MARK);
    const ids: string[] = [];
    let stampId = "";
    try {
      const s = await page.request.post("/api/stamps", { data: { shortDescription: `${MARK} Ștampilă de test`, notes: "" } });
      expect(s.status()).toBe(201);
      stampId = ((await s.json()) as { id: string }).id;
      for (const n of ["Ion", "Ana", "Dan"]) {
        const id = await createNaturalPerson(page.request, { lastName: MARK, firstName: n });
        ids.push(id);
        if (n === "Ion") {
          const refs = (await (await page.request.get(`/api/people/${id}/entity-references`)).json()) as { principalObjectId: string };
          expect((await page.request.post(`/api/metadata/${refs.principalObjectId}/stamps`, { data: { stampId } })).ok()).toBeTruthy();
        }
      }
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/admin/stamps/${stampId}`);
      await page.evaluate((k) => localStorage.removeItem(k), KEY);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });

      // Step 1 — 1366: the four tiles and their places; „Tip element" names the select; „Implicit".
      const description = region("Descrierea ștampilei");
      const type = region("Tip element");
      const stamped = region("Elemente deja ștampilate");
      const available = region("Elemente disponibile pentru ștampilare");
      await expect(description).toBeVisible({ timeout: 30_000 });
      await expect(description.getByText("Cod", { exact: true })).toBeVisible();
      const select = page.getByRole("combobox", { name: "Tip element", exact: true });
      await expect(select.locator("option:checked")).toHaveText("Persoană fizică");
      await expect(type.getByText("Sunt afișate doar elementele de tipul selectat", { exact: false })).toBeVisible();
      await expect(stamped.getByText(`Ion ${MARK}`)).toBeVisible({ timeout: 30_000 });
      await expect(stamped.locator("span.text-xs").first()).toHaveText("1");
      await expect(available).toBeVisible();
      const reset = page.getByRole("button", { name: "Implicit", exact: true });
      await expect(reset).toBeVisible();
      const [r, h] = await Promise.all([reset.boundingBox(), page.getByRole("heading", { level: 1 }).boundingBox()]);
      expect((r?.x ?? 0) + (r?.width ?? 0)).toBeGreaterThan(1366 - 80); // the top right
      expect(Math.abs((r?.y ?? 0) - (h?.y ?? 0))).toBeLessThan(40);
      await expect.poll(async () => same(await boxes(page)), { timeout: 20_000 }).toBe(true);

      // Step 2 — 1920: the same four places.
      await page.setViewportSize({ width: 1920, height: 1000 });
      await expect.poll(async () => page.evaluate(() => Math.round(document.querySelector("[data-tile-row]")!.getBoundingClientRect().width)), { timeout: 10_000 }).toBeGreaterThan(1400);
      await page.waitForTimeout(500);
      const rule = await boxes(page);
      expect(at(rule)).toEqual(defaults(rule));

      // Step 3 — „Elemente deja ștampilate" by its bottom bar's padding, to the right of „Elemente disponibile…", level with „Tip element".
      const bar = stamped.locator(":scope > div").last();
      const p = await bar.boundingBox();
      const [me, av, ty] = await Promise.all([stamped.boundingBox(), available.boundingBox(), type.boundingBox()]);
      if (!p || !me || !av || !ty) throw new Error("a tile is not on the page");
      const x = p.x + 4;
      const y = p.y + 4;
      await page.mouse.move(x, y);
      await expect.poll(() => stamped.evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");
      await page.mouse.down();
      await page.mouse.move(x + 10, y - 10, { steps: 3 });
      await page.mouse.move(x + (av.x + av.width + GAP - me.x), y + (ty.y - me.y), { steps: 12 });
      await expect(page.locator("[data-tile-outline]")).toHaveAttribute("data-free", "true");
      await page.mouse.up();
      const dropped = { x: rule.available.x + rule.available.w + GAP, y: 0 };
      await expect.poll(async () => { const b = (await boxes(page)).stamped; return { x: b.x, y: b.y }; }).toEqual(dropped);
      const after = await boxes(page);
      for (const k of ["description", "type", "available"]) expect({ k, box: after[k] }).toEqual({ k, box: rule[k] });

      // Step 4 — after a reload, where it was dropped.
      await page.reload();
      await expect(stamped).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => { const b = (await boxes(page)).stamped; return { x: b.x, y: b.y }; }, { timeout: 20_000 }).toEqual(dropped);

      // Step 5 — „Implicit": back under „Descrierea ștampilei"; nothing kept.
      await page.getByRole("button", { name: "Implicit", exact: true }).click();
      await expect.poll(async () => { const b = (await boxes(page)).stamped; return { x: b.x, y: b.y }; }, { timeout: 20_000 }).toEqual(defaults(rule).stamped);
      expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), KEY).catch(() => undefined);
      if (stampId) await page.request.delete(`/api/stamps/${stampId}`);
      await removeStampLeftovers(page.request, MARK);
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
