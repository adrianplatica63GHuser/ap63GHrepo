/**
 * Case:   TC-PERS-05 — „Corelate" pe o persoană fizică și pe o firmă: persoanele, proprietățile și actele într-o singură fișă, rolul în act după „Relația"
 * Source: docs/testing/cases/TC-PERS-05.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PERS-05` (records.ts); the links are posted
 *     through the routes „Asociază" calls.
 *   - „Corelate" is ticked with `showTile` in this browser's own profile,
 *     where the case uses `?tab=related`.
 *   - Slice #37.67's pictures, not steps of the case: each person's „Corelate"
 *     with the contract's bubble open, at 1366 and 1920 px, into
 *     `playwright-report/person-related-tile/`.
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

const MARK = `${E2E_MARKER}PERS-05`;
const ION = `Ion ${MARK}`;
const MARIA = `Maria ${MARK}`;
const COMPANY = `${MARK} Firmă SRL`;
const PROPERTY = `${MARK} Teren`;
const CVC = `${MARK} CVC`;
const OWNER = "Proprietar / Titular de drept real";
const SHOTS = "playwright-report/person-related-tile";

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

/** The groups' kinds and their rows' content, in order; each row one line, the line on every group but the first. */
async function expectRows(tile: Locator, expected: readonly (readonly [string, string, RegExp])[]): Promise<void> {
  const groups = tile.locator("[data-related-group]");
  await expect(groups).toHaveCount(expected.length, { timeout: 30_000 });
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
}

/** Steps 6–8 and 12: each „Asociază …" opens its screen; „Anulează" comes back to „Corelate". */
async function associateAndBack(page: Page, base: string): Promise<void> {
  for (const [button, heading, tab] of [
    ["Asociază persoană", "Asociere persoană corelată", "related"],
    ["Asociază proprietate", "Asociere proprietate", "properties"],
    ["Asociază act", "Asociere act", "document"],
  ] as const) {
    await page.getByRole("region", { name: "Legături", exact: true }).getByRole("button", { name: button, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Anulează", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${base}\\?tab=${tab}$`), { timeout: 30_000 });
    await expect(page.getByRole("region", { name: "Legături", exact: true }).locator("[data-related-rows]")).toBeVisible({ timeout: 30_000 });
  }
}

test.describe("TC-PERS-05 — „Corelate” pe o persoană fizică și pe o firmă", () => {
  test("patru feluri de rânduri în ordine, fără cotă, rolul în act după „Relația”, „Dezasociază”, cele trei „Asociază …” și înapoi — pe persoană și pe firmă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });

    const roles = ((await (await page.request.get("/api/admin/value-lists/person-roles")).json()) as { items: { id: string; name: string }[] }).items;
    const role = (name: string): string | undefined => roles.find((r) => r.name === name)?.id;
    const pairs = ((await (await page.request.get("/api/admin/doc-type-person-roles")).json()) as { items: Pair[] }).items;
    const seller = pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Vânzător");
    const buyer = pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === "Cumpărător");
    expect(role("Soț") && role("Reprezentant legal / Mandatar") && role(OWNER) && seller && buyer, "the roles exist").toBeTruthy();

    const ionId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion", gender: "MALE" });
    const mariaId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Maria", gender: "FEMALE" });
    const companyId = await createCompany(page.request, { name: COMPANY });
    const propertyId = await createProperty(page.request, { nickname: PROPERTY });
    const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC);
    try {
      await post(page, `/api/people/${ionId}/references`, { personIds: [mariaId], relationshipRoleId: role("Soț") });
      await post(page, `/api/people/${companyId}/references`, { personIds: [ionId], relationshipRoleId: role("Reprezentant legal / Mandatar") });
      await post(page, `/api/people/${ionId}/properties`, { propertyIds: [propertyId], personRoleId: role(OWNER) });
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [ionId], personRoleId: seller?.personRoleId });
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [companyId], personRoleId: buyer?.personRoleId });

      // Step 1 — on Ion: four rows, one line each, in order, with their icons; no „Cotă"; the buttons.
      await page.goto(`/natural-persons/${ionId}`);
      await expect(page.getByRole("heading", { name: ION })).toBeVisible({ timeout: 30_000 });
      const tile = await showTile(page, "Legături");
      await expectRows(tile, [
        ["natural", `${MARIA} (Soț)`, /lucide-user\b/],
        ["judicial", `${COMPANY} (Reprezentat / Mandant)`, /lucide-building-?2/],
        ["property", `${PROPERTY} (${OWNER})`, /lucide-map\b/],
        ["document", `${CVC} (Contract de Vânzare)`, /lucide-file-text/],
      ]);
      await expect(tile.getByRole("button", { name: "Cotă", exact: true })).toHaveCount(0);
      await expect(tile.getByRole("heading")).toHaveCount(1); // the tile's own title, nothing over the groups
      const names = ["Asociază persoană", "Asociază proprietate", "Asociază act", "Dezasociază"];
      const tops = await Promise.all(names.map(async (name) => Math.round((await tile.getByRole("button", { name, exact: true }).boundingBox())?.y ?? -1)));
      expect(new Set(tops).size, `one row: ${tops.join(", ")}`).toBe(1);

      // Steps 2–3 — „Relația" on the contract: the person's role in it; a click outside hides it.
      const contract = tile.locator('[data-related-group="document"] li[data-one-line-row]');
      await expect(contract).not.toContainText("Vânzător");
      await expect(tile.getByRole("button", { name: "Relația", exact: true })).toHaveCount(1);
      await contract.getByRole("button", { name: "Relația", exact: true }).click();
      const bubble = page.getByRole("status").filter({ hasText: "Rol: „" });
      await expect(bubble).toHaveText("Rol: „Vânzător”");
      await photograph(page, "natural-person-related", tile);
      await tile.getByRole("heading", { name: "Legături" }).click();
      await expect(bubble).toHaveCount(0);

      // Steps 4–5 — Maria's radio, alone; the „Asociază …" not offered; „Dezasociază": her row and group go.
      await tile.getByRole("radio", { name: MARIA, exact: true }).check();
      await expect(tile.locator('input[type="radio"]:checked')).toHaveCount(1);
      for (const name of names.slice(0, 3)) await expect(tile.getByRole("button", { name, exact: true })).toBeDisabled();
      await tile.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(tile.locator("[data-related-group]")).toHaveCount(3, { timeout: 15_000 });
      await expect(tile.locator('[data-related-group="natural"]')).toHaveCount(0);
      for (const text of [COMPANY, PROPERTY, CVC]) await expect(tile.locator("[data-row-content]").filter({ hasText: text })).toHaveCount(1);

      // Steps 6–8.
      await associateAndBack(page, `/natural-persons/${ionId}`);

      // Step 9 — on the company: Ion and the contract.
      await page.goto(`/judicial-persons/${companyId}`);
      await expect(page.getByRole("heading", { name: COMPANY })).toBeVisible({ timeout: 30_000 });
      const onCompany = await showTile(page, "Legături");
      await expectRows(onCompany, [
        ["natural", `${ION} (Reprezentant legal / Mandatar)`, /lucide-user\b/],
        ["document", `${CVC} (Contract de Vânzare)`, /lucide-file-text/],
      ]);

      // Step 10 — „Relația" on the contract, then Esc.
      await onCompany.locator('[data-related-group="document"]').getByRole("button", { name: "Relația", exact: true }).click();
      await expect(bubble).toHaveText("Rol: „Cumpărător”");
      await photograph(page, "judicial-person-related", onCompany);
      await page.keyboard.press("Escape");
      await expect(bubble).toHaveCount(0);

      // Step 11 — the contract's radio, „Dezasociază": its row and group go; Ion stays.
      await onCompany.getByRole("radio", { name: `${CVC} — Cumpărător`, exact: true }).check();
      await onCompany.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(onCompany.locator("[data-related-group]")).toHaveCount(1, { timeout: 15_000 });
      await expect(onCompany.locator('[data-related-group="natural"] [data-row-content]')).toHaveText(`${ION} (Reprezentant legal / Mandatar)`);

      // Step 12.
      await associateAndBack(page, `/judicial-persons/${companyId}`);
    } finally {
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
      await removeRecord(page.request, "document", cvcId);
      await removeRecord(page.request, "person", ionId);
      await removeRecord(page.request, "person", mariaId);
      await removeRecord(page.request, "company", companyId);
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
