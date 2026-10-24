/**
 * Case:   TC-TILES-18 — Bifele fișelor în patru grupuri colorate, fiecare fișă în culoarea grupului ei
 * Source: docs/testing/cases/TC-TILES-18.md, „Last green" 2026-10-05
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; each colour is the case's table.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-18` (records.ts).
 *   - Step 7 checks the outline calls the place free before releasing, as
 *     TC-TILES-13's spec does, so the drag really moves the tile; the hand run's
 *     pane could not (FU-290).
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-18`;
const KEY = "ga40-tile-positions-natural-person-v1";
const FILL = { record: "rgb(238, 244, 250)", related: "rgb(221, 240, 225)" /* #38.15 */, meta: "rgb(248, 243, 229)", family: "rgb(223, 240, 251)" /* #39.12 */, fixed: "rgb(246, 240, 254)" } as const;
type Group = keyof typeof FILL;

/** The bar's strips, left to right: each group and the names of its boxes. */
async function strips(page: Page): Promise<[string, string[]][]> {
  return page.locator("[data-tile-selector] [data-tile-group]").evaluateAll((els) =>
    els.map((g) => [(g as HTMLElement).dataset.tileGroup ?? "", [...g.querySelectorAll("label")].map((l) => l.textContent?.trim() ?? "")] as [string, string[]]),
  );
}

/** A strip's or tile's surface fill: its own, or the first painted box inside it. */
async function fill(el: Locator): Promise<string> {
  return el.evaluate((e) => {
    for (const x of [e, ...e.querySelectorAll("*")]) {
      const bg = getComputedStyle(x).backgroundColor;
      if (bg !== "rgba(0, 0, 0, 0)") return bg;
    }
    return "none";
  });
}

/** Slice 40.41: the strips' groups in any order — the two-row bar puts them where the rows come out even. */
const byGroup = (s: [string, string[]][]) => [...s].sort((a, b) => a[0].localeCompare(b[0]));

/**
 * Step 8 (40.41): the bar on two rows — no group's boxes on both rows (unless the group alone is wider than a row), the
 * buttons the last thing on the second row, the first row the wider.
 */
async function expectTwoRows(page: Page, url: string): Promise<void> {
  const r = await page.locator("[data-tile-selector]").evaluate((bar) => {
    // Slice 40.42: one wrapping container; each piece (and the buttons) says its row in `data-bar-row`.
    const R = (e: Element) => e.getBoundingClientRect();
    const on = (n: string) => [...bar.querySelectorAll<HTMLElement>(`:scope > [data-bar-row="${n}"]`)];
    const widthOf = (els: HTMLElement[]) => (els.length ? Math.max(...els.map((e) => R(e).right)) - Math.min(...els.map((e) => R(e).left)) : 0);
    const keys = (els: HTMLElement[]) => els.filter((e) => e.dataset.tileGroup).map((e) => e.dataset.tileGroup ?? "");
    return {
      mode: (bar as HTMLElement).dataset.tileRows,
      keys: [keys(on("1")), keys(on("2"))],
      lastIsButtons: (bar.lastElementChild as HTMLElement | null)?.hasAttribute("data-tile-bar-buttons") === true && (bar.lastElementChild as HTMLElement).dataset.barRow === "2",
      widths: [widthOf(on("1")), widthOf(on("2"))],
      sameLine: [on("1"), on("2")].map((els) => new Set(els.map((e) => Math.round((R(e).top + R(e).bottom) / 2))).size),
      room: bar.parentElement!.clientWidth,
      split: [...bar.querySelectorAll<HTMLElement>("[data-tile-group]")].map((g) => g.dataset.tileGroup).filter((k, i, a) => a.indexOf(k) !== i),
    };
  });
  expect(r.sameLine).toEqual([1, 1]);
  expect({ url, mode: r.mode, rows: r.keys.length, lastIsButtons: r.lastIsButtons }).toEqual({ url, mode: "2", rows: 2, lastIsButtons: true });
  const onBoth = r.keys[0].filter((k) => r.keys[1].includes(k));
  expect({ url, onBoth }).toEqual({ url, onBoth: r.split });
  expect(r.widths[0]).toBeGreaterThanOrEqual(r.widths[1] - 1);
  expect(r.widths[0]).toBeLessThanOrEqual(r.room + 1);
}

/**
 * Step 9 (40.42): the diagram right of the bar — one rectangle per tile box on screen (not the action bar), each in its
 * group's fill, all the same height; inside the header's top and the bar's bottom; clear of the version controls.
 */
async function expectDiagram(page: Page, url: string, width: number): Promise<void> {
  // No room before the version controls (a sale contract at 1366: its record boxes fill the first row) — then it is not
  // drawn at all, and that is all there is to read. At 1920 every form has the room.
  await expect.poll(async () => page.locator("[data-tiles-diagram]").getAttribute("data-room"), { timeout: 15_000 }).not.toBe("pending");
  const none = await page.locator("[data-tiles-diagram]").getAttribute("data-room");
  if (none === "none") {
    expect({ url, width, room: "none" }).toEqual({ url, width: 1366, room: "none" });
    await expect(page.locator("[data-tiles-diagram]")).toBeHidden();
    return;
  }
  await expect.poll(async () => {
    const d = await page.evaluate(() => {
      const R = (e: Element) => e.getBoundingClientRect();
      const dg = document.querySelector<HTMLElement>("[data-tiles-diagram]");
      const header = document.querySelector("[data-record-header]");
      const bar = document.querySelector("[data-tile-selector]");
      const slot = document.querySelector("[data-version-slot]")?.firstElementChild ?? null;
      if (!dg || !header || !bar) return null;
      const rects = [...dg.querySelectorAll<HTMLElement>("[data-diagram-rect]")];
      const boxes = [...document.querySelectorAll<HTMLElement>("[data-tile-row] [data-packed-col]")].filter(
        (e) => e.offsetParent !== null && !e.classList.contains("order-last"),
      );
      return {
        hidden: dg.getAttribute("aria-hidden"),
        rects: rects.length,
        boxes: boxes.length,
        heights: [...new Set(rects.map((r) => Math.round(R(r).height * 10) / 10))].length,
        fills: rects.map((r) => [r.dataset.group ?? "", getComputedStyle(r).backgroundColor]),
        inside: R(dg).top >= R(header).top - 1 && R(dg).bottom <= R(bar).bottom + 1,
        clear: slot ? R(dg).right <= R(slot).left : true,
      };
    });
    return d;
  }, { timeout: 15_000 }).toMatchObject({ hidden: "true", heights: 1, inside: true, clear: true });
  const d = await page.evaluate(() => ({
    rects: document.querySelectorAll("[data-tiles-diagram] [data-diagram-rect]").length,
    boxes: [...document.querySelectorAll<HTMLElement>("[data-tile-row] [data-packed-col]")].filter((e) => e.offsetParent !== null && !e.classList.contains("order-last")).length,
    fills: [...document.querySelectorAll<HTMLElement>("[data-tiles-diagram] [data-diagram-rect]")].map((r) => [r.dataset.group ?? "", getComputedStyle(r).backgroundColor]),
  }));
  expect({ url, rects: d.rects }).toEqual({ url, rects: d.boxes });
  for (const [group, fill] of d.fills) expect({ url, group, fill }).toEqual({ url, group, fill: FILL[group as Group] });
}

async function expectForm(page: Page, url: string, expected: [Group, string[]][], width = 1920): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
  // Slice 40.41: in any order — was the registry's, left to right.
  await expect.poll(async () => byGroup(await strips(page)), { timeout: 30_000 }).toEqual(byGroup(expected));
  await expectTwoRows(page, url);
  await expectDiagram(page, url, width);
  for (const [group, names] of expected) {
    expect({ group, fill: await fill(page.locator(`[data-tile-group="${group}"]`)) }).toEqual({ group, fill: FILL[group] });
    for (const name of names) {
      const tile = page.getByRole("region", { name, exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      expect({ name, fill: await fill(tile) }).toEqual({ name, fill: FILL[group] });
    }
  }
}

test.describe("TC-TILES-18 — bifele în patru grupuri colorate", () => {
  test("pe cele patru fișe, la 1366 și 1920; o previzualizare verde; o fișă trasă își păstrează culoarea", async ({ page }) => {
    test.setTimeout(360_000);
    await removeLeftovers(page.request, MARK);
    const prop = await createProperty(page.request, { nickname: `${MARK} Teren` });
    const np = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const jp = await createCompany(page.request, { name: `${MARK} SRL` });
    const doc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Act`);
    try {
      // Steps 1–5 — each form, at 1366 and then 1920.
      for (const width of [1366, 1920]) {
        await page.setViewportSize({ width, height: 1080 });
        await expectForm(page, `/properties/${prop}`, [
          ["record", ["Identificare cadastrală", "Adresă"]],
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["fixed", ["Hartă", "Puncte de contur", "Street View"]],
        ], width);
        await expectForm(page, `/natural-persons/${np}`, [
          ["record", ["Identitate", "Act de identitate", "Contact", "Adrese"]],
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["family", ["Arbore de moștenire"]], // #39.12
          ["fixed", ["Interacțiuni"]], // #37.89
        ], width);
        await expectForm(page, `/judicial-persons/${jp}`, [
          ["record", ["Date de înregistrare", "Reprezentanți și contact", "Adrese"]], // #37.89: „Identitate"; #38.30: „Date de înregistrare"
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["fixed", ["Interacțiuni"]], // #37.89
        ], width);
        await expectForm(page, `/documents/${doc}`, [
          ["record", ["Identificarea actului", "Preț și plată", "Obiectul vânzării", "Carte funciară", "Declarații și garanții", "Taxe și cheltuieli", "Părți"]], // #38.33
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["fixed", ["Pagini"]],
        ], width);
      }

      // Step 6 — a preview from „Persoane Fizice" is green.
      await page.goto("/natural-persons");
      const row = page.getByRole("row").filter({ hasText: MARK }).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      await row.getByRole("button", { name: "Previzualizare", exact: true }).click();
      const preview = page.locator("[data-preview]").first();
      await expect(preview).toBeVisible({ timeout: 30_000 });
      expect(await preview.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(FILL.related);

      // Step 7 — „Conexiuni" dragged under „Corelate" stands there, still yellow.
      await page.setViewportSize({ width: 1920, height: 1300 });
      await page.goto(`/natural-persons/${np}`);
      await page.evaluate((k) => localStorage.removeItem(k), KEY);
      await page.reload();
      await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
      await hideTile(page, "Interacțiuni"); // #37.89: TC-TILES-13's layout, without the right-hand column
      await hideTile(page, "Arbore de moștenire"); // #39.12: and without the family tile, which packs under „Legături"
      const conn = page.getByRole("region", { name: "Etichete și grupuri", exact: true });
      const related = page.getByRole("region", { name: "Legături", exact: true });
      await expect(related).toContainText("Nimic corelat încă.", { timeout: 30_000 });
      await page.waitForTimeout(2500);
      await conn.scrollIntoViewIfNeeded();
      const [c, r] = [await conn.boundingBox(), await related.boundingBox()];
      const p = { x: (c?.x ?? 0) + 5, y: (c?.y ?? 0) + Math.min((c?.height ?? 0) / 2, 120) };
      const tx = (r?.x ?? 0) + (p.x - (c?.x ?? 0));
      const ty = (r?.y ?? 0) + (r?.height ?? 0) + 60 + (p.y - (c?.y ?? 0));
      await page.mouse.move(p.x, p.y);
      await page.mouse.down();
      await page.mouse.move(p.x + 10, p.y + 10, { steps: 3 });
      await page.mouse.move(tx, ty, { steps: 12 });
      // The outline says the place is free, as TC-TILES-13's step 2 reads it — so the tile really moves.
      expect(await page.evaluate(() => document.querySelector<HTMLElement>("[data-tile-outline]")?.dataset.free ?? null)).toBe("true");
      await page.mouse.up();
      await expect.poll(async () => {
        const [now, rr] = [await conn.boundingBox(), await related.boundingBox()];
        return { x: Math.round(now?.x ?? 0), under: (now?.y ?? 0) >= (rr?.y ?? 0) + (rr?.height ?? 0) };
      }, { timeout: 15_000 }).toEqual({ x: Math.round(r?.x ?? 0), under: true });
      expect(await fill(conn)).toBe(FILL.meta);
    } finally {
      await page.evaluate((k) => localStorage.removeItem(k), KEY).catch(() => undefined);
      await removeRecord(page.request, "property", prop);
      await removeRecord(page.request, "person", np);
      await removeRecord(page.request, "company", jp);
      await removeRecord(page.request, "document", doc);
    }
  });
});
