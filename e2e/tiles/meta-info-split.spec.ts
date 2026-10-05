/**
 * Case:   TC-TILES-08 — META INFO în două: „Clasificări" și „Conexiuni", explicațiile în bule
 * Source: docs/testing/cases/TC-TILES-08.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-08` (records.ts).
 *   - A Playwright browser has never chosen, so the property opens with its
 *     defaults plus the two tiles `?tab=metadata` adds.
 *   - Slice #37.63's pictures, not steps of the case: the two tiles on the
 *     property and on the document, at 1366 and 1920 px, and their sizes, into
 *     `playwright-report/meta-info-split/` (after-*.png, after.json) — the
 *     „before" pictures were taken by an earlier version of this file.
 */

import fs from "node:fs";
import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
} from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-08`;
const SHOTS = "playwright-report/meta-info-split";
const CLASSIFICATION = "Clasificări";
const CONNECTIONS = "Conexiuni";

/** Step 1's reading, on any record's screen opened with `?tab=metadata`. */
async function twoTiles(page: Page, url: string): Promise<{ cls: Locator; con: Locator }> {
  await page.goto(url);
  const cls = page.getByRole("region", { name: CLASSIFICATION, exact: true });
  const con = page.getByRole("region", { name: CONNECTIONS, exact: true });
  await expect(cls).toBeVisible({ timeout: 30_000 });
  await expect(con).toBeVisible();
  await expect(tileBox(page, CLASSIFICATION)).toBeChecked();
  await expect(tileBox(page, CONNECTIONS)).toBeChecked();
  await expect(tileBox(page, "META INFO")).toHaveCount(0);
  await expect(cls.locator("h3, h4")).toHaveText(["Importanță", "Relevanță", "Proveniență", "Istoric"], { timeout: 30_000 });
  await expect(con.locator("h3")).toHaveText(["Etichete / Cuvinte cheie", "Grupuri", "Ștampile", "Vezi și"]);
  // No explanation under any title: the only lines are what is true of this record.
  await expect(cls.locator("p:not(.sr-only)")).toHaveText(["Actualizat azi", "Niciun istoric înregistrat încă"]);
  await expect(con.locator("p:not(.sr-only)")).toHaveText([
    "Nicio etichetă adăugată încă", "Nu face parte din niciun grup", "Nicio ștampilă aplicată", "Nicio trimitere adăugată încă",
  ]);
  return { cls, con };
}

/** Step 2: a rest on „Importanță" opens its bubble; leaving closes it. */
async function importanceBubble(page: Page, cls: Locator): Promise<void> {
  const bubble = cls.getByRole("tooltip").filter({ hasText: "Reflectă valoarea subiectivă pe care o acorzi acestui element" });
  await expect(bubble).toHaveClass(/sr-only/);
  await cls.getByRole("heading", { name: "Importanță", exact: true }).hover();
  await expect(bubble).not.toHaveClass(/sr-only/);
  await page.mouse.move(5, 5);
  await expect(bubble).toHaveClass(/sr-only/);
}

async function photograph(page: Page, kind: string, cls: Locator, con: Locator, sizes: Record<string, unknown>): Promise<void> {
  for (const width of [1366, 1920]) {
    // Tall enough for both tiles whole.
    await page.setViewportSize({ width, height: 1400 });
    await page.waitForTimeout(300);
    await cls.screenshot({ path: `${SHOTS}/after-${kind}-classification-${width}.png` });
    await con.screenshot({ path: `${SHOTS}/after-${kind}-connections-${width}.png` });
    const [a, b] = [await cls.boundingBox(), await con.boundingBox()];
    sizes[`${kind}-${width}`] = { classification: [a?.width, a?.height], connections: [b?.width, b?.height] };
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-TILES-08 — META INFO în două", () => {
  test("„Clasificări” și „Conexiuni” pe cele patru ecrane, explicațiile în bule", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    fs.mkdirSync(SHOTS, { recursive: true });
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids = {
      property: await createProperty(page.request, { nickname: `${MARK} Teren de test` }),
      document: await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act de test`),
      person:   await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" }),
      company:  await createCompany(page.request, { name: `${MARK} Firmă de test SRL` }),
    };
    const sizes: Record<string, unknown> = {};
    try {
      // Step 1 — the property with `?tab=metadata`: the two tiles, no „META INFO", no explanation.
      const { cls, con } = await twoTiles(page, `/properties/${ids.property}?tab=metadata`);
      await photograph(page, "property", cls, con, sizes);

      // Step 2 — „Importanță"'s bubble.
      await importanceBubble(page, cls);

      // Step 3 — Proveniență's value, „Manual (Adaugă nou)", and what it means.
      const provenance = cls.locator("select").nth(2);
      await expect(provenance.locator("option:checked")).toHaveText("Manual (Adaugă nou)");
      const meaning = cls.getByRole("tooltip").filter({ hasText: "Acest element a fost introdus manual" });
      await expect(meaning).toHaveClass(/sr-only/);
      await provenance.hover();
      await expect(meaning).not.toHaveClass(/sr-only/);
      await page.mouse.move(5, 5);
      await expect(meaning).toHaveClass(/sr-only/);

      // Step 4 — the document, the natural person and the company the same way.
      const doc = await twoTiles(page, `/documents/${ids.document}?tab=metadata`);
      await photograph(page, "document", doc.cls, doc.con, sizes);
      await importanceBubble(page, doc.cls);
      for (const url of [`/natural-persons/${ids.person}?tab=metadata`, `/judicial-persons/${ids.company}?tab=metadata`]) {
        const other = await twoTiles(page, url);
        await importanceBubble(page, other.cls);
      }
      fs.writeFileSync(`${SHOTS}/after.json`, JSON.stringify(sizes, null, 2));
    } finally {
      await removeRecord(page.request, "property", ids.property);
      await removeRecord(page.request, "document", ids.document);
      await removeRecord(page.request, "person", ids.person);
      await removeRecord(page.request, "company", ids.company);
    }
  });
});
