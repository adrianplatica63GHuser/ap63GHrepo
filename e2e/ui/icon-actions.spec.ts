/**
 * Case:   TC-ICON-02 — Creionul, Salvarea și Coșul pe o proprietate: modificată, păstrată, ștearsă
 * Source: docs/testing/cases/TC-ICON-02.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim. An icon is read as the case reads it: the Lucide
 * class on the button's <svg> (`lucide-pencil`, `lucide-save`,
 * `lucide-trash2`, `lucide-x`, `lucide-arrow-left`).
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - „Poreclă" is `TC-E2E-ICON-02 Teren de probă` (records.ts), and step 4
 *     types `TC-E2E-ICON-02 Teren modificat`.
 *   - The hand run's pane was hidden, so its hovers were dispatched events and
 *     its presses `click()`; here they are Playwright's real mouse.
 *   - Slice #37.43's pictures, not a step of the case: the four forms'
 *     toolbars read-only and in edit mode (a person, a company and a document
 *     made here for it, removed at the end), a value list's edit footer
 *     („Cetățenie" → „Editează" on its first row, left with „Anulează" — no
 *     value changes), and the delete question of step 7, at 1366 and 1920 px,
 *     into `playwright-report/icon-actions/`. The sidebar's „Recente" list is
 *     painted over.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createNaturalPerson,
  createProperty,
  createSaleContract,
  removeLeftovers,
  removeRecord,
  type RecordKind,
} from "../helpers/records";

const MARK = `${E2E_MARKER}ICON-02`;
const SHOTS = "playwright-report/icon-actions";

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

/** The Lucide icon a button draws. */
async function iconOf(button: Locator): Promise<string> {
  const cls = (await button.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

const tooltip = (page: Page) => page.getByRole("tooltip");

test.describe("TC-ICON-02 — Creionul, Salvarea și Coșul pe o proprietate", () => {
  test("modificată, păstrată, ștearsă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: { kind: RecordKind; id: string }[] = [];
    try {
      const propertyId = await createProperty(page.request, { nickname: `${MARK} Teren de probă` });
      made.push({ kind: "property", id: propertyId });

      // Step 1 — read-only: ← „Înapoi la listă" and the pencil „Modifică", 38 px each.
      await page.goto(`/properties/${propertyId}?readonly=true`);
      const back = page.getByRole("button", { name: "Înapoi la listă" });
      const modify = page.getByRole("button", { name: "Modifică" });
      await expect(modify).toBeVisible({ timeout: 15_000 });
      expect(await iconOf(back)).toBe("lucide-arrow-left");
      expect(await iconOf(modify)).toBe("lucide-pencil");
      expect(Math.round((await modify.boundingBox())!.height)).toBe(38);
      expect(Math.round((await back.boundingBox())!.height)).toBe(38);
      await photograph(page, "property-view", () => moveAway(page));

      // Step 2 — the pencil's tooltip.
      await modify.hover();
      await expect(tooltip(page)).toHaveText("Modifică");

      // Step 3 — editing: ←, the floppy disk (inactive), the bin.
      await modify.click();
      const save = page.getByRole("button", { name: "Salvează" });
      const del = page.getByRole("button", { name: "Șterge" });
      await expect(save).toBeDisabled();
      expect(await iconOf(save)).toBe("lucide-save");
      expect(await iconOf(del)).toBe("lucide-trash2");
      await photograph(page, "property-edit-from-view", () => moveAway(page));

      // Step 4 — „Poreclă" changed; the floppy disk active, its tooltip „Salvează".
      const nickname = page.getByRole("textbox", { name: "Poreclă", exact: true });
      await nickname.fill(`${MARK} Teren modificat`);
      await expect(save).toBeEnabled();
      await save.hover();
      await expect(tooltip(page)).toHaveText("Salvează");

      // Step 5 — saved: read-only again, the value kept.
      await save.click();
      await expect(page.getByRole("button", { name: "Modifică" })).toBeVisible({ timeout: 15_000 });
      const stored = await (await page.request.get(`/api/properties/${propertyId}`)).json();
      expect((stored.property ?? stored).nickname).toBe(`${MARK} Teren modificat`);

      // Step 6 — opened the ordinary way: floppy disk, bin, X.
      await page.goto(`/properties/${propertyId}`);
      const bin = page.getByRole("button", { name: "Șterge" });
      await expect(bin).toBeVisible({ timeout: 15_000 });
      expect(await iconOf(page.getByRole("button", { name: "Salvează" }))).toBe("lucide-save");
      expect(await iconOf(page.getByRole("button", { name: "Anulează" }))).toBe("lucide-x");
      await photograph(page, "property-edit", () => moveAway(page));

      // Step 7 — the bin's tooltip, then the question: „Nu" / „Da", words, no icon.
      await bin.hover();
      await expect(tooltip(page)).toHaveText("Șterge");
      await bin.click();
      const question = page
        .getByRole("dialog")
        .or(page.getByRole("alertdialog"))
        .filter({ hasText: "Ștergeți proprietatea?" });
      await expect(question).toBeVisible();
      for (const word of ["Nu", "Da"]) {
        const b = question.getByRole("button", { name: word, exact: true });
        await expect(b).toHaveText(word);
        await expect(b.locator("svg")).toHaveCount(0);
      }
      await photograph(page, "delete-question");

      // Step 8 — „Da": the list, and the property gone.
      await question.getByRole("button", { name: "Da", exact: true }).click();
      await expect(page).toHaveURL(/\/properties$/, { timeout: 15_000 });
      expect((await page.request.get(`/api/properties/${propertyId}`)).status()).toBe(404);
      made.shift();

      // Pictures (#37.43), not steps: the other three forms' toolbars, read-only and editing.
      const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Persoana" });
      made.push({ kind: "person", id: person });
      const company = await createCompany(page.request, { name: `${MARK} Firma` });
      made.push({ kind: "company", id: company });
      const contract = await createSaleContract(page.request, `${MARK} Contract`);
      made.push({ kind: "document", id: contract });
      for (const [name, url] of [
        ["natural-person", `/natural-persons/${person}`],
        ["judicial-person", `/judicial-persons/${company}`],
        ["document", `/documents/${contract}`],
      ] as const) {
        await page.goto(`${url}?readonly=true`);
        await expect(page.getByRole("button", { name: "Modifică" })).toBeVisible({ timeout: 15_000 });
        await photograph(page, `${name}-view`, () => moveAway(page));
        await page.goto(url);
        await expect(page.getByRole("button", { name: "Șterge" })).toBeVisible({ timeout: 15_000 });
        await photograph(page, `${name}-edit`, () => moveAway(page));
      }

      // A value list's edit footer: „Cetățenie", „Editează" on its first row, left with „Anulează".
      await page.goto("/admin/value-lists");
      await page.getByRole("button", { name: "Cetățenie", exact: true }).click();
      await page.getByRole("button", { name: "Editează", exact: true }).first().click();
      const cancel = page.getByRole("button", { name: "Anulează", exact: true });
      await expect(cancel).toBeVisible();
      await photograph(page, "value-list-footer", () => moveAway(page));
      await cancel.click();
    } finally {
      for (const { kind, id } of made) await removeRecord(page.request, kind, id);
    }
  });
});
