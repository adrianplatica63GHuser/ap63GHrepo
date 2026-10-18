/**
 * Case:   TC-LAYOUT-05 — Cele patru liste: înguste, câte un rând pe linie, butoanele unul lângă altul
 * Source: docs/testing/cases/TC-LAYOUT-05.md, „Last green" 2026-10-18
 *
 * A translation of the case file, step for step. The records carry `TC-E2E-LAYOUT-05` (records.ts), and each list is
 * searched for it, so nothing but invented records is read.
 *
 * Divergence from the hand run: „Câmpuri afișate" is set by writing each list's stored choice before the page loads
 * (`CHOICE`), not by ticking — the case only needs the four columns on screen (#39.83).
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord, type RecordKind } from "../helpers/records";

const MARK = `${E2E_MARKER}LAYOUT-05`;
const LONG = "cu o denumire mult prea lungă ca să încapă pe un singur rând al listei, oricât de lată ar fi fereastra";

// #39.24: `gap` is the space from a row's box to its name's first letter — 30 % of 144 px on Proprietăți, 50 % of 72 on
// the persons' lists (Adrian, 2026-10-13), Acte's as it was. #39.73: Proprietăți has no box any more (its delete went,
// and its ticks with it), so there is no gap to measure there, and no header box to align with — `null`.
const LISTS: { path: string; search: string; gap: number | null }[] = [
  { path: "/properties", search: "caută după Cod, Poreclă, Nr. cadastru, Nr. CF, Tarla/Solă sau Parcelă", gap: null },
  { path: "/natural-persons", search: "caută după ID, Nume, Poreclă, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu", gap: 36 },
  { path: "/judicial-persons", search: "caută după ID, Denumire, Poreclă, Nr. înregistrare (CUI), Telefon firmă sau E-mail firmă", gap: 36 },
  { path: "/documents", search: "caută după Cod, Titlu sau Nr. document", gap: 72 },
];

// #39.83: four columns on each list — a long name that always takes two rows, a filterable one, a multi-word name
// without a filter, and one more — so the band of names is read with every kind of cell in it.
const CHOICE: Record<string, string[]> = {
  "ga40-col-property-v4": ["useCategory", "propertyType", "cadastralNumber", "surfaceAreaMp"],
  "ga40-col-person-v3": ["dateOfBirth", "relationships", "cnp", "placeOfBirth"],
  "ga40-col-company-v2": ["cuiNumber", "tradeRegisterNumber", "contactPerson", "locality"],
  "ga40-col-document-v3": ["institution", "pageCount", "nrDocument", "propertyCount"],
};

/** #39.83 — the band of names: every cell's band, each name's rows, the funnel's place, a plain name's centring. */
async function band(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const bands = [...document.querySelectorAll<HTMLElement>("main thead [data-head-band]")];
    for (const b of bands) {
      const col = b.closest("th")?.dataset.widthColumn ?? "?";
      const box = b.getBoundingClientRect();
      const name = b.querySelector<HTMLElement>("[data-head-text]")!;
      const n = name.getBoundingClientRect();
      const rows = Math.round(n.height / 16);
      if (Math.round(box.height) !== 58) out.push(`${col}: band ${box.height}`);
      if (rows < 1 || rows > 2 || name.scrollHeight > name.clientHeight + 1) out.push(`${col}: ${rows} rows`);
      if (name.scrollWidth > name.clientWidth + 1) out.push(`${col}: cut sideways`);
      if (b.dataset.headBand === "filter") {
        const f = b.querySelector<HTMLElement>("[data-head-funnel] button")!.getBoundingClientRect();
        if (f.top < n.bottom - 0.5) out.push(`${col}: funnel not under the name`);
        if (Math.abs(n.bottom - (box.top + 32)) > 1) out.push(`${col}: name not on rows 1–2`);
        if (Math.abs(f.bottom - box.bottom) > 1) out.push(`${col}: funnel not on row 3`);
      } else if (Math.abs(n.top + n.height / 2 - (box.top + box.height / 2)) > 1) {
        out.push(`${col}: not centred`);
      }
    }
    const twoRows = bands
      .filter((b) => b.querySelector("[data-head-text] br"))
      .map((b) => Math.round(b.querySelector<HTMLElement>("[data-head-text]")!.getBoundingClientRect().height / 16));
    return { cells: bands.length, wrong: out, forcedOnTwo: twoRows.every((r) => r === 2), forced: twoRows.length };
  });
}

/** What the case reads off one list: its cells, its row's buttons and height, its toolbar's two sides. */
async function reading(page: Page) {
  return page.evaluate(() => {
    const table = document.querySelector<HTMLElement>("main table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
    const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")].filter((r) => r.cells.length === heads.length);
    const notOneLine: string[] = [];
    let buttonsOneLine = true;
    for (const r of rows) {
      [...r.cells].forEach((td, i) => {
        const col = heads[i].dataset.widthColumn ?? "";
        if (col === "listRowActions") {
          const tops = [...td.querySelectorAll<HTMLElement>("a,button")].map((b) => Math.round(b.getBoundingClientRect().top));
          if (new Set(tops).size > 1) buttonsOneLine = false;
          return;
        }
        if (col === "listBadges" || col === "selectNew" || col === "listSelectPerson") return;
        const cs = getComputedStyle(td);
        const cut = td.scrollWidth > td.clientWidth + 1;
        if (cs.whiteSpace !== "nowrap" || cs.textOverflow !== "ellipsis" || (cut && !(td.title || "").trim())) notOneLine.push(col);
      });
    }
    // The toolbar's two sides: „Adaugă …"'s group never over the controls on its left.
    const add = [...document.querySelectorAll<HTMLElement>("[data-list-toolbar] button, [data-list-toolbar] a")].find((b) => /Adaugă/.test(b.textContent ?? "") || /Adaugă/.test(b.getAttribute("aria-label") ?? ""))!;
    let group: HTMLElement = add;
    while (group.parentElement && !group.parentElement.matches("[data-list-toolbar], [data-toolbar-row]")) group = group.parentElement;
    const g = group.getBoundingClientRect();
    const overlap = [...group.parentElement!.children]
      .filter((c) => c !== group)
      .map((c) => c.getBoundingClientRect())
      .some((b) => b.width > 0 && b.top < g.bottom && b.bottom > g.top && b.right > g.left + 1);
    const toolbar = document.querySelector<HTMLElement>("[data-list-toolbar]")!.getBoundingClientRect().width;
    // #39.24: the gap from the row's box to its name's first letter, and the header's box over the rows'.
    const box = rows[0].querySelector<HTMLElement>("input[type=checkbox]")?.getBoundingClientRect() ?? null;
    const text = [...rows[0].cells[1].childNodes].find((n) => (n.textContent ?? "").trim())!;
    const range = document.createRange();
    range.selectNodeContents(text);
    const headBox = table.querySelector<HTMLElement>("thead input[type=checkbox]")?.getBoundingClientRect() ?? null;
    return {
      rows: rows.length,
      notOneLine,
      buttonsOneLine,
      tallest: Math.max(...rows.map((r) => Math.round(r.getBoundingClientRect().height))),
      overlap,
      frameAtLeastToolbar: table.parentElement!.getBoundingClientRect().width + 1 >= toolbar - 1,
      gap: box ? Math.round(range.getBoundingClientRect().left - box.right) : null,
      boxesAligned: box && headBox ? Math.abs(headBox.left - box.left) < 0.5 : null,
    };
  });
}

test.describe("TC-LAYOUT-05 — cele patru liste, câte un rând pe linie", () => {
  test("la 1366 și la 1920 px", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const made: [RecordKind, string][] = [];
    await page.addInitScript((choice) => {
      for (const [k, v] of Object.entries(choice)) localStorage.setItem(k, JSON.stringify(v));
    }, CHOICE);
    try {
      made.push(["property", await createProperty(page.request, { nickname: `${MARK} Proprietate ${LONG}` })]);
      made.push(["person", await createNaturalPerson(page.request, { lastName: `${MARK} Popescu`, firstName: `Ion ${LONG}`, nickname: `${MARK} poreclă ${LONG}` })]);
      made.push(["company", await createCompany(page.request, { name: `${MARK} SRL ${LONG}` })]);
      made.push(["document", await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Act ${LONG}`)]);

      for (const width of [1366, 1920]) {
        await page.setViewportSize({ width, height: 900 });
        for (const list of LISTS) {
          await page.goto(list.path);
          const search = page.locator("main").getByRole("searchbox", { name: list.search });
          await expect(search).toBeVisible({ timeout: 30_000 });
          await search.fill(MARK);
          // The search narrows the table to the one record — wait for the narrowing (the search is debounced, and a
          // single „loading" row would pass a count of one), not just for the record.
          await expect(page.locator("main table[data-width-table] tbody tr").filter({ hasNotText: MARK })).toHaveCount(0, { timeout: 30_000 });
          await expect(page.locator("main table[data-width-table] tbody tr").filter({ hasText: MARK })).toHaveCount(1, { timeout: 30_000 });
          const r = await reading(page);
          expect({ width, list: list.path, rows: r.rows, notOneLine: r.notOneLine, buttonsOneLine: r.buttonsOneLine, oneLineTall: r.tallest < 56, overlap: r.overlap, frame: r.frameAtLeastToolbar, gap: r.gap, boxesAligned: r.boxesAligned })
            .toEqual({ width, list: list.path, rows: 1, notOneLine: [], buttonsOneLine: true, oneLineTall: true, overlap: false, frame: true, gap: list.gap, boxesAligned: list.gap === null ? null : true });
          // #39.83: the band of names — three rows on every cell, no name over two, the funnel alone on the third, a
          // name without one centred; Adrian's long names on two rows (three of `CHOICE` on each list but the juridical persons').
          // #39.85: the search box as wide as „Adaugă …", its whole explanation on hover (the box's title).
          const fit = await page.evaluate(() => {
            const box = document.querySelector<HTMLInputElement>("main [data-list-search]")!;
            const add = document.querySelector<HTMLElement>("main [data-list-add]")!;
            return { widthsAgree: Math.abs(box.getBoundingClientRect().width - add.getBoundingClientRect().width) <= 1, hover: box.title === box.placeholder && box.title.length > 0 };
          });
          expect({ width, list: list.path, ...fit }).toEqual({ width, list: list.path, widthsAgree: true, hover: true });
          await expect(search).toHaveAttribute("title", list.search);
          const h = await band(page);
          expect({ width, list: list.path, ...h }).toEqual({
            width, list: list.path, cells: list.path === "/properties" ? 5 : 6, wrong: [], forcedOnTwo: true,
            forced: list.path === "/judicial-persons" ? 0 : 3,
          });
        }
      }
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});
