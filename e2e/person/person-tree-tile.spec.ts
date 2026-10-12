/**
 * Case:   TC-INHER-02 — „Arbore de moștenire” pe persoană: trei generații în fișă, panoul restrâns din listă și deschis din arbore, o rudă adăugată și scoasă
 * Source: docs/testing/cases/TC-INHER-02.md, „Last green" 2026-10-12
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The four persons and the first two ties are created through the routes the screens call, with
 *     `TC-E2E-INHER-02` names, and removed in `finally` (their ties go with them).
 *   - The screen is opened by its address, as the list's „Deschide" opens it — no `?tree=`.
 *   - The picture is the tile alone, at 1366 px: only the test family is in it.
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INHER-02`;
const ROLES = "/api/admin/value-lists/person-roles";

async function roleId(request: APIRequestContext, name: string): Promise<string> {
  const items = ((await (await request.get(ROLES)).json()) as { items: { id: string; name: string; kinship: string | null }[] }).items;
  const role = items.find((r) => r.name === name && r.kinship !== null);
  expect(role, `the role „${name}” with a kinship (migration_106)`).toBeTruthy();
  return role!.id;
}

const tile = (page: Page) => page.getByRole("region", { name: "Arbore de moștenire", exact: true });
const node = (page: Page, id: string) => tile(page).locator(`[data-tree-node="${id}"]`);

test.describe("TC-INHER-02 — arborele persoanei", () => {
  test("trei generații; C restrâns din listă, deschis din arbore; o rudă adăugată prin C, apoi scoasă", async ({ page }) => {
    test.setTimeout(240_000);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids: string[] = [];
    try {
      const make = async (firstName: string, gender: "MALE" | "FEMALE", dateOfBirth: string) => {
        const id = await createNaturalPerson(page.request, { lastName: MARK, firstName, gender, dateOfBirth });
        ids.push(id);
        return id;
      };
      const ion = await make("Ion", "MALE", "1940-02-02");
      const elena = await make("Elena", "FEMALE", "1965-05-05");
      const radu = await make("Radu", "MALE", "1990-09-09");
      const dan = await make("Dan", "MALE", "1968-08-08");
      const tie = async (holder: string, role: string, other: string) => {
        const res = await page.request.post(`/api/people/${other}/references`, { data: { personIds: [holder], relationshipRoleId: role } });
        expect(res.ok(), `POST references failed (${res.status()})`).toBeTruthy();
      };
      await tie(ion, await roleId(page.request, "Tată"), elena);
      await tie(elena, await roleId(page.request, "Mamă"), radu);

      // Step 1 — Elena's screen, as from the list: the tile, three generations, C collapsed; the drawing square.
      await page.goto(`/natural-persons/${elena}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await expect(node(page, radu)).toBeAttached({ timeout: 30_000 });
      const gen = async (id: string) => Number(await node(page, id).getAttribute("data-generation"));
      expect([await gen(ion), await gen(elena), await gen(radu)]).toEqual([0, 1, 2]);
      await expect(node(page, dan)).toHaveCount(0);
      await expect(tile(page).locator('[data-tree-panel="collapsed"]')).toBeVisible();
      const box = (await tile(page).locator("[data-tree-tile-canvas]").boundingBox())!;
      expect(Math.abs(box.width - box.height), `the drawing ${box.width} × ${box.height}`).toBeLessThanOrEqual(2);

      // Step 2 — from the whole tree, Elena's name: her screen with C expanded.
      await page.goto("/inheritance-tree");
      const frame = page.getByRole("dialog", { name: "Arbori de moștenire" });
      await frame.getByRole("searchbox", { name: "Caută o persoană…" }).fill(`Elena ${MARK}`);
      await frame.getByRole("button", { name: "Caută", exact: true }).click();
      await frame.locator("[data-tree-card]").getByRole("link", { name: `Elena ${MARK}`, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${elena}\\?tree=open$`), { timeout: 30_000 });
      const panel = tile(page).locator('[data-tree-panel="expanded"]');
      await expect(panel).toBeVisible({ timeout: 30_000 });
      await expect(panel.locator("[data-tree-ties]")).toContainText(`Ion ${MARK}`);

      // Step 3 — „Ruda": Dan; „Ce este pentru …": „Frate"; „Adaugă legătura" — Dan in the tile, beside Elena.
      await panel.getByRole("searchbox", { name: "Ruda" }).fill(`Dan ${MARK}`);
      // A pick closes the list and names the relative (`[data-tree-chosen]`), so the radio is clicked, not checked.
      await panel.getByRole("radio", { name: `Dan ${MARK}` }).click({ timeout: 15_000 });
      await expect(panel.locator("[data-tree-chosen]")).toHaveText(`Dan ${MARK}`);
      await panel.getByRole("combobox", { name: `Ce este pentru Elena ${MARK}` }).selectOption({ label: "Frate" });
      await panel.getByRole("button", { name: "Adaugă legătura", exact: true }).click();
      await expect(node(page, dan)).toBeAttached({ timeout: 30_000 });
      expect(await gen(dan)).toBe(await gen(elena));
      await expect(panel.locator(`[data-tree-tie="${dan}"]`)).toContainText("Frate");
      await page.mouse.move(5, 5);
      await tile(page).screenshot({ path: "playwright-report/inheritance-tree/person-tile-1366.png" });

      // Step 4 — „Scoate legătura cu Dan …", „Scoate": Dan gone from the tile.
      await panel.getByRole("button", { name: `Scoate legătura cu Dan ${MARK}`, exact: true }).click();
      await panel.getByRole("button", { name: "Scoate", exact: true }).click();
      await expect(node(page, dan)).toHaveCount(0, { timeout: 30_000 });
      await expect(panel.locator(`[data-tree-tie="${dan}"]`)).toHaveCount(0);
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
