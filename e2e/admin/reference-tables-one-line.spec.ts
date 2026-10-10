/**
 * Case:   TC-VL-05 — „Date de referință”: tabele înguste, câte un rând pe linie, butoanele unul lângă altul
 * Source: docs/testing/cases/TC-VL-05.md, „Last green" 2026-10-09
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

/** Slice #38.60: where each column's text sits against its column — the ✓ in a checkmark column, and the alignment. */
async function centring(page: Page) {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
    const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")].filter((r) => r.cells.length === heads.length);
    const first = (re: RegExp) => heads.findIndex((th) => re.test(th.innerText.replace(/\s+/g, " ").trim()));
    const cols = {
      flagProperty: first(/^persoană → proprietate$/i),
      flagPerson: first(/^persoană → persoană$/i),
      converse: first(/^rol invers/i),
      usage: first(/^folosit de/i),
      name: first(/^denumire$/i),
      description: first(/^descriere$/i),
    };
    let worstTick = 0;
    let ticks = 0;
    for (const i of [cols.flagProperty, cols.flagPerson]) {
      for (const r of rows) {
        const td = r.cells[i];
        const span = td.querySelector("span");
        if (!span || span.textContent !== "✓") continue;
        const a = span.getBoundingClientRect();
        const b = td.getBoundingClientRect();
        worstTick = Math.max(worstTick, Math.abs((a.left + a.right) / 2 - (b.left + b.right) / 2));
        ticks++;
      }
    }
    const align = (i: number) => ({ head: getComputedStyle(heads[i]).textAlign, cell: getComputedStyle(rows[0].cells[i]).textAlign });
    return {
      ticks,
      worstTick: Math.round(worstTick * 10) / 10,
      centred: [cols.flagProperty, cols.flagPerson, cols.converse, cols.usage].map(align),
      left: [cols.name, cols.description].map(align),
      tallest: Math.max(...rows.map((r) => Math.round(r.getBoundingClientRect().height))),
    };
  });
}

test.describe("TC-VL-05 pasul 4 — Roluri: valorile centrate (#38.60)", () => {
  for (const width of [1366, 1920]) {
    test(`la ${width} px: ✓ în mijlocul coloanei, antetele centrate deasupra, rândul pe o linie`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/admin/value-lists?list=person-roles");
      await expect(page.locator("[data-usage]").first()).not.toHaveText("…", { timeout: 30_000 });
      const c = await centring(page);
      expect(c.ticks).toBeGreaterThan(0);
      expect(c.worstTick).toBeLessThanOrEqual(2);
      const centre = { head: "center", cell: "center" };
      expect(c.centred).toEqual([centre, centre, centre, centre]);
      for (const l of c.left) expect([l.head, l.cell].every((a) => a === "left" || a === "start")).toBe(true);
      expect(c.tallest).toBeLessThan(56);
    });
  }
});

/** Slice #38.66: on one list, how close the next column follows the longest name, and whether any name is cut. */
async function nameGap(page: Page) {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
    const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")].filter((r) => r.cells.length === heads.length);
    let gap = Infinity;
    const cut: string[] = [];
    for (const r of rows) {
      const td = r.cells[0];
      // The text's own box: a document type's name sits in its tooltip's span (#38.53), every other in a plain span.
      const text = td.querySelector<HTMLElement>("[data-name-tip]") ?? td.querySelector<HTMLElement>("span")!;
      gap = Math.min(gap, td.getBoundingClientRect().right - text.getBoundingClientRect().right);
      if (text.scrollWidth > text.clientWidth + 1 || td.scrollWidth > td.clientWidth + 1) cut.push(td.innerText);
    }
    const street = heads.find((th) => th.innerText.replace(/\s+/g, " ").trim().toUpperCase() === "STREET VIEW");
    let streetLines = 0;
    if (street) {
      // The text's own line boxes — a range over the whole cell would add the span's box as one more.
      const words = document.createTreeWalker(street, NodeFilter.SHOW_TEXT).nextNode()!;
      const range = document.createRange();
      range.selectNodeContents(words);
      streetLines = new Set([...range.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size;
    }
    return { rows: rows.length, gap: Math.round(gap * 10) / 10, cut, streetLines };
  });
}

test.describe("TC-VL-05 pasul 5 — „Tipuri de obiecte” fără spațiu irosit (#38.66)", () => {
  test("la 1366 px: coloana următoare urmează îndeaproape cea mai lungă denumire; „Street View” pe două rânduri", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 1000 });
    for (const list of [
      { name: "Tipuri de Persoană Juridică", key: "judicial-person-types" },
      { name: "Tipuri de Proprietate", key: "property-types" },
      { name: "Tipuri de Document", key: "document-types" },
    ]) {
      await page.goto(`/admin/value-lists?list=${list.key}`);
      await expect(page.locator("[data-usage]").first()).not.toHaveText("…", { timeout: 30_000 });
      const g = await nameGap(page);
      expect({ list: list.name, rows: g.rows > 0, cut: g.cut, under24: g.gap < 24 }, `the longest name ends ${g.gap} px before the next column`).toEqual({
        list: list.name, rows: true, cut: [], under24: true,
      });
      if (list.key === "property-types") expect(g.streetLines, "„Street View” on two lines").toBe(2);
      // The slice's pictures, not a step of the case.
      await page.getByRole("region", { name: list.name, exact: true }).screenshot({ path: `playwright-report/value-list-page/types-${list.key}-1366.png` });
    }
  });
});
