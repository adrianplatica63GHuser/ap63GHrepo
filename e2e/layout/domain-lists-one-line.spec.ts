/**
 * Case:   TC-LAYOUT-05 — Cele patru liste: înguste, câte un rând pe linie, butoanele unul lângă altul
 * Source: docs/testing/cases/TC-LAYOUT-05.md, „Last green" 2026-10-18
 *
 * A translation of the case file, step for step. The records carry `TC-E2E-LAYOUT-05` (records.ts), and each list is
 * searched for it, so nothing but invented records is read.
 *
 * Divergence from the hand run: „Câmpuri afișate" is set by writing each list's stored choice before the page loads
 * (`CHOICE`), not by ticking — the case only needs the four columns on screen (#39.83).
 *
 * Steps 7–10 (Slice #40.02) are the second test: each list unsearched, so it holds a page of rows, at 1280 × 600 and at
 * 1920 × 1080. They read the archive's own rows' boxes only — no text — and on Proprietăți open a record whose maps are
 * blocked (e2e/README.md): no map loads, no Street View, no address look-up.
 *
 * Step 17 (Slice 40.20) is the fifth test: every column's short name in the band, in Romanian and in English.
 *
 * Steps 15–16 (Slice 40.18) are the fourth test: a column name is drawn in Roboto Condensed and in ink, a tile's title
 * in Roboto Slab and in navy — read off the styles and the loaded font faces, no text — in light and in dark.
 *
 * Steps 11–14 (Slice #40.03) are the third test (11b, Slice 40.23: the glyphs' slow pulse): Acte with four columns chosen at 1100 px, so its columns are wider
 * than the frame — the red „>" and „<" at the band's edges as the list scrolls sideways; a funnel under the right-hand
 * signs still opens its editor; at 1920 px with no column chosen, neither sign.
 */

import { test, expect, type Page } from "../helpers/test";
import { lookOnLoad } from "../helpers/theme";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord, type RecordKind } from "../helpers/records";

// Slice 40.14: the scroll bars shown, as Adrian's Windows Chrome draws them. Since the lists' frame keeps its vertical
// bar's room (`scrollbar-gutter: stable`, `LIST_FRAME`), headless Chromium's hidden bars (Playwright passes
// `--hide-scrollbars`) disagree with themselves: the frame's clientWidth leaves the 15-px room out, the furthest the
// frame scrolls sideways does not — measured on Acte at 1100 px, clientWidth 811, scrollWidth 1292, scrollLeft stopped
// at 466 — so step 13's end of the list kept its „>". No window a person uses hides the bars that way.
test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

const MARK = `${E2E_MARKER}LAYOUT-05`;
const LONG = "cu o denumire mult prea lungă ca să încapă pe un singur rând al listei, oricât de lată ar fi fereastra";

// #39.24: `gap` is the space from a row's box to its name's first letter — 30 % of 144 px on Proprietăți, 50 % of 72 on
// the persons' lists (Adrian, 2026-10-13), Acte's as it was. #39.73: Proprietăți has no box any more (its delete went,
// and its ticks with it), so there is no gap to measure there, and no header box to align with — `null`. Slice 40.10:
// the other three lists' boxes went the same way (were 36, 36 and 72), so every gap is `null`; their first columns keep
// their widths, so the names stay where the boxes left them.
const LISTS: { path: string; search: string; gap: number | null }[] = [
  { path: "/properties", search: "caută după Cod, Poreclă, Nr. cadastru, Nr. CF, Tarla/Solă sau Parcelă", gap: null },
  { path: "/natural-persons", search: "caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu", gap: null },
  { path: "/judicial-persons", search: "caută după ID, Denumire, Poreclă, Nr. înregistrare (CUI), Telefon firmă sau E-mail firmă", gap: null },
  { path: "/documents", search: "caută după Cod, Titlu sau Nr. document", gap: null },
];

// #39.83: four columns on each list — a long name that always takes two rows, a filterable one, a multi-word name
// without a filter, and one more — so the band of names is read with every kind of cell in it.
const CHOICE: Record<string, string[]> = {
  "ga40-col-property-v4": ["useCategory", "propertyType", "cadastralNumber", "surfaceAreaMp"],
  "ga40-col-person-v3": ["dateOfBirth", "relationships", "cnp", "placeOfBirth"],
  "ga40-col-company-v2": ["cuiNumber", "tradeRegisterNumber", "contactPerson", "locality"],
  "ga40-col-document-v3": ["institution", "pageCount", "nrDocument", "propertyCount"],
};

/**
 * The band of names: every cell's band, each name's rows, and — Slice 40.29 — the name ALONE centred in the cell both
 * ways (within 1 px), the funnel 13 × 13 in the cell's bottom-right corner, 2 px in, pressable 5 px beyond its
 * top-left (40.21 had the name and the funnel as one centred group).
 */
async function band(page: Page) {
  return page.evaluate(() => {
    const out: string[] = [];
    const bands = [...document.querySelectorAll<HTMLElement>("main thead [data-head-band]")];
    for (const b of bands) {
      const th = b.closest("th")!;
      const col = th.dataset.widthColumn ?? "?";
      const box = b.getBoundingClientRect();
      const cell = th.getBoundingClientRect();
      const name = b.querySelector<HTMLElement>("[data-head-text]")!;
      const n = name.getBoundingClientRect();
      // Slice 40.21: two rows of the names' line (40.18's Roboto Condensed 13.5 px); 17 px since 40.30 (18 before) —
      // 34 px; it was 36, and 62 before 40.21.
      const rows = Math.round(n.height / 17);
      if (Math.round(box.height) !== 34) out.push(`${col}: band ${box.height}`);
      if (rows < 1 || rows > 2 || name.scrollHeight > name.clientHeight + 1) out.push(`${col}: ${rows} rows`);
      if (name.scrollWidth > name.clientWidth + 1) out.push(`${col}: cut sideways`);
      // The name alone, centred in its cell, both ways — the funnel takes no part in it.
      if (Math.abs((n.left + n.right) / 2 - (cell.left + cell.right) / 2) > 1) out.push(`${col}: not centred across`);
      if (Math.abs((n.top + n.bottom) / 2 - (cell.top + cell.bottom) / 2) > 1) out.push(`${col}: not centred down`);
      if (b.dataset.headBand === "filter") {
        const button = th.querySelector<HTMLElement>("[data-head-funnel] button")!;
        const f = button.getBoundingClientRect();
        if (Math.round(f.width) !== 13 || Math.round(f.height) !== 13) out.push(`${col}: funnel ${f.width} × ${f.height}`);
        if (Math.abs(cell.right - 2 - f.right) > 1 || Math.abs(cell.bottom - 2 - f.bottom) > 1) out.push(`${col}: funnel not in the corner`);
        if (f.left < n.right - 0.5 && f.top < n.bottom - 0.5) out.push(`${col}: funnel over the name`);
        // A smaller funnel is not harder to hit: 4 px above and left of its box still presses it — read where the point
        // is on screen, inside the frame and clear of its red „<" / „>" signs at the two edges.
        const frame = th.closest("table")!.parentElement!.getBoundingClientRect();
        if (f.left - 4 > frame.left + 40 && f.right < frame.right - 40 && f.bottom < window.innerHeight) {
          const hit = document.elementFromPoint(f.left - 4, f.top - 4);
          if (!hit || !button.contains(hit)) out.push(`${col}: funnel's pressable area under 20 px`);
        }
      }
    }
    // Slice 40.20: no name is broken onto two rows by force any more.
    const forced = bands.filter((b) => b.querySelector("[data-head-text] br")).length;
    return { cells: bands.length, wrong: out, forcedOnTwo: true, forced };
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
    // Slice 40.24: no box and no badges' column any more — the gap is measured only where a box is.
    const box = rows[0].querySelector<HTMLElement>("input[type=checkbox]")?.getBoundingClientRect() ?? null;
    const range = document.createRange();
    if (box) range.selectNodeContents([...rows[0].cells[1].childNodes].find((n) => (n.textContent ?? "").trim())!);
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
          // Slice 40.10: no tick box in the frame — the band or a row — and no „Șterge selecția".
          await expect(page.locator("main table[data-width-table] input[type=checkbox]")).toHaveCount(0);
          await expect(page.getByRole("button", { name: /^Șterge selecția/ })).toHaveCount(0);
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
          // Step 1a (Slice 40.24): no column before the first named one — the band's first cell has a name — and this
          // fresh record's „Nou!" sits in its row's first cell, after the text.
          const first = await page.evaluate(() => {
            const th = document.querySelector("main table[data-width-table] thead th")!;
            const td = document.querySelector("main table[data-width-table] tbody tr td")!;
            return { named: th.querySelector("[data-head-text]") !== null, badge: td.querySelector("[data-row-badges]")?.textContent ?? "" };
          });
          expect({ width, list: list.path, ...first }).toEqual({ width, list: list.path, named: true, badge: expect.stringContaining("Nou!") });
          // Slice 40.30 — three quarters as tall: the band 39 px (it was 52), the row 32 (about 43); the row's buttons
          // 24 × 24, 6 px apart; the search box 30 px, as an sm button; „Adaugă …" md, 34; „Câmpuri afișate" sm, 30.
          const size = await page.evaluate(() => {
            const table = document.querySelector<HTMLElement>("main table[data-width-table]")!;
            const h = (el: Element | null) => (el ? Math.round(el.getBoundingClientRect().height * 2) / 2 : -1);
            const buttons = [...table.querySelectorAll<HTMLElement>("tbody tr [data-row-actions] a, tbody tr [data-row-actions] button")];
            const gaps = buttons.slice(1).map((b, i) => Math.round(b.getBoundingClientRect().left - buttons[i].getBoundingClientRect().right));
            return {
              band: h(table.querySelector("thead tr")),
              row: h(table.querySelector("tbody tr")),
              buttons: [...new Set(buttons.map((b) => `${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`))],
              gaps: [...new Set(gaps)],
              search: h(document.querySelector("main [data-list-search]")),
              add: h(document.querySelector("main [data-list-add] a, main [data-list-add] button")),
              chooser: h(document.querySelector("main [data-field-chooser] > span > button, main [data-field-chooser] button")),
            };
          });
          expect({ width, list: list.path, band: Math.abs(size.band - 39) <= 1, row: Math.abs(size.row - 32) <= 1, buttons: size.buttons, gaps: size.gaps, search: size.search, add: size.add, chooser: size.chooser })
            .toEqual({ width, list: list.path, band: true, row: true, buttons: ["24×24"], gaps: [6], search: 30, add: 34, chooser: 30 });
          const h = await band(page);
          expect({ width, list: list.path, ...h }).toEqual({
            width, list: list.path, cells: list.path === "/properties" ? 5 : 6, wrong: [], forcedOnTwo: true,
            // Slice 40.20: Adrian's short names need no forced break — none is on two rows by force.
            forced: 0,
          });
        }
      }
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
  // Slice #40.02 — steps 7–10: the list fits the window. Short, the page does not scroll: the frame does, the band of
  // names and the „Se afișează … / Pagina x din y" row staying in sight; Back from a record puts the frame's scroll back;
  // tall, a page of rows fits and the frame draws no scroll bar.
  test("la 1280 × 600 lista încape în fereastră: rândurile se derulează în chenarul lor", async ({ page }) => {
    test.slow();
    for (const list of LISTS) {
      await test.step(list.path, async () => {
        // Step 7 — short: the page has no vertical scroll; the frame has one.
        await page.setViewportSize({ width: 1280, height: 600 });
        await page.goto(list.path);
        const main = page.locator("main");
        await expect(main.getByRole("searchbox", { name: list.search })).toBeVisible({ timeout: 30_000 });
        const frame = main.locator("[data-list-frame]");
        await expect.poll(async () => frame.locator("tbody tr").count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(10);
        const fits = () =>
          page.evaluate(() => {
            const ps = document.querySelector<HTMLElement>("[data-page-scroll]")!;
            const f = document.querySelector<HTMLElement>("main [data-list-frame]")!;
            return { page: ps.scrollHeight - ps.clientHeight, frame: f.scrollHeight - f.clientHeight };
          });
        await expect.poll(async () => (await fits()).page, { timeout: 10_000, message: `${list.path}: the page does not scroll` }).toBeLessThanOrEqual(0);
        expect((await fits()).frame, `${list.path}: the frame scrolls`).toBeGreaterThan(0);

        // Step 8 — the frame scrolled to its last row: the band at the frame's top, the last row and the pagination row
        // inside the window.
        const atEnd = await page.evaluate(() => {
          const f = document.querySelector<HTMLElement>("main [data-list-frame]")!;
          f.scrollTop = f.scrollHeight;
          const fr = f.getBoundingClientRect();
          const head = f.querySelector("thead")!.getBoundingClientRect();
          const last = [...f.querySelectorAll("tbody tr")].at(-1)!.getBoundingClientRect();
          const pag = [...document.querySelectorAll<HTMLElement>("main [data-list-edge]")].at(-1)!.getBoundingClientRect();
          return { scrolled: f.scrollTop > 0, head: Math.round(head.top - fr.top), last: last.bottom <= fr.bottom + 1, pag: pag.bottom <= window.innerHeight, page: document.querySelector<HTMLElement>("[data-page-scroll]")!.scrollTop };
        });
        expect({ list: list.path, ...atEnd }).toEqual({ list: list.path, scrolled: true, head: 1, last: true, pag: true, page: 0 });

        // Step 9 — a row half-way down opened, then Back: the frame's scroll as it was (±2 px), the row in sight.
        const middle = await page.evaluate(() => {
          const f = document.querySelector<HTMLElement>("main [data-list-frame]")!;
          f.scrollTop = Math.round((f.scrollHeight - f.clientHeight) / 2);
          const band = f.querySelector("thead")!.getBoundingClientRect().bottom;
          const rows = [...f.querySelectorAll<HTMLTableRowElement>("tbody tr")];
          const i = rows.findIndex((r) => r.getBoundingClientRect().top >= band);
          return { top: f.scrollTop, row: i };
        });
        expect(middle.top, `${list.path}: scrolled half-way`).toBeGreaterThan(0);
        await page.waitForTimeout(400); // the scroll is kept 100 ms after it stops
        const row = frame.locator("tbody tr").nth(middle.row);
        await row.getByRole("link", { name: "Deschide", exact: true }).click();
        await expect(page).toHaveURL((u) => u.pathname.startsWith(`${list.path}/`), { timeout: 30_000 });
        await page.waitForTimeout(1_000);
        await page.goBack();
        await expect(page).toHaveURL((u) => u.pathname === list.path, { timeout: 30_000 });
        await expect
          .poll(async () => Math.abs((await frame.evaluate((el) => el.scrollTop)) - middle.top), { timeout: 8_000, message: `${list.path}: the frame's scroll comes back` })
          .toBeLessThanOrEqual(2);
        await expect(row).toBeInViewport();

        // Step 10 — tall: a page of rows fits, and the frame draws no scroll bar.
        await page.setViewportSize({ width: 1920, height: 1080 });
        await expect.poll(async () => (await fits()).frame, { timeout: 10_000, message: `${list.path}: no scroll bar at 1080 px` }).toBeLessThanOrEqual(0);
        expect((await fits()).page).toBeLessThanOrEqual(0);
      });
    }
  });
  // Slice #40.03 — steps 11–14: three red „>" at the band's right edge while columns are hidden to the right, three red
  // „<" at its left edge while columns are hidden to the left. Slice 40.11: each sign a button that explains itself — a
  // bubble with its sentence on hover or keyboard focus, a press scrolling the list that way (step 11a, step 13).
  test("semnele roșii „>” și „<” la marginile benzii cât timp sunt coloane ascunse", async ({ page }) => {
    test.slow();
    await page.addInitScript(() => {
      localStorage.setItem("ga40-col-document-v3", JSON.stringify(["dateDocument", "institution", "pageCount", "createdAt"]));
    });
    const main = page.locator("main");
    const frame = main.locator("[data-list-frame]");
    const right = frame.locator("[data-hidden-right]");
    const left = frame.locator("[data-hidden-left]");
    const read = () =>
      frame.evaluate((f) => {
        const box = (sel: string) => {
          const e = f.querySelector<HTMLElement>(sel);
          if (!e) return null;
          const b = e.getBoundingClientRect();
          return { left: b.left, right: b.right, top: b.top, height: b.height };
        };
        const fr = f.getBoundingClientRect();
        const head = f.querySelector("thead")!.getBoundingClientRect();
        return { frame: { left: fr.left + f.clientLeft, right: fr.left + f.clientLeft + f.clientWidth }, head: { top: head.top, height: head.height }, left: box("[data-hidden-left]"), right: box("[data-hidden-right]") };
      });

    // Step 11 — at the start: the „>" only, three of them, red, at the visible part's right edge, the band's height.
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.goto("/documents");
    await expect(main.getByRole("columnheader", { name: /Adăugat la/ })).toBeVisible({ timeout: 30_000 });
    await expect(right).toBeVisible({ timeout: 10_000 });
    await expect(left).toHaveCount(0);
    await expect(right.locator("span")).toHaveText([">", ">", ">"]);
    // The danger red, as the browser computes `text-red-600` (Tailwind v4 writes it in oklch; Chromium reads it back as lab).
    const red = await page.evaluate(() => {
      const probe = document.createElement("span");
      probe.className = "text-red-600";
      document.body.append(probe);
      const c = getComputedStyle(probe).color;
      probe.remove();
      return c;
    });
    await expect(right).toHaveCSS("color", red);
    // The strip between the signs takes no pointer; since 40.11 the signs do, and are named by their sentence.
    await expect(frame.locator("[data-hidden-columns]")).toHaveCSS("pointer-events", "none");
    await expect(right).toHaveAttribute("aria-label", "Mai sunt coloane la dreapta. Derulați spre dreapta ca să le vedeți.");
    const r11 = await read();
    expect(Math.abs(r11.right!.right - r11.frame.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(r11.right!.top - r11.head.top)).toBeLessThanOrEqual(1);
    expect(Math.abs(r11.right!.height - r11.head.height)).toBeLessThanOrEqual(1);

    // Step 11b (Slice 40.23) — the glyphs breathe: one 2.4-s cycle, endlessly, on the glyphs and not on the strip;
    // still while the mouse rests on the sign; never under „reduce motion".
    const pulse = () =>
      right.evaluate((b) => {
        const g = getComputedStyle(b.querySelector("span")!);
        return { name: g.animationName, duration: g.animationDuration, count: g.animationIterationCount, strip: getComputedStyle(b).animationName };
      });
    // The mouse away from the signs and nothing focused, so the first reading is the sign left alone.
    await page.mouse.move(5, 5);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await pulse()).toEqual({ name: "ga-sign-pulse", duration: "2.4s", count: "infinite", strip: "none" });
    await right.hover();
    expect((await pulse()).name).toBe("none");
    await page.mouse.move(5, 5);
    expect((await pulse()).name).toBe("ga-sign-pulse");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await pulse()).name).toBe("none");
    await page.emulateMedia({ reducedMotion: "no-preference" });

    // Step 11a (Slice 40.11) — the mouse over the „>": a bubble under the band with its sentence; a press: the frame
    // scrolls right — by its visible width less 4 rem — and the „<" appear; a keyboard focus on the „<": its bubble.
    await right.hover();
    const bubble = page.getByRole("tooltip").filter({ hasText: "Mai sunt coloane la dreapta. Derulați spre dreapta ca să le vedeți." });
    await expect(bubble).toBeVisible({ timeout: 5_000 });
    expect((await bubble.boundingBox())!.y).toBeGreaterThanOrEqual(r11.head.top + r11.head.height - 1);
    const before = await frame.evaluate((f) => f.scrollLeft);
    await right.click();
    await expect.poll(() => frame.evaluate((f) => f.scrollLeft), { timeout: 5_000 }).toBeGreaterThan(before + 100);
    await expect(left).toBeVisible();
    await page.mouse.move(5, 5);
    await page.keyboard.press("Shift");
    await left.focus();
    await expect(page.getByRole("tooltip").filter({ hasText: "Mai sunt coloane la stânga. Derulați spre stânga ca să le vedeți." })).toBeVisible({ timeout: 5_000 });
    await left.blur();

    // Step 12 — scrolled to the middle: both; scrolled down too, both still at the band's height.
    await frame.evaluate((f) => { f.scrollLeft = Math.round((f.scrollWidth - f.clientWidth) / 2); f.scrollTop = 120; });
    await expect(left).toBeVisible();
    await expect(right).toBeVisible();
    await expect(left.locator("span")).toHaveText(["<", "<", "<"]);
    const r12 = await read();
    expect(Math.abs(r12.left!.left - r12.frame.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(r12.right!.right - r12.frame.right)).toBeLessThanOrEqual(1);
    expect(Math.abs(r12.left!.top - r12.head.top)).toBeLessThanOrEqual(1);

    // Step 13 — at the end: the „<" only. Then back to where a funnel stands under the right-hand signs. Slice 40.11: was
    // „pressed through them, it opens its editor" — the sign catches the press now and scrolls the list right, which
    // brings the funnel out from under it; then the funnel is pressed.
    await frame.evaluate((f) => { f.scrollLeft = f.scrollWidth; f.scrollTop = 0; });
    await expect(right).toHaveCount(0);
    await expect(left).toBeVisible();
    const at = await frame.evaluate((f) => {
      f.scrollLeft = 0;
      const edge = f.getBoundingClientRect().left + f.clientLeft + f.clientWidth;
      // The first funnel whose centre the list can bring under the signs' 20-px strip.
      for (const b of Array.from(f.querySelectorAll<HTMLElement>("[data-filter-funnel] button"))) {
        const r = b.getBoundingClientRect();
        const shift = r.left + r.width / 2 - (edge - 10);
        if (shift >= 0 && shift <= f.scrollWidth - f.clientWidth) {
          f.scrollLeft = shift;
          const after = b.getBoundingClientRect();
          return { x: after.left + after.width / 2, y: after.top + after.height / 2, key: b.closest("[data-filter-funnel]")!.getAttribute("data-filter-funnel") };
        }
      }
      return null;
    });
    expect(at, "a funnel the list can bring under the right-hand signs").not.toBeNull();
    await expect(right).toBeVisible();
    const sign = await read();
    expect(at!.x).toBeGreaterThanOrEqual(sign.right!.left);
    await page.waitForTimeout(200);
    const under = await frame.evaluate((f) => f.scrollLeft);
    await page.mouse.click(at!.x, at!.y);
    await expect.poll(() => frame.evaluate((f) => f.scrollLeft), { timeout: 5_000 }).toBeGreaterThan(under);
    await page.locator(`[data-filter-funnel="${at!.key}"] button`).click();
    await expect(page.locator(`[data-filter-editor="${at!.key}"]`)).toBeVisible({ timeout: 10_000 });
    await page.keyboard.press("Escape");

    // Step 14 — at 1920 px with no column chosen, every column fits: neither sign; the horizontal scroll bar stays the
    // frame's own.
    await page.evaluate(() => localStorage.setItem("ga40-col-document-v3", JSON.stringify([])));
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.addInitScript(() => localStorage.setItem("ga40-col-document-v3", JSON.stringify([])));
    await page.goto("/documents");
    await expect(frame.locator("tbody tr").first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(right).toHaveCount(0);
    await expect(left).toHaveCount(0);
  });

  // Steps 15–16 (Slice 40.18): alternative 13 in Adrian's colours. Only styles are read — no record's text.
  test("titlurile: numele coloanelor în Roboto Condensed, negru; titlul unei dale în Roboto Slab, bleumarin", async ({ page }) => {
    const look = (selector: string) =>
      page.evaluate(async (sel) => {
        await document.fonts.ready;
        const el = document.querySelector<HTMLElement>(sel)!;
        const cs = getComputedStyle(el);
        const loaded = [...document.fonts].filter((f) => f.status === "loaded").map((f) => `${f.family} ${f.weight}`);
        // Today's dark column names are Tailwind 4's zinc-300, an oklch colour: read it off the page's own variable.
        const probe = document.createElement("span");
        probe.style.color = "var(--color-zinc-300)";
        document.body.append(probe);
        const zinc300 = getComputedStyle(probe).color;
        probe.remove();
        return { family: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, transform: cs.textTransform, color: cs.color, loaded, zinc300 };
      }, selector);

    for (const scheme of ["light", "dark"] as const) {
      // Slice 40.19: the look is the ga40-theme cookie („Mod întunecat"), not the OS setting.
      await lookOnLoad(page, scheme);
      await page.setViewportSize({ width: 1366, height: 900 });

      // Step 15 — a column name on „Persoane fizice" (step 15: the dark look is „Mod întunecat" ticked, since 40.19).
      await page.goto("/natural-persons");
      await expect(page.locator("main thead [data-head-text]").first()).toBeVisible({ timeout: 30_000 });
      const col = await look("main thead [data-head-text]");
      expect(col.family).toMatch(/Roboto[ _]Condensed/);
      expect([col.size, col.weight, col.transform]).toEqual(["13.5px", "600", "uppercase"]);
      expect(col.color).toBe(scheme === "light" ? "rgb(60, 65, 73)" : col.zinc300);
      expect(col.loaded.some((f) => /Roboto[ _]Condensed/.test(f))).toBe(true);

      // Step 16 — a tile's title on the dashboard.
      await page.goto("/");
      await expect(page.locator("[data-tile-title] h2").first()).toBeVisible({ timeout: 30_000 });
      const tile = await look("[data-tile-title] h2");
      expect(tile.family).toMatch(/Roboto[ _]Slab/);
      expect([tile.size, tile.weight, tile.transform]).toEqual(["16px", "600", "uppercase"]);
      expect(tile.color).toBe(scheme === "light" ? "rgb(30, 58, 138)" : "rgb(191, 219, 254)");
      expect(tile.loaded.some((f) => /Roboto[ _]Slab/.test(f))).toBe(true);
    }
  });

  // Step 17 (Slice 40.20): Adrian's short names in the band, in both languages, every column of each list — four at a
  // time, as „Câmpuri afișate" allows — with the field's whole label on hover. Only the band is read: no record's text.
  test("numele scurte ale coloanelor, în română și în engleză", async ({ page }) => {
    const fs = await import("node:fs");
    const msgs = {
      "ro-RO": JSON.parse(fs.readFileSync("messages/ro-RO.json", "utf8")),
      "en-GB": JSON.parse(fs.readFileSync("messages/en-GB.json", "utf8")),
    } as const;
    const LISTS2 = [
      { path: "/natural-persons", ns: "naturalPerson", store: "ga40-col-person-v3", fixed: ["name", "nickname"],
        groups: [["cnp", "dateOfBirth", "age", "gender"], ["dateOfDeath", "placeOfBirth", "professionalType", "relationships"]] },
      { path: "/judicial-persons", ns: "judicialPerson", store: "ga40-col-company-v2", fixed: ["name", "nickname"],
        groups: [["judicialPersonType", "cuiNumber", "tradeRegisterNumber", "contactPerson"], ["locality"]] },
      { path: "/properties", ns: "property", store: "ga40-col-property-v4", fixed: ["nickname"],
        groups: [["tarlaSola", "parcela", "surfaceAreaMp", "calculatedAreaMp"], ["carteFunciara", "cadastralNumber", "useCategory", "propertyType"], ["locality"]] },
      { path: "/documents", ns: "document", store: "ga40-col-document-v3", fixed: ["type", "title"],
        groups: [["nrDocument", "dateDocument", "institution", "subject"], ["pageCount", "personCount", "propertyCount", "createdAt"]] },
    ];
    const base = test.info().project.use.baseURL ?? "http://localhost:3000";
    await page.setViewportSize({ width: 1920, height: 1080 });
    try {
      for (const locale of ["ro-RO", "en-GB"] as const) {
        await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, url: base }]);
        for (const list of LISTS2) {
          for (const group of list.groups) {
            await page.goto(list.path);
            await page.evaluate(([k, v]) => localStorage.setItem(k, v), [list.store, JSON.stringify(group)] as const);
            await page.reload();
            const names = page.locator("main thead [data-head-text]");
            await expect(names).toHaveCount(list.fixed.length + group.length, { timeout: 30_000 });
            const heads = msgs[locale][list.ns].listHeads as Record<string, string>;
            await expect(names).toHaveText([...list.fixed, ...group].map((k) => heads[k]));
            // The whole label on hover: a title on every name.
            const titles = await names.evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));
            expect(titles.every((t) => t.length > 0)).toBe(true);
          }
        }
      }
    } finally {
      await page.context().addCookies([{ name: "NEXT_LOCALE", value: "ro-RO", url: base }]);
    }
  });
});

