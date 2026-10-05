/**
 * Case:   TC-TILES-16 — „Clasificări": linii între cele trei, Importanță și Relevanță centrate fiecare în celula ei
 * Source: docs/testing/cases/TC-TILES-16.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-16` (records.ts).
 *   - Playwright picks the select's option and presses „Salvează"; the hand
 *     run's script did, because the pane's emulated viewport drops real clicks.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-16`;

/** What the case reads off the tile: the lines and the two cells. */
async function read(tile: Locator) {
  return tile.evaluate((t) => {
    const tb = t.getBoundingClientRect();
    const pair = t.querySelector<HTMLElement>("[data-classification-pair]")!;
    const cells = [...pair.children].filter((c) => c.tagName === "SECTION");
    const v = pair.querySelector<HTMLElement>('[data-divider="vertical"]')!;
    const sel = cells.map((c) => c.querySelector("select")!.getBoundingClientRect());
    const cr = cells.map((c) => c.getBoundingClientRect());
    const vr = v.getBoundingClientRect();
    const lines = [...t.querySelectorAll<HTMLElement>("[data-divider]")].map((d) => {
      const r = d.getBoundingClientRect();
      const cs = getComputedStyle(d);
      const vertical = d.dataset.divider === "vertical";
      return {
        kind: d.dataset.divider,
        look: vertical ? `${cs.borderLeftWidth} ${cs.borderLeftStyle} ${cs.borderLeftColor}` : `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
        inside: r.left - tb.left >= 12 && tb.right - r.right >= 12 && r.top - tb.top >= 12 && tb.bottom - r.bottom >= 12,
      };
    });
    return {
      level: Math.round(sel[0].top) === Math.round(sel[1].top),
      centred: sel.every((s, i) => Math.abs((s.left + s.right) / 2 - (cr[i].left + cr[i].right) / 2) <= 1),
      between: vr.left >= cr[0].right && vr.right <= cr[1].left,
      spans: Math.abs(vr.top - Math.min(cr[0].top, cr[1].top)) <= 1 && Math.abs(Math.max(cr[0].bottom, cr[1].bottom) - vr.bottom) <= 1,
      kinds: lines.map((l) => l.kind),
      looks: [...new Set(lines.map((l) => l.look))],
      inside: lines.every((l) => l.inside),
    };
  });
}

async function steps(page: Page, url: string, olderToo: boolean) {
  // Step 1 — one version: two lines; the two cells centred, level; inside the padding.
  await page.goto(url);
  const tile = await showTile(page, "Clasificări");
  await expect(tile.locator("[data-classification-pair] select")).toHaveCount(2, { timeout: 30_000 });
  const one = await read(tile);
  expect(one).toMatchObject({ level: true, centred: true, between: true, spans: true, kinds: ["vertical", "horizontal"], inside: true });
  expect(one.looks).toHaveLength(1);

  // Step 2 — an Importanță value, „Salvează": the version controls, a third line of the same look.
  await tile.locator("[data-classification-pair] select").first().selectOption({ index: 1 });
  await tile.getByRole("button", { name: "Salvează", exact: true }).click();
  await expect(tile.getByRole("button", { name: "Versiunea anterioară", exact: true })).toBeVisible({ timeout: 15_000 });
  const two = await read(tile);
  expect(two).toMatchObject({ level: true, centred: true, between: true, kinds: ["horizontal", "vertical", "horizontal"], inside: true });
  expect(two.looks).toEqual(one.looks);

  // Step 3 — the older version: the same three lines, the cells centred and level.
  if (olderToo) {
    await tile.getByRole("button", { name: "Versiunea anterioară", exact: true }).click();
    await expect(tile.getByRole("button", { name: "Marchează ca verificat" })).toHaveCount(0);
    const older = await read(tile);
    expect(older).toMatchObject({ level: true, centred: true, between: true, kinds: ["horizontal", "vertical", "horizontal"], inside: true });
    expect(older.looks).toEqual(one.looks);
  }
}

test.describe("TC-TILES-16 — „Clasificări”: liniile și cele două celule", () => {
  test("pe persoană și pe act: o versiune, două, cea anterioară", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const doc = await createSaleContract(page.request, `${MARK} Act`);
    try {
      await steps(page, `/natural-persons/${person}`, true);
      // Step 4 — the document, steps 1–2.
      await steps(page, `/documents/${doc}`, false);
    } finally {
      await removeRecord(page.request, "document", doc);
      await removeRecord(page.request, "person", person);
    }
  });
});
