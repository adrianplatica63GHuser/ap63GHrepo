/**
 * Case:   TC-DOC-04 — Listele derulante ale unui CVC: cât cea mai lungă alegere, două pe rând
 * Source: docs/testing/cases/TC-DOC-04.md, „Last green" 2026-10-02
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The document carries `TC-E2E-DOC-04` (records.ts).
 *   - The widest choice is selected with Playwright's `selectOption`, a real
 *     change; nothing is saved, as in the case.
 *   - Slice #37.53's pictures, not steps of the case: the CVC's four tiles
 *     („Preț și taxe", „Cadastru și CF", „Stare juridică",
 *     „Formalități" since #37.54) at 1366 and 1920 px, into
 *     `playwright-report/template-dropdowns/`, the page from „Preț și taxe"
 *     down, the sidebar's „Recente" list painted over.
 *   - #37.54 renamed the two panels the case counts: „Stare juridică afirmată"
 *     is „Declarații și garanții", „Conformitate și formalități" is
 *     „Declarații și obligații legale". The case file says so.
 *   - #37.55 took the dashes off the blank choice, so the clauses are 9rem and
 *     sit three to a row; step 3 counts the new rows. The case file says so.
 *   - 40.93: Adrian's rows of two (migration_122) — step 3 counts 2s, and
 *     step 6 reads the five tiles' rows he changed, with two widths in px.
 *   - 40.88: „whole" is 40.78's rule — on one line when the choice fits the
 *     box, wrapped in a box that keeps its width when it does not
 *     (`expectDropdownsWrap`). Adrian set some dropdowns narrower than their
 *     widest choice (Calitate exemplar at M). The case file says so.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { openFoldedTile, openPanelTile, pressTileButton, forEachFrame } from "../helpers/tiles";
import { showEmptyFields } from "../helpers/empty-fields";
import { expectDropdownsWrap } from "../helpers/field-widths";

const MARK = `${E2E_MARKER}DOC-04`;
const SHOTS = "playwright-report/template-dropdowns";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

/** The type's own dropdowns that are drawn, in the order the page draws them. */
const dropdowns = (page: Page) => page.locator('select[name^="customFields."]:visible');

/** Each dropdown's widest choice by its drawn width (a canvas in its own font). */
async function widestChoices(page: Page): Promise<{ name: string; value: string }[]> {
  return dropdowns(page).evaluateAll((els) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return (els as HTMLSelectElement[]).map((s) => {
      const cs = getComputedStyle(s);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      let best = s.options[0];
      for (const o of s.options) if (ctx.measureText(o.text).width > ctx.measureText(best.text).width) best = o;
      return { name: s.name, value: best.value };
    });
  });
}


/** Boxes per row in the panel headed `name`, top to bottom. */
async function boxesPerRow(page: Page, name: string): Promise<number[]> {
  // #37.90: inside a tile a panel's heading is its name in square brackets.
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: `[${name}]`, exact: true }) }).last();
  return panel.locator("[data-width-field]").evaluateAll((els) => {
    const tops = new Map<number, number>();
    for (const el of els) {
      const t = Math.round(el.getBoundingClientRect().top);
      tops.set(t, (tops.get(t) ?? 0) + 1);
    }
    return [...tops.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  });
}

/** The fields in the panel headed `name`, row by row, by their `data-width-field` (40.89). */
async function rowsOf(page: Page, name: string): Promise<string[][]> {
  await reopen(page, name); // 41.30
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name: `[${name}]`, exact: true }) }).last();
  return panel.locator("[data-width-field]").evaluateAll((els) => {
    const rows = new Map<number, { left: number; key: string }[]>();
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0) continue;
      const top = Math.round(r.top);
      const key = (el.getAttribute("data-width-field") ?? "").replace(/^customFields\./, "");
      const row = [...rows.keys()].find((t) => Math.abs(t - top) <= 2) ?? top;
      rows.set(row, [...(rows.get(row) ?? []), { left: r.left, key }]);
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r.sort((x, y) => x.left - y.left).map((i) => i.key));
  });
}

/** 40.75: a saved document draws a tile's dropdowns while it is open — each frame in turn, its widest choices. */
async function widestWhole(page: Page): Promise<void> {
  await forEachFrame(page, async () => {
    for (const { name, value } of await widestChoices(page)) await page.locator(`select[name="${name}"]`).selectOption(value);
    // 40.88: whole means 40.78's rule — one line when it fits, wrapped in a box that keeps its width when it does not.
    await expectDropdownsWrap(page);
  });
}

const UNIT = 119;
const GAP = 16;
const unitsPx = (n: number) => n * UNIT + (n - 1) * GAP;

/**
 * 41.25 — „Preț și plată" as drawn: the frame's px, its inner width, each panel's px, anything inside wider than the
 * widest panel, and its width handle's units.
 */
async function priceFrame(page: Page) {
  return page.getByRole("region", { name: "Preț și plată", exact: true }).evaluate((el) => {
    const px = (v: string) => parseFloat(v) || 0;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const inner = r.width - px(cs.paddingLeft) - px(cs.paddingRight) - px(cs.borderLeftWidth) - px(cs.borderRightWidth);
    const sections = [...el.querySelectorAll<HTMLElement>("section")].map((s) => ({
      section: s.dataset.section ?? s.dataset.panel ?? "",
      w: Math.round(s.getBoundingClientRect().width * 10) / 10,
      style: s.style.width,
    }));
    const widest = Math.max(0, ...sections.map((s) => s.w));
    const all = [...el.querySelectorAll<HTMLElement>("*")].filter((e) => e.getBoundingClientRect().width > widest + 1);
    const wider = all
      .filter((e) => !all.includes(e.parentElement as HTMLElement))
      .slice(0, 6)
      .map((e) => `${e.tagName.toLowerCase()}${[...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("")} w${Math.round(e.getBoundingClientRect().width * 10) / 10}`);
    const handle = document.querySelector<HTMLElement>(`[data-tile-handle="${el.dataset.frame ?? el.dataset.tile}"]`);
    return {
      tile: el.dataset.frame ?? el.dataset.tile ?? "",
      w: Math.round(r.width * 10) / 10,
      inner: Math.round(inner * 10) / 10,
      style: (el as HTMLElement).style.width,
      sections,
      wider,
      now: Number(handle?.getAttribute("aria-valuenow") ?? NaN),
      min: Number(handle?.getAttribute("aria-valuemin") ?? NaN),
    };
  });
}

/**
 * 41.26: an empty frame folds back to its line at `forEachFrame`'s „Renunță" — opened again, every field shown, to read
 * rows. 41.30: one empty tile is open at a time, so the frame holding the panel read next is opened — `rowsOf` and
 * `boxesPerRow` do it for their panel.
 */
async function reopen(page: Page, panel = "Declarațiile vânzătorului"): Promise<void> {
  const frame = await openPanelTile(page, panel);
  // The fields shown once stay shown for the visit, so there may be no „Arată N câmpuri goale" left: no wait.
  await showEmptyFields(frame);
}

async function stepsTwoAndThree(page: Page): Promise<void> {
  // Step 2 — every one, its widest choice selected, shows it whole.
  await widestWhole(page);
  await reopen(page);
  // Step 3 — since 40.93 (migration_122) two to a row: the 12 statements as 2,2,2,2,2,2 and the 5 statutory
  // declarations as 2,2,1 (#37.55–40.92 three to a row: 3,3,3,3 and 3,2).
  expect(await boxesPerRow(page, "Declarațiile vânzătorului")).toEqual([2, 2, 2, 2, 2, 2]);
  expect(await boxesPerRow(page, "Declarații legale")).toEqual([2, 2, 1]);
}

async function photograph(page: Page): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    await page.getByRole("region", { name: "Preț și plată", exact: true }).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/cvc-tiles-${width}.png`, fullPage: true, mask: [recent(page)] });
  }
}

test.describe("TC-DOC-04 — listele derulante ale unui CVC", () => {
  test("cât cea mai lungă alegere, întregi, două pe rând, la 1366 și la 1920", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    let id: string | undefined;
    try {
      id = await createSaleContract(page.request, `${MARK} CVC`);

      // Step 1 — opened at 1366, „Toate": 36 dropdowns of the type's own fields.
      await page.goto(`/documents/${id}`);
      await pressTileButton(page, "Toate", { timeout: 30_000 });
      // 40.71: the empty fields of a partly filled tile are behind „Arată N câmpuri goale"; shown for the steps below.
      // 41.30: the empty tiles stay folded — `forEachFrame` opens each in turn.
      await showEmptyFields(page, undefined, { wait: true });
      // 40.75: each frame's dropdowns, the frame open.
      await expect(page.locator('[data-read-value^="customFields."]').first()).toBeVisible({ timeout: 30_000 });
      let count = 0;
      await forEachFrame(page, async () => {
        count += await dropdowns(page).count();
      });
      expect(count).toBe(36);

      await stepsTwoAndThree(page);

      // Step 4 — 1920 × 1080: the same.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await widestWhole(page);
      await reopen(page);
      expect(await boxesPerRow(page, "Declarațiile vânzătorului")).toEqual([2, 2, 2, 2, 2, 2]); // 40.93
      expect(await boxesPerRow(page, "Declarații legale")).toEqual([2, 2, 1]); // 40.93

      // Step 5 — 40.89, Adrian's three moves, back at 1366.
      await page.setViewportSize({ width: 1366, height: 900 });
      // 41.25 (migration_123) re-laid „Preț" — step 7 reads its rows now (it was [["pretTotal", "monedaPret",
      // "pretRealDeclarat"], ["temeiPret"], ["alocarePret"]]).
      expect(await rowsOf(page, "Situația în cartea funciară")).toEqual([["marcajCarteFunciara"], ["consimtamantRadiere", "poateFiIntabulat"]]);
      expect(await rowsOf(page, "Excepția de la cadastru")).toEqual([
        ["temeiExceptieCadastru"],
        ["renuntareCercetareOcpi", "obligatieNrCadastral"],
        ["termenFormalitati"],
        ["completareUlterioara"],
      ]);

      // Step 6 — 40.93, Adrian's six changes (migration_122). Temei autentificare across „Identificarea actului",
      // Data conținutului under it; Stare plată | Data plății, Modalitate plată under them, both L; Documentație
      // finalizată under Categorie internă at 184 px; the warranties swapped; the fees two to a row, Onorariu notarial
      // | Impozit transfer first.
      const general = page.locator('[data-panel="general"]');
      const authBox = await general.locator('[data-width-field="customFields.temeiAutentificare"]').boundingBox();
      const contentBox = await general.locator('[data-width-field="customFields.dataContinut"]').boundingBox();
      expect(contentBox!.y, "Data conținutului under Temei autentificare").toBeGreaterThan(authBox!.y + authBox!.height - 1);
      expect(Math.abs(contentBox!.x - authBox!.x), "both at the left").toBeLessThanOrEqual(1);
      // 41.25 — „Plată" is step 7's now (it was [["starePlata", "dataPlatii"], ["modalitatePlata"]]).
      expect(await rowsOf(page, "Dosar cadastral")).toEqual([["categorieInterna"], ["documentatieFinalizata"]]);
      expect(await rowsOf(page, "Garanții")).toEqual([["garantieEvictiune", "garantieVicii"], ["temeiLegalEvictiune"]]);
      expect(await rowsOf(page, "Taxe și onorarii")).toEqual([["onorariuNotarial", "impozitTransfer"], ["timbruJudiciar", "taxaTimbruPublicitate"]]);
      expect(await rowsOf(page, "Cheltuieli")).toEqual([["cheltuieliPerfectare", "taxeLocalePlatiteDe"], ["taxeLocaleLaZi"]]);
      for (const [key, px] of [["starePlata", 208], ["modalitatePlata", 208], ["documentatieFinalizata", 184], ["onorariuNotarial", 136]] as const) {
        const b = await page.locator(`[data-width-field="customFields.${key}"]`).first().boundingBox();
        expect(Math.abs(b!.width - px), `${key} is ${px} px`).toBeLessThanOrEqual(1);
      }

      await photograph(page);
    } finally {
      // At the end — leaving without saving, and deleting the document.
      if (id) await removeRecord(page.request, "document", id);
    }
  });

  // Slice 41.25 — „Preț și plată" in whole units, its fields re-laid (Adrian: „it looks like 2.5 units; When I try to
  // grab the right edge and make it narrower it jumps to three units instead").
  test("pasul 7 (41.25): „Preț și plată” — unități întregi, marginea pornește de la cât arată, câmpurile pe rândurile lui Adrian", async ({ page }) => {
    test.slow();
    const MARK7 = `${MARK}-PRET`;
    await removeLeftovers(page.request, MARK7);
    await page.setViewportSize({ width: 1366, height: 900 });
    let id: string | undefined;
    try {
      id = await createSaleContract(page.request, `${MARK7} CVC`);
      const frame = page.getByRole("region", { name: "Preț și plată", exact: true });
      const openPrice = async () => {
        await page.goto(`/documents/${id}`);
        await pressTileButton(page, "Toate", { timeout: 30_000 });
        await openFoldedTile(page, "Preț și plată"); // 41.30: the one frame read here
        await showEmptyFields(page);
        await frame.scrollIntoViewIfNeeded();
        await expect(frame.locator('[data-width-field="customFields.pretTotal"]')).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(300);
        return priceFrame(page);
      };
      // The unit is per browser, a cookie (41.16, width-unit.ts): measured at 119 px and at 150 px.
      const setUnit = async (px: number) => {
        await page.context().addCookies([{ name: "ga40-width-unit", value: String(px), url: new URL(page.url()).origin }]);
      };
      const at119 = await openPrice();
      console.log(`TC-DOC-04 step 7 (41.25) — open, unit 119: ${JSON.stringify(at119)}`);
      await setUnit(150);
      const at150 = await openPrice();
      console.log(`TC-DOC-04 step 7 (41.25) — open, unit 150: ${JSON.stringify(at150)}`);
      await setUnit(119);

      // Whole units at either unit, and the handle reads the units the frame shows.
      for (const [unit, m] of [[119, at119], [150, at150]] as const) {
        const k = Math.round((m.w + GAP) / (unit + GAP));
        expect(m.w, `unit ${unit}: a whole number of units`).toBe(k * unit + (k - 1) * GAP);
        expect(m.now, `unit ${unit}: the edge starts at the units shown`).toBe(k);
      }
      const open = await openPrice();
      const units = Math.round((open.w + GAP) / (UNIT + GAP));
      expect(units, "Preț total | Monedă, 280 px, past 2 units").toBe(3);

      // Adrian's rows (migration_123).
      expect(await rowsOf(page, "Preț")).toEqual([["pretTotal", "monedaPret"], ["pretRealDeclarat"], ["temeiPret"], ["alocarePret"]]);
      expect(await rowsOf(page, "Plată")).toEqual([["starePlata"], ["dataPlatii"], ["modalitatePlata"]]);
      for (const key of ["pretTotal", "monedaPret"]) {
        const b = await frame.locator(`[data-width-field="customFields.${key}"]`).boundingBox();
        expect(Math.abs(b!.width - 136), `${key} is M, 136 px`).toBeLessThanOrEqual(1);
      }
      const price = open.sections.find((sec) => sec.section === "group:Preț");
      for (const key of ["temeiPret", "alocarePret"]) {
        const b = await frame.locator(`[data-width-field="customFields.${key}"]`).boundingBox();
        expect(Math.abs(b!.width - (price?.w ?? -1)), `${key} is the panel's inner width`).toBeLessThanOrEqual(1);
      }

      // One unit narrower from the width shown: refused (41.21 says why) or one unit narrower — never the same or wider.
      const edge = page.locator(`[data-tile-handle="${open.tile}"]`);
      await edge.focus();
      await page.keyboard.press("ArrowLeft");
      await page.waitForTimeout(300);
      const after = await priceFrame(page);
      console.log(`TC-DOC-04 step 7 (41.25) — one unit narrower: ${JSON.stringify({ w: after.w, now: after.now, min: after.min })}`);
      expect([open.w, unitsPx(units - 1)]).toContain(after.w);
      expect(after.w).toBeLessThanOrEqual(open.w);
    } finally {
      if (id) await removeRecord(page.request, "document", id);
    }
  });
});
