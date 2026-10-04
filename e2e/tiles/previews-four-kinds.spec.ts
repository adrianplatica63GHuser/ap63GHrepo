/**
 * Case:   TC-TILES-11 — Cele patru previzualizări: „născută:", contactele firmei, cele trei rânduri ale proprietății, actul fără tip
 * Source: docs/testing/cases/TC-TILES-11.md, „Last green" 2026-10-03
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-11` (records.ts), and each list is
 *     searched for that.
 *   - The tarla is the archive's first, read from the list the property form
 *     reads; the spec compares the preview with its indicativ.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createDocumentOfType, createNaturalPerson, createProperty, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-11`;

/** Searches the list for the case's marker and opens the preview of the row holding `name`. */
async function preview(page: Page, list: string, name: string): Promise<Locator> {
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  const row = main.locator("tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  await row.getByRole("button", { name: "Previzualizare", exact: true }).click();
  const tile = page.locator("[data-preview]");
  await expect(tile.getByRole("link", { name: "Deschide", exact: true })).toBeVisible({ timeout: 30_000 });
  return tile;
}

/** A compact line's values, as read: the values' own text, not their read-aloud labels. */
async function linesOf(tile: Locator): Promise<string[]> {
  return tile.evaluate((el) => [...el.querySelectorAll("[data-preview-line]")].map((l) =>
    [...l.querySelectorAll("[data-preview-value]")]
      .map((v) => [...v.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""))
      .join("")));
}

/** The labelled fields, row by row, as „Label=value". */
async function rowsOf(tile: Locator): Promise<string[][]> {
  return tile.evaluate((el) => [...el.querySelectorAll("[data-preview-fields] > div")].map((r) =>
    [...r.children].map((f) => `${f.children[0]?.textContent}=${f.children[1]?.textContent}`)));
}

test.describe("TC-TILES-11 — cele patru previzualizări", () => {
  test("„născută:”, „(2 contacte)”, cele trei rânduri ale proprietății, actul fără „Tip document”", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    const c1 = await createNaturalPerson(page.request, { lastName: `${MARK} Contact`, firstName: "Unu" });
    const c2 = await createNaturalPerson(page.request, { lastName: `${MARK} Contact`, firstName: "Doi" });
    const person = await createNaturalPerson(page.request, {
      lastName: MARK, firstName: "Ioana", gender: "FEMALE", nickname: "Ioni", dateOfBirth: "1960-03-12", placeOfBirth: "Bragadiru",
    });
    const res = await page.request.post("/api/judicial-persons", {
      data: { name: `${MARK} Firmă SRL`, nickname: "Firma", contactPerson1Id: c1, contactPerson2Id: c2, provenance: "MANUAL" },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const company = ((await res.json()) as { person: { id: string } }).person.id;
    const tarla = ((await (await page.request.get("/api/admin/value-lists/tarla")).json()) as { items: { id: string; indicativ: string }[] }).items[0];
    const property = await createProperty(page.request, { nickname: `${MARK} Teren`, parcela: "77/1", tarlaId: tarla.id, surfaceAreaMp: 1234 });
    const doc = await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act`, {
      subject: "Adeverință de rol fiscal", nrDocument: "123/2020", dateDocument: "2020-05-04",
    });
    try {
      // Step 1 — the person: „Ioni" and „născută: 12.03.1960, Bragadiru".
      const p = await preview(page, "/natural-persons", "Ioana");
      await expect(p.locator("h2")).toHaveText(`${MARK} Ioana`);
      await expect.poll(() => linesOf(p)).toEqual(["Ioni", "născută: 12.03.1960, Bragadiru"]);

      // Step 2 — the company: „(2 contacte)" after its name, then „Firma".
      const c = await preview(page, "/judicial-persons", "Firmă");
      await expect(c.locator("h2")).toHaveText(`${MARK} Firmă SRL`);
      await expect(c.locator("[data-preview-title-note]")).toHaveText("(2 contacte)");
      await expect.poll(() => linesOf(c)).toEqual(["Firma"]);

      // Step 3 — the property's three rows.
      const r = await preview(page, "/properties", "Teren");
      await expect(r.locator("h2")).toHaveText(`${MARK} Teren`);
      await expect.poll(() => rowsOf(r)).toEqual([
        ["Nr. parcelă=77/1", `Tarla/Solă=${tarla.indicativ}`, "Suprafață (mp)=1234.00"],
        [`Poreclă=${MARK} Teren`],
        ["Carte funciară=—", "Nr. cadastral=—"],
      ]);

      // Step 4 — the document: no „Tip document", no „Etichetă scurtă"; one row; „Prima pagină".
      const d = await preview(page, "/documents", "Act");
      await expect(d.locator("h2")).toHaveText(`${MARK} Act`);
      await expect.poll(() => rowsOf(d)).toEqual([["Subiect=Adeverință de rol fiscal", "Nr. document=123/2020", "Data=04.05.2020"]]);
      await expect(d).not.toContainText("Tip document");
      await expect(d).not.toContainText("Etichetă scurtă");
      await expect(d.getByText("Prima pagină", { exact: true })).toBeVisible();
    } finally {
      for (const [k, id] of [["document", doc], ["property", property], ["company", company], ["person", person], ["person", c1], ["person", c2]] as const) {
        await removeRecord(page.request, k, id);
      }
    }
  });
});
