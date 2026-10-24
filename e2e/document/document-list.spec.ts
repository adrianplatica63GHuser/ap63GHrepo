/**
 * Case:   TC-DOC-08 — Lista actelor: căutarea înaintea tipului, fără filtre de importanță și relevanță, „Câmpuri afișate" cu câmpurile oricărui act, „Câmp specific" explicat, doar cu liste închise
 * Source: docs/testing/cases/TC-DOC-08.md, „Last green" 2026-10-18 (steps 1, 6, 7 and 9 follow Slice #38.18; steps 1 and 7 also #39.63)
 *         Steps 1 and 9 follow Slice #40.01, and steps 10–13 — the toolbar's row and the filters row — are the second test.
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

import { test, expect, type Locator, type Page } from "../helpers/test";
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
      const search = main.getByRole("searchbox", { name: "caută după Cod, Titlu sau Nr. document" });
      await expect(search).toBeVisible({ timeout: 30_000 });
      const typeFilter = main.getByRole("button", { name: /^Tip document:/ });
      await expect(main.getByRole("button", { name: /^Tip document:\s*Toate tipurile/ })).toBeVisible();
      await expect(main.getByText("Câmp specific:")).toBeVisible();
      const about = main.getByRole("button", { name: "Despre „Câmp specific”" });
      await expect(about).toBeVisible();
      // #39.84: „Expiră curând" is on the toolbar's row, right after „Câmpuri afișate" (#39.74 had it after „Câmp
      // specific", #39.63 on the filter bar).
      const expiring = main.getByRole("button", { name: "Expiră curând" });
      await expect(expiring).toBeVisible();
      await expect(main.locator('[data-toolbar-row="first"]').getByRole("button", { name: "Expiră curând" })).toHaveCount(1);
      const chooserButton = main.getByRole("button", { name: /^Câmpuri afișate \d\/4$/ });
      await expect(chooserButton).toBeVisible();
      // #37.83/#38.18: the first row, level and in order, „Adaugă act" at its end — no „Tip document" on it.
      const addNew = main.getByRole("link", { name: "Adaugă act" });
      const firstRow = async () => Promise.all([search, chooserButton].map(async (l) => (await l.boundingBox())!));
      const row1 = await firstRow();
      const add = (await addNew.boundingBox())!;
      const centres = row1.map((r) => r.y + r.height / 2);
      expect(Math.max(...centres) - Math.min(...centres)).toBeLessThanOrEqual(1);
      expect([...row1.map((r) => r.x), add.x]).toEqual([...row1.map((r) => r.x), add.x].sort((a, b) => a - b));
      // #40.01: on the toolbar's row „Expiră curând" right after „Câmpuri afișate", then „Tip document: Toate tipurile",
      // a red sign and „Câmp specific:" with its ⓘ, and „Adaugă act" at its end; no filters row while no filter is
      // active. (#39.84 had „Tip document:" and „Câmp specific" on the filter bar under the search box; #39.74 the sign
      // and „Câmp specific:" on the toolbar's row, between the chooser and „Expiră curând"; #38.18 on a second row.)
      const sign = main.locator("[data-custom-field-sign]");
      await expect(sign).toHaveAttribute("data-custom-field-sign", "off");
      await expect(sign.locator("svg")).toHaveClass(/lucide-ban/);
      const [typeAt, signAt, field, aboutAt, expAt] = await Promise.all([typeFilter, sign, main.getByText("Câmp specific:"), about, expiring].map(async (l) => (await l.boundingBox())!));
      const xs = [row1[0].x, row1[1].x, expAt.x, typeAt.x, signAt.x, field.x, aboutAt.x, add.x];
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(expAt.x - (row1[1].x + row1[1].width)).toBeLessThanOrEqual(16);
      expect(typeAt.x - (expAt.x + expAt.width)).toBeLessThanOrEqual(16);
      expect(Math.abs(expAt.y + expAt.height / 2 - (row1[0].y + row1[0].height / 2))).toBeLessThanOrEqual(2);
      for (const b of [typeAt, signAt, aboutAt]) expect(Math.abs(b.y + b.height / 2 - (row1[0].y + row1[0].height / 2))).toBeLessThanOrEqual(4);
      await expect(main.locator('[data-toolbar-row="first"] [data-filter-fixed]').getByRole("button", { name: /^Tip document:/ })).toHaveCount(1);
      await expect(main.locator('[data-toolbar-row="first"] [data-filter-fixed] [data-custom-field-group]')).toHaveCount(1);
      await expect(main.locator("[data-filter-bar] [data-filter-fixed]")).toHaveCount(0);
      await expect(main.locator("[data-filter-bar]")).toHaveAttribute("data-filter-bar-shown", "false");
      await expect(main.getByText(/Importanță|Relevanță/)).toHaveCount(0);

      // Step 2 — one row: „Adeverință", the title.
      await search.fill(MARK);
      const table = main.locator("table").first();
      const row = table.locator("tbody tr").filter({ hasText: TITLE });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await expect(row).toContainText("Adeverință");
      expect((await table.innerText()).match(/\bDOC\d{3,}\b/g) ?? []).toEqual([]);
      await photograph(page, "documents-toolbar", search.locator(".."));

      // Step 3 — the nine fields (eight until 40.55), and none of the three.
      await chooserButton.click();
      const picker = main.locator("[data-field-chooser]");
      await expect(picker.getByText("Selectați până la 4 coloane opționale")).toBeVisible();
      await expect(picker.locator("label")).toHaveText([
        // Slice 40.20: Adrian's short names (#39.83's „Nr. document", „Instituție / Notariat", „Nr. pagini", … before).
        "#Document", "Data", "Inst./Notar", "Subiect", "Pagini", "Persoane", "Proprietăți", "Adăugat la",
        "Modificat la", // 40.55
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
      expect(new Set(await table.locator("tbody tr td:nth-child(1) [data-first-cell] > span:first-child").allTextContents())).toEqual(new Set(["CVC"]));
      const moved = await firstRow();
      expect(moved.map((r) => [Math.round(r.x), Math.round(r.y)])).toEqual(row6.map((r) => [Math.round(r.x), Math.round(r.y)]));

      // Step 8 — „Toate" again: the second list is gone.
      await key.selectOption({ label: "Toate" });
      await expect(value).toHaveCount(0);

      // Step 9 — only „Adeverință": its name on the button; „Câmp specific:" still drawn, disabled (#38.07).
      await tick("Contract de Vânzare");
      await tick("Adeverință");
      await expect(main.getByRole("button", { name: /^Tip document:\s*Adeverință/ })).toBeVisible({ timeout: 30_000 });
      await expect(main.locator('[data-toolbar-row="first"] [data-filter-fixed] [data-custom-field-group]')).toHaveCount(1); // #40.01; #39.84 read `[data-filter-bar] [data-filter-fixed]`
      await expect(key).toBeDisabled();
      await expect(sign).toHaveAttribute("data-custom-field-sign", "off");
      await expect.poll(async () => new Set(await table.locator("tbody tr td:nth-child(1) [data-first-cell] > span:first-child").allTextContents()), { timeout: 30_000 }).toEqual(new Set(["Adeverință"]));
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "document", contractId);
    }
  });
  // Slice #40.01 — steps 10–13: „Tip document:" and „Câmp specific" on the toolbar's row when the window allows it,
  // whole on a line of their own when it does not, and the filters row only while a filter is active. No record is
  // made: the steps read the toolbar, and the filter set is the address's.
  test("pe rândul barei: „Tip document” și „Câmp specific” după „Expiră curând”, rândul filtrelor doar cu un filtru activ", async ({ page }) => {
    const main = page.locator("main");
    const box = async (l: Locator) => (await l.boundingBox())!;
    const search = main.getByRole("searchbox", { name: "caută după Cod, Titlu sau Nr. document" });
    const expiring = main.getByRole("button", { name: "Expiră curând" });
    const group = main.locator('[data-toolbar-row="first"] [data-filter-fixed]');
    const addNew = main.getByRole("link", { name: "Adaugă act" });
    const bar = main.locator("[data-filter-bar]");

    // Step 10 — at 1920 px: the group on the first row, right after „Expiră curând"; no filters row, and the list
    // right under the toolbar.
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/documents");
    await expect(search).toBeVisible({ timeout: 30_000 });
    await expect(group.locator("[data-custom-field-group]")).toHaveCount(1, { timeout: 30_000 });
    const [s10, e10, g10, a10] = await Promise.all([search, expiring, group, addNew].map(box));
    expect(Math.abs(g10.y - s10.y)).toBeLessThanOrEqual(4);
    expect(g10.x).toBeGreaterThan(e10.x + e10.width);
    expect(g10.x - (e10.x + e10.width)).toBeLessThanOrEqual(16);
    expect(a10.x).toBeGreaterThan(g10.x + g10.width);
    await expect(bar).toHaveAttribute("data-filter-bar-shown", "false");
    await expect(bar.locator("[data-filter-chip]")).toHaveCount(0);
    // 40.49: on the toolbar, always — disabled with no filter (it read `toHaveCount(0)`).
    await expect(main.getByRole("button", { name: "Șterge filtrele" })).toBeDisabled();
    const toolbar = await box(main.locator("[data-toolbar]"));
    const frame = await box(main.locator("[data-list-edge]").first());
    expect(frame.y - (toolbar.y + toolbar.height)).toBeLessThanOrEqual(20); // one gap, no empty row

    // Step 11 — a column filter set („Nr. pagini" 1–3): the filters row appears, its chip and „Șterge filtrele".
    await page.goto("/documents?pageCount=1..3");
    await expect(bar).toHaveAttribute("data-filter-bar-shown", "true", { timeout: 30_000 });
    await expect(bar.locator('[data-filter-chip="pageCount"]')).toContainText("Nr. pagini");
    const clear = main.getByRole("button", { name: "Șterge filtrele" });
    await expect(clear).toBeEnabled(); // 40.49: the toolbar's (it read `toBeVisible()`, on the row)
    const b11 = await box(bar);
    const t11 = await box(main.locator("[data-toolbar]"));
    expect(b11.y).toBeGreaterThanOrEqual(t11.y + t11.height);
    await expect(group.locator("[data-custom-field-group]")).toHaveCount(1);

    // Step 12 — „Șterge filtrele": the row is gone again.
    await clear.click();
    await expect(bar).toHaveAttribute("data-filter-bar-shown", "false", { timeout: 30_000 });
    await expect(bar.locator("[data-filter-chip]")).toHaveCount(0);

    // Step 13 — at 1000 px the group does not fit beside „Expiră curând": it goes whole onto a line of its own, at the
    // left, and „Adaugă act" stays at the first line's end. The page does not scroll sideways.
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect
      .poll(async () => {
        const [s, g] = await Promise.all([search, group].map(box));
        return g.y >= s.y + s.height;
      }, { timeout: 10_000 })
      .toBe(true);
    const [s13, g13, a13] = await Promise.all([search, group, addNew].map(box));
    expect(Math.abs(g13.x - s13.x)).toBeLessThanOrEqual(2);
    expect(Math.abs(a13.y - s13.y)).toBeLessThanOrEqual(4);
    expect(a13.x).toBeGreaterThan(s13.x + s13.width);
    for (const part of ["[data-custom-field-sign]", "[data-custom-field-box]"]) {
      expect(Math.abs((await box(group.locator(part))).y + (await box(group.locator(part))).height / 2 - (g13.y + g13.height / 2))).toBeLessThanOrEqual(4);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
