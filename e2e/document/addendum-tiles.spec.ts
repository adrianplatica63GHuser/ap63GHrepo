/**
 * Case:   TC-DOC-20 — Actul adițional: „Actul modificat" legat de contractul pe care îl modifică, câmpurile text doar fără legătură, un singur act modificat
 * Source: docs/testing/cases/TC-DOC-20.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.34). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The three documents are created through the route, with `TC-E2E-DOC-20`
 *     names (e2e/helpers/records.ts), and removed in `finally`.
 *   - The tiles are read as regions by their names; the boxes by their field
 *     (`data-width-field`).
 *   - Slice #38.34's pictures, not steps of the case: „Actul modificat" linked
 *     and not, and the page, at 1366 and 1920 px, into `playwright-report/addendum-tiles/`.
 *   - Step 6 (40.88) measures the boxes in px, from field-widths.ts's scale:
 *     XL 272, M 136, a 3-unit tile 363 inside (40.98; 450 in 3 units of 148, and „Ce modifică" 286 in 2).
 *   - Step 7 (40.92) creates a fourth document, at its start (step 3 would find it), a Contract de Vânzare with
 *     „Preț total" filled, through the route.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { openEmptyTile, openEmptyTiles, showTile, editTile, editTileNamed, saveTileNamed } from "../helpers/tiles";
import { showEmptyFields } from "../helpers/empty-fields";

const MARK = `${E2E_MARKER}DOC-20`;
const ACT = `${MARK} Act`;
const CVC = `${MARK} CVC`;
const OTHER = `${MARK} Alt CVC`;
const RETYPED = `${MARK} CVC tip`;
const SHOTS = "playwright-report/addendum-tiles";

/** 40.92: „Schimbă tipul…"'s confirmation. */
const typeChange = (page: Page) => page.locator("[data-type-change-dialog]");
const amended = (page: Page) => page.getByRole("region", { name: "Actul modificat", exact: true });
const fallback = (page: Page) => amended(page).locator('[data-width-field="customFields.actParinteNumar"]');

/** A drawn box's place and size. */
async function rect(box: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  await expect(box).toBeVisible({ timeout: 30_000 });
  const r = await box.boundingBox();
  expect(r).not.toBeNull();
  return r!;
}

/** Within a pixel of `px` wide. */
async function expectWidth(box: Locator, px: number): Promise<void> {
  expect(Math.abs((await rect(box)).width - px), `${await box.getAttribute("data-width-field")} is ${px} px`).toBeLessThanOrEqual(1);
}

async function photograph(page: Page, name: string, target: Locator | null): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    if (target) await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
    else await page.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

test.describe("TC-DOC-20 — actul adițional și actul pe care îl modifică", () => {
  test("legat, refuzat a doua oară, dezlegat — câmpurile text revin cu ce aveau", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const made: string[] = [];
    try {
      made.push(await createDocumentOfType(page.request, "CONTRACT_VANZARE", CVC));
      made.push(await createDocumentOfType(page.request, "CONTRACT_VANZARE", OTHER));
      const act = await createDocumentOfType(page.request, "ACT_ADITIONAL", ACT);
      made.push(act);

      // Step 1 — the four tiles; „Onorariu notarial" on „Identificarea actului"; no deed yet.
      await page.goto(`/documents/${act}`);
      await expect(page.getByRole("heading", { name: ACT })).toBeVisible({ timeout: 30_000 });
      for (const name of ["Actul modificat", "Ce modifică", "Părți"]) await showTile(page, name);
      // 40.64: a new act's empty tiles are one line each; „Adaugă" opens them.
      await openEmptyTiles(page);
      // 40.71: the empty fields of a partly filled tile are behind „Arată N câmpuri goale"; shown for the steps below.
      await showEmptyFields(page, undefined, { wait: true });
      const general = page.locator('[data-panel="general"]');
      for (const label of ["Notariat", "Nr. act autentic", "Data autentificării", "Calitate exemplar", "Exemplare emise", "Onorariu notarial"]) {
        await expect(general.getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(amended(page).getByRole("button", { name: "Leagă actul modificat", exact: true })).toBeVisible();
      await expect(amended(page).getByText("Actul modificat nu e în arhivă — datele lui, așa cum le dă actul adițional:")).toBeVisible();
      await expect(fallback(page)).toBeVisible();
      const changes = page.getByRole("region", { name: "Ce modifică", exact: true });
      for (const label of ["Motiv completare", "Efect urmărit", "Preț neschimbat", "Liber de sarcini"]) {
        await expect(changes.getByText(label, { exact: true }).first()).toBeVisible();
      }

      // Step 2 — `TC-1` into „Nr. act părinte", „Salvează": „v 1". 40.75: „Editează" on „Actul modificat", its „Salvează".
      await editTileNamed(page, "Actul modificat");
      await fallback(page).fill("TC-1");
      await saveTileNamed(page, "Actul modificat");
      await expect(page.getByText("v 1", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await photograph(page, "amended-none", amended(page));

      // Step 3 — „Leagă actul modificat", `TC-E2E-DOC-20`: the two contracts; „Leagă" on the first.
      await amended(page).getByRole("button", { name: "Leagă actul modificat", exact: true }).click();
      await amended(page).getByRole("searchbox", { name: "Caută actul modificat" }).fill(MARK);
      const results = amended(page).locator("[data-parent-candidate]");
      await expect(results).toHaveCount(2, { timeout: 15_000 });
      await expect(results.first()).toHaveAttribute("data-parent-candidate", "CONTRACT_VANZARE");
      await amended(page).getByRole("button", { name: `Leagă „${CVC}”`, exact: true }).click();
      const deed = amended(page).locator("[data-parent-deed]");
      await expect(deed).toContainText(CVC, { timeout: 15_000 });
      await expect(deed).toContainText("Contract de Vânzare");
      await expect(deed.getByRole("link", { name: "Deschide", exact: true })).toHaveAttribute("href", /\/documents\//);
      await expect(fallback(page)).toBeHidden();
      await expect(amended(page).getByText("Actul modificat nu e în arhivă", { exact: false })).toHaveCount(0);
      await photograph(page, "amended-linked", amended(page));
      await photograph(page, "addendum-page", null);

      // Step 4 — a second deed through „Legături" → „Asociază act", „Act adițional la": refused, naming the first.
      const links = await showTile(page, "Legături");
      await links.getByRole("button", { name: "Asociază act", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Asociază Document" })).toBeVisible({ timeout: 30_000 });
      await page.getByPlaceholder("Cod sau titlu…", { exact: true }).fill(OTHER);
      await page.getByRole("checkbox", { name: OTHER }).check({ timeout: 15_000 });
      await page.getByRole("combobox", { name: "Tip legătură", exact: true }).selectOption({ label: "Act adițional la" });
      await page.getByRole("button", { name: "Asociază selecția" }).click();
      await expect(page.getByText(`Acest act adițional modifică deja „${CVC}”. Dezlegați-l întâi.`)).toBeVisible({ timeout: 15_000 });
      await page.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/documents/${act}\\?tab=related$`), { timeout: 30_000 });

      // Step 5 — „Dezleagă": „Leagă actul modificat" again, and `TC-1` still in „Nr. act părinte".
      await amended(page).getByRole("button", { name: "Dezleagă", exact: true }).click();
      await expect(amended(page).getByRole("button", { name: "Leagă actul modificat", exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(fallback(page)).toBeVisible();
      await expect(fallback(page)).toHaveText("TC-1"); // 40.75: read as text

      // Step 6 — 40.88, Adrian's sizes. „Editează" on „Identificarea actului": Tip document and Notariat XL;
      // Calitate exemplar | Onorariu notarial on one row, Exemplare emise across the tile under them.
      // 40.92: in edit mode the type reads as text beside „Schimbă tipul…"; a type with a form is „… (F)" in that
      // dialog's list, the words on hover.
      await editTile(page, "general");
      const identification = page.locator('[data-panel="general"]');
      const field = (name: string) => identification.locator(`[data-width-field="${name}"]`);
      await expect(field("documentTypeId")).toHaveText("Act Adițional");
      await expect(identification.locator('select[name="documentTypeId"]')).toHaveCount(0);
      await identification.getByRole("button", { name: "Schimbă tipul…", exact: true }).click();
      const cvcOption = typeChange(page).locator("option", { hasText: "Contract de Vânzare (F)" });
      await expect(cvcOption).toHaveAttribute("title", "Contract de Vânzare (are formular)");
      await typeChange(page).getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(typeChange(page)).toHaveCount(0);
      await expectWidth(field("documentTypeId"), 272);
      await expectWidth(field("issuerPersonId"), 272);
      const quality = await rect(field("customFields.calitateExemplar"));
      const fee = await rect(field("customFields.onorariuNotarial"));
      const copies = await rect(field("customFields.exemplareEmise"));
      expect(Math.abs(quality.y - fee.y), "Calitate exemplar | Onorariu notarial on one row").toBeLessThanOrEqual(1);
      expect(fee.x).toBeGreaterThan(quality.x);
      expect(copies.y, "Exemplare emise under them").toBeGreaterThan(Math.max(quality.y + quality.height, fee.y + fee.height) - 1);
      await expectWidth(field("customFields.calitateExemplar"), 136);
      await expectWidth(field("customFields.exemplareEmise"), 363); // 40.98: 3 units of 119 px (450 in 3 of 148)
      await page.locator('[data-tile-cancel="general"]').click();
      await expect(page.locator('[data-tile-edit-bar="general"]')).toHaveCount(0);
      // „Editează" on „Ce modifică": Temei legal completare the panel's whole width (3 units since 40.98, 363 px; 2
      // units of 148, 286, before), the dropdowns M.
      // Still empty, so one line with „Adaugă" again after the navigation of step 4 (40.64): opened, then „Editează".
      await openEmptyTile(page, "tab:Ce modifică");
      const changes6 = page.getByRole("region", { name: "Ce modifică", exact: true });
      if ((await changes6.locator("[data-tile-edit-bar]").count()) === 0) await editTileNamed(page, "Ce modifică");
      await showEmptyFields(changes6);
      const inChanges = (name: string) => changes6.locator(`[data-width-field="customFields.${name}"]`);
      await expectWidth(inChanges("temeiLegalCompletare"), 363);
      for (const name of ["efectUrmarit", "pretNeschimbat", "liberDeSarcini", "consimtamantRadiere", "celelalteClauzeNemodificate"]) {
        await expectWidth(inChanges(name), 136);
      }
      await changes6.locator("[data-tile-cancel]").click();
      await expect(changes6.locator("[data-tile-edit-bar]")).toHaveCount(0);

      // Step 7 — 40.92. A Contract de Vânzare with „Preț total" filled: „Schimbă tipul…" to Act Adițional names that
      // field; „Anulează" leaves the type as it was; „Confirmă" changes it in the form, and „Salvează" writes it.
      // Created here, not with the other three: step 3's search for the mark must find the two contracts alone.
      const retyped = await createDocumentOfType(page.request, "CONTRACT_VANZARE", RETYPED, { customFields: { pretTotal: "100000" } });
      made.push(retyped);
      await page.goto(`/documents/${retyped}`);
      await expect(page.getByRole("heading", { name: RETYPED })).toBeVisible({ timeout: 30_000 });
      await editTile(page, "general");
      const typeBox = page.locator('[data-panel="general"] [data-read-value="documentTypeId"]');
      await expect(typeBox).toHaveText("Contract de Vânzare");
      const changeType = page.locator('[data-panel="general"]').getByRole("button", { name: "Schimbă tipul…", exact: true });
      await changeType.click();
      await typeChange(page).getByLabel("Tipul nou").selectOption({ label: "Act Adițional (F)" });
      await expect(typeChange(page).locator('[data-type-change-list="fields"]')).toContainText("Preț total");
      await typeChange(page).getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(typeChange(page)).toHaveCount(0);
      await expect(typeBox).toHaveText("Contract de Vânzare");
      await changeType.click();
      await typeChange(page).getByLabel("Tipul nou").selectOption({ label: "Act Adițional (F)" });
      await typeChange(page).getByRole("button", { name: "Confirmă", exact: true }).click();
      await expect(typeChange(page)).toHaveCount(0);
      await expect(typeBox).toHaveText("Act Adițional");
      await page.locator('[data-tile-save="general"]').click();
      await expect(page.locator('[data-tile-edit-bar="general"]')).toHaveCount(0, { timeout: 30_000 });
      await page.reload();
      await expect(page.locator('[data-read-value="documentTypeId"]')).toHaveText("Act Adițional", { timeout: 30_000 });
    } finally {
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const id of made.reverse()) await removeRecord(page.request, "document", id);
    }
  });
});
