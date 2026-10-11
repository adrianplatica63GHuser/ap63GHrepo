/**
 * Case:   TC-INT-06 — „Interacțiuni” pe persoană: istoricul ei, pe ecran și în Incursiune; cele două butoane deschid modulul
 * Source: docs/testing/cases/TC-INT-06.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The company and its two interactions carry `TC-E2E-INT-06` (records.ts) and are made through the API. A
 *     company, because its screen shows „Interacțiuni" ticked by default (a natural person's does not, #38.30).
 *   - The pictures for Slice #38.89's handover go to playwright-report/interactions-person, invented records only;
 *     the signed-in name and „Recente" are painted over.
 */

import fs from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INT-06`;
const SHOTS = "playwright-report/interactions-person";
const DAY = 24 * 3600_000;

async function log(request: APIRequestContext, personId: string, subject: string, channel: string, daysAgo: number): Promise<string> {
  const res = await request.post("/api/interactions", {
    data: { personId, subject, channel, direction: "OUTBOUND", status: "LOGGED", occurredAt: new Date(Date.now() - daysAgo * DAY).toISOString() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function picture(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    mask: [
      page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
      page.locator("aside").getByText(/^Autentificat ca/),
    ],
  });
}

test.describe("TC-INT-06 — istoricul pe fișa persoanei", () => {
  test("cele două, cele mai noi întâi, pe ecran și în Incursiune; „Deschide în „Interacțiuni”” și „Interacțiune nouă”; un rând deschide modulul pe el", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const firm = await createCompany(page.request, { name: `${MARK} Construct SRL` });
    try {
      await log(page.request, firm, "Ofertă de preț", "EMAIL", 3);
      const recent = await log(page.request, firm, "Întâlnire pe șantier", "MEETING", 1);
      await page.setViewportSize({ width: 1366, height: 1000 });

      // Step 1 — the company's screen: „Interacțiuni" lists both, newest first, with no box to type in.
      await page.goto(`/judicial-persons/${firm}`);
      const tile = page.getByRole("region", { name: "Interacțiuni", exact: true });
      const subjects = tile.locator("[data-person-interaction] [data-subject]");
      await expect(subjects).toHaveText(["Întâlnire pe șantier", "Ofertă de preț"], { timeout: 30_000 });
      await expect(tile.locator("input, textarea, select")).toHaveCount(0);
      await tile.scrollIntoViewIfNeeded();
      await picture(page, "company-1366");

      // Step 2 — „Deschide în „Interacțiuni””: the module, scoped to the company.
      await tile.getByRole("button", { name: "Deschide în „Interacțiuni”", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/interactions\\?person=${firm}$`), { timeout: 30_000 });
      await expect(page.locator("[data-interactions-scope]")).toContainText(`${MARK} Construct SRL`, { timeout: 30_000 });

      // Step 3 — back; „Interacțiune nouă": the module, a new record with the company filled in.
      await page.goto(`/judicial-persons/${firm}`);
      await tile.getByRole("button", { name: "Interacțiune nouă", exact: true }).click();
      await expect(page).toHaveURL(/new=1/, { timeout: 30_000 });
      const logTile = page.locator("[data-interactions-log]");
      await expect(logTile.getByRole("radio", { name: "Înregistrare nouă" })).toBeChecked();
      await expect(logTile.getByRole("combobox", { name: "Persoană" })).toHaveValue(new RegExp(`${MARK} Construct SRL`), { timeout: 30_000 });

      // Step 4 — back; a row: the module, with that row chosen and loaded.
      await page.goto(`/judicial-persons/${firm}`);
      await tile.locator(`[data-person-interaction="${recent}"]`).click();
      await expect(page).toHaveURL(new RegExp(`select=${recent}`), { timeout: 30_000 });
      await expect(page.locator(`[data-interaction-row="${recent}"]`)).toHaveAttribute("aria-selected", "true", { timeout: 30_000 });
      await expect(logTile.getByLabel("Subiect", { exact: true })).toHaveValue("Întâlnire pe șantier", { timeout: 15_000 });

      // Step 5 — „Persoane Juridice", the company's „Incursiune": the same two rows.
      await page.goto("/judicial-persons");
      const search = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const row = page.locator("main [data-list-edge] tbody tr").filter({ hasText: `${MARK} Construct SRL` });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await expect(async () => {
        await row.getByRole("button", { name: "Incursiune", exact: true }).click();
        await expect(page.locator('[data-incursion="company"]')).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000 });
      const peek = page.locator('[data-incursion="company"] [data-tile="interactions"]');
      await expect(peek.locator("[data-person-interaction] [data-subject]")).toHaveText(["Întâlnire pe șantier", "Ofertă de preț"], { timeout: 30_000 });
      await picture(page, "incursion-1366");
    } finally {
      await removeRecord(page.request, "company", firm);
    }
  });
});
