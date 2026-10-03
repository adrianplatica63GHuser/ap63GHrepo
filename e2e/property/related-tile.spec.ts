/**
 * Case:   TC-PROP-07 — „Corelate" pe o proprietate: persoanele fizice, juridice, proprietățile și actele într-o singură fișă, relația după „Relația"
 * Source: docs/testing/cases/TC-PROP-07.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PROP-07` (records.ts); the links are posted
 *     through the routes „Asociază" calls.
 *   - „Corelate" is ticked with `showTile` in this browser's own profile,
 *     where the case uses `?tab=related`.
 *   - Slice #37.66's pictures, not steps of the case: „Corelate" with the
 *     bubble open and after „Dezasociază", at 1366 and 1920 px, into
 *     `playwright-report/property-related-tile/`.
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

const MARK = `${E2E_MARKER}PROP-07`;
const PERSON = `Ion ${MARK}`;
const COMPANY = `${MARK} Firmă SRL`;
const PROPERTY = `${MARK} Teren`;
const WHOLE = `${MARK} Teren întreg`;
const CVC = `${MARK} CVC`;
const ROLE = "Proprietar / Titular de drept real";
const RELATION = "Inclus în";
const SHOTS = "playwright-report/property-related-tile";

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

test.describe("TC-PROP-07 — „Corelate” pe o proprietate", () => {
  test("patru feluri de rânduri în ordine, fără cotă, relația după „Relația”, „Dezasociază” pe firmă, cele trei „Asociază …” și înapoi", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });

    const personRoles = ((await (await page.request.get("/api/admin/value-lists/person-roles")).json()) as { items: { id: string; name: string }[] }).items;
    const owner = personRoles.find((r) => r.name === ROLE);
    const propertyRoles = ((await (await page.request.get("/api/admin/property-property-roles", { timeout: 120_000 })).json()) as { items: { id: string; name: string }[] }).items;
    const inclus = propertyRoles.find((r) => r.name === RELATION);
    expect(owner && inclus, `„${ROLE}" and „${RELATION}" exist`).toBeTruthy();

    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const wholeId = await createProperty(page.request, { nickname: WHOLE });
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const companyId = await createCompany(page.request, { name: COMPANY });
    const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC);
    try {
      await post(page, `/api/properties/${propertyId}/persons`, { personIds: [personId, companyId], personRoleId: owner?.id });
      await post(page, `/api/properties/${propertyId}/references`, { propertyIds: [wholeId], relationshipRoleId: inclus?.id });
      await post(page, `/api/properties/${propertyId}/documents`, { documentIds: [cvcId] });

      // Step 1 — four rows, one line each, in order, with their icons; no „Cotă"; the buttons.
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      const tile = await showTile(page, "Corelate");
      await expect(page.locator('[data-tile-area="right"]').getByRole("region", { name: "Corelate", exact: true })).toHaveCount(0);
      const groups = tile.locator("[data-related-group]");
      await expect(groups).toHaveCount(4, { timeout: 30_000 });
      const expected = [
        ["natural", `${PERSON} (${ROLE})`, /lucide-user\b/],
        ["judicial", `${COMPANY} (${ROLE})`, /lucide-building-?2/],
        ["property", WHOLE, /lucide-map\b/],
        ["document", `${CVC} (Contract de Vânzare)`, /lucide-file-text/],
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
      await expect(tile.getByRole("button", { name: "Cotă", exact: true })).toHaveCount(0);
      await expect(tile.getByRole("heading")).toHaveCount(1); // the tile's own title, nothing over the groups
      const names = ["Asociază persoană", "Asociază proprietate", "Asociază act", "Dezasociază"];
      const tops = await Promise.all(names.map(async (name) => Math.round((await tile.getByRole("button", { name, exact: true }).boundingBox())?.y ?? -1)));
      expect(new Set(tops).size, `one row: ${tops.join(", ")}`).toBe(1);

      // Steps 2–3 — „Relația" on the other property: the bubble; a click outside hides it.
      const wholeRow = groups.nth(2).locator("li[data-one-line-row]");
      await expect(wholeRow).not.toContainText(RELATION);
      await wholeRow.getByRole("button", { name: "Relația", exact: true }).click();
      const bubble = page.getByRole("status").filter({ hasText: RELATION });
      await expect(bubble).toHaveText(`această proprietate „${RELATION}” ${WHOLE}`);
      await photograph(page, "property-related-relation", tile);
      await tile.getByRole("heading", { name: "Corelate" }).click();
      await expect(bubble).toHaveCount(0);

      // Step 4 — the company's radio, „Dezasociază": its row and group go; the rest stay.
      await tile.getByRole("radio", { name: COMPANY, exact: true }).check();
      await expect(tile.locator('input[type="radio"]:checked')).toHaveCount(1);
      await tile.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(groups).toHaveCount(3, { timeout: 15_000 });
      await expect(tile.locator('[data-related-group="judicial"]')).toHaveCount(0);
      for (const text of [PERSON, WHOLE, CVC]) await expect(tile.locator("[data-row-content]").filter({ hasText: text })).toHaveCount(1);
      await photograph(page, "property-related", tile);

      // Steps 5–7 — each „Asociază …" opens its screen; „Anulează" comes back to „Corelate".
      for (const [button, heading, tab] of [
        ["Asociază persoană", "Asociere persoană", "persons"],
        ["Asociază proprietate", "Asociere proprietate corelată", "related"],
        ["Asociază act", "Asociere act", "document"],
      ] as const) {
        await page.getByRole("region", { name: "Corelate", exact: true }).getByRole("button", { name: button, exact: true }).click();
        await expect(page.getByRole("heading", { name: heading })).toBeVisible({ timeout: 30_000 });
        await page.getByRole("button", { name: "Anulează", exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?tab=${tab}$`), { timeout: 30_000 });
        await expect(page.getByRole("region", { name: "Corelate", exact: true }).locator("[data-related-rows]")).toBeVisible({ timeout: 30_000 });
      }
    } finally {
      // Bounded: the map and Street View keep a property's network busy, so an
      // unbounded „networkidle" waited out the test (full 20261003T180836Z-93).
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await removeRecord(page.request, "document", cvcId);
      await removeRecord(page.request, "person", personId);
      await removeRecord(page.request, "company", companyId);
      await removeRecord(page.request, "property", propertyId);
      await removeRecord(page.request, "property", wholeId);
    }
  });
});
