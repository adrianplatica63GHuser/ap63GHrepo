/**
 * Case:   TC-GRP-04 — Ecranul unui grup: trei fișe cu nume, „Deja în grup" sub identitate, trase ca pe formulare
 * Source: docs/testing/cases/TC-GRP-04.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The group and the properties carry `TC-E2E-GRP-04` (records.ts).
 *   - Playwright's mouse drags; the hand run dispatched pointer events from a
 *     script (FU-290). Each reading is polled until it holds.
 *   - The places are read relative to the row, in px, as the hand run read them;
 *     the expected ones are computed from the tiles' own sizes, not written down.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}GRP-04`;
const KEY = "ga40-tile-positions-admin-group-v1";
const GAP = 16;

type Box = { x: number; y: number; w: number; h: number };

async function principalOf(request: APIRequestContext, propertyId: string): Promise<string> {
  const res = await request.get(`/api/properties/${propertyId}/entity-references`);
  return ((await res.json()) as { principalObjectId: string }).principalObjectId;
}

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

/** The default places: „Deja în grup" under „Identitatea grupului", „Membri disponibili…" at their right, tops level. */
function defaults(b: Record<string, Box>) {
  return {
    available: { x: b.identity.w + GAP, y: 0 },
    "in-group": { x: 0, y: b.identity.h + GAP },
  };
}
const at = (b: Record<string, Box>) => ({ available: { x: b.available.x, y: b.available.y }, "in-group": { x: b["in-group"].x, y: b["in-group"].y } });

test.describe("TC-GRP-04 — ecranul unui grup: trei fișe", () => {
  test("1366 și 1920: locurile implicite; „Deja în grup” trasă, după reîncărcare, „Implicit”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeGroupLeftovers(page.request, MARK);
    const ids: string[] = [];
    let groupId = "";
    try {
      const g = await page.request.post("/api/groups", { data: { targetType: "PROPERTY", description: `${MARK} Grup de test` } });
      expect(g.status()).toBe(201);
      groupId = ((await g.json()) as { id: string }).id;
      for (const n of ["A", "B", "C"]) {
        const id = await createProperty(page.request, { nickname: `${MARK} Teren ${n}` });
        ids.push(id);
        if (n !== "C") expect((await page.request.post(`/api/metadata/${await principalOf(page.request, id)}/groups`, { data: { groupId } })).ok()).toBeTruthy();
      }
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/admin/groups/${groupId}`);
      await page.evaluate((k) => localStorage.removeItem(k), KEY);
      await page.reload();
      const region = (name: string) => page.getByRole("region", { name, exact: true });

      // Step 1 — 1366: three tiles; „Deja în grup" under „Identitatea grupului", „Membri disponibili…" at their right; „Implicit".
      const identity = region("Identitatea grupului");
      const available = region("Membri disponibili pentru includere");
      const inGroup = region("Deja în grup");
      await expect(identity).toBeVisible({ timeout: 30_000 });
      await expect(identity.getByText("Țintă", { exact: true })).toBeVisible();
      await expect(inGroup.getByText(`${MARK} Teren A`)).toBeVisible({ timeout: 30_000 });
      await expect(inGroup.getByText(`${MARK} Teren B`)).toBeVisible();
      await expect(inGroup.locator("span.text-xs").first()).toHaveText("2");
      await available.getByPlaceholder("Caută…").fill(MARK);
      await expect(available.getByText(`${MARK} Teren C`)).toBeVisible({ timeout: 15_000 });
      const reset = page.getByRole("button", { name: "Implicit", exact: true });
      await expect(reset).toBeVisible();
      const [r, h] = await Promise.all([reset.boundingBox(), page.getByRole("heading", { level: 1 }).boundingBox()]);
      expect((r?.x ?? 0) + (r?.width ?? 0)).toBeGreaterThan(1366 - 80); // the top right
      expect(Math.abs((r?.y ?? 0) - (h?.y ?? 0))).toBeLessThan(40);
      await expect.poll(async () => { const b = await boxes(page); return JSON.stringify(at(b)) === JSON.stringify(defaults(b)); }, { timeout: 20_000 }).toBe(true);

      // Step 2 — 1920: the same three places, the space at the right empty.
      await page.setViewportSize({ width: 1920, height: 1000 });
      await expect.poll(async () => page.evaluate(() => Math.round(document.querySelector("[data-tile-row]")!.getBoundingClientRect().width)), { timeout: 10_000 }).toBeGreaterThan(1400);
      await page.waitForTimeout(500);
      const rule = await boxes(page);
      expect(at(rule)).toEqual(defaults(rule));

      // Step 3 — „Deja în grup" by its bottom bar's padding to the right of „Membri disponibili…", level with its top.
      const bar = inGroup.locator(":scope > div").last();
      const p = await bar.boundingBox();
      const [ig, av] = await Promise.all([inGroup.boundingBox(), available.boundingBox()]);
      if (!p || !ig || !av) throw new Error("a tile is not on the page");
      const x = p.x + 4;
      const y = p.y + 4;
      await page.mouse.move(x, y);
      await expect.poll(() => inGroup.evaluate((e) => getComputedStyle(e).cursor)).toBe("grab");
      const tx = x + (av.x + av.width + GAP - ig.x);
      const ty = y + (av.y - ig.y);
      await page.mouse.down();
      await page.mouse.move(x + 10, y - 10, { steps: 3 });
      await page.mouse.move(tx, ty, { steps: 12 });
      await expect(page.locator("[data-tile-outline]")).toHaveAttribute("data-free", "true");
      await page.mouse.up();
      const dropped = { x: rule.available.x + rule.available.w + GAP, y: 0 };
      await expect.poll(async () => { const b = (await boxes(page))["in-group"]; return { x: b.x, y: b.y }; }).toEqual(dropped);
      const after = await boxes(page);
      expect(after.identity).toEqual(rule.identity);
      expect(after.available).toEqual(rule.available);

      // Step 4 — after a reload, where it was dropped.
      await page.reload();
      await expect(inGroup).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => { const b = (await boxes(page))["in-group"]; return { x: b.x, y: b.y }; }, { timeout: 20_000 }).toEqual(dropped);

      // Step 5 — „Implicit": back under „Identitatea grupului"; nothing kept.
      await page.getByRole("button", { name: "Implicit", exact: true }).click();
      await expect.poll(async () => { const b = (await boxes(page))["in-group"]; return { x: b.x, y: b.y }; }, { timeout: 20_000 }).toEqual(defaults(rule)["in-group"]);
      expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBeNull();
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), KEY).catch(() => undefined);
      if (groupId) await page.request.delete(`/api/groups/${groupId}`);
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
