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
 *     („Instrument", „Cadastru", „Stare juridică", „Conformitate") at 1366 and
 *     1920 px, into `playwright-report/template-dropdowns/`, the page from
 *     „Instrument" down, the sidebar's „Recente" list painted over.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";

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

/** „Whole": the inner width at least the selected text's width plus 24 px for the arrow. Returns those that are not. */
async function clipped(page: Page): Promise<string[]> {
  return dropdowns(page).evaluateAll((els) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    return (els as HTMLSelectElement[]).flatMap((s) => {
      const cs = getComputedStyle(s);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const inner = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const text = s.selectedOptions[0]?.text ?? "";
      const need = ctx.measureText(text).width + 24;
      return need > inner ? [`${s.name}: „${text}" needs ${need.toFixed(1)} px, has ${inner.toFixed(1)}`] : [];
    });
  });
}

/** Boxes per row in the panel headed `name`, top to bottom. */
async function boxesPerRow(page: Page, name: string): Promise<number[]> {
  const panel = page.locator("section").filter({ has: page.getByRole("heading", { name, exact: true }) }).last();
  return panel.locator("[data-width-field]").evaluateAll((els) => {
    const tops = new Map<number, number>();
    for (const el of els) {
      const t = Math.round(el.getBoundingClientRect().top);
      tops.set(t, (tops.get(t) ?? 0) + 1);
    }
    return [...tops.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  });
}

async function stepsTwoAndThree(page: Page): Promise<void> {
  // Step 2 — every one, its widest choice selected, shows it whole.
  for (const { name, value } of await widestChoices(page)) await page.locator(`select[name="${name}"]`).selectOption(value);
  expect(await clipped(page)).toEqual([]);
  // Step 3 — two boxes to every row: 14 in 7, 10 in 5.
  expect(await boxesPerRow(page, "Stare juridică afirmată")).toEqual([2, 2, 2, 2, 2, 2, 2]);
  expect(await boxesPerRow(page, "Conformitate și formalități")).toEqual([2, 2, 2, 2, 2]);
}

async function photograph(page: Page): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    await page.waitForTimeout(300);
    await page.getByRole("region", { name: "Instrument", exact: true }).scrollIntoViewIfNeeded();
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
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await expect(dropdowns(page)).toHaveCount(36, { timeout: 30_000 });

      await stepsTwoAndThree(page);

      // Step 4 — 1920 × 1080: the same.
      await page.setViewportSize({ width: 1920, height: 1080 });
      expect(await clipped(page)).toEqual([]);
      expect(await boxesPerRow(page, "Stare juridică afirmată")).toEqual([2, 2, 2, 2, 2, 2, 2]);
      expect(await boxesPerRow(page, "Conformitate și formalități")).toEqual([2, 2, 2, 2, 2]);

      await photograph(page);
    } finally {
      // At the end — leaving without saving, and deleting the document.
      if (id) await removeRecord(page.request, "document", id);
    }
  });
});
