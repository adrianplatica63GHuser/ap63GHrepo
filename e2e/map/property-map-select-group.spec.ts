/**
 * Case:   TC-MAP-07 — „Selectează” pe hartă: trei proprietăți alese cu clicuri, „Grup nou…”, înapoi, adăugate în grup
 * Source: docs/testing/cases/TC-MAP-07.md, „Last green" 2026-10-18 (confirmed by two hand runs, Slice #39.73)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * ⚠️ **A GROUP IS SHARED STATE.** The `finally` removes any group whose „Descriere" carries this spec's marker, and
 * the three lots, even when an assertion failed first (records.ts).
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The three lots are drawn through the API near 45.72 N, 24.43 E, where the archive has no property, and carry
 *     `TC-E2E-MAP-07`. The map opens on the first as „Proprietăți — Hartă" would (`?focus=<id>&z=19`).
 *   - A lot is clicked at the midpoint of two opposite corner dots (`data-corner-marker`), which the map draws while
 *     the lot is a polygon. The bar's count is read from `data-select-count`, the box as `[data-group-picker]`.
 *   - The tab's kept selection is cleared first, so the run starts with none.
 *   - Step 9's „the group holds them" is read through GET /api/groups/[id], as the hand runs read it.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord } from "../helpers/records";

test.use({ realMaps: true }); // TC-MAP-07 clicks the lots the map draws, and comes back to the map after „Grupuri"

const MARK = `${E2E_MARKER}MAP-07`;
const DESCRIPTION = `${MARK} Grup din hartă`;
// About 20 m × 20 m at 45.7° N, about 31 m apart: at zoom 19 each is a polygon about 96 px wide, 149 px apart.
const lot = (lon: number) => {
  const east = Number((lon + 0.00026).toFixed(5));
  return [
    { lat: 45.72, lon },
    { lat: 45.72, lon: east },
    { lat: 45.72018, lon: east },
    { lat: 45.72018, lon },
  ];
};
const LOTS = [lot(24.43), lot(24.4304), lot(24.4308)];

const bigMap = (page: Page) => page.locator("[data-property-map]");
const count = (page: Page) => page.locator("[data-select-count]");

/** A click in the middle of a lot: between its first and third corner dots. */
async function clickLot(page: Page, corners: { lat: number; lon: number }[]): Promise<void> {
  const a = (await page.locator(`[data-corner-marker="${corners[0].lat},${corners[0].lon}"]`).boundingBox())!;
  const c = (await page.locator(`[data-corner-marker="${corners[2].lat},${corners[2].lon}"]`).boundingBox())!;
  await page.mouse.click((a.x + a.width / 2 + c.x + c.width / 2) / 2, (a.y + a.height / 2 + c.y + c.height / 2) / 2);
}

test.describe("TC-MAP-07 — „Selectează” pune proprietăți într-un grup", () => {
  test("trei loturi alese cu clicuri, „Grup nou…”, înapoi, „Adaugă”: toate trei în grupul nou", async ({ page }) => {
    test.slow();
    await removeGroupLeftovers(page.request, MARK);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      for (const [i, corners] of LOTS.entries()) ids.push(await createProperty(page.request, { nickname: `${MARK} Lot ${i + 1}`, corners }));
      await page.goto("/");
      await page.evaluate(() => {
        sessionStorage.removeItem("ga40.map.selection");
        sessionStorage.removeItem("ga40.map.newGroupId");
      });

      // Step 1 — the map on the first lot at zoom 19: three polygons, „Selectează", no bar.
      await page.goto(`/properties/map?focus=${ids[0]}&z=19`);
      await expect(bigMap(page)).toHaveAttribute("data-focus-blink", "done", { timeout: 40_000 });
      for (const corners of LOTS)
        for (const c of corners) await expect(page.locator(`[data-corner-marker="${c.lat},${c.lon}"]`)).toHaveCount(1, { timeout: 15_000 });
      await expect(page.locator("[data-select-bar]")).toHaveCount(0);

      // Step 2 — „Selectează": the bar.
      await page.getByRole("button", { name: "Selectează", exact: true }).click();
      await expect(count(page)).toHaveText("Nicio proprietate selectată");
      for (const name of ["Afișează selecția", "Adaugă la grup…", "Anulează"])
        await expect(page.locator("[data-select-bar]").getByRole("button", { name, exact: true })).toBeVisible();

      // Step 3 — a click inside each lot.
      for (const corners of LOTS) await clickLot(page, corners);
      await expect(count(page)).toHaveText("3 proprietăți selectate");

      // Step 4 — the second lot out, then in again.
      await clickLot(page, LOTS[1]);
      await expect(count(page)).toHaveText("2 proprietăți selectate");
      await page.waitForTimeout(600); // two clicks closer than this are Google's double click
      await clickLot(page, LOTS[1]);
      await expect(count(page)).toHaveText("3 proprietăți selectate");

      // Step 5 — „Adaugă la grup…": the box, the groups, „Grup nou…".
      await page.getByRole("button", { name: "Adaugă la grup…", exact: true }).click();
      const picker = page.locator("[data-group-picker]");
      await expect(picker.getByRole("heading", { name: "Adaugă cele 3 proprietăți selectate la un grup" })).toBeVisible();
      await expect(picker.getByRole("button", { name: "Grup nou…" })).toBeVisible();

      // Step 6 — „Grup nou…": „Grupuri", the add form open on „Proprietate", the line and „Înapoi la hartă".
      await picker.getByRole("button", { name: "Grup nou…" }).click();
      await expect(page).toHaveURL(/\/admin\/groups\?from=map$/, { timeout: 30_000 });
      const form = page.getByRole("heading", { name: "Adaugă grup nou" }).locator("..");
      await expect(form).toBeVisible({ timeout: 30_000 });
      await expect(form.getByLabel("Țintă").locator("option:checked")).toHaveText("Proprietate");
      const line = page.locator("[data-from-map]");
      await expect(line).toContainText("Creați grupul de proprietăți, apoi reveniți la hartă:");
      await expect(line.getByRole("button", { name: "Înapoi la hartă" })).toBeVisible();

      // Step 7 — „Descriere", „Salvează": the line names the group.
      await form.getByLabel("Descriere").fill(DESCRIPTION);
      await form.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(line).toContainText(/Grupul GRP-\d+ a fost creat\. Reveniți la hartă pentru a-i adăuga proprietățile selectate\./, { timeout: 15_000 });
      const code = (await line.textContent())?.match(/GRP-\d+/)?.[0] ?? "";

      // Step 8 — back: the map, the bar, the box open, the new group chosen.
      await page.goBack();
      await expect(page).toHaveURL(/\/properties\/map$/, { timeout: 30_000 });
      await expect(count(page)).toHaveText("3 proprietăți selectate", { timeout: 40_000 });
      await expect(picker).toBeVisible();
      await expect(picker.locator("label").filter({ hasText: code }).getByRole("radio")).toBeChecked({ timeout: 15_000 });

      // Step 9 — „Adaugă": the box and the bar go, the toast, and the group holds the three.
      await picker.getByRole("button", { name: "Adaugă", exact: true }).click();
      await expect(page.locator("[data-toast]")).toHaveText(`3 proprietăți adăugate la ${code}`, { timeout: 15_000 });
      await expect(picker).toHaveCount(0);
      await expect(page.locator("[data-select-bar]")).toHaveCount(0);
      const groups = await (await page.request.get("/api/groups")).json() as { items: { id: string; description: string }[] };
      const group = groups.items.find((g) => g.description === DESCRIPTION)!;
      const detail = await (await page.request.get(`/api/groups/${group.id}`)).json() as { members: { memberId: string }[] };
      expect(detail.members.map((m) => m.memberId).sort()).toEqual([...ids].sort());
    } finally {
      await removeGroupLeftovers(page.request, MARK);
      for (const id of ids) await removeRecord(page.request, "property", id);
    }
  });
});
