/**
 * Case:   TC-DOC-10 — „Corelate" pe un act: persoanele fizice, juridice, proprietățile și actele într-o singură fișă, un singur „Dezasociază"
 * Source: docs/testing/cases/TC-DOC-10.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-10` (records.ts); the links are posted
 *     through the routes „Asociază" calls.
 *   - „Corelate" is ticked with `showTile` in this browser's own profile,
 *     where the case uses `?tab=related`.
 *   - Slice #37.65's pictures, not steps of the case: „Corelate" with a row
 *     selected, at 1366 and 1920 px, into `playwright-report/related-tile/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createDocumentOfType,
  createNaturalPerson,
  createProperty,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { expectOneLine, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-10`;
const PERSON = `Ion ${MARK}`;
const COMPANY = `${MARK} Firmă SRL`;
const PROPERTY = `${MARK} Teren`;
const CVC = `${MARK} CVC`;
const PAD = `${MARK} PAD`;
const SHOTS = "playwright-report/related-tile";

type Pair = { personRoleId: string; personRoleName: string; documentTypeName: string };

async function post(page: Page, url: string, data: unknown): Promise<void> {
  const res = await page.request.post(url, { data });
  expect(res.ok(), `POST ${url} failed (${res.status()})`).toBeTruthy();
}

async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-10 — „Corelate” pe un act", () => {
  test("patru feluri de rânduri în ordine, o singură selecție, „Dezasociază” pe firmă, cele trei „Asociază …” și înapoi", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });

    const pairs = ((await (await page.request.get("/api/admin/doc-type-person-roles")).json()) as { items: Pair[] }).items;
    const seller = pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Vânzător");
    const buyer = pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Cumpărător");
    expect(seller && buyer, "Contract de Vânzare offers „Vânzător\" and „Cumpărător\"").toBeTruthy();
    const roles = ((await (await page.request.get("/api/admin/document-document-roles")).json()) as { items: { id: string; name: string }[] }).items;
    const titluAnterior = roles.find((r) => r.name === "Titlu anterior al");

    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const companyId = await createCompany(page.request, { name: COMPANY });
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC);
    const padId = await createDocumentOfType(page.request, "PLAN_AMPLASAMENT_DELIMITARE", PAD);
    try {
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [personId], personRoleId: seller?.personRoleId });
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [companyId], personRoleId: buyer?.personRoleId });
      await post(page, `/api/documents/${cvcId}/properties`, { propertyIds: [propertyId] });
      await post(page, `/api/documents/${padId}/references`, { documentIds: [cvcId], relationshipRoleId: titluAnterior?.id });

      // Step 1 — four rows, one line each, in order, with their icons; the buttons.
      await page.goto(`/documents/${cvcId}`);
      await expect(page.getByRole("heading", { name: CVC })).toBeVisible({ timeout: 30_000 });
      const tile = await showTile(page, "Corelate");
      const groups = tile.locator("[data-related-group]");
      await expect(groups).toHaveCount(4, { timeout: 30_000 });
      const expected = [
        ["natural", `${PERSON} (Vânzător)`, /lucide-user\b/],
        ["judicial", `${COMPANY} (Cumpărător)`, /lucide-building-?2/],
        ["property", PROPERTY, /lucide-map\b/],
        ["document", `${PAD} (Plan de Amplasament și Delimitare)`, /lucide-file-text/],
      ] as const;
      for (const [i, [kind, text, icon]] of expected.entries()) {
        const group = groups.nth(i);
        await expect(group).toHaveAttribute("data-related-group", kind);
        const row = group.locator("li[data-one-line-row]");
        await expect(row).toHaveCount(1);
        await expect(row.locator("[data-row-content]")).toHaveText(text);
        await expect(row.locator("svg").first()).toHaveAttribute("class", icon);
        await expectOneLine(row);
        if (i > 0) await expect(group).toHaveClass(/border-t/);
      }
      await expect(tile.getByRole("heading")).toHaveCount(1); // the tile's own title, nothing over the groups
      const names = ["Asociază persoană", "Asociază proprietate", "Asociază act", "Dezasociază"];
      const tops = await Promise.all(names.map(async (name) => Math.round((await tile.getByRole("button", { name, exact: true }).boundingBox())?.y ?? -1)));
      expect(new Set(tops).size, `one row: ${tops.join(", ")}`).toBe(1);
      await expect(tile.getByRole("button", { name: "Înscrisuri citate", exact: true })).toBeVisible();

      // Step 2 — the property's radio, then the company's: only the company's.
      await tile.getByRole("radio", { name: PROPERTY }).check();
      await tile.getByRole("radio", { name: `${COMPANY} — Cumpărător` }).check();
      await expect(tile.getByRole("radio", { name: PROPERTY })).not.toBeChecked();
      await expect(tile.locator('input[type="radio"]:checked')).toHaveCount(1);
      for (const name of names.slice(0, 3)) await expect(tile.getByRole("button", { name, exact: true })).toBeDisabled();
      await expect(tile.getByRole("button", { name: "Dezasociază", exact: true })).toBeEnabled();
      await photograph(page, "cvc-related-selected", tile);

      // Step 3 — „Dezasociază": the company's row and group go; the rest stay.
      await tile.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(groups).toHaveCount(3, { timeout: 15_000 });
      await expect(tile.locator('[data-related-group="judicial"]')).toHaveCount(0);
      for (const text of [PERSON, PROPERTY, PAD]) await expect(tile.locator("[data-row-content]").filter({ hasText: text })).toHaveCount(1);
      await expect(tile.locator('input[type="radio"]:checked')).toHaveCount(0);
      for (const name of names.slice(0, 3)) await expect(tile.getByRole("button", { name, exact: true })).toBeEnabled();
      await photograph(page, "cvc-related", tile);

      // Steps 4–6 — each „Asociază …" opens its screen; „Anulează" comes back to „Corelate".
      for (const [button, heading, tab] of [
        ["Asociază persoană", "Asociere persoană", "persons"],
        ["Asociază proprietate", "Asociere proprietate", "properties"],
        ["Asociază act", "Asociază Document", "related"],
      ] as const) {
        await page.getByRole("region", { name: "Corelate", exact: true }).getByRole("button", { name: button, exact: true }).click();
        await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
        await page.getByRole("button", { name: "Anulează", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/documents/${cvcId}\\?tab=${tab}$`), { timeout: 30_000 });
        await expect(page.getByRole("region", { name: "Corelate", exact: true }).locator("[data-related-rows]")).toBeVisible({ timeout: 30_000 });
      }
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      await removeRecord(page.request, "document", cvcId);
      await removeRecord(page.request, "document", padId);
      await removeRecord(page.request, "person", personId);
      await removeRecord(page.request, "company", companyId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
