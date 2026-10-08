/**
 * Case:   TC-DOC-08 — Lista actelor: căutarea înaintea tipului, fără filtre de importanță și relevanță, „Câmpuri afișate" cu câmpurile oricărui act, „Câmp specific" explicat, doar cu liste închise
 * Source: docs/testing/cases/TC-DOC-08.md, „Last green" 2026-10-06 (steps 1, 6, 7 and 9 follow Slice #38.18)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The documents carry `TC-E2E-DOC-08` and `TC-E2E-DOC08-CVC` (records.ts).
 *   - Steps 6–7 read the two selects' options, which is what the open list
 *     shows; a native list's popup is not part of the page.
 *   - A Playwright browser has never chosen, so the columns start as the
 *     defaults — since #37.94 none: „Câmpuri afișate 0/4" — and step 4's
 *     headers follow them.
 *   - Before step 6 the search box is emptied, as the hand runs of #37.83 did:
 *     step 2's text would otherwise hide every contract from step 7's filter.
 *   - Step 5 checks the bubble's opening and closing and the start of its text;
 *     the jest suite `document-list.test.tsx` holds the rest.
 *   - Slice #37.62's pictures, not steps of the case: the toolbar, and the list
 *     with „Câmpuri afișate" open, at 1366 and 1920 px, into
 *     `playwright-report/document-list/`.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}DOC-08`;
const TITLE = `${MARK} Act de test`;
const SUBJECT = "Subiect de test TC-DOC-08";
// Slice #37.73: the contract's title does not contain MARK, so step 2 still finds one row.
const CVC_MARK = `${E2E_MARKER}DOC08-CVC`;
const SHOTS = "playwright-report/document-list";

/** `target` alone, or — with none — the window, so an open list that hangs below the table is in the picture whole. */
async function photograph(page: Page, name: string, target?: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    const path = `${SHOTS}/${name}-${width}.png`;
    await (target ? target.screenshot({ path }) : page.screenshot({ path }));
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-08 — lista actelor", () => {
  test("căutarea întâi, fără importanță și relevanță, „Câmpuri afișate” cu câmpurile oricărui act, „Câmp specific” explicat", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeLeftovers(page.request, CVC_MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const documentId = await createDocumentOfType(page.request, "ADEVERINTA", TITLE, { subject: SUBJECT });
    const contractId = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${CVC_MARK} Contract de test`, {
      customFields: { starePlata: "ACHITAT_INTEGRAL" },
    });
    try {
      // Step 1 — the search box first, then „Tip document"; no „Importanță" or „Relevanță".
      await page.goto("/documents");
      const main = page.locator("main");
      const search = main.getByRole("searchbox", { name: "caută după cod, titlu sau nr. document" });
      await expect(search).toBeVisible({ timeout: 30_000 });
      const typeFilter = main.getByRole("button", { name: /^Tip document:/ });
      await expect(main.getByRole("button", { name: /^Tip document:\s*Toate tipurile/ })).toBeVisible();
      await expect(main.getByText("Câmp specific:")).toBeVisible();
      const about = main.getByRole("button", { name: "Despre „Câmp specific”" });
      await expect(about).toBeVisible();
      const expiring = main.getByRole("button", { name: "Expiră curând" });
      await expect(expiring).toBeVisible();
      const chooserButton = main.getByRole("button", { name: /^Câmpuri afișate \d\/4$/ });
      await expect(chooserButton).toBeVisible();
      // #37.83/#38.18: the first row, level and in order, „Adaugă act" at its end — no „Tip document" on it.
      const addNew = main.getByRole("link", { name: "Adaugă act" });
      const firstRow = async () => Promise.all([search, expiring, chooserButton].map(async (l) => (await l.boundingBox())!));
      const row1 = await firstRow();
      const add = (await addNew.boundingBox())!;
      const centres = row1.map((r) => r.y + r.height / 2);
      expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(1);
      expect([...row1.map((r) => r.x), add.x]).toEqual([...row1.map((r) => r.x), add.x].sort((a, b) => a - b));
      await expect(main.locator('[data-toolbar-row="first"]').getByRole("button", { name: /^Tip document:/ })).toHaveCount(0);
      // #38.18: the second row, under the search box: „Tip document: Toate tipurile", a red sign, „Câmp specific:" with its ⓘ.
      const sign = main.locator("[data-custom-field-sign]");
      await expect(sign).toHaveAttribute("data-custom-field-sign", "off");
      await expect(sign.locator("svg")).toHaveClass(/lucide-ban/);
      const [typeAt, signAt, field, aboutAt] = await Promise.all([typeFilter, sign, main.getByText("Câmp specific:"), about].map(async (l) => (await l.boundingBox())!));
      expect([typeAt.x, signAt.x, field.x, aboutAt.x]).toEqual([typeAt.x, signAt.x, field.x, aboutAt.x].sort((a, b) => a - b));
      expect(typeAt.y).toBeGreaterThanOrEqual(row1[0].y + row1[0].height);
      expect(Math.abs(typeAt.x - row1[0].x)).toBeLessThanOrEqual(24);
      await expect(main.getByText(/Importanță|Relevanță/)).toHaveCount(0);

      // Step 2 — one row: „Adeverință", the title.
      await search.fill(MARK);
      const table = main.locator("table").first();
      const row = table.locator("tbody tr").filter({ hasText: TITLE });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await expect(row).toContainText("Adeverință");
      expect((await table.innerText()).match(/\bDOC\d{3,}\b/g) ?? []).toEqual([]);
      await photograph(page, "documents-toolbar", search.locator(".."));

      // Step 3 — the eight fields, and none of the three.
      await chooserButton.click();
      const picker = main.locator("[data-field-chooser]");
      await expect(picker.getByText("Selectați până la 4 coloane opționale")).toBeVisible();
      await expect(picker.locator("label")).toHaveText([
        "Nr. document", "Data", "Instituție / Notariat", "Subiect", "Nr. pagini", "Persoane", "Proprietăți", "Adăugat la",
      ]);
      for (const gone of ["Importanță", "Relevanță", "Proveniență"]) {
        await expect(picker.getByText(gone, { exact: true })).toHaveCount(0);
      }

      // Step 4 — „Subiect" and „Adăugat la": two more headers, and their values.
      await picker.getByLabel("Subiect", { exact: true }).check();
      await picker.getByLabel("Adăugat la", { exact: true }).check();
      await expect(table.getByRole("columnheader", { name: "Subiect" })).toBeVisible();
      await expect(table.getByRole("columnheader", { name: "Adăugat la" })).toBeVisible();
      const today = await page.evaluate(() => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
      });
      await expect(row).toContainText(SUBJECT);
      await expect(row).toContainText(today);
      await photograph(page, "documents-chooser");

      // Step 5 — outside the list; resting the mouse on „Câmp specific:" opens the
      // bubble, moving it away closes it. (A press on the ⓘ after a rest would close
      // it again — the ⓘ is the way in for a finger, as on the import bar.)
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(picker.locator("label")).toHaveCount(0);
      const bubble = page.locator("#custom-field-hint");
      await expect(bubble).toHaveClass(/sr-only/);
      await main.getByText("Câmp specific:").hover();
      await expect(bubble).toContainText("Filtrează după unul dintre câmpurile proprii ale unui tip de act");
      await expect(bubble).not.toHaveClass(/sr-only/);
      await page.mouse.move(5, 5);
      await expect(bubble).toHaveClass(/sr-only/);

      // Step 6 — #38.07: with every type „Câmp specific:" is disabled, „Toate" only; with only
      // „Contract de Vânzare" it is enabled — closed lists only, no Antecontract field, no „Temei preț".
      // The search box emptied first, as the hand runs did, so step 7's filter has contracts to show.
      await search.fill("");
      const key = main.getByRole("combobox", { name: "Câmp specific:" });
      await expect(key).toBeDisabled();
      expect(await key.locator("option").allTextContents()).toEqual(["Toate"]);
      await expect(sign).toHaveAttribute("data-custom-field-sign", "off");
      // A tick reloads the address; the list is opened again whenever it is not showing.
      // A toggle that is checked to have held: in full 20261008T112106Z-3600 step 9's untick of
      // „Contract de Vânzare" was lost and both types stayed ticked. So the click is repeated
      // until the box reads the opposite of what it read before.
      const tick = async (name: string) => {
        const box = main.getByRole("checkbox", { name, exact: true });
        if (!(await box.isVisible())) await typeFilter.click();
        const want = !(await box.isChecked());
        await expect(async () => {
          if (!(await box.isVisible())) await typeFilter.click();
          if ((await box.isChecked()) !== want) await box.click();
          await expect(box).toBeChecked({ checked: want, timeout: 2_000 });
        }).toPass({ timeout: 30_000 });
      };
      await tick("Toate tipurile");
      await tick("Contract de Vânzare");
      await expect(main.getByRole("button", { name: /^Tip document:\s*Contract de Vânzare/ })).toBeVisible({ timeout: 30_000 });
      await expect(key).toBeEnabled({ timeout: 30_000 });
      await expect(sign).toHaveAttribute("data-custom-field-sign", "on");
      await expect(sign.locator("svg")).toHaveClass(/lucide-circle-check/);
      const keys = await key.locator("option").allTextContents();
      expect(keys[0]).toBe("Toate");
      for (const kept of ["Monedă", "Stare plată", "Modalitate plată"]) expect(keys).toContain(kept);
      for (const gone of ["CNP 1", "Anul", "luna", "suma de", "Temei preț"]) expect(keys).not.toContain(gone);
      await page.getByRole("heading", { level: 1 }).first().click();
      const row6 = await firstRow();

      // Step 7 — „Stare plată": its values by label with a count, no code.
      await key.selectOption({ label: "Stare plată" });
      const value = main.getByRole("combobox", { name: "Valoarea câmpului specific" });
      await expect(value).toBeEnabled({ timeout: 30_000 });
      await expect(value.locator("option").filter({ hasText: /^Achitat integral \(\d+ (document|documente|de documente)\)$/ })).toHaveCount(1);
      expect((await value.locator("option").allTextContents()).some((t) => /ACHITAT_/.test(t))).toBe(false);
      // „Achitat integral": only such contracts; nothing on the first row moved (#37.83).
      await value.selectOption({ label: (await value.locator("option").filter({ hasText: /^Achitat integral/ }).textContent())! });
      await expect(table.locator("tbody tr").first()).toContainText("CVC", { timeout: 30_000 }); // #37.95: the short name
      expect(new Set(await table.locator("tbody tr td:nth-child(2)").allTextContents())).toEqual(new Set(["CVC"]));
      const moved = await firstRow();
      expect(moved.map((r) => [Math.round(r.x), Math.round(r.y)])).toEqual(row6.map((r) => [Math.round(r.x), Math.round(r.y)]));

      // Step 8 — „Toate" again: the second list is gone.
      await key.selectOption({ label: "Toate" });
      await expect(value).toHaveCount(0);

      // Step 9 — only „Adeverință": its name on the button; „Câmp specific:" still drawn, disabled (#38.07).
      await tick("Contract de Vânzare");
      await tick("Adeverință");
      await expect(main.getByRole("button", { name: /^Tip document:\s*Adeverință/ })).toBeVisible({ timeout: 30_000 });
      await expect(main.locator('[data-toolbar-row="second"]')).toHaveCount(1);
      await expect(key).toBeDisabled();
      await expect(sign).toHaveAttribute("data-custom-field-sign", "off");
      await expect.poll(async () => new Set(await table.locator("tbody tr td:nth-child(2)").allTextContents()), { timeout: 30_000 }).toEqual(new Set(["Adeverință"]));
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "document", contractId);
    }
  });
});
