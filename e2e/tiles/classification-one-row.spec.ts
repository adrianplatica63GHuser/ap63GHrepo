/**
 * Case:   TC-TILES-09 — „Clasificare” îngustă (41.10; was: Relevanță lângă Importanță, salvarea pe linia „Istoric")
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

import { test, expect, type Locator, type Page } from "../helpers/test";
import {
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
} from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-09`;
const CLASSIFICATION = "Clasificare";

async function tile(page: Page, url: string): Promise<Locator> {
  await page.goto(url);
  const cls = page.getByRole("region", { name: CLASSIFICATION, exact: true });
  // 41.10: a new record has no value — the tile folds to one line; otherwise it reads, with „Editează".
  await expect(cls.locator('[data-empty-tile="classification"], [data-tile-edit="classification"]').first()).toBeVisible({ timeout: 30_000 });
  return cls;
}

async function box(l: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

/** „Adaugă" on the folded line, or „Editează": the three selects. */
async function openEdit(cls: Locator): Promise<void> {
  const add = cls.locator("[data-empty-tile-add]");
  if (await add.count()) await add.click();
  else await cls.locator('[data-tile-edit="classification"]').click();
  await expect(cls.locator("select")).toHaveCount(3, { timeout: 15_000 });
}

/** Steps 1 and 2 on one record's screen. */
async function layout(cls: Locator): Promise<void> {
  // Step 1 — 254 px (2 units of 119, 41.10; 524, 4, before); opened, the three selects one under another, each inside.
  const t = await box(cls);
  expect(Math.round(t.width)).toBe(254);
  await openEdit(cls);
  const [imp, rel, prov] = [await box(cls.locator("select").nth(0)), await box(cls.locator("select").nth(1)), await box(cls.locator("select").nth(2))];
  expect(rel.y).toBeGreaterThan(imp.y + imp.height);
  expect(prov.y).toBeGreaterThan(rel.y + rel.height);
  for (const b of [imp, rel, prov]) expect(b.x + b.width).toBeLessThanOrEqual(t.x + t.width - 12 + 1);

  // Step 2 — one „Salvează", disabled, under the fields; „Renunță" closes it.
  const saves = cls.getByRole("button", { name: "Salvează", exact: true });
  await expect(saves).toHaveCount(1);
  await expect(saves).toBeDisabled();
  expect((await box(saves)).y).toBeGreaterThan(prov.y + prov.height);
  await cls.getByRole("button", { name: "Renunță", exact: true }).click();
  await expect(cls.locator("select")).toHaveCount(0);
}

test.describe("TC-TILES-09 — „Clasificare” îngustă: cele trei una sub alta, „Salvează” sub ele", () => {
  test("pe cele patru ecrane, și o salvare care scrie", async ({ page }) => {
    test.slow();
    // A run that died before its `finally` leaves its records; they would be a second match here.
    await removeLeftovers(page.request, MARK);
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

      // Step 3 — Importanță to „Ridicată", „Salvează": the tile reads „Ridicată"; reopened, „Ridicată".
      await openEdit(cls);
      await cls.getByRole("combobox", { name: "Importanță", exact: true }).selectOption({ label: "Ridicată" });
      await expect(cls.getByRole("button", { name: "Salvează", exact: true })).toBeEnabled();
      await cls.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(cls.locator('[data-read-value="classification.importance"]')).toHaveText("Ridicată", { timeout: 15_000 });
      const again = await tile(page, personUrl);
      await expect(again.locator('[data-read-value="classification.importance"]')).toHaveText("Ridicată");

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
