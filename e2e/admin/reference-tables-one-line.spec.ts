/**
 * Case:   TC-VL-05 — „Date de referință”: tabele înguste, câte un rând pe linie, butoanele unul lângă altul
 * Source: docs/testing/cases/TC-VL-05.md, „Last green" 2026-10-09
 *
 * A translation of the case file, step for step. Nothing is created: the lists are read as they are — but for
 * step 8 (Slice #39.10), which makes one role, `TC-E2E-VL-05 Rudă`, through the route the screen calls, and removes
 * it in `finally`.
 */

import { test, expect, type Page } from "../helpers/test";

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
    // Slice #38.78: „+ Adaugă" and the count left the frame for the title's line; what stays above the table is the
    // filters' line, on the lists that have one (#38.50 read the frame's first child, the toolbar).
    const toolbar = frame.querySelector<HTMLElement>("[data-value-list-filters]");
    return {
      rows: rows.length,
      notOneLine: cellsOk.slice(0, 5),
      actionsOneLine,
      sameHeight: heights.length > 0 && Math.max(...heights) - Math.min(...heights) <= 1,
      tallest: Math.max(...heights),
      // The toolbar's own width — its controls side by side, with their gaps — against the table's frame.
      tableAtLeastToolbar: (() => {
        if (!toolbar) return true;
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

        // Slice #38.78 — „+ Adaugă" on the title's line, its right edge the table's (±2 px), the count to its left; on
        // a list with no checkboxes the table's top within 8 px of the divider under the title.
        const head = await page.evaluate(() => {
          const card = document.querySelector<HTMLElement>("[data-value-list-card]")!;
          const add = card.querySelector<HTMLElement>("[data-value-list-head] [data-value-list-add] button")!.getBoundingClientRect();
          const title = card.querySelector<HTMLElement>("[data-value-list-head] h2")!.getBoundingClientRect();
          const count = card.querySelector<HTMLElement>("[data-value-list-head] [data-value-list-count]")!.getBoundingClientRect();
          const table = card.querySelector<HTMLElement>("table[data-width-table]")!.parentElement!.getBoundingClientRect();
          const divider = card.querySelector<HTMLElement>("[data-value-list-head]")!.getBoundingClientRect().bottom;
          return {
            sameLine: Math.abs((add.top + add.bottom) / 2 - (title.top + title.bottom) / 2),
            rightEdges: add.right - table.right,
            countLeft: count.right <= add.left,
            countSameLine: Math.abs((count.top + count.bottom) / 2 - (add.top + add.bottom) / 2),
            tableUnderDivider: table.top - divider,
            filters: card.querySelector("[data-value-list-filters]") !== null,
          };
        });
        const at = `${list.name} at ${width}`;
        // Slice #39.70: the first card's — „Tipuri de Proprietate și Folosințe" has two tiles, each with its „+ Adaugă"
        // (#39.66), and `head` above reads the first. Was the page's `[data-value-list-head]`.
        await expect(
          page.locator("[data-value-list-card]").first().locator("[data-value-list-head]").getByRole("button", { name: "+ Adaugă", exact: true }),
        ).toBeVisible();
        expect(head.sameLine, `${at}: „+ Adaugă" on the title's line`).toBeLessThanOrEqual(4);
        expect(Math.abs(head.rightEdges), `${at}: „+ Adaugă"'s right edge against the table's`).toBeLessThanOrEqual(2);
        expect([head.countLeft, head.countSameLine <= 4], `${at}: the count to its left, on its line`).toEqual([true, true]);
        expect(head.filters, `${at}: a line of checkboxes`).toBe(list.key === "document-types");
        if (!head.filters) {
          expect(head.tableUnderDivider, `${at}: the table's top under the divider`).toBeGreaterThanOrEqual(0);
          expect(head.tableUnderDivider, `${at}: the table's top under the divider`).toBeLessThanOrEqual(8);
        }
        if (width === 1366 && (list.key === "person-roles" || list.key === "document-types")) {
          // The slice's pictures: reference data, no person in them.
          await page.locator("[data-value-list-card]").evaluate((el) => el.scrollIntoView({ block: "start" }));
          await page.mouse.move(1, 1);
          await page.screenshot({ path: `playwright-report/value-list-head/${list.key}-1366.png` });
        }
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
      // #38.70: „Descriere" is read in the name's tooltip, not a column — #38.60 read it left-aligned here too.
      left: [cols.name].map(align),
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
    // #39.88: in a tile the name may take the width its list gains to reach the standard gap; that width is not waste.
    const gain = parseFloat(table.querySelector<HTMLElement>("col")?.dataset.fillGain ?? "0") * parseFloat(getComputedStyle(document.documentElement).fontSize);
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
    return { rows: rows.length, gap: Math.round((gap - gain) * 10) / 10, cut, streetLines };
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

test.describe("TC-VL-05 pasul 6 — „Roluri Persoane” fără bară de derulare orizontală (#38.70)", () => {
  test("la 1366 px: tot tabelul, butoanele fiecărui rând în chenar; descrierea în bula denumirii", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.goto("/admin/value-lists?list=person-roles");
    await expect(page.locator("[data-usage]").first()).not.toHaveText("…", { timeout: 30_000 });
    const fit = await page.evaluate(() => {
      const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
      const frame = table.parentElement!;
      const card = table.closest<HTMLElement>("[data-value-list-card]")!.getBoundingClientRect();
      const rows = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")];
      const outside = rows.filter((r) => {
        const buttons = [...r.querySelectorAll<HTMLElement>("[data-row-actions] button, [data-row-actions] a")];
        const last = buttons[buttons.length - 1];
        return last ? last.getBoundingClientRect().right > card.right : false;
      }).length;
      const heads = [...table.querySelectorAll<HTMLElement>("thead th")].map((th) => th.innerText.replace(/\s+/g, " ").trim().toLowerCase());
      return { scroll: frame.scrollWidth, client: frame.clientWidth, rows: rows.length, outside, heads };
    });
    expect(fit.rows).toBeGreaterThan(0);
    expect(fit.scroll, `the frame scrolls ${fit.scroll - fit.client} px`).toBeLessThanOrEqual(fit.client);
    expect(fit.outside, "rows whose last button is outside the card").toBe(0);
    expect(fit.heads).not.toContain("descriere");
    // The description, in the name's tooltip under the name — in the body's face, not mono.
    const named = page.locator("tbody tr").filter({ hasText: /^Coproprietar/ }).locator("[data-name-tip]").first();
    await named.hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toHaveCount(1);
    await expect(tip).toContainText("Coproprietar");
    await page.screenshot({ path: "playwright-report/value-list-page/roles-no-scroll-1366.png" });
    await page.mouse.move(5, 5);
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.waitForTimeout(300);
    await page.screenshot({ path: "playwright-report/value-list-page/roles-no-scroll-1920.png" });
  });
});

/** Slice #39.10 — step 8's test role, created through the route the screen calls and removed in `finally`. */
const KIN_ROLES = "/api/admin/value-lists/person-roles";
const KIN_ROLE = "TC-E2E-VL-05 Rudă";

test.describe("TC-VL-05 pasul 8 — „Rudenie” pe „Roluri Persoane” (#39.10)", () => {
  test("la 1366 px: aleasă în panoul rolului, citită în „Persoană → Persoană”; „Tată” rămâne „Părinte”; tabelul tot fără bară de derulare", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 1000 });
    const leftovers = async () => {
      const items = ((await (await page.request.get(KIN_ROLES)).json()) as { items: { id: string; name: string }[] }).items;
      for (const r of items) if (r.name === KIN_ROLE) await page.request.delete(`${KIN_ROLES}/${r.id}`);
    };
    await leftovers();
    try {
      const created = await page.request.post(KIN_ROLES, { data: { name: KIN_ROLE, validForPerson: true } });
      expect(created.ok(), `POST ${KIN_ROLES} failed (${created.status()})`).toBeTruthy();
      await page.goto("/admin/value-lists?list=person-roles");
      await expect(page.locator("[data-usage]").first()).not.toHaveText("…", { timeout: 30_000 });
      const list = page.getByRole("region", { name: "Roluri Persoane", exact: true });
      const rowOf = (name: string) => list.locator("tbody tr").filter({ has: page.locator("td:first-child", { hasText: new RegExp(`^${name}$`) }) });
      const personCell = async (name: string) => {
        const heads = (await list.locator("thead th").allInnerTexts()).map((h) => h.replace(/\s+/g, " ").trim().toLowerCase());
        return rowOf(name).locator("td").nth(heads.indexOf("persoană → persoană"));
      };

      // The seeded ties read where the ✓ was: „Tată" and „Fiu".
      await expect(await personCell("Tată")).toHaveText("Părinte");
      await expect(await personCell("Fiu")).toHaveText("Copil");
      await expect(await personCell(KIN_ROLE)).toHaveText("✓");

      // The test role's panel: „Rudenie" while „Persoană" is pressed, gone when it is not.
      await rowOf(KIN_ROLE).getByRole("button", { name: "Editează", exact: true }).click();
      const panel = page.locator("[data-role-scope]") /* #39.76: the role form is a tile of its own, beside the list */;
      const kinship = panel.getByRole("combobox", { name: "Rudenie", exact: true });
      await expect(kinship).toHaveValue("");
      await panel.getByRole("button", { name: "Persoană", exact: true }).click();
      await expect(kinship).toHaveCount(0);
      await panel.getByRole("button", { name: "Persoană", exact: true }).click();
      await kinship.selectOption({ label: "Altă rudă" });
      await page.locator("[data-value-list-form-tile]").getByRole("button", { name: "Salvează", exact: true }).click(); // #39.76: the form's own tile
      await expect(await personCell(KIN_ROLE)).toHaveText("Altă rudă", { timeout: 15_000 });
      const saved = ((await (await page.request.get(KIN_ROLES)).json()) as { items: { name: string; kinship: string | null }[] }).items.find((r) => r.name === KIN_ROLE);
      expect(saved?.kinship).toBe("OTHER");

      // „Tată": its tie is fixed — the identity-card import finds the role by it.
      await rowOf("Tată").getByRole("button", { name: "Editează", exact: true }).click();
      await expect(panel.getByRole("combobox", { name: "Rudenie", exact: true })).toBeDisabled();
      await expect(panel.getByRole("combobox", { name: "Rudenie", exact: true })).toHaveValue("PARENT");
      await page.locator("[data-value-list-form-tile]").getByRole("button", { name: "Anulează", exact: true }).click(); // #39.76: the form's own tile

      // Still the whole table at 1366 px — no scroll bar (#38.70).
      const fit = await page.evaluate(() => {
        const frame = document.querySelector<HTMLElement>("table[data-width-table]")!.parentElement!;
        return { scroll: frame.scrollWidth, client: frame.clientWidth };
      });
      expect(fit.scroll, `the frame scrolls ${fit.scroll - fit.client} px`).toBeLessThanOrEqual(fit.client);
      await page.mouse.move(5, 5);
      await page.screenshot({ path: "playwright-report/value-list-page/roles-kinship-1366.png" });
    } finally {
      await leftovers();
    }
  });
});

/** Slice #39.76 — every page's lists as tiles (step 9). */
const TILED: { key: string; triangle: boolean }[] = [
  { key: "person-types", triangle: false },
  { key: "judicial-person-types", triangle: false },
  { key: "document-types", triangle: false },
  { key: "person-roles", triangle: true },
  { key: "property-property-roles", triangle: true },
  { key: "document-document-roles", triangle: true },
  { key: "citizenships", triangle: false },
  { key: "person-relationships", triangle: false },
  // #39.77: „Indicative Tarla" too — its code column its header's width, its buttons' column theirs.
  { key: "tarla", triangle: false },
];

test.describe("TC-VL-05 pasul 9 — listele ca fișe (#39.76)", () => {
  test("la 1920 px: fiecare listă o fișă de unități întregi, cu același spațiu stânga și dreapta; triunghiul și formularul rolului fișe proprii", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1920, height: 1080 });
    for (const list of TILED) {
      await page.goto(`/admin/value-lists?list=${list.key}`);
      await expect(page.locator(`[data-reference-tiles] [data-tile="${list.key}"] table[data-width-table] tbody tr`).first()).toBeVisible({ timeout: 30_000 });
      const tiles = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("[data-reference-tiles] [data-tile]")]
          .filter((t) => !t.hidden)
          .map((t) => {
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
            const r = t.getBoundingClientRect();
            const full = t.dataset.tileFull !== undefined;
            const units = full ? 0 : Number(t.dataset.tileUnits);
            const frame = t.querySelector<HTMLElement>("[data-value-list-frame]")?.getBoundingClientRect();
            // #39.88: the list's own frame, and the standard gap — „Categorii Folosință"'s 21 px — on every page but the
            // roles' and the links'.
            const list = t.querySelector<HTMLElement>("[data-value-list-table-frame]")?.getBoundingClientRect();
            const standard = !["triangle", "person-roles", "property-property-roles", "document-document-roles"].includes(t.dataset.tile ?? "");
            const near21 = (n: number) => Math.abs(n - 21) <= 1.5;
            // #39.88: „Cetățenie" and „Relația cu firma" are their list and two gaps, off the unit grid.
            const offGrid = t.dataset.tile === "citizenships" || t.dataset.tile === "person-relationships";
            return {
              tile: t.dataset.tile,
              units,
              // The triangle is a line of its own across the row (`data-tile-full`), at #38.77's width (TC-VL-10).
              whole: full || offGrid || Math.abs(r.width - (units * 7.4375 + (units - 1)) * rem) <= 1 /* 40.98: UNIT_REM, 119 px */,
              even: frame ? Math.abs(frame.left - r.left - (r.right - frame.right)) <= 2 : true,
              gap: !standard || (list !== undefined && near21(list.left - r.left) && near21(r.right - list.right) && near21(r.bottom - list.bottom)),
            };
          }),
      );
      expect(tiles.map((t) => t.tile), list.key).toEqual(list.triangle ? ["triangle", list.key] : [list.key]);
      for (const t of tiles) expect({ list: list.key, ...t }).toEqual({ list: list.key, tile: t.tile, units: t.units, whole: true, even: true, gap: true });
      if (list.triangle) await expect(page.locator('[data-tile="triangle"]')).toHaveAttribute("data-tile-full", "");
      await expect(page.locator(`[data-tile-positions-reset="reference-${list.key}"]`)).toBeVisible();
    }

    // „Editează" on a role: its form in a tile of its own, before the list, with where it applies.
    await page.goto("/admin/value-lists?list=person-roles");
    const list = page.getByRole("region", { name: "Roluri Persoane", exact: true });
    await list.locator("tbody tr").first().getByRole("button", { name: "Editează", exact: true }).click({ timeout: 30_000 });
    const form = page.locator('[data-tile="role-form"]');
    await expect(form).toBeVisible();
    await expect(form.locator("[data-role-scope]")).toBeVisible();
    await expect(list.locator("[data-role-scope]")).toHaveCount(0);
    await form.getByRole("button", { name: "Anulează", exact: true }).click();
    await expect(form).toBeHidden();
  });
});
