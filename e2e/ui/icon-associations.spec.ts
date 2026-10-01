/**
 * Case:   TC-ICON-03 — „Asociază" și „Dezasociază" cu pictogramă și cuvinte, și un pas înapoi printre versiuni
 * Source: docs/testing/cases/TC-ICON-03.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the button's <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-ICON-03` (records.ts): „Poreclă"
 *     `TC-E2E-ICON-03 Teren`, the person `Ion TC-E2E-ICON-03`.
 *   - The hand run's pane was hidden (dispatched hover, `click()`); here it is
 *     Playwright's real mouse.
 *   - Slice #37.44's pictures, not a step of the case: the property's
 *     „Persoane" with the row, the associate screen, META INFO with the group
 *     picker open (ChevronUp), and the version strip on „v 0", at 1366 and
 *     1920 px, into `playwright-report/icon-associations/`. The sidebar's
 *     „Recente" list is painted over.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, createProperty, removeLeftovers, removeRecord, type RecordKind } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ICON-03`;
const PROPERTY = `${MARK} Teren`;
const PERSON = `Ion ${MARK}`;
const ROLE = "Proprietar / Titular de drept real";
const SHOTS = "playwright-report/icon-associations";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before?: () => Promise<void>): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    if (before) await before();
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

async function moveAway(page: Page): Promise<void> {
  const v = page.viewportSize() ?? { width: 1920, height: 1080 };
  await page.mouse.move(v.width - 10, v.height - 10);
}

async function iconOf(button: Locator): Promise<string> {
  const cls = (await button.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

test.describe("TC-ICON-03 — „Asociază” și „Dezasociază” cu pictogramă și cuvinte", () => {
  test("asociere, dezasociere, un pas înapoi printre versiuni", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: { kind: RecordKind; id: string }[] = [];
    try {
      const propertyId = await createProperty(page.request, { nickname: PROPERTY });
      made.push({ kind: "property", id: propertyId });
      made.push({ kind: "person", id: await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" }) });

      // Step 1 — „Persoane": empty; „Asociază" (link + word), „Dezasociază" (broken link + word, inactive).
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "Persoane");
      await expect(page.getByText("Nicio persoană asociată acestei proprietăți")).toBeVisible({ timeout: 30_000 });
      const associate = page.getByRole("button", { name: "Asociază", exact: true });
      const dissociate = page.getByRole("button", { name: "Dezasociază", exact: true });
      await expect(associate).toHaveText("Asociază");
      expect(await iconOf(associate)).toBe("lucide-link");
      await expect(dissociate).toHaveText("Dezasociază");
      expect(await iconOf(dissociate)).toBe("lucide-unlink");
      await expect(dissociate).toBeDisabled();

      // Step 2 — „Asociere persoană", its „Anulează" an X.
      await associate.click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}/associate-person$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Asociere persoană" })).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(page.getByRole("button", { name: "Anulează", exact: true }))).toBe("lucide-x");

      // Step 3 — the person ticked, the role picked: „Asociază selecția" (link + words), active.
      await page.getByPlaceholder("Nume…", { exact: true }).fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: PERSON })).toHaveCount(1, { timeout: 15_000 });
      await page.getByRole("checkbox", { name: PERSON }).check();
      await page.getByRole("combobox", { name: "Rol", exact: true }).selectOption({ label: ROLE });
      const associateSelected = page.getByRole("button", { name: "Asociază selecția" });
      await expect(associateSelected).toHaveText("Asociază selecția");
      expect(await iconOf(associateSelected)).toBe("lucide-link");
      await expect(associateSelected).toBeEnabled();
      await photograph(page, "associate-screen", () => moveAway(page));

      // Step 4 — back on the property: one row, with the role.
      await associateSelected.click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}\\?tab=persons$`), { timeout: 30_000 });
      const row = page.getByRole("row").filter({ has: page.getByRole("radio", { name: PERSON }) });
      await expect(row).toHaveCount(1, { timeout: 15_000 });
      await expect(row).toContainText(ROLE);
      await photograph(page, "property-persons", () => moveAway(page));

      // Step 5 — the row's radio, „Dezasociază": empty again, no question.
      await page.getByRole("radio", { name: PERSON }).check();
      await page.getByRole("button", { name: "Dezasociază", exact: true }).click();
      await expect(page.getByText("Nicio persoană asociată acestei proprietăți")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // Step 6 — „Poreclă" changed, the floppy disk: the „2 versiuni" chip, step-back icon first.
      await page.getByRole("textbox", { name: "Poreclă", exact: true }).fill(`${PROPERTY} v1`);
      await page.getByRole("button", { name: "Salvează" }).click();
      const chip = page.getByRole("button", { name: "2 versiuni" });
      await expect(chip).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(chip)).toBe("lucide-step-back");

      // Step 7 — the chip's tooltip: „2 versiuni" and „Versiunea anterioară".
      await chip.hover();
      await expect(page.getByRole("tooltip")).toContainText("2 versiuni");
      await expect(page.getByRole("tooltip")).toContainText("Versiunea anterioară");

      // Step 8 — „v 0": step back inactive, step forward active.
      await chip.click();
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 15_000 });
      const back = page.getByRole("button", { name: "Versiunea anterioară", exact: true });
      const forward = page.getByRole("button", { name: "Versiunea următoare", exact: true });
      expect(await iconOf(back)).toBe("lucide-step-back");
      expect(await iconOf(forward)).toBe("lucide-step-forward");
      await expect(back).toBeDisabled();
      await expect(forward).toBeEnabled();
      await photograph(page, "version-strip", () => moveAway(page));

      // Picture (#37.44), not a step: META INFO with the group picker open (ChevronUp).
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: `${PROPERTY} v1` })).toBeVisible({ timeout: 30_000 });
      await showTile(page, "META INFO");
      const addToGroup = page.getByRole("button", { name: "+ Adaugă în grup" });
      await expect(addToGroup).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(addToGroup)).toBe("lucide-plus");
      await addToGroup.click();
      const hide = page.getByRole("button", { name: "Ascunde" }).first();
      expect(await iconOf(hide)).toBe("lucide-chevron-up");
      await photograph(page, "metadata-picker-open", () => moveAway(page));
    } finally {
      for (const { kind, id } of made) await removeRecord(page.request, kind, id);
    }
  });
});
