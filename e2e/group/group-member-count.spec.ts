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

import { test, expect, type APIRequestContext, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, removeGroupLeftovers, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile, editConnections } from "../helpers/tiles";

const MARK = `${E2E_MARKER}GRP-03`;
const GROUP = `${MARK} Grup`;

async function principalOf(request: APIRequestContext, propertyId: string): Promise<string> {
  const res = await request.get(`/api/properties/${propertyId}/entity-references`);
  return ((await res.json()) as { principalObjectId: string }).principalObjectId;
}

/** The group's row in this screen's „Grupuri", and its chip. */
async function groupRow(page: Page, propertyId: string): Promise<{ groups: Locator; row: Locator; chip: Locator }> {
  await page.goto(`/properties/${propertyId}`);
  await showTile(page, "Etichete și grupuri");
  const tile = await editConnections(page); // 41.40: „+" and „×" only in edit
  const groups = tile.locator("section").filter({ has: page.getByRole("heading", { name: "Grupuri", exact: true }) });
  const row = groups.locator("li").filter({ hasText: GROUP });
  // 41.95: the code's rectangle — the code alone (it read „{code} [n]", `data-group-member-count`, #38.11).
  return { groups, row, chip: row.locator("[data-code-chip] > span").first() };
}

// Slice 41.95 rewrote the case in place — it was #38.11's „[3], un membru scos — [2], adăugat înapoi — [3] deși locul lui
// e 4". Adrian, 2026-11-06: „should not display the numbers of items in the group • when hovering over the Grey rectangle
// … will no longer display the number of members". So the rectangle reads the code alone, with no tooltip, whatever the
// group's size; the „×" is on the rectangle; removing and adding back keep it so. The count is the group screens'.
test.describe("TC-GRP-03 — grupul fără număr de membri", () => {
  test("codul singur, fără bulă; scos din grup prin „×” de pe cod, adăugat înapoi — tot codul singur", async ({ page }) => {
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

      // Step 1 — A: the code alone, no title.
      let at = await groupRow(page, a);
      await expect(at.chip).toHaveText(/^GRP-\d+$/, { timeout: 30_000 });
      expect(await at.chip.getAttribute("title")).toBeNull();

      // Step 2 — C: the group removed.
      at = await groupRow(page, c);
      await expect(at.row).toHaveCount(1, { timeout: 30_000 });
      await at.row.locator("[data-code-chip]").hover();
      await at.row.getByRole("button", { name: /^Elimină din grup / }).click();
      await expect(at.row).toHaveCount(0, { timeout: 30_000 });

      // Step 3 — A: still the code alone.
      at = await groupRow(page, a);
      await expect(at.chip).toHaveText(/^GRP-\d+$/, { timeout: 30_000 });
      expect(await at.chip.getAttribute("title")).toBeNull();

      // Step 4 — C adds it back: the code alone; its position is 4 (the high-water counter the „[n]" used to be mistaken for).
      at = await groupRow(page, c);
      await at.groups.getByRole("button", { name: "+ Adaugă în grup", exact: true }).click();
      await at.groups.locator("select").selectOption(groupId);
      await expect(at.chip).toHaveText(/^GRP-\d+$/, { timeout: 30_000 });
      const refs = (await (await page.request.get(`/api/properties/${c}/entity-references`)).json()) as { groups: { id: string; position: number }[] };
      expect(refs.groups.find((x) => x.id === groupId)?.position).toBe(4);
      at = await groupRow(page, a);
      await expect(at.chip).toHaveText(/^GRP-\d+$/, { timeout: 30_000 });
    } finally {
      for (const id of ids) await removeRecord(page.request, "property", id);
      await removeGroupLeftovers(page.request, MARK);
    }
  });
});
