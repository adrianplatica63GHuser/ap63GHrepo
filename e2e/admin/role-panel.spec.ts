/**
 * Case:   TC-VL-03 — Un rol într-un singur panou: un tip de act cu „Deține cotă”, apoi rolul ales pe acel tip, cu cotă
 * Source: docs/testing/cases/TC-VL-03.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.36). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The role, the person and the document are created through the routes
 *     the screens call, with `TC-E2E-VL-03` names, and removed in `finally`
 *     (the role last; its document types go with it).
 *   - Slice #38.36's pictures, not steps of the case: the role's panel, at 1366
 *     and 1920 px, into `playwright-report/role-panel/`.
 */

import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { lineRow, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}VL-03`;
const ROLE = `${MARK} Rol`;
const PERSON = `Ion ${MARK}`;
const PAD = `${MARK} PAD`;
const TYPE = "Plan de Amplasament și Delimitare";
const ROLES = "/api/admin/value-lists/person-roles";
const SHOTS = "playwright-report/role-panel";

async function removeRoles(request: APIRequestContext): Promise<void> {
  const res = await request.get(ROLES);
  const items = ((await res.json()) as { items: { id: string; name: string }[] }).items;
  for (const r of items) if (r.name.startsWith(MARK)) await request.delete(`${ROLES}/${r.id}`);
}

async function openRole(page: Page): Promise<Locator> {
  await page.goto("/admin/value-lists?list=person-roles");
  const list = page.getByRole("region", { name: "Roluri Persoane", exact: true }) /* #38.61: was „Roluri" */;
  const row = list.locator("tbody tr").filter({ has: page.locator("td:first-child", { hasText: ROLE }) });
  await row.getByRole("button", { name: "Editează", exact: true }).click({ timeout: 30_000 });
  const panel = list.locator("[data-role-scope]");
  await expect(panel).toBeVisible();
  return panel;
}

async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-VL-03 — un rol într-un singur panou", () => {
  test("„Act”, un tip cu „Deține cotă”, apoi rolul ales pe acel tip cu „Cotă”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeRoles(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    let personId: string | undefined;
    let padId: string | undefined;
    try {
      const created = await page.request.post(ROLES, { data: { name: ROLE } });
      expect(created.ok(), `POST ${ROLES} failed (${created.status()})`).toBeTruthy();

      // Step 1 — the role's panel: the three chips, none pressed.
      let panel = await openRole(page);
      for (const chip of ["Act", "Proprietate", "Persoană"]) {
        await expect(panel.getByRole("button", { name: chip, exact: true })).toHaveAttribute("aria-pressed", "false");
      }

      // Step 2 — „Act": „Tipuri de act", none yet; add „Plan de Amplasament și Delimitare".
      await panel.getByRole("button", { name: "Act", exact: true }).click();
      await expect(panel.getByText("Rolul nu este oferit încă pe niciun tip de act. Adăugați unul mai jos.")).toBeVisible();
      await panel.getByRole("combobox", { name: "Adaugă un tip de act", exact: true }).selectOption({ label: TYPE });
      await panel.getByRole("button", { name: "Adaugă tipul", exact: true }).click();
      const tick = panel.getByRole("checkbox", { name: `Deține cotă — ${TYPE} — ${ROLE}`, exact: true });
      await expect(tick).not.toBeChecked({ timeout: 15_000 });
      await expect(panel.locator(`[data-pair="${TYPE}"]`)).toContainText("nicio legătură");

      // Step 3 — „Deține cotă": ticked, and still after the panel is opened again.
      await tick.check();
      await expect(tick).toBeChecked();
      await page.waitForLoadState("networkidle").catch(() => {});
      panel = await openRole(page);
      await expect(panel.getByRole("button", { name: "Act", exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(panel.getByRole("checkbox", { name: `Deține cotă — ${TYPE} — ${ROLE}`, exact: true })).toBeChecked({ timeout: 15_000 });
      await photograph(page, "role-panel", panel.locator("xpath=..")); // the form: the fields, then the chips and the types

      // Step 4 — the PAD: „Asociază persoană", the role in „Rol", the person; the row has „Cotă".
      personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
      padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", PAD);
      await page.goto(`/documents/${padId}`);
      await expect(page.getByRole("heading", { name: PAD })).toBeVisible({ timeout: 30_000 });
      const links = await showTile(page, "Legături");
      await links.getByRole("button", { name: "Asociază persoană", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      await page.getByPlaceholder("Nume…", { exact: true }).fill(MARK);
      await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption({ label: ROLE });
      await page.getByRole("checkbox", { name: PERSON }).check({ timeout: 15_000 });
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      const row = lineRow(page.getByRole("region", { name: "Legături", exact: true }), PERSON);
      await expect(row.locator("[data-row-content]")).toHaveText(`${PERSON} (${ROLE})`, { timeout: 30_000 });
      await expect(row.getByRole("button", { name: "Cotă", exact: true })).toBeVisible();

      // Step 5 — back on the role: „1 legătură" beside the type.
      panel = await openRole(page);
      await expect(panel.locator(`[data-pair="${TYPE}"]`)).toContainText("1 legătură", { timeout: 15_000 });
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      if (padId) await removeRecord(page.request, "document", padId);
      if (personId) await removeRecord(page.request, "person", personId);
      await removeRoles(page.request);
    }
  });
});
