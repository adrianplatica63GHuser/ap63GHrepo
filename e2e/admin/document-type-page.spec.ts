/**
 * Case:   TC-VL-04 — Un tip de act pe pagina lui: General, Formular, Roluri; un rol bifat aici apare în panoul rolului
 * Source: docs/testing/cases/TC-VL-04.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.39). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document type and the role are created through the routes the
 *     screens call, with `TC-E2E-VL-04` names, and removed in `finally` (the
 *     type first; its pairs go with it).
 *   - Slice #38.39's pictures, not steps of the case: the page's three tabs at
 *     1366 and 1920 px, into `playwright-report/document-type-page/`.
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_MARKER } from "../helpers/records";

const MARK = `${E2E_MARKER}VL-04`;
const TYPE = `${MARK} Tip`;
const ROLE = `${MARK} Rol`;
const TYPES = "/api/admin/value-lists/document-types";
const ROLES = "/api/admin/value-lists/person-roles";
const SHOTS = "playwright-report/document-type-page";

async function removeOurs(request: APIRequestContext, list: string): Promise<void> {
  const res = await request.get(list);
  const items = ((await res.json()) as { items: { id: string; name: string }[] }).items;
  for (const r of items) if (r.name.startsWith(MARK)) await request.delete(`${list}/${r.id}`);
}

async function photograph(page: Page, name: string): Promise<void> {
  const target = page.locator("main");
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-VL-04 — un tip de act pe pagina lui", () => {
  test("deschis din listă; General, Formular, Roluri; rolul bifat aici, cu „Deține cotă”, apare în panoul rolului", async ({ page }) => {
    test.slow();
    await removeOurs(page.request, TYPES);
    await removeOurs(page.request, ROLES);
    await page.setViewportSize({ width: 1366, height: 900 });
    try {
      const type = await page.request.post(TYPES, { data: { name: TYPE } });
      expect(type.ok(), `POST ${TYPES} failed (${type.status()})`).toBeTruthy();
      const code = ((await type.json()) as { key: string }).key;
      const role = await page.request.post(ROLES, { data: { name: ROLE } });
      expect(role.ok(), `POST ${ROLES} failed (${role.status()})`).toBeTruthy();

      // Step 1 — „Tipuri de Document": the type's row has „Deschide", which opens its page.
      await page.goto("/admin/value-lists?list=document-types");
      const row = page.locator("tbody tr").filter({ has: page.locator("td:first-child", { hasText: TYPE }) });
      await row.getByRole("link", { name: "Deschide", exact: true }).click({ timeout: 30_000 });
      await expect(page).toHaveURL(new RegExp(`/admin/value-lists/document-types/${code}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: TYPE, level: 1 })).toBeVisible({ timeout: 30_000 });

      // Step 2 — three tabs; „General": the name, the short name, the code read-only.
      for (const tab of ["General", "Formular", "Roluri"]) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
      }
      await expect(page.getByRole("tab", { name: "General", exact: true })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("textbox", { name: "Denumire", exact: true })).toHaveValue(TYPE);
      await expect(page.locator("[data-type-code]")).toHaveText(code);
      await expect(page.getByText("Codul nu se schimbă", { exact: false })).toBeVisible();
      await photograph(page, "general");

      // Step 3 — „Formular": no form yet, and „Creează formularul".
      await page.getByRole("tab", { name: "Formular", exact: true }).click();
      await expect(page.getByText("Acest tip nu are încă formular.", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Creează formularul", exact: true })).toBeVisible();

      // Step 4 — „Roluri": none; add the role, tick „Deține cotă"; still there after a reload.
      await page.getByRole("tab", { name: "Roluri", exact: true }).click();
      await expect(page).toHaveURL(/\?tab=roles$/);
      await expect(page.getByText("Acest tip nu oferă încă niciun rol. Adăugați unul mai jos.", { exact: true })).toBeVisible({ timeout: 15_000 });
      await page.getByRole("combobox", { name: "Adaugă un rol", exact: true }).selectOption({ label: ROLE });
      await page.getByRole("button", { name: "Adaugă rolul", exact: true }).click();
      const tick = page.getByRole("checkbox", { name: `Deține cotă — ${TYPE} — ${ROLE}`, exact: true });
      await expect(tick).not.toBeChecked({ timeout: 15_000 });
      // The tick shows at once (optimistically), so the reload waits for the PATCH itself —
      // a `networkidle` wait resolves at once on a page that has long been idle, and the
      // first runner run (20261008T083305Z-28735) reloaded with the PATCH still in flight.
      const saved = page.waitForResponse(
        (r) => r.url().includes("/api/admin/doc-type-person-roles/") && r.request().method() === "PATCH",
      );
      await tick.check();
      expect((await saved).ok()).toBeTruthy();
      await expect(tick).toBeChecked();
      await page.reload();
      await expect(page.getByRole("checkbox", { name: `Deține cotă — ${TYPE} — ${ROLE}`, exact: true })).toBeChecked({ timeout: 30_000 });
      await photograph(page, "roles");

      // Step 5 — the role's panel: the type under „Tipuri de act", „Deține cotă" ticked.
      await page.goto("/admin/value-lists?list=person-roles");
      const roles = page.getByRole("region", { name: "Roluri", exact: true });
      const roleRow = roles.locator("tbody tr").filter({ has: page.locator("td:first-child", { hasText: ROLE }) });
      await roleRow.getByRole("button", { name: "Editează", exact: true }).click({ timeout: 30_000 });
      const panel = roles.locator("[data-role-scope]");
      await expect(panel.locator(`[data-pair="${TYPE}"]`)).toBeVisible({ timeout: 15_000 });
      await expect(panel.getByRole("checkbox", { name: `Deține cotă — ${TYPE} — ${ROLE}`, exact: true })).toBeChecked();
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      await removeOurs(page.request, TYPES);
      await removeOurs(page.request, ROLES);
    }
  });
});
