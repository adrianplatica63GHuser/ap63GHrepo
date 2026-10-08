/**
 * Case:   TC-DOC-19 — „Părți" pe un contract de vânzare: vânzătorii și cumpărătorii pe grupe, cu „Cotă"; restul legăturilor pe „Legături"
 * Source: docs/testing/cases/TC-DOC-19.md, „Last green" 2026-10-07
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-DOC-19` (records.ts); the three links are
 *     posted through POST /api/documents/[id]/persons, as „Asociază" does.
 *   - „Părți" and „Legături" are ticked with `showTile` in this browser's own
 *     profile; both are default tiles, so a fresh profile shows them anyway.
 *   - Slice #38.33's pictures, not steps of the case: „Părți" and the whole
 *     page at 1366 and 1920 px, into `playwright-report/sale-parties/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createDocumentOfType,
  createNaturalPerson,
  removeLeftovers,
  removeRecord,
} from "../helpers/records";
import { expectOneLine, lineRow, showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-19`;
const SELLER = `Ion ${MARK}`;
const NOTARY = `Maria ${MARK}`;
const BUYER = `${MARK} Firmă SRL`;
const CVC = `${MARK} CVC`;
const SHOTS = "playwright-report/sale-parties";

type Pair = { personRoleId: string; personRoleName: string; documentTypeName: string; holdsShare: boolean };

async function post(page: Page, url: string, data: unknown): Promise<void> {
  const res = await page.request.post(url, { data });
  expect(res.ok(), `POST ${url} failed (${res.status()})`).toBeTruthy();
}

async function photograph(page: Page, name: string, target: Locator | null): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    if (target) await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
    else await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

const rowTexts = (tile: Locator) => tile.locator("[data-row-content]");

test.describe("TC-DOC-19 — „Părți” pe un contract de vânzare", () => {
  test("vânzătorul și cumpărătorul pe „Părți”, pe grupe, cu „Cotă”; notarul pe „Legături”; „Dezasociază” pe „Părți”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });

    const pairs = ((await (await page.request.get("/api/admin/doc-type-person-roles")).json()) as { items: Pair[] }).items;
    const role = (name: string) => pairs.find((p) => p.documentTypeName === "Contract de Vânzare" && p.personRoleName === name);
    const [vanzator, cumparator, notar] = [role("Vânzător"), role("Cumpărător"), role("Notar")];
    expect(vanzator?.holdsShare && cumparator?.holdsShare, "„Vânzător\" and „Cumpărător\" hold a share (Before you start)").toBe(true);
    expect(notar?.holdsShare, "„Notar\" holds none (Before you start)").toBe(false);

    const sellerId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const notaryId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Maria" });
    const buyerId = await createCompany(page.request, { name: BUYER });
    const cvcId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC);
    try {
      // Posted buyer first, so the order on „Părți" is the tile's, not the links'.
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [buyerId], personRoleId: cumparator?.personRoleId });
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [sellerId], personRoleId: vanzator?.personRoleId });
      await post(page, `/api/documents/${cvcId}/persons`, { personIds: [notaryId], personRoleId: notar?.personRoleId });

      // Step 1 — „Părți": „Vânzător" over the seller, „Cumpărător" over the buyer, each with „Cotă".
      await page.goto(`/documents/${cvcId}`);
      await expect(page.getByRole("heading", { name: CVC })).toBeVisible({ timeout: 30_000 });
      const parties = await showTile(page, "Părți");
      await expect(parties.locator("[data-party-group-heading]")).toHaveText(["Vânzător", "Cumpărător"], { timeout: 30_000 });
      await expect(rowTexts(parties)).toHaveText([`${SELLER} (Vânzător)`, `${BUYER} (Cumpărător)`]);
      for (const name of [SELLER, BUYER]) {
        const row = lineRow(parties, name);
        await expectOneLine(row);
        await expect(row.getByRole("button", { name: "Cotă", exact: true })).toBeVisible();
      }
      await expect(parties.getByRole("button", { name: "Asociază persoană", exact: true })).toBeVisible();
      await expect(parties.getByRole("button", { name: "Asociază proprietate", exact: true })).toHaveCount(0);
      await photograph(page, "cvc-parties", parties);

      // Step 2 — „Legături": the notary only.
      const links = await showTile(page, "Legături");
      await expect(rowTexts(links)).toHaveText([`${NOTARY} (Notar)`], { timeout: 30_000 });
      await photograph(page, "cvc-page", null);

      // Step 3 — „Părți"'s „Asociază persoană", then „Anulează": back on the contract.
      await parties.getByRole("button", { name: "Asociază persoană", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      await page.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${cvcId}\\?tab=persons$`), { timeout: 30_000 });
      await expect(parties.locator("[data-party-group-heading]")).toHaveText(["Vânzător", "Cumpărător"], { timeout: 30_000 });

      // Step 4 — the seller's radio, „Dezasociază" on „Părți": the seller and its heading go.
      await parties.getByRole("radio", { name: `${SELLER} — Vânzător` }).check();
      await parties.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(parties.locator("[data-party-group-heading]")).toHaveText(["Cumpărător"], { timeout: 15_000 });
      await expect(rowTexts(parties)).toHaveText([`${BUYER} (Cumpărător)`]);
      await expect(rowTexts(links)).toHaveText([`${NOTARY} (Notar)`]);
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      await removeRecord(page.request, "document", cvcId);
      await removeRecord(page.request, "person", sellerId);
      await removeRecord(page.request, "person", notaryId);
      await removeRecord(page.request, "company", buyerId);
    }
  });
});
