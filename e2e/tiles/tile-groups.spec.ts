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

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, createProperty, removeLeftovers, removeRecord } from "../helpers/records";
import { hideTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-18`;
const KEY = "ga40-tile-positions-natural-person-v1";
const FILL = { record: "rgb(238, 244, 250)", related: "rgb(221, 240, 225)" /* #38.15 */, meta: "rgb(248, 243, 229)", fixed: "rgb(246, 240, 254)" } as const;
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

async function expectForm(page: Page, url: string, expected: [Group, string[]][]): Promise<void> {
  await page.goto(url);
  await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
  await expect.poll(() => strips(page), { timeout: 30_000 }).toEqual(expected);
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
        ]);
        await expectForm(page, `/natural-persons/${np}`, [
          ["record", ["Identitate", "Act de identitate", "Contact", "Adrese"]],
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["fixed", ["Interacțiuni"]], // #37.89
        ]);
        await expectForm(page, `/judicial-persons/${jp}`, [
          ["record", ["Date de înregistrare", "Reprezentanți și contact", "Adrese"]], // #37.89: „Identitate"; #38.30: „Date de înregistrare"
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["fixed", ["Interacțiuni"]], // #37.89
        ]);
        await expectForm(page, `/documents/${doc}`, [
          ["record", ["Identificarea actului", "Preț și taxe", "Cadastru și CF", "Stare juridică", "Formalități"]],
          ["related", ["Legături"]],
          ["meta", ["Clasificare", "Etichete și grupuri"]],
          ["fixed", ["Pagini"]],
        ]);
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
