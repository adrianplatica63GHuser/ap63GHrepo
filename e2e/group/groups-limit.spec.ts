/**
 * Case:   TC-GRP-02 — O proprietate în trei grupuri: limita spusă în cuvinte, „+" inactiv
 * Source: docs/testing/cases/TC-GRP-02.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property and the groups carry `TC-E2E-GRP-02` (records.ts).
 *   - Playwright's mouse presses „×" and „+" and picks the group; the hand run
 *     did by script (FU-290). „×" shows on hover only (#37.69), so the row is
 *     hovered first.
 *   - Slice #38.10's pictures, not steps of the case: „Conexiuni" at three
 *     groups and at two, at 1366 px, into `playwright-report/groups-limit/`.
 */

import { test, expect, type APIRequestContext, type Locator } from "@playwright/test";
import { E2E_MARKER, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}GRP-02`;
const SHOTS = "playwright-report/groups-limit";
// #38.73: „Un obiect" — was „Un element".
const LINE = "Un obiect poate face parte din cel mult 3 grupuri. Scoateți-l dintr-un grup pentru a-l adăuga în altul.";

async function createGroup(request: APIRequestContext, description: string): Promise<string> {
  const res = await request.post("/api/groups", { data: { targetType: "PROPERTY", description } });
  expect(res.status(), `POST /api/groups (${description})`).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

/** „Grupuri" inside „Conexiuni". */
function groupsOf(tile: Locator): Locator {
  return tile.locator("section").filter({ has: tile.page().getByRole("heading", { name: "Grupuri", exact: true }) });
}

test.describe("TC-GRP-02 — limita de trei grupuri", () => {
  test("la trei: rândul în cursiv și „+” inactiv; la două: „+” activ; adăugat înapoi", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeGroupLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const propertyId = await createProperty(page.request, { nickname: `${MARK} Teren` });
    const groupIds: string[] = [];
    try {
      const refs = await page.request.get(`/api/properties/${propertyId}/entity-references`);
      const po = ((await refs.json()) as { principalObjectId: string }).principalObjectId;
      for (const n of ["A", "B", "C"]) groupIds.push(await createGroup(page.request, `${MARK} Grup ${n}`));
      for (const id of groupIds) {
        const add = await page.request.post(`/api/metadata/${po}/groups`, { data: { groupId: id } });
        expect(add.ok()).toBeTruthy();
      }

      // Step 1 — three groups; „+" inactive, named by the limit; the italic line; no picker.
      await page.goto(`/properties/${propertyId}`);
      const tile = await showTile(page, "Etichete și grupuri");
      const groups = groupsOf(tile);
      await expect(groups.locator("li")).toHaveCount(3, { timeout: 30_000 });
      const capped = groups.getByRole("button", { name: "Cel mult 3 grupuri", exact: true });
      await expect(capped).toBeDisabled();
      const line = groups.locator("[data-groups-limit]");
      await expect(line).toHaveText(LINE);
      await expect(line).toHaveCSS("font-style", "italic");
      await expect(groups.locator("select")).toHaveCount(0);
      await tile.screenshot({ path: `${SHOTS}/connections-three-groups-1366.png` });

      // Step 2 — „Grup A" removed: two; „+ Adaugă în grup" active; no line.
      const rowA = groups.locator("li").filter({ hasText: `${MARK} Grup A` });
      await rowA.hover();
      await rowA.getByRole("button", { name: /^Elimină din grup / }).click();
      await expect(groups.locator("li")).toHaveCount(2, { timeout: 30_000 });
      const plus = groups.getByRole("button", { name: "+ Adaugă în grup", exact: true });
      await expect(plus).toBeEnabled();
      await expect(line).toHaveCount(0);
      await page.mouse.move(1, 1);
      await tile.screenshot({ path: `${SHOTS}/connections-two-groups-1366.png` });

      // Step 3 — „+": the picker offers „Grup A".
      await plus.click();
      const picker = groups.locator("select");
      await expect(picker.locator("option").filter({ hasText: `${MARK} Grup A` })).toHaveCount(1, { timeout: 30_000 });

      // Step 4 — „Grup A" chosen: three again; „+" inactive; the line back; the picker closed.
      await picker.selectOption(groupIds[0]);
      await expect(groups.locator("li")).toHaveCount(3, { timeout: 30_000 });
      await expect(capped).toBeDisabled();
      await expect(line).toHaveText(LINE);
      await expect(groups.locator("select")).toHaveCount(0);
    } finally {
      await removeRecord(page.request, "property", propertyId);
      await removeGroupLeftovers(page.request, MARK);
    }
  });
});
