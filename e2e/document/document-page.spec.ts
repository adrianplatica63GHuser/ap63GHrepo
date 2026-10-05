/**
 * Case:   TC-DOC-01 — Act creat, pagină atașată, pagina se deschide
 * Source: docs/testing/cases/TC-DOC-01.md, „Last green" 2026-09-22
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **NO REAL DEED GOES INTO GIT.** The hand run attaches `530.jpg`, a scan of
 * a real contract with real names on it. This spec attaches
 * `e2e/fixtures/tc-e2e-pagina.png` instead — a blank page reading „PAGINĂ DE
 * TEST", made for the purpose — through `setInputFiles` on the same `sr-only`
 * input the hand run uses. It asserts what does not depend on the scan: the
 * page appears in „Pagini", „Pagini extinse" opens it and „✕ Restrânge"
 * closes it. Step 10's „a Romanian sale contract, first page" stays a
 * hand-run assertion; the case file says so too.
 *
 * Other divergences from the hand run, each for a reason the case cannot have:
 *   - „Etichetă scurtă" is `TC-E2E-DOC-01 Contract de test` — a spec's rows
 *     carry the TC-E2E- marker (e2e/helpers/records.ts).
 *   - The case leaves its document for the association cases. A spec may not:
 *     it is removed in `finally` through DELETE /api/documents/[id], the route
 *     the form's „Șterge" → „Da" calls. Not through the button itself: this
 *     screen has two „Șterge" — the page row's and the form's — and the case's
 *     cleanup paragraph exists to tell a PERSON which is which.
 *   - After step 9 the window is set to 1366, 1920 and 2560 px for a moment
 *     and the „Pagini" panel's width is written, with a picture at each, to
 *     `playwright-report/layout/` (Slice #37.15: the page image must stay at
 *     least as wide as it was before the fixed-width layout). Not a step of
 *     the case; it asserts nothing but the fixed widths below.
 *   - Slice #37.15 checks the Document's fixed widths here, as TC-PERS-01's
 *     spec does the person's: on this spec's own Contract de Vânzare, and — a
 *     second test — on one document of each seeded type that has fields of its
 *     own (and the Certificat de Moștenitor, for its parties panel), each
 *     created through POST /api/documents with the TC-E2E- marker and removed
 *     in `finally`. Every box and panel must be the same width at 1400 and at
 *     2400 px, on every notebook page, and every fixed box must hold its value.
 *   - Slice #37.16 checks „Acte"'s fixed column widths after step 5 — every
 *     column the same width at 1400 and 2400 px, the table no wider than its
 *     columns, no fixed cell wider than its column — and photographs the list
 *     at 1366, 1920 and 2560 px, searched down to this spec's own row first so
 *     no real document's title is in the picture.
 *   - Slice #37.20: the document has no tab row, and its notebook tabs are
 *     tiles. Step 6 reads the tile row — „Date generale", „Pagini" and
 *     „Instrument" ticked — where the case reads five tabs. The width checks
 *     show every tile at once („Toate") where they turned the notebook's pages
 *     one by one. After the widths, „Cadastru", „Stare juridică" and
 *     „Conformitate" are ticked beside the page image and photographed at 1920
 *     and 2560 px (a synthetic record), then „Implicit" puts the default back.
 *     Since #37.54 those tiles are „Preț și taxe", „Cadastru și carte
 *     funciară", „Stare juridică" and „Formalități".
 *   - Slice #37.31: every tile on the width unit, each notebook tile one frame;
 *     `expectUnitGrid` checks the row at 1366, 1920 and 2560 px with „Toate".
 *     The new document, the Plan parcelar and the Certificat de Moștenitor are
 *     photographed too.
 *   - Slice #37.65: a Document's „Persoane", „Proprietăți" and „Acte corelate"
 *     are one tile, „Corelate", with „Asociază persoană", „Asociază
 *     proprietate" and „Asociază act" (the case's steps as corrected on 2026-10-03).
 */

import fs from "fs";
import path from "path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { openFromSidebar } from "../helpers/sidebar";
import { expectFixedFieldsHold, expectStableColumns, expectStableWidths, expectUnitGrid, photograph } from "../helpers/field-widths";
import { TILE_GROUP, showTile, tileBox } from "../helpers/tiles";
import { DOCUMENT, PAGES_PANEL_REM, TEMPLATE_FIELD, UNIT_GAP_REM, UNIT_REM } from "../../src/lib/ui/field-widths";

/** The widest value each FIXED box on the Document must hold (`field-widths.ts`). */
const SAMPLES: Record<string, string> = { nrDocument: DOCUMENT.nrDocument.sample };

/**
 * The seeded types with fields of their own (the six `measure-fields` read),
 * and the Certificat de Moștenitor for its parties panel. (Slice #37.15)
 */
// Slice #37.74: no ANTECONTRACT — its form („discover"'s 14 fields) was taken off; it has no fields of its own.
const TYPES_WITH_FIELDS = [
  "ACT_ADITIONAL",
  "CONTRACT_VANZARE",
  "FISA_CORPULUI_PROPRIETATE",
  "PLAN_AMPLASAMENT_DELIMITARE",
  "PLAN_PARCELAR",
  "CERTIFICAT_MOSTENITOR",
] as const;

/**
 * The fixed-width checks on the open document: same widths at 1400 and 2400
 * px, then — with every tile shown at once („Toate", Slice #37.20: the notebook's
 * pages are tiles now) — the same again, every number box holds its sample,
 * every dropdown its longest option, and no panel is wider inside than out.
 * „Implicit" puts the default back.
 */
async function expectDocumentWidths(page: Page): Promise<void> {
  await expectStableWidths(page);
  const group = page.getByRole("group", { name: TILE_GROUP });
  await group.getByRole("button", { name: "Toate", exact: true }).click();
  await expect(page.getByRole("region", { name: "Conexiuni", exact: true })).toBeVisible({ timeout: 30_000 });
  await expectStableWidths(page);
  // Slice #37.31 — every tile on the width unit: the row is 6 units at 1366 px, 10 at 1920,
  // 14 at 2560, and each tile — a notebook tile is one frame — a whole number of units.
  await expectUnitGrid(page, UNIT_REM, UNIT_GAP_REM, { 1366: 6, 1920: 10, 2560: 14 });
  const numbers = await page.locator('input[type="number"][data-width-field]').evaluateAll((els) =>
    els.map((e) => (e as HTMLElement).dataset.widthField ?? ""),
  );
  const samples: Record<string, string> = { ...SAMPLES };
  for (const n of numbers) samples[n] = TEMPLATE_FIELD.number.sample;
  await expectFixedFieldsHold(page, samples);
  await group.getByRole("button", { name: "Implicit", exact: true }).click();
  await expect(page.getByRole("region", { name: "Conexiuni", exact: true })).toHaveCount(0);
}

const TITLE = `${E2E_MARKER}DOC-01 Contract de test`;
const FIXTURE = path.join(__dirname, "../fixtures/tc-e2e-pagina.png");
const FIXTURE_NAME = "tc-e2e-pagina.png";

/**
 * The „Pagini" panel's width at 1920 × 1080, and a full-page picture, into
 * `playwright-report/layout/` (Slice #37.15). The document is this spec's own
 * synthetic one, so the picture holds nothing of anybody's.
 */
async function recordPagesPanel(page: Page, pages: Locator): Promise<void> {
  const viewport = page.viewportSize();
  const widths: Record<string, number | null> = {};
  try {
    fs.mkdirSync("playwright-report/layout", { recursive: true });
    // The earlier steps scrolled the page; the picture starts at the heading.
    await page.getByRole("heading", { level: 1 }).first().scrollIntoViewIfNeeded();
    for (const width of [1366, 1920, 2560]) {
      await page.setViewportSize({ width, height: 1080 });
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null)))));
      const box = await pages.boundingBox();
      widths[String(width)] = box ? Math.round(box.width * 10) / 10 : null;
      await page.screenshot({ path: `playwright-report/layout/document-${width}.png`, fullPage: true });
    }
    fs.writeFileSync(
      "playwright-report/layout/document-pages-panel.json",
      JSON.stringify({ pagesPanelPx: widths, fixedRem: PAGES_PANEL_REM }, null, 2),
    );
  } finally {
    if (viewport) await page.setViewportSize(viewport);
  }
}

async function readTotal(page: Page): Promise<number> {
  const text = await page.getByText(/^Se afișează \d+ din \d+$/).textContent();
  const m = /din (\d+)/.exec(text ?? "");
  if (!m) throw new Error(`Unexpected count text: "${text}"`);
  return Number(m[1]);
}

test.describe("TC-DOC-01 — Act creat, pagină atașată, pagina se deschide", () => {
  test("act nou, o pagină atașată fără dialogul sistemului, pagina se deschide", async ({ page }) => {
    // Room for the `finally`: an action waiting on a locator that never matches
    // spends the whole default 30 s, and the cleanup after it then dies of the
    // same timeout, leaving a TC-E2E- row for the next run's removeLeftovers.
    test.slow();
    await removeLeftovers(page.request, `${E2E_MARKER}DOC-01`);

    let documentId: string | undefined;
    try {
      // Step 1 — „Acte": every document in one list, filters, „Adaugă act".
      await page.goto("/");
      await openFromSidebar(page, "Acte");
      await expect(page.getByRole("heading", { name: "Acte", exact: true })).toBeVisible({ timeout: 30_000 });
      for (const col of ["TIP", "TITLU"] /* #37.57: no „Cod" */) {
        await expect(page.getByRole("columnheader", { name: col }).first()).toBeVisible();
      }
      await expect(page.getByRole("button", { name: /^Tip document:\s*Toate tipurile/ })).toBeVisible();
      // #37.62: the search box first, without „SAU"; no „Importanță" or „Relevanță" filter.
      await expect(page.getByRole("searchbox", { name: "caută după cod, titlu sau nr. document" })).toBeVisible();
      await expect(page.getByText("Importanță:")).toHaveCount(0);
      await expect(page.getByText("Relevanță:")).toHaveCount(0);
      await expect(page.getByText("Câmp specific:")).toBeVisible();
      const totalBefore = await readTotal(page);

      // Step 2 — „Adaugă act": „Act nou", „DATE GENERALE", „DATE DE EMITERE" (#37.52: no type, so no fees group),
      // and „Tip document" starts empty.
      await page.getByRole("link", { name: "Adaugă act" }).click();
      await expect(page).toHaveURL(/\/documents\/new$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Act nou" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("DATE GENERALE").first()).toBeVisible();
      await expect(page.getByText("DATE DE EMITERE").first()).toBeVisible();
      const type = page.getByLabel(/^Tip document/);
      await expect(type).toHaveValue("");

      // Step 3 — „Contract de Vânzare (are formular)": the notebook tabs and „FINANCIAR".
      await type.selectOption({ label: "Contract de Vânzare (are formular)" });
      // #37.54: the CVC's tabs renamed — „Preț și taxe", „Cadastru și CF", „Formalități".
      for (const tab of ["Preț și taxe", "Cadastru și CF", "Stare juridică", "Formalități"]) {
        await expect(page.getByRole("tab", { name: tab, exact: true })).toBeVisible();
      }
      await expect(page.getByText("FINANCIAR").first()).toBeVisible();

      // Step 4 — „Etichetă scurtă" is the title; there is no „Titlu" field.
      await page.getByLabel(/^Etichetă scurtă/).fill(TITLE);
      await expect(page.getByLabel(/^Titlu/)).toHaveCount(0);
      // Slice #37.31 — the new document, filled with made-up values (typed, then cleared), pictured.
      await page.getByLabel(/^Subiect/).fill("Vânzarea unei parcele de test");
      await photograph(page, "document-new", [1366, 1920, 2560], 1200);
      await page.getByLabel(/^Subiect/).fill("");

      // Step 5 — „Salvează": the new document opens (#37.93); „Acte": the new row on top, count + 1.
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 30_000 });
      await openFromSidebar(page, "Acte");
      await expect(page).toHaveURL(/\/documents$/, { timeout: 30_000 });
      const top = page.getByRole("row").nth(1);
      await expect(top).toContainText(TITLE, { timeout: 15_000 });
      await expect(top).toContainText("Nou!");
      await expect(top).not.toContainText(/DOC\d+/); // #37.57: no system ID here
      await expect(top).toContainText("CVC"); // #37.95: the type by its short name
      await expect(top.locator("td").nth(1)).toHaveAttribute("title", "Contract de Vânzare");
      await expect(page.getByText(new RegExp(`^Se afișează \\d+ din ${totalBefore + 1}$`))).toBeVisible();
      // Slice #37.16: the list's fixed columns, on the archive's real rows; then
      // its pictures, narrowed to this spec's own row first — the other rows
      // are real documents, and no real title goes into a picture.
      await expectStableColumns(page);
      const listSearch = page.getByRole("searchbox", { name: "caută după cod, titlu sau nr. document" });
      await listSearch.fill(TITLE);
      await expect(page.getByRole("row")).toHaveCount(2, { timeout: 15_000 });
      await photograph(page, "list-documents");
      await listSearch.fill("");
      await expect(page.getByText(new RegExp(`^Se afișează \\d+ din ${totalBefore + 1}$`))).toBeVisible({ timeout: 15_000 });

      // Step 6 — „Deschide": headed with the title, „Neprocesat", the tile row
      // (no tabs — #37.20), and „Pagini" reading „Nicio pagină adăugată".
      const href = await top.getByRole("link", { name: "Deschide" }).getAttribute("href");
      documentId = href?.split("/").pop();
      await top.getByRole("link", { name: "Deschide" }).click();
      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 30_000 });
      // The chip carries its subject in an sr-only span
      // (document-detail-tiles.tsx), so its text is „Stare procesare: Neprocesat"
      // and an exact match on „Neprocesat" alone finds nothing (first run).
      await expect(page.getByText("Stare procesare: Neprocesat")).toBeVisible();
      await expect(page.getByRole("group", { name: TILE_GROUP }).getByRole("checkbox")).toHaveCount(9, { timeout: 30_000 }); // #37.63: META INFO is two; #37.65: Persoane, Proprietăți and „Acte corelate" are „Corelate"
      for (const tile of ["Date generale", "Pagini", "Preț și taxe"]) await expect(tileBox(page, tile)).toBeChecked();
      for (const tile of ["Cadastru și CF", "Stare juridică", "Formalități", "Corelate", "Clasificări", "Conexiuni"]) {
        await expect(tileBox(page, tile)).not.toBeChecked();
      }
      await expect(page.getByRole("tab")).toHaveCount(0);
      const pages = page.getByRole("region", { name: "Pagini" });
      await expect(pages.getByText("Nicio pagină adăugată")).toBeVisible();
      await expect(pages.getByRole("button", { name: "Pagini extinse" })).toBeVisible();

      // Step 7 — „+ Adaugă pagină" opens the APPLICATION's dialog.
      await pages.getByRole("button", { name: "+ Adaugă pagină" }).click();
      const dialog = page.getByRole("dialog", { name: "Adaugă pagină" });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText("Număr pagină")).toBeVisible();
      await expect(dialog.getByText("Denumire pagină")).toBeVisible();
      await expect(dialog.getByText("Note pagină")).toBeVisible();
      await expect(dialog.getByRole("spinbutton")).toHaveValue("1");
      const dialogSave = dialog.getByRole("button", { name: "Salvează", exact: true });
      await expect(dialogSave).toBeDisabled();

      // Step 8 — the file goes onto the hidden input; „Încarcă" is NOT pressed.
      await dialog.locator('input[type="file"]').setInputFiles(FIXTURE);
      await expect(dialog.getByText(`✓ ${FIXTURE_NAME}`)).toBeVisible();

      // Step 9 — „Salvează": the page is in „Pagini" under its file name, with
      // „Vizualizare", „Tipărire", „Șterge" — and no „1 / 1" for a single page.
      await dialogSave.click();
      await expect(dialog).toHaveCount(0);
      await expect(pages.getByRole("img", { name: FIXTURE_NAME })).toBeVisible({ timeout: 15_000 });
      await expect(pages.getByText(FIXTURE_NAME, { exact: true }).first()).toBeVisible();
      for (const action of ["Vizualizare", "Tipărire", "Șterge"]) {
        await expect(pages.getByRole("button", { name: action, exact: true })).toBeVisible();
      }
      await expect(pages.getByText("1 / 1")).toHaveCount(0);

      // Slice #37.15 — the page panel's width in a maximised 1920-pixel window,
      // written beside the layout screenshots for the handover. Recorded, not
      // asserted: #37.15 reads it once before its layout change and once after.
      await recordPagesPanel(page, pages);
      await expectDocumentWidths(page);
      // The page image is its fixed width wherever the window puts it.
      const pagesBox = await pages.boundingBox();
      expect(Math.round(pagesBox?.width ?? 0)).toBe(PAGES_PANEL_REM * 16);
      // Slice #37.20 — the page image and all four notebook tiles on one screen.
      for (const tile of ["Cadastru și CF", "Stare juridică", "Formalități"]) await showTile(page, tile);
      // 1440 px high: the four notebook tiles run to a second and third row.
      await photograph(page, "document-cvc-notebook-tiles", [1920, 2560], 1440);
      await page.getByRole("group", { name: TILE_GROUP }).getByRole("button", { name: "Implicit", exact: true }).click();
      await expect(tileBox(page, "Cadastru și CF")).not.toBeChecked();

      // Step 10 — „Pagini extinse": the full-window view headed „Pagini".
      // (That the page is readable is the hand run's to judge — see the header.)
      await pages.getByRole("button", { name: "Pagini extinse" }).click();
      const collapse = page.getByRole("button", { name: /^✕?\s*Restrânge$/ });
      await expect(collapse).toBeVisible();
      await expect(page.getByRole("heading", { name: "Pagini", exact: true })).toBeVisible();

      // Step 11 — „✕ Restrânge": the large view closes.
      await collapse.click();
      await expect(collapse).toHaveCount(0);
      await expect(pages.getByRole("button", { name: "Pagini extinse" })).toBeVisible();
    } finally {
      if (documentId) await removeRecord(page.request, "document", documentId);
    }
  });

  test("lățimile fixe, pe câte un act din fiecare tip cu câmpuri proprii", async ({ page }) => {
    // Slice #37.15 — not a step of the case; see the header.
    test.setTimeout(TYPES_WITH_FIELDS.length * 90_000);
    const mark = `${E2E_MARKER}DOC-01-W`;
    await removeLeftovers(page.request, mark);
    const made: string[] = [];
    try {
      for (const key of TYPES_WITH_FIELDS) {
        const title = `${mark} ${key}`;
        const id = await createDocumentOfType(page.request, key, title);
        made.push(id);
        await page.goto(`/documents/${id}`);
        await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('[data-panel="general"]')).toBeVisible({ timeout: 30_000 });
        await expect(page.locator('[data-panel="pages"]')).toBeVisible();
        // The type's own fields arrive with the type list, after the general
        // ones: measured before they are drawn, the 1400-px read has fewer boxes
        // than the 2400-px one (first run). The Certificat has none of its own;
        // its parties panel is what it adds.
        await expect(
          page.locator(key === "CERTIFICAT_MOSTENITOR" ? '[data-panel="succession-parties"]' : '[data-width-field^="customFields."]').first(),
        ).toBeAttached({ timeout: 30_000 });
        await expectDocumentWidths(page);
        // Slice #37.31 — the Plan parcelar's „Câmpuri specifice" and the certificate's „Părți", pictured.
        if (key === "PLAN_PARCELAR" || key === "CERTIFICAT_MOSTENITOR") {
          await photograph(page, `document-${key.toLowerCase()}`, [1366, 1920, 2560], 1200);
        }
      }
    } finally {
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
