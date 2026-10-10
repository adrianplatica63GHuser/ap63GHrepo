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
import {
  E2E_MARKER, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
} from "../helpers/records";

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
  // Slice #38.71: the row's first button is the magnifier, „Previzualizare"; its last, „Deschide"; not pressed yet.
  const actions = row.locator("[data-row-actions]").locator("a, button");
  await expect(actions.first()).toHaveAccessibleName("Previzualizare");
  await expect(actions.last()).toHaveAccessibleName("Deschide");
  const magnifier = row.getByRole("button", { name: "Previzualizare", exact: true });
  await expect(magnifier).toHaveAttribute("aria-pressed", "false");
  await magnifier.click();
  const tile = page.locator("[data-preview]");
  await expect(tile.getByRole("link", { name: "Deschide", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(magnifier).toHaveAttribute("aria-pressed", "true");
  return tile;
}

/** Slice #38.71: the magnifier pressed again closes its preview and is released. */
async function closeByMagnifier(page: Page, name: string): Promise<void> {
  const row = page.locator("main tbody tr").filter({ hasText: name });
  await row.getByRole("button", { name: "Previzualizare", exact: true }).click();
  await expect(page.locator("[data-preview]")).toHaveCount(0, { timeout: 15_000 });
  await expect(row.getByRole("button", { name: "Previzualizare", exact: true })).toHaveAttribute("aria-pressed", "false");
}

/**
 * Slice #38.72: the eye, „Incursiune", on one list. The row reads magnifier, eye, arrow; with a preview open,
 * the eye shows the object's tile beside the list — `inner` finds the reused tile in it — filling the row to the
 * content area's right edge (±8 px) at 1366 and 1920 px, the preview closed and every magnifier disabled; the
 * eye again closes it and frees them. A picture at each width (the spec's own records only).
 */
async function peek(page: Page, list: string, name: string, kind: string, inner: (tile: Locator) => Locator, shot: string): Promise<void> {
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  const row = main.locator("tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  const actions = row.locator("[data-row-actions]").locator("a, button");
  await expect(actions.nth(0)).toHaveAccessibleName("Previzualizare");
  await expect(actions.nth(1)).toHaveAccessibleName("Incursiune");
  await expect(actions.nth(2)).toHaveAccessibleName("Deschide");
  // …and all three inside the table's frame, none cut at its edge.
  const cut = await row.evaluate((r) => {
    const frame = r.closest("table")!.parentElement!.getBoundingClientRect();
    return [...r.querySelectorAll<HTMLElement>("[data-row-actions] a, [data-row-actions] button")].filter((b) => b.getBoundingClientRect().right > frame.right + 0.5).length;
  });
  expect(cut, `${list}: buttons cut at the table's edge`).toBe(0);
  const magnifier = row.getByRole("button", { name: "Previzualizare", exact: true });
  const eye = row.getByRole("button", { name: "Incursiune", exact: true });
  await magnifier.click();
  await expect(page.locator("[data-preview]")).toHaveCount(1, { timeout: 30_000 });
  await eye.click();
  const tile = page.locator(`[data-incursion="${kind}"]`);
  await expect(tile).toBeVisible({ timeout: 30_000 });
  await expect(inner(tile)).toBeVisible({ timeout: 30_000 });
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-preview]")).toHaveCount(0);
  await expect(magnifier).toBeDisabled();
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(400);
    const gap = await page.evaluate((k) => {
      const m = document.querySelector("main")!;
      const content = m.getBoundingClientRect().right - parseFloat(getComputedStyle(m).paddingRight);
      return content - document.querySelector(`[data-incursion="${k}"]`)!.getBoundingClientRect().right;
    }, kind);
    expect(Math.abs(gap), `${list} at ${width}: the tile ends ${gap} px before the content area's right edge`).toBeLessThanOrEqual(8);
    await page.screenshot({ path: `playwright-report/incursion/${shot}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await eye.click();
  await expect(tile).toHaveCount(0);
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(magnifier).toBeEnabled();
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
    // A run that died before its `finally` leaves its records; they would be a second match here.
    await removeLeftovers(page.request, MARK);
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
      await closeByMagnifier(page, "Ioana");

      // Step 2 — the company: „(2 contacte)" after its name, then „Firma".
      const c = await preview(page, "/judicial-persons", "Firmă");
      await expect(c.locator("h2")).toHaveText(`${MARK} Firmă SRL`);
      await expect(c.locator("[data-preview-title-note]")).toHaveText("(2 contacte)");
      await expect.poll(() => linesOf(c)).toEqual(["Firma"]);
      await closeByMagnifier(page, "Firmă");

      // Step 3 — the property's three rows.
      const r = await preview(page, "/properties", "Teren");
      await expect(r.locator("h2")).toHaveText(`${MARK} Teren`);
      await expect.poll(() => rowsOf(r)).toEqual([
        ["Nr. parcelă=77/1", `Tarla/Solă=${tarla.indicativ}`, "Suprafață (mp)=1234.00"],
        [`Poreclă=${MARK} Teren`],
        ["Carte funciară=—", "Nr. cadastral=—"],
      ]);
      await closeByMagnifier(page, "Teren");

      // Step 4 — the document: no „Tip document", no „Etichetă scurtă"; one row; „Prima pagină".
      const d = await preview(page, "/documents", "Act");
      await expect(d.locator("h2")).toHaveText(`${MARK} Act`);
      await expect.poll(() => rowsOf(d)).toEqual([["Subiect=Adeverință de rol fiscal", "Nr. document=123/2020", "Data=04.05.2020"]]);
      await expect(d).not.toContainText("Tip document");
      await expect(d).not.toContainText("Etichetă scurtă");
      await expect(d.getByText("Prima pagină", { exact: true })).toBeVisible();
      await page.screenshot({ path: "playwright-report/magnifier/documents-pressed-1366.png" });
      await closeByMagnifier(page, "Act");

      // Step 6 — (#38.72) „Incursiune" on each of the four lists: its tile beside the list, filling the row.
      await peek(page, "/natural-persons", "Ioana", "person", (t) => t.locator('[data-tile="interactions"]'), "natural-persons");
      await peek(page, "/judicial-persons", "Firmă", "company", (t) => t.locator('[data-tile="interactions"]'), "judicial-persons");
      await peek(page, "/properties", "Teren", "property", (t) => t.locator("[data-incursion-map]"), "properties");
      await peek(page, "/documents", "Act", "document", (t) => t.locator('section[aria-label="Pagini"]'), "documents");
      // In peek mode „Pagini" offers no write: no „+ Adaugă pagină", no turn, no „Salvează".
      // (Read on the open tile, below, where the documents' Incursiune is opened again.)

      // Step 7 — one at a time: on Persoane Fizice, another row's eye moves it there.
      await page.goto("/natural-persons");
      const search = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const rows = page.locator("main tbody tr");
      await expect(rows).toHaveCount(3, { timeout: 30_000 });
      const eyeOf = (name: string) => rows.filter({ hasText: name }).getByRole("button", { name: "Incursiune", exact: true });
      await eyeOf("Ioana").click();
      await expect(page.locator("[data-incursion]")).toHaveCount(1, { timeout: 30_000 });
      await eyeOf("Unu").click();
      await expect(page.locator("[data-incursion]")).toHaveCount(1);
      await expect(page.locator("[data-incursion] h2").first()).toContainText("Unu"); // its own head; the reused tile has an h2 too
      await expect(eyeOf("Ioana")).toHaveAttribute("aria-pressed", "false");
      await expect(eyeOf("Unu")).toHaveAttribute("aria-pressed", "true");

      // Step 8 — the documents' Incursiune draws no write.
      await page.goto("/documents");
      const dsearch = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(dsearch).toBeVisible({ timeout: 30_000 });
      await dsearch.fill(MARK);
      const docRow = page.locator("main tbody tr").filter({ hasText: `${MARK} Act` });
      await expect(docRow).toHaveCount(1, { timeout: 30_000 });
      await docRow.getByRole("button", { name: "Incursiune", exact: true }).click();
      const pagesTile = page.locator('[data-incursion="document"]');
      await expect(pagesTile.locator('section[aria-label="Pagini"]')).toBeVisible({ timeout: 30_000 });
      await expect(pagesTile.getByRole("button", { name: "+ Adaugă pagină" })).toHaveCount(0);
      await expect(pagesTile.locator("[data-page-turn]")).toHaveCount(0);
    } finally {
      for (const [k, id] of [["document", doc], ["property", property], ["company", company], ["person", person], ["person", c1], ["person", c2]] as const) {
        await removeRecord(page.request, k, id);
      }
    }
  });
});
