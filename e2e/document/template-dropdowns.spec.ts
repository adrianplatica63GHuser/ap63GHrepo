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
import { openEmptyTiles, pressTileButton, forEachFrame } from "../helpers/tiles";
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

async function stepsTwoAndThree(page: Page): Promise<void> {
  // Step 2 — every one, its widest choice selected, shows it whole.
  await widestWhole(page);
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
      // 40.64: a new contract\'s empty tiles are one line each; „Adaugă" opens them.
      await openEmptyTiles(page);
      // 40.71: the empty fields of a partly filled tile are behind „Arată N câmpuri goale"; shown for the steps below.
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
      expect(await boxesPerRow(page, "Declarațiile vânzătorului")).toEqual([2, 2, 2, 2, 2, 2]); // 40.93
      expect(await boxesPerRow(page, "Declarații legale")).toEqual([2, 2, 1]); // 40.93

      // Step 5 — 40.89, Adrian's three moves, back at 1366.
      await page.setViewportSize({ width: 1366, height: 900 });
      expect(await rowsOf(page, "Preț")).toEqual([["pretTotal", "monedaPret", "pretRealDeclarat"], ["temeiPret"], ["alocarePret"]]);
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
      expect(await rowsOf(page, "Plată")).toEqual([["starePlata", "dataPlatii"], ["modalitatePlata"]]);
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
});
