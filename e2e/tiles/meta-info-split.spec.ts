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
import { test, expect, type Locator, type Page } from "../helpers/test";
import {
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
} from "../helpers/records";
import { tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-08`;
const SHOTS = "playwright-report/meta-info-split";
const CLASSIFICATION = "Clasificare";
const CONNECTIONS = "Etichete și grupuri";

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
  // 41.37 — was ["Actualizat azi", "Niciun istoric înregistrat încă"]: on a record of one version the top line went
  // into „Clasificare"'s „i" bubble (the review), so the tile's only line is the history's.
  await expect(cls.locator("p:not(.sr-only)")).toHaveText(["Niciun istoric înregistrat încă"]);
  await expect(con.locator("p:not(.sr-only)")).toHaveText([
    "Nicio etichetă adăugată încă", "Nu face parte din niciun grup", "Nicio ștampilă aplicată", "Nicio trimitere adăugată încă",
  ]);
  return { cls, con };
}

/**
 * Step 2: „Importanță"'s explanation. Inverted in place for 41.28 („one „i"") and 41.37 (the „i" on the title's line) —
 * it was: a rest on the heading „Importanță" opens its own bubble and leaving closes it. The headings have no bubble of
 * their own since 41.28; the tile's one „i" holds every explanation (TC-TILES-16 step 3b, classification-dividers).
 */
async function importanceBubble(page: Page, cls: Locator): Promise<void> {
  const info = cls.locator("[data-tile-title-line] button:has([data-info-glyph])");
  await expect(info).toHaveCount(1);
  await info.click();
  await expect(cls.locator("[data-tile-title-line] [role=tooltip]")).toContainText("Reflectă valoarea subiectivă pe care o acorzi acestui element");
  await info.click();
  await page.mouse.move(5, 5);
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

      // Step 3 — Proveniență's value, „Manual (Adaugă nou)", and what it means. 41.10: read as text, not a select.
      const provenance = cls.locator('[data-read-value="classification.provenance"]');
      await expect(provenance).toHaveText("Manual (Adaugă nou)");
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
