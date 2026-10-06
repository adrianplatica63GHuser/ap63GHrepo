/**
 * Case:   TC-GRP-03 — „Grupuri" arată câți membri are grupul, nu locul înregistrării în el
 * Source: docs/testing/cases/TC-GRP-03.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The group and the properties carry `TC-E2E-GRP-03` (records.ts).
 *   - Playwright's mouse presses „×" (shown on hover, #37.69) and „+" and picks
 *     the group; the hand run did by script (FU-290).
 *   - Step 4 reads C's position from the route the screen reads, to prove the
 *     chip is not it.
 */

import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}GRP-03`;
const GROUP = `${MARK} Grup`;

async function principalOf(request: APIRequestContext, propertyId: string): Promise<string> {
  const res = await request.get(`/api/properties/${propertyId}/entity-references`);
  return ((await res.json()) as { principalObjectId: string }).principalObjectId;
}

/** The group's row in this screen's „Grupuri", and its chip. */
async function groupRow(page: Page, propertyId: string): Promise<{ groups: Locator; row: Locator; chip: Locator }> {
  await page.goto(`/properties/${propertyId}`);
  const tile = await showTile(page, "Conexiuni");
  const groups = tile.locator("section").filter({ has: page.getByRole("heading", { name: "Grupuri", exact: true }) });
  const row = groups.locator("li").filter({ hasText: GROUP });
  return { groups, row, chip: row.locator("[data-group-member-count]") };
}

test.describe("TC-GRP-03 — câți membri are grupul", () => {
  test("[3], un membru scos — [2], adăugat înapoi — [3] deși locul lui e 4", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeGroupLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const g = await page.request.post("/api/groups", { data: { targetType: "PROPERTY", description: GROUP } });
      expect(g.status()).toBe(201);
      const groupId = ((await g.json()) as { id: string }).id;
      for (const n of ["A", "B", "C"]) {
        const id = await createProperty(page.request, { nickname: `${MARK} Teren ${n}` });
        ids.push(id);
        expect((await page.request.post(`/api/metadata/${await principalOf(page.request, id)}/groups`, { data: { groupId } })).ok()).toBeTruthy();
      }
      const [a, , c] = ids;

      // Step 1 — A: „[3]", „3 membri".
      let at = await groupRow(page, a);
      await expect(at.chip).toHaveText(/\[3\]$/, { timeout: 30_000 });
      await expect(at.chip).toHaveAttribute("title", "3 membri");

      // Step 2 — C: the group removed.
      at = await groupRow(page, c);
      await expect(at.row).toHaveCount(1, { timeout: 30_000 });
      await at.row.hover();
      await at.row.getByRole("button", { name: /^Elimină din grup / }).click();
      await expect(at.row).toHaveCount(0, { timeout: 30_000 });

      // Step 3 — A: „[2]", „2 membri".
      at = await groupRow(page, a);
      await expect(at.chip).toHaveText(/\[2\]$/, { timeout: 30_000 });
      await expect(at.chip).toHaveAttribute("title", "2 membri");

      // Step 4 — C adds it back: C's chip „[3]" while its position is 4; A's „[3]".
      at = await groupRow(page, c);
      await at.groups.getByRole("button", { name: "+ Adaugă în grup", exact: true }).click();
      await at.groups.locator("select").selectOption(groupId);
      await expect(at.chip).toHaveText(/\[3\]$/, { timeout: 30_000 });
      const refs = (await (await page.request.get(`/api/properties/${c}/entity-references`)).json()) as { groups: { id: string; position: number }[] };
      expect(refs.groups.find((x) => x.id === groupId)?.position).toBe(4);
      at = await groupRow(page, a);
      await expect(at.chip).toHaveText(/\[3\]$/, { timeout: 30_000 });
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
      await removeGroupLeftovers(page.request, MARK);
    }
  });
});
