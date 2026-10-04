/**
 * Case:   TC-TILES-09 — „Clasificare subiectivă": Relevanță lângă Importanță, butonul de salvare pe linia „Istoric"
 * Source: docs/testing/cases/TC-TILES-09.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-09` (records.ts).
 *   - The press on „Salvează" is Playwright's own click; the hand runs used the
 *     button's `click()` because the browser pane misplaces clicks in an
 *     emulated window (FU-290).
 *   - „To the pixel" is read as within half a pixel of each other, since
 *     boxes are fractional.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-09`;
const CLASSIFICATION = "Clasificare subiectivă";

async function tile(page: Page, url: string): Promise<Locator> {
  await page.goto(url);
  const cls = page.getByRole("region", { name: CLASSIFICATION, exact: true });
  await expect(cls.locator("select")).toHaveCount(3, { timeout: 30_000 });
  return cls;
}

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

/** Steps 1 and 2 on one record's screen. */
async function layout(cls: Locator): Promise<void> {
  // Step 1 — 476 px (3 units); Relevanță level with Importanță and to its right; Proveniență under both.
  const t = await box(cls);
  expect(Math.round(t.width)).toBe(476);
  const [imp, rel, prov] = [await box(cls.locator("select").nth(0)), await box(cls.locator("select").nth(1)), await box(cls.locator("select").nth(2))];
  expect(Math.abs(rel.y - imp.y)).toBeLessThan(0.5);
  expect(rel.x).toBeGreaterThan(imp.x + imp.width);
  expect(prov.y).toBeGreaterThan(Math.max(imp.y + imp.height, rel.y + rel.height));

  // Step 2 — one „Salvează", disabled, on „ISTORIC"'s line, its right edge the tile's less border and 12 px padding.
  const saves = cls.getByRole("button", { name: "Salvează", exact: true });
  await expect(saves).toHaveCount(1);
  await expect(saves).toBeDisabled();
  const s = await box(saves);
  const h = await box(cls.getByRole("heading", { name: "Istoric", exact: true }));
  const mid = s.y + s.height / 2;
  expect(mid).toBeGreaterThanOrEqual(h.y);
  expect(mid).toBeLessThanOrEqual(h.y + h.height);
  expect(Math.abs(s.x + s.width - (t.x + t.width - 1 - 12))).toBeLessThan(0.5);
}

test.describe("TC-TILES-09 — Relevanță lângă Importanță, salvarea pe linia „Istoric”", () => {
  test("pe cele patru ecrane, și o salvare care scrie", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    const ids = {
      person:   await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" }),
      company:  await createCompany(page.request, { name: `${MARK} Firmă de test SRL` }),
      property: await createProperty(page.request, { nickname: `${MARK} Teren de test` }),
      document: await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act de test`),
    };
    try {
      // Steps 1–2 — the natural person.
      const personUrl = `/natural-persons/${ids.person}?tab=metadata`;
      const cls = await tile(page, personUrl);
      await layout(cls);

      // Step 3 — Importanță to „Ridicată", „Salvează" → „✓ Salvat" on the same line; reopened, „Ridicată".
      await cls.locator("select").nth(0).selectOption({ label: "Ridicată" });
      await expect(cls.getByRole("button", { name: "Salvează", exact: true })).toBeEnabled();
      await cls.getByRole("button", { name: "Salvează", exact: true }).click();
      const saved = cls.getByRole("button", { name: "✓ Salvat", exact: true });
      await expect(saved).toBeVisible();
      const s = await box(saved);
      const h = await box(cls.getByRole("heading", { name: "Istoric", exact: true }));
      expect(s.y + s.height / 2).toBeGreaterThanOrEqual(h.y);
      expect(s.y + s.height / 2).toBeLessThanOrEqual(h.y + h.height);
      const again = await tile(page, personUrl);
      await expect(again.locator("select").nth(0).locator("option:checked")).toHaveText("Ridicată");

      // Step 4 — the company, the property and the document.
      for (const url of [`/judicial-persons/${ids.company}?tab=metadata`, `/properties/${ids.property}?tab=metadata`, `/documents/${ids.document}?tab=metadata`]) {
        await layout(await tile(page, url));
      }
    } finally {
      await removeRecord(page.request, "person", ids.person);
      await removeRecord(page.request, "company", ids.company);
      await removeRecord(page.request, "property", ids.property);
      await removeRecord(page.request, "document", ids.document);
    }
  });
});
