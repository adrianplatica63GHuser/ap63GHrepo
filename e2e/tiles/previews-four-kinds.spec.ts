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
  E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord,
  type RecordKind,
} from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-11`;
/**
 * Slice #38.75: step 9's own records — a full page of them on each list. Its own marker, which neither holds
 * `MARK` nor is held by it, so steps 1–8's searches and leftovers never meet these.
 */
const TALL = `${E2E_MARKER}INCURSION-H`;
/** A list's page (`PAGE_SIZE` in each list-view). */
const PAGE = 15;

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
  // Slice #38.76: the chain link between the eye and the arrow (#38.72 read „Deschide" third).
  await expect(actions.nth(2)).toHaveAccessibleName("Legături");
  await expect(actions.nth(3)).toHaveAccessibleName("Deschide");
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

// ── Step 9 (Slice #38.75): the Incursiune as tall as the list, in its own purple ─────────────────────────────

type Box = { top: number; bottom: number; height: number };
type Measure = { list: Box; tile: Box; wrapped: boolean; surface: string; pinned: string; card: string };

/** The list's body (toolbar to pagination) and the Incursiune beside it; the reused tile's fill and the two fills it may wear. */
async function measure(page: Page): Promise<Measure> {
  return page.evaluate(() => {
    const box = (el: Element): Box => {
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    };
    const list = box(document.querySelector("[data-list-body]")!);
    const tile = box(document.querySelector("[data-incursion]")!);
    const fill = (cls: string) => {
      const probe = document.createElement("div");
      probe.className = cls;
      document.body.append(probe);
      const c = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return c;
    };
    return {
      list,
      tile,
      wrapped: tile.top >= list.bottom - 1,
      surface: getComputedStyle(document.querySelector("[data-incursion] > section")!).backgroundColor,
      pinned: fill("bg-card-pinned"),
      card: fill("bg-card"),
    };
  });
}

/**
 * The list's own rows — inside its frame. Not `main tbody tr`: the Incursiune beside it holds tables of its own
 * (Google Maps' hidden keyboard-shortcuts table under „Hartă", measured: 25 rows for 15; the pages under „Pagini").
 */
const listRows = (page: Page) => page.locator("main [data-list-body] [data-list-edge] tbody tr");

/** Searches the list and waits for `rows` rows. */
async function searchFor(page: Page, text: string, rows: number): Promise<void> {
  const main = page.locator("main");
  await main.locator('input[placeholder^="caută"]').first().fill(text);
  await expect(listRows(page)).toHaveCount(rows, { timeout: 30_000 });
  await page.waitForTimeout(400); // the tile's own read (the map's corners, the pages) settles
}

/**
 * On one list: one row (shorter than the tile) and a full page (taller), at 1920 and 1366 px. Beside the list,
 * the tile's top is the list's; with one row it keeps its own height and the list is not stretched; with a page
 * its bottom is the list's (±2 px). Under the list (a window too narrow for both) it keeps its own height.
 */
async function asTall(page: Page, list: string, kind: string, shot: string): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto(list);
  await expect(page.locator("main").locator('input[placeholder^="caută"]').first()).toBeVisible({ timeout: 30_000 });
  const one = `${TALL} Rând 01`;
  await searchFor(page, one, 1);
  const before = await page.locator("[data-list-body]").evaluate((el) => el.getBoundingClientRect().height);
  await listRows(page).first().getByRole("button", { name: "Incursiune", exact: true }).click();
  await expect(page.locator(`[data-incursion="${kind}"] > section`)).toBeVisible({ timeout: 30_000 });
  for (const width of [1920, 1366]) {
    await page.setViewportSize({ width, height: 1000 });
    await searchFor(page, one, 1);
    const short = await measure(page);
    const at = `${list} at ${width}`;
    expect(short.surface, `${at}: the tile's fill is the pinned purple`).toBe(short.pinned);
    expect(short.surface, `${at}: not the card's grey-blue`).not.toBe(short.card);
    if (width === 1920) {
      expect(short.wrapped, `${at}: the tile stands beside the list`).toBe(false);
      expect(Math.abs(short.list.height - before), `${at}: the one-row list was stretched`).toBeLessThanOrEqual(1);
    }
    if (!short.wrapped) {
      expect(Math.abs(short.tile.top - short.list.top), `${at}, one row: tops`).toBeLessThanOrEqual(2);
      expect(short.tile.bottom, `${at}, one row: the tile keeps its own height`).toBeGreaterThan(short.list.bottom + 2);
    }
    await searchFor(page, TALL, PAGE);
    const tall = await measure(page);
    if (tall.wrapped) {
      // Under the list: its own height, whatever the list's.
      expect(Math.abs(tall.tile.height - short.tile.height), `${at}, under the list: its own height`).toBeLessThanOrEqual(2);
    } else {
      expect(tall.list.height, `${at}: a page of rows is taller than the tile's own height`).toBeGreaterThan(short.tile.height);
      expect(Math.abs(tall.tile.top - tall.list.top), `${at}: tops ${tall.tile.top} / ${tall.list.top}`).toBeLessThanOrEqual(2);
      expect(Math.abs(tall.tile.bottom - tall.list.bottom), `${at}: bottoms ${tall.tile.bottom} / ${tall.list.bottom}`).toBeLessThanOrEqual(2);
    }
    expect(tall.surface, `${at}: the tile's fill is the pinned purple`).toBe(tall.pinned);
    // The spec's own records only: nothing in the picture identifies anyone. A tile under the list is scrolled
    // into the picture (the page scrolls inside the layout, so `fullPage` stops at the window); the pointer off the
    // rows, so the eye's tooltip does not cover the list.
    if (tall.wrapped) await page.locator("[data-incursion]").evaluate((el) => el.scrollIntoView({ block: "end" }));
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `playwright-report/incursion-height/${shot}-${width}.png` });
  }
}

test.describe("TC-TILES-11 — the Incursiune as tall as the list (#38.75)", () => {
  test("step 9: on the four lists, level with the list's top and bottom, in the pinned purple", async ({ page }) => {
    test.slow();
    for (let i = 0; i < 4; i++) await removeLeftovers(page.request, TALL); // the search answers a page at a time
    const made: [RecordKind, string][] = [];
    try {
      for (let n = 1; n <= PAGE; n++) {
        const name = `${TALL} Rând ${String(n).padStart(2, "0")}`;
        made.push(["person", await createNaturalPerson(page.request, { lastName: name, firstName: "Test" })]);
        made.push(["company", await createCompany(page.request, { name })]);
        made.push(["property", await createProperty(page.request, { nickname: name })]);
        made.push(["document", await createDocumentOfType(page.request, "ADEVERINTA", name)]);
      }
      await asTall(page, "/natural-persons", "person", "natural-persons");
      await asTall(page, "/judicial-persons", "company", "judicial-persons");
      await asTall(page, "/properties", "property", "properties");
      await asTall(page, "/documents", "document", "documents");
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});

// ── Step 10 (Slice #38.76): the chain link shows „Legături” beside the list, read-only, in green ─────────────

/** Step 10's own records and links. Its own marker: neither holds `MARK` or `TALL`, nor is held by them. */
const LINKS = `${E2E_MARKER}LEGATURI-10`;

/** The fill of an element and of a probe wearing `cls`. */
async function fills(page: Page, selector: string, cls: string): Promise<[string, string]> {
  return page.evaluate(([sel, c]) => {
    const probe = document.createElement("div");
    probe.className = c;
    document.body.append(probe);
    const want = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return [getComputedStyle(document.querySelector(sel)!).backgroundColor, want];
  }, [selector, cls] as const);
}

/**
 * On one list: the row reads magnifier, eye, chain link, arrow, inside its frame; the chain link shows the object's
 * „Legături” — `rows` related rows, no radio, no „Asociază”, no „Dezasociază”, no share — in the related green,
 * pressed; an eye after it closes it, and the chain link after the eye; pressed again it closes.
 */
async function links(page: Page, list: string, name: string, kind: string, rows: number, shot: string): Promise<void> {
  await page.setViewportSize({ width: 1366, height: 1000 });
  await page.goto(list);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(LINKS);
  const row = main.locator("[data-list-edge] tbody tr").filter({ hasText: name });
  await expect(row).toHaveCount(1, { timeout: 30_000 });
  const actions = row.locator("[data-row-actions]").locator("a, button");
  await expect(actions).toHaveCount(4);
  for (const [i, n] of ["Previzualizare", "Incursiune", "Legături", "Deschide"].entries()) await expect(actions.nth(i)).toHaveAccessibleName(n);
  const cut = await row.evaluate((r) => {
    const frame = r.closest("table")!.parentElement!.getBoundingClientRect();
    return [...r.querySelectorAll<HTMLElement>("[data-row-actions] a, [data-row-actions] button")].filter((b) => b.getBoundingClientRect().right > frame.right + 0.5).length;
  });
  expect(cut, `${list}: buttons cut at the table's edge`).toBe(0);

  const magnifier = row.getByRole("button", { name: "Previzualizare", exact: true });
  const eye = row.getByRole("button", { name: "Incursiune", exact: true });
  const chain = row.getByRole("button", { name: "Legături", exact: true });
  await magnifier.click();
  await expect(page.locator("[data-preview]")).toHaveCount(1, { timeout: 30_000 });
  await chain.click();
  const tile = page.locator(`[data-incursion="${kind}"][data-incursion-view="links"]`);
  const inner = tile.locator('[data-tile="incursion-links"]');
  await expect(inner.locator("[data-one-line-row]")).toHaveCount(rows, { timeout: 30_000 });
  await expect(chain).toHaveAttribute("aria-pressed", "true");
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("[data-preview]")).toHaveCount(0);
  await expect(magnifier).toBeDisabled();
  // A look, not an edit.
  await expect(inner.locator('input[type="radio"]')).toHaveCount(0);
  await expect(inner.getByRole("button", { name: /^Asociază/ })).toHaveCount(0);
  await expect(inner.getByRole("button", { name: "Dezasociază" })).toHaveCount(0);
  await expect(inner.locator("[data-share-button]")).toHaveCount(0);
  // The green its screen gives it — the tile and, calmer, its rows.
  const [tileFill, related] = await fills(page, `[data-incursion-view="links"] [data-tile="incursion-links"]`, "bg-card-related");
  expect(tileFill, `${list}: „Legături” in the related green`).toBe(related);
  const [rowsFill, relatedRow] = await fills(page, `[data-incursion-view="links"] [data-related-rows]`, "bg-card-related-row");
  expect(rowsFill, `${list}: its rows in the rows' green`).toBe(relatedRow);
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(400);
    // The spec's own records only: nothing in the picture identifies anyone.
    await page.locator("[data-incursion]").evaluate((el) => el.scrollIntoView({ block: "nearest" }));
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `playwright-report/legaturi/${shot}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 1000 });

  // One choice with the eye: the eye after it closes it; the chain link after the eye closes that.
  await eye.click();
  await expect(page.locator("[data-incursion]")).toHaveCount(1);
  await expect(page.locator(`[data-incursion="${kind}"]`)).toHaveAttribute("data-incursion-view", "peek");
  await expect(eye).toHaveAttribute("aria-pressed", "true");
  await expect(chain).toHaveAttribute("aria-pressed", "false");
  await chain.click();
  await expect(tile).toBeVisible();
  await expect(eye).toHaveAttribute("aria-pressed", "false");
  await expect(chain).toHaveAttribute("aria-pressed", "true");
  // Pressed again, it closes, and the magnifiers come back.
  await chain.click();
  await expect(page.locator("[data-incursion]")).toHaveCount(0);
  await expect(chain).toHaveAttribute("aria-pressed", "false");
  await expect(magnifier).toBeEnabled();
}

test.describe("TC-TILES-11 — the chain link shows „Legături” (#38.76)", () => {
  test("step 10: on the four lists, the object's „Legături” beside the list, read-only, in green, one choice with the eye", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, LINKS);
    const made: [RecordKind, string][] = [];
    try {
      const person = await createNaturalPerson(page.request, { lastName: LINKS, firstName: "Ana" });
      made.push(["person", person]);
      const company = await createCompany(page.request, { name: `${LINKS} Firmă` });
      made.push(["company", company]);
      const property = await createProperty(page.request, { nickname: `${LINKS} Teren` });
      made.push(["property", property]);
      const doc = await createDocumentOfType(page.request, "ADEVERINTA", `${LINKS} Act`);
      made.unshift(["document", doc]); // removed first, with its links
      for (const [url, data] of [
        [`/api/documents/${doc}/persons`, { personIds: [person, company] }],
        [`/api/documents/${doc}/properties`, { propertyIds: [property] }],
      ] as const) {
        const res = await page.request.post(url, { data });
        expect(res.ok(), `POST ${url}: ${res.status()} ${await res.text()}`).toBeTruthy();
      }
      await links(page, "/natural-persons", "Ana", "person", 1, "natural-persons");
      await links(page, "/judicial-persons", "Firmă", "company", 1, "judicial-persons");
      await links(page, "/properties", "Teren", "property", 1, "properties");
      await links(page, "/documents", "Act", "document", 3, "documents");
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});
