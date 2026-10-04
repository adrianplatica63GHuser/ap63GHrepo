/**
 * Case:   TC-PROP-08 — „Puncte de contur" cât „Hartă", butoanele unui rând lângă marginea din dreapta
 * Source: docs/testing/cases/TC-PROP-08.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-PROP-08` (records.ts).
 *   - Playwright's mouse presses the buttons; the hand run's script did, because
 *     the pane's emulated viewport drops real clicks (FU-290).
 *   - „Afișare" is set to „Stereo 70" first, since the screen may remember DMS.
 *   - „Street View" is ticked in „Părți afișate" (`showTile`): the pane had it
 *     ticked from earlier runs, the runner's fresh browser does not.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PROP-08`;
const CORNERS = [
  { lat: 44.43512, lon: 26.10234 }, { lat: 44.43561, lon: 26.10301 }, { lat: 44.43527, lon: 26.10372 },
  { lat: 44.4347, lon: 26.10335 }, { lat: 44.43468, lon: 26.10262 },
];

type Box = { l: number; t: number; r: number; b: number; w: number };
async function boxOf(l: Locator): Promise<Box> {
  const r = await l.boundingBox();
  if (!r) throw new Error("not on the page");
  return { l: Math.round(r.x), t: Math.round(r.y), r: Math.round(r.x + r.width), b: Math.round(r.y + r.height), w: Math.round(r.width) };
}

/** The table's wrapper scrolls sideways by this much (0 = not at all). */
const sideScroll = (tile: Locator) =>
  tile.locator("table").evaluate((t) => (t.parentElement ? t.parentElement.scrollWidth - t.parentElement.clientWidth : -1));

async function steps(page: Page, id: string, width: number): Promise<void> {
  await page.setViewportSize({ width, height: 1200 });
  // Step 1 — the three tiles the same width, flush right, the column as wide.
  await page.goto(`/properties/${id}`);
  const tile = page.locator('[data-panel="corners"]');
  await expect(tile.locator("tbody tr")).toHaveCount(5, { timeout: 30_000 });
  await showTile(page, "Street View");
  await tile.getByRole("button", { name: "Stereo 70", exact: true }).click();
  const map = page.locator('[data-panel="map"]');
  const sv = page.locator('[data-panel="street-view"]');
  const right = page.locator('[data-tile-area="right"]');
  await expect.poll(async () => {
    const [m, c, s, r] = await Promise.all([boxOf(map), boxOf(tile), boxOf(sv), boxOf(right)]);
    return { corners: c.w === m.w, streetView: s.w === m.w, column: r.w === m.w, rightEdges: new Set([m.r, c.r, s.r]).size };
  }, { timeout: 20_000 }).toEqual({ corners: true, streetView: true, column: true, rightEdges: 1 });

  // Step 2 — the four buttons on one line, „Șterge" against the table's edge.
  const row = tile.locator("tbody tr").first();
  const names = ["Mută mai sus", "Mută mai jos", "Editează", "Șterge"];
  const boxes = await Promise.all(names.map((n) => boxOf(row.getByRole("button", { name: n, exact: true }))));
  expect(new Set(boxes.map((b) => b.t)).size, `${width}: the four buttons on one line`).toBe(1);
  const table = await boxOf(tile.locator("table"));
  expect(Math.abs(table.r - 1 - boxes[3].r - 12), `${width}: „Șterge" 12 px from the edge`).toBeLessThanOrEqual(1);

  // Step 3 — „Editează": the edit row inside the tile, nothing to scroll; „Anulează".
  const t = await boxOf(tile);
  await row.getByRole("button", { name: "Editează", exact: true }).click();
  const editing = tile.locator("tbody tr").filter({ has: page.locator("input") });
  await expect(editing.getByRole("button", { name: "Salvează", exact: true })).toBeVisible();
  await expect(editing.getByRole("button", { name: "Anulează", exact: true })).toBeVisible();
  for (const el of await editing.locator("input, button").all()) {
    const b = await boxOf(el);
    expect(b.l >= t.l && b.r <= t.r, `${width}: the edit row inside the tile`).toBe(true);
  }
  expect(await sideScroll(tile)).toBe(0);
  await editing.getByRole("button", { name: "Anulează", exact: true }).click();
  await expect(editing).toHaveCount(0);

  // Step 4 — „DMS", „Editează": the latitude on one line, left of „Salvează".
  await tile.getByRole("button", { name: "DMS", exact: true }).click();
  await tile.locator("tbody tr").first().getByRole("button", { name: "Editează", exact: true }).click();
  await expect(editing).toHaveCount(1);
  const lat = [...(await editing.locator("input").all()).slice(0, 3),
    editing.getByRole("button", { name: "N", exact: true }), editing.getByRole("button", { name: "S", exact: true })];
  const latBoxes = await Promise.all(lat.map(boxOf));
  expect(new Set(latBoxes.map((b) => Math.round((b.t + b.b) / 2))).size, `${width}: the latitude on one line`).toBe(1);
  const save = await boxOf(editing.getByRole("button", { name: "Salvează", exact: true }));
  expect(Math.max(...latBoxes.map((b) => b.r)), `${width}: left of „Salvează"`).toBeLessThan(save.l);
  expect(await sideScroll(tile)).toBe(0);
  await editing.getByRole("button", { name: "Anulează", exact: true }).click();
  await expect(editing).toHaveCount(0);
  await tile.getByRole("button", { name: "Stereo 70", exact: true }).click();
}

test.describe("TC-PROP-08 — „Puncte de contur” cât „Hartă”", () => {
  test("la 1920 și la 1366 px: aceeași lățime, butoanele pe un rând lângă margine, rândul de editare în fișă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const id = await createProperty(page.request, { nickname: `${MARK} Teren cu colțuri`, corners: CORNERS });
    try {
      await steps(page, id, 1920);
      await steps(page, id, 1366);
    } finally {
      await removeRecord(page.request, "property", id);
    }
  });
});
