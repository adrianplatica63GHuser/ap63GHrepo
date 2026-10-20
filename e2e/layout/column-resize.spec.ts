/**
 * Case:   TC-LAYOUT-06 — Linia dintre coloane: trasă în banda numelor, schimbă lățimea coloanei
 * Source: docs/testing/cases/TC-LAYOUT-06.md, „Last green" 2026-10-20
 *
 * A translation of the case file, step for step (Slice 40.12). Acte reads the archive's own rows' boxes only — no text;
 * „Grupuri" reads its band; the associate screen reads one invented person, `TC-E2E-LAYOUT-06`.
 *
 * Divergence from the hand run: „Câmpuri afișate" is set by writing Acte's stored choice before the page loads, as
 * TC-LAYOUT-05 does — the four columns make the table wider than its toolbar, so no frame's width is shared out among
 * the columns and a drag of 80 px is 80 px on the column. Every context starts with no stored width (40.12's Ask
 * first 10): nothing here writes one but the drags, and step 4 and the cleanup give each one back.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}LAYOUT-06`;
const PERSON = `Ion ${MARK}`;

/** A real mouse drag of a handle by `dx` px, in steps, from its centre. */
async function drag(page: Page, handle: Locator, dx: number): Promise<void> {
  const box = (await handle.boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y, { steps: 5 });
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}

/** The table's width and each band cell's, by column name. */
function widths(table: Locator) {
  return table.evaluate((t) => ({
    table: t.getBoundingClientRect().width,
    cols: Object.fromEntries(
      [...t.querySelectorAll<HTMLElement>("thead th[data-width-column]")].map((th) => [th.dataset.widthColumn ?? "?", th.getBoundingClientRect().width]),
    ),
  }));
}

/** Which cells draw the line on their right: band and first row, `true` for every cell but the last. */
function lines(table: Locator) {
  return table.evaluate((el) => {
    const t = el as HTMLTableElement;
    const row = (r: HTMLTableRowElement | undefined) => (r ? [...r.cells].map((c) => getComputedStyle(c).boxShadow.includes("inset")) : []);
    return { band: row(t.tHead?.rows[0]), first: row(t.tBodies[0]?.rows[0]) };
  });
}

test.describe("TC-LAYOUT-06 — Linia dintre coloane: trasă în banda numelor, schimbă lățimea coloanei", () => {
  test("Acte: o linie între coloane, trasă cu mausul, păstrată, dată înapoi, mutată din tastatură", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      localStorage.setItem("ga40-col-document-v3", JSON.stringify(["institution", "pageCount", "nrDocument", "propertyCount"]));
    });
    await page.setViewportSize({ width: 1366, height: 900 });
    const main = page.locator("main");
    const table = main.locator("table[data-resize-table='documents']");
    const handle = table.getByRole("separator", { name: "Lățimea coloanei Tip", exact: true });

    // Step 1 — a line on the right of every cell but the last, band and rows; a handle per column in the band.
    await page.goto("/documents");
    await expect(main.getByRole("columnheader", { name: /Nr\. pagini/ })).toBeVisible({ timeout: 30_000 });
    await expect(table.locator("tbody tr").nth(2)).toBeVisible({ timeout: 30_000 });
    const drawn = await lines(table);
    expect(drawn.band.slice(0, -1).every(Boolean), "a line after every band cell but the last").toBe(true);
    expect(drawn.band.at(-1), "no line after the last").toBe(false);
    expect(drawn.first.slice(0, -1).every(Boolean), "the same in the rows").toBe(true);
    await expect(table.getByRole("separator")).toHaveCount(drawn.band.length);
    await expect(handle).toBeVisible();
    const before = await widths(table);

    // Step 2 — „Tip"'s handle dragged 80 px right: the column 80 px wider, the table with it, live.
    await drag(page, handle, 80);
    const after = await widths(table);
    expect(after.cols.listDocumentType - before.cols.listDocumentType).toBeCloseTo(80, 0);
    expect(after.table - before.table).toBeCloseTo(80, 0);
    expect(after.cols.listDocumentTitle).toBeCloseTo(before.cols.listDocumentTitle, 0);
    // The drag pressed nothing under it: still on the list.
    await expect(page).toHaveURL(/\/documents$/);

    // Step 3 — reloaded: the width is kept.
    await page.reload();
    await expect(table.locator("tbody tr").nth(2)).toBeVisible({ timeout: 30_000 });
    expect((await widths(table)).cols.listDocumentType).toBeCloseTo(after.cols.listDocumentType, 0);

    // Step 4 — a double-click on the handle: the usual width back.
    await handle.dblclick();
    expect((await widths(table)).cols.listDocumentType).toBeCloseTo(before.cols.listDocumentType, 0);
    expect(await page.evaluate(() => localStorage.getItem("ga40-colw-v1:documents"))).toBeNull();

    // Step 5 — from the keyboard: Right widens by half a rem, Home gives it back.
    await handle.focus();
    await page.keyboard.press("ArrowRight");
    expect((await widths(table)).cols.listDocumentType - before.cols.listDocumentType).toBeCloseTo(8, 0);
    await expect(handle).toHaveAttribute("aria-valuenow", String(Math.round(before.cols.listDocumentType + 8)));
    await page.keyboard.press("Home");
    expect((await widths(table)).cols.listDocumentType).toBeCloseTo(before.cols.listDocumentType, 0);

    // Step 6 — never under 3 rem: a drag far to the left stops at 48 px.
    await drag(page, handle, -400);
    expect((await widths(table)).cols.listDocumentType).toBeCloseTo(48, 0);
    await handle.dblclick();
  });

  test("Grupuri: lista cât cadrul — ce câștigă o coloană pierde descrierea", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    const table = page.locator("table[data-resize-table='groups']");
    await page.goto("/admin/groups");
    await expect(table.locator("thead")).toBeVisible({ timeout: 30_000 });
    // Step 7 — „Cod" 80 px wider; „Descriere" 80 px narrower; the table as wide as before; the description has no handle.
    const before = await widths(table);
    await drag(page, table.getByRole("separator", { name: "Lățimea coloanei Cod", exact: true }), 80);
    const after = await widths(table);
    expect(after.cols.groupCode - before.cols.groupCode).toBeCloseTo(80, 0);
    expect(before.cols.description - after.cols.description).toBeCloseTo(80, 0);
    expect(after.table).toBeCloseTo(before.table, 0);
    await expect(table.getByRole("separator", { name: /Descriere/ })).toHaveCount(0);
    await table.getByRole("separator", { name: "Lățimea coloanei Cod", exact: true }).dblclick();
    expect((await widths(table)).cols.groupCode).toBeCloseTo(before.cols.groupCode, 0);
  });

  test("un ecran de asociere: tabelul cât fișa, oricât s-ar lăți o coloană", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const personId = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const documentId = await createSaleContract(page.request, `${MARK} Contract`);
    try {
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.goto(`/documents/${documentId}/associate-person`);
      await page.getByPlaceholder("Nume…", { exact: true }).fill(MARK);
      await expect(page.getByRole("row").filter({ hasText: PERSON })).toHaveCount(1, { timeout: 15_000 });
      const table = page.locator("table[data-resize-table='documents/associate-person']");
      // Step 8 — „Tip" 40 px wider: the name, which fills the tile, 40 px narrower; the table — the tile — unchanged.
      const before = await widths(table);
      const tip = table.getByRole("separator", { name: /^Lățimea coloanei Tip/ });
      await drag(page, tip, 40);
      const after = await widths(table);
      expect(after.cols.personType - before.cols.personType).toBeCloseTo(40, 0);
      expect(before.cols.personName - after.cols.personName).toBeCloseTo(40, 0);
      expect(after.table).toBeCloseTo(before.table, 0);
      await tip.dblclick();
      expect((await widths(table)).cols.personType).toBeCloseTo(before.cols.personType, 0);
    } finally {
      await removeRecord(page.request, "document", documentId);
      await removeRecord(page.request, "person", personId);
    }
  });
});
