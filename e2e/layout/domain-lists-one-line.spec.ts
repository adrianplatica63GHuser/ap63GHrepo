/**
 * Case:   TC-LAYOUT-05 — Cele patru liste: înguste, câte un rând pe linie, butoanele unul lângă altul
 * Source: docs/testing/cases/TC-LAYOUT-05.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. The records carry `TC-E2E-LAYOUT-05` (records.ts), and each list is
 * searched for it, so nothing but invented records is read.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord, type RecordKind } from "../helpers/records";

const MARK = `${E2E_MARKER}LAYOUT-05`;
const LONG = "cu o denumire mult prea lungă ca să încapă pe un singur rând al listei, oricât de lată ar fi fereastra";

const LISTS: { path: string; search: string }[] = [
  { path: "/properties", search: "caută după cod, poreclă, nr. cadastru, carte funciară, tarla sau parcelă" },
  { path: "/natural-persons", search: "caută după cod, nume, email sau telefon" },
  { path: "/judicial-persons", search: "caută după cod, nume, poreclă sau ID" },
  { path: "/documents", search: "caută după cod, titlu sau nr. document" },
];

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
        if (col === "listBadges" || col === "selectNew") return;
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
    return {
      rows: rows.length,
      notOneLine,
      buttonsOneLine,
      tallest: Math.max(...rows.map((r) => Math.round(r.getBoundingClientRect().height))),
      overlap,
      frameAtLeastToolbar: table.parentElement!.getBoundingClientRect().width + 1 >= toolbar - 1,
    };
  });
}

test.describe("TC-LAYOUT-05 — cele patru liste, câte un rând pe linie", () => {
  test("la 1366 și la 1920 px", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const made: [RecordKind, string][] = [];
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
          expect({ width, list: list.path, rows: r.rows, notOneLine: r.notOneLine, buttonsOneLine: r.buttonsOneLine, oneLineTall: r.tallest < 56, overlap: r.overlap, frame: r.frameAtLeastToolbar })
            .toEqual({ width, list: list.path, rows: 1, notOneLine: [], buttonsOneLine: true, oneLineTall: true, overlap: false, frame: true });
        }
      }
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});
