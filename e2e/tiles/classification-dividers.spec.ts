/**
 * Case:   TC-TILES-16 — „Clasificare": o fișă gri — citită, „Editează”, 2 unități
 * Source: docs/testing/cases/TC-TILES-16.md, „Last green" 2026-10-30 (Slice 41.10 rewrote the case)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-16` (records.ts) — invented, not a seed property: a save writes.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-16`;

/** What the case reads off the tile: its width, the items one to a row, the lines. */
async function read(tile: Locator) {
  return tile.evaluate((t) => {
    const tb = t.getBoundingClientRect();
    const items = [...t.querySelectorAll<HTMLElement>("[data-classification-item]")];
    const lines = [...t.querySelectorAll<HTMLElement>("[data-divider]")].map((d) => {
      const r = d.getBoundingClientRect();
      return { kind: d.dataset.divider, inside: r.left - tb.left >= 12 && tb.right - r.right >= 12 };
    });
    const rects = items.map((i) => i.getBoundingClientRect());
    return {
      width: Math.round(tb.width),
      items: items.map((i) => i.dataset.classificationItem),
      // One to a row: each under the one before.
      stacked: rects.every((r, i) => i === 0 || r.top >= rects[i - 1].bottom - 1),
      // Nothing past the tile's right edge.
      within: [...t.querySelectorAll<HTMLElement>("*")].every((e) => e.getBoundingClientRect().right <= tb.right + 1),
      selects: t.querySelectorAll("select").length,
      kinds: lines.map((l) => l.kind),
      inside: lines.every((l) => l.inside),
    };
  });
}

/** „Editează" — or „Adaugă" on the one line a tile with no value folds to (Ask first 5). */
async function openEdit(tile: Locator) {
  const add = tile.locator("[data-empty-tile-add]");
  if (await add.count()) await add.click();
  else await tile.locator('[data-tile-edit="classification"]').click();
  await expect(tile.locator("select")).toHaveCount(3, { timeout: 15_000 });
}

async function steps(page: Page, url: string, olderToo: boolean) {
  // Step 1 — 254 px wide (2 units); it reads: a new record's Proveniență „Manual (Adaugă nou)" as text, no select.
  await page.goto(url);
  const tile = await showTile(page, "Clasificare");
  await expect.poll(async () => (await read(tile)).width, { timeout: 30_000 }).toBe(254);
  await expect(tile.locator('[data-read-value="classification.provenance"]')).toHaveText("Manual (Adaugă nou)", { timeout: 30_000 });
  expect(await read(tile)).toMatchObject({ items: ["importance", "relevance", "provenance"], stacked: true, within: true, selects: 0 });

  // Step 2 — „Editează": the three selects, one to a row, inside the tile; „Salvează" disabled until a choice.
  await openEdit(tile);
  expect(await read(tile)).toMatchObject({ items: ["importance", "relevance", "provenance"], stacked: true, within: true, selects: 3 });
  await expect(tile.locator('[data-tile-save="classification"]')).toBeDisabled();
  await tile.getByRole("combobox", { name: "Importanță", exact: true }).selectOption({ index: 1 });
  const chosen = (await tile.getByRole("combobox", { name: "Importanță", exact: true }).locator("option:checked").textContent())!.trim();
  await tile.locator('[data-tile-save="classification"]').click();

  // Step 3 — saved, it reads: the value as text, no select, „Editează" in the corner; still 254 px.
  await expect(tile.locator("select")).toHaveCount(0, { timeout: 15_000 });
  await expect(tile.locator('[data-read-value="classification.importance"]')).toHaveText(chosen);
  await expect(tile.locator('[data-tile-edit="classification"]')).toBeVisible();
  expect(await read(tile)).toMatchObject({ width: 254, stacked: true, within: true, selects: 0 });

  // Step 3b — 41.28: Importanță was set today — „(actualizat azi)" after its value, its button „Verificat azi", disabled;
  // one „i" in the tile, whose bubble names Importanță, Relevanță, Proveniență, Istoric. 41.37 inverted in place — it was
  // „at the right end of its top line": now on the title's line, right after „Clasificare", and its bubble adds
  // „Revizuire" with the configured day counts (90 on the seed).
  const imp = tile.locator('[data-classification-item="importance"]');
  await expect(imp.locator("[data-classification-date]")).toHaveText("(actualizat azi)");
  const [rv, dt] = await Promise.all([imp.locator('[data-read-value="classification.importance"]').boundingBox(), imp.locator("[data-classification-date]").boundingBox()]);
  expect(dt!.x >= rv!.x + rv!.width - 1 || dt!.y >= rv!.y + rv!.height - 1, "the date follows the value").toBe(true);
  await expect(imp.getByRole("button", { name: "Verificat azi", exact: true })).toBeDisabled();
  await expect(tile.locator("[data-info-glyph]")).toHaveCount(1);
  const titleLine = tile.locator("[data-tile-title-line]");
  const info = titleLine.locator("button:has([data-info-glyph])");
  const [ib, hb] = await Promise.all([info.boundingBox(), titleLine.locator("h2").boundingBox()]);
  expect(Math.abs(ib!.y + ib!.height / 2 - (hb!.y + hb!.height / 2)), "the „i” on the title's line").toBeLessThanOrEqual(4);
  expect(ib!.x - (hb!.x + hb!.width), "the „i” right after the title").toBeLessThanOrEqual(12);
  expect(ib!.x - (hb!.x + hb!.width)).toBeGreaterThanOrEqual(0);
  await info.click();
  const tip = titleLine.locator("[role=tooltip]");
  for (const w of ["Importanță", "Relevanță", "Proveniență", "Istoric", "Revizuire"]) await expect(tip).toContainText(w);
  await expect(tip).toContainText("mai mult de 90 de zile");
  await expect(tip).toContainText("mai veche de 90 de zile");
  await expect(tip).toContainText("Administrare → Setări");
  await info.click();

  // Step 4 — after a reload the value is still there; with two versions the version line has the one divider.
  await page.reload();
  const again = await showTile(page, "Clasificare");
  await expect(again.locator('[data-read-value="classification.importance"]')).toHaveText(chosen, { timeout: 30_000 });
  await expect(again.getByRole("button", { name: "Versiunea anterioară", exact: true })).toBeVisible({ timeout: 15_000 });
  expect(await read(again)).toMatchObject({ kinds: ["horizontal"], inside: true });

  // Step 5 — „Editează", a change, „Renunță": nothing written, the value as it was.
  await openEdit(again);
  await again.getByRole("combobox", { name: "Importanță", exact: true }).selectOption({ index: 0 });
  await again.locator('[data-tile-cancel="classification"]').click();
  await expect(again.locator('[data-read-value="classification.importance"]')).toHaveText(chosen);

  // Step 6 — the older version reads only: no „Editează", no „Marchează ca verificat".
  if (olderToo) {
    await again.getByRole("button", { name: "Versiunea anterioară", exact: true }).click();
    await expect(again.locator('[data-tile-edit="classification"]')).toHaveCount(0);
    await expect(again.getByRole("button", { name: "Marchează ca verificat" })).toHaveCount(0);
  }
}

test.describe("TC-TILES-16 — „Clasificare”: o fișă gri", () => {
  test("pe proprietate și pe act: îngustă, citită, „Editează”, „Salvează”, reîncărcare, „Renunță”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const property = await createProperty(page.request, { nickname: `${MARK} Teren` });
    const doc = await createSaleContract(page.request, `${MARK} Act`);
    try {
      await steps(page, `/properties/${property}`, true);
      // Step 7 — the document, steps 1–5.
      await steps(page, `/documents/${doc}`, false);
    } finally {
      await removeRecord(page.request, "document", doc);
      await removeRecord(page.request, "property", property);
    }
  });
});
