/**
 * Case:   TC-VL-05 — „Date de referință”: tabele înguste, câte un rând pe linie, butoanele unul lângă altul
 * Source: docs/testing/cases/TC-VL-05.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. Nothing is created: the lists are read as they are.
 */

import { test, expect, type Page } from "@playwright/test";

/** What the case reads off one list's table. */
async function reading(page: Page, skip: string[]) {
  return page.evaluate((skipCols) => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
    const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")].filter((r) => r.cells.length === heads.length);
    const cellsOk: string[] = [];
    let actionsOneLine = true;
    for (const r of rows) {
      [...r.cells].forEach((td, i) => {
        const col = heads[i].dataset.widthColumn ?? "";
        const isActions = col.startsWith("valueActions");
        if (isActions) {
          const tops = [...td.querySelectorAll<HTMLElement>("a,button")].map((b) => Math.round(b.getBoundingClientRect().top));
          if (new Set(tops).size > 1) actionsOneLine = false;
          return;
        }
        if (skipCols.includes(heads[i].innerText.split("\n")[0])) return;
        const cs = getComputedStyle(td);
        // #38.53: a document type's name is cut inside its tooltip's span, and that tooltip (not `title`) says it whole.
        const tip = td.querySelector<HTMLElement>("[data-name-tip]");
        const cut = (tip ?? td).scrollWidth > (tip ?? td).clientWidth + 1;
        if (cs.whiteSpace !== "nowrap" || cs.textOverflow !== "ellipsis" || (cut && !tip && !(td.title || "").trim())) cellsOk.push(`${heads[i].innerText}: ${td.innerText}`);
      });
    }
    const heights = rows.map((r) => Math.round(r.getBoundingClientRect().height));
    const frame = document.querySelector<HTMLElement>("[data-value-list-frame]")!;
    const toolbar = frame.firstElementChild as HTMLElement;
    return {
      rows: rows.length,
      notOneLine: cellsOk.slice(0, 5),
      actionsOneLine,
      sameHeight: heights.length > 0 && Math.max(...heights) - Math.min(...heights) <= 1,
      tallest: Math.max(...heights),
      // The toolbar's own width — its controls side by side, with their gaps — against the table's frame.
      tableAtLeastToolbar: (() => {
        const kids = [...toolbar.children].map((c) => c.getBoundingClientRect().width);
        const natural = kids.reduce((a, b) => a + b, 0) + Math.max(0, kids.length - 1) * parseFloat(getComputedStyle(toolbar).columnGap || "0");
        return table.parentElement!.getBoundingClientRect().width + 1 >= natural;
      })(),
    };
  }, skip);
}

const LISTS: { name: string; key: string; skip: string[]; sameHeight: boolean }[] = [
  { name: "Tipuri Proprietate", key: "property-types", skip: [], sameHeight: true },
  // #38.50 had `skip: ["ROL INVERS"], sameHeight: false` — „#38.55 puts the converse names on one line; until then
  // that one cell is stacked". #38.55 did: every cell one line, every row one height.
  { name: "Roluri Persoană", key: "person-roles", skip: [], sameHeight: true },
  { name: "Tipuri Document", key: "document-types", skip: [], sameHeight: true },
];

test.describe("TC-VL-05 — tabele înguste, câte un rând pe linie", () => {
  for (const width of [1366, 1920]) {
    test(`la ${width} px: un rând pe linie, butoanele pe o linie, tabelul cel puțin cât bara de deasupra`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 1000 });
      for (const list of LISTS) {
        await page.goto(`/admin/value-lists?list=${list.key}`);
        await expect(page.locator("table[data-width-table] tbody tr").first()).toBeVisible({ timeout: 30_000 });
        await expect(page.locator("[data-usage]").first()).not.toHaveText("…", { timeout: 30_000 });
        const r = await reading(page, list.skip);
        expect({ list: list.name, rows: r.rows > 0, notOneLine: r.notOneLine, actionsOneLine: r.actionsOneLine, toolbar: r.tableAtLeastToolbar }).toEqual({
          list: list.name, rows: true, notOneLine: [], actionsOneLine: true, toolbar: true,
        });
        if (list.sameHeight) expect({ list: list.name, sameHeight: r.sameHeight, oneLine: r.tallest < 56 }).toEqual({ list: list.name, sameHeight: true, oneLine: true });
      }
    });
  }
});
