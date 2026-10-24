/**
 * Case:   TC-PERS-07 — „Interacțiuni”, o fișă fixă la dreapta pe persoane; prima fișă a persoanei juridice se numește „Identitate”
 * Source: docs/testing/cases/TC-PERS-07.md, „Last green" 2026-10-11 (step 2 follows Slice #38.89 and the default of 2026-10-11, step 4 #38.46)
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PERS-07` (records.ts).
 *   - The sizes are compared with the document's „Pagini" as measured in this
 *     run, not with the case's 640 × 420 written as numbers alone; both are asserted.
 *   - Step 6 (40.43) makes its two persons and their interactions through the API, as the other records are made.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile, tileBox } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-07`;
const PURPLE = "rgb(246, 240, 254)";
const RIM = "rgb(218, 203, 238)";
// Slice #38.89: the placeholder sentence („Modulul de gestionare a interacțiunilor va fi dezvoltat în viitor.", in
// italics and in parentheses since #38.06) is gone — the tile shows the person's history; this person has none.
const EMPTY = "Nicio interacțiune înregistrată cu această persoană.";

async function size(l: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  const r = await l.boundingBox();
  return { x: Math.round(r?.x ?? -1), y: Math.round(r?.y ?? -1), w: Math.round(r?.width ?? -1), h: Math.round(r?.height ?? -1) };
}
/**
 * FU-312: a tile's place once it holds still — the same box read twice, 500 ms apart. The document's
 * „Pagini" was read once, right after it became visible, and was caught at y 109 and 155 while the
 * screen above it was still settling (164 once settled), so the person's tile, polled, never matched.
 */
async function settledSize(l: Locator): Promise<{ x: number; y: number; w: number; h: number }> {
  let last = await size(l);
  for (let i = 0; i < 40; i++) {
    await l.page().waitForTimeout(500);
    const now = await size(l);
    if (JSON.stringify(now) === JSON.stringify(last)) return now;
    last = now;
  }
  return last;
}
/**
 * Slice 40.43: what stands under a tile's lowest button — the tile's bottom less the lowest button's bottom, in px.
 * „Legături" has only its padding there; „Interacțiuni" must have the same.
 */
async function underLowestButton(tile: Locator): Promise<number> {
  return tile.evaluate((t) => {
    const buttons = [...t.querySelectorAll("button, a")].filter((b) => (b as HTMLElement).offsetParent !== null);
    const lowest = Math.max(...buttons.map((b) => b.getBoundingClientRect().bottom));
    return Math.round(t.getBoundingClientRect().bottom - lowest);
  });
}

/** Slice 40.43: `n` interactions for a person, through the route the module's „Salvează" sends; their ids. */
async function logMany(page: Page, personId: string, n: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const res = await page.request.post("/api/interactions", {
      data: { personId, subject: `${MARK} ${i + 1}`, channel: "EMAIL", direction: "OUTBOUND", status: "LOGGED", occurredAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString() },
    });
    expect(res.status(), await res.text()).toBe(201);
    ids.push(((await res.json()) as { id: string }).id);
  }
  return ids;
}

const clearChoices = (page: Page) =>
  page.evaluate(() => { localStorage.removeItem("ga40-tiles-natural-person-v1"); localStorage.removeItem("ga40-tiles-judicial-person-v1"); });

test.describe("TC-PERS-07 — „Interacțiuni” pe cele două fișe de persoană", () => {
  test("fixă la dreapta, cât „Pagini”, mov; debifată dispare; la 1366 sub formular; „Identitate” pe persoana juridică", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const np = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const jp = await createCompany(page.request, { name: `${MARK} SRL` });
    const doc = await createDocumentOfType(page.request, "CONTRACT_VANZARE", `${MARK} Act`);
    // Slice 40.43: the two persons step 6 makes, removed with their interactions.
    const made: string[] = [];
    try {
      await page.setViewportSize({ width: 1920, height: 1080 });
      // Step 1 — the document's „Pagini", no page: 640 × 436 (420 before #38.30's subtitle line).
      await page.goto(`/documents/${doc}`);
      const pages = page.locator('[data-tile="pages"]');
      await expect(pages).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Nicio pagină adăugată")).toBeVisible({ timeout: 30_000 });
      const pages1920 = await settledSize(pages);
      // 420 px in the pane, 422 on the runner's server before #38.30; + the 16 px subtitle line. Within 4 px is „Pagini"'s height.
      expect(pages1920.w).toBe(640);
      expect(Math.abs(pages1920.h - 436)).toBeLessThanOrEqual(4);

      // Step 2 — the person: the last box ticked in the purple strip; the tile at „Pagini"'s size and place.
      await page.goto(`/natural-persons/${np}`);
      await clearChoices(page);
      await page.reload();
      // Ticked by default again (Adrian, 2026-10-11) — #38.30 had taken it off „until it is built"; this step read
      // „not ticked … ticks it".
      const tile = page.getByRole("region", { name: "Interacțiuni", exact: true });
      await expect(tileBox(page, "Interacțiuni")).toBeChecked({ timeout: 30_000 });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      // Slice 40.41: the bar's groups stand in whatever order evens its two rows, so the box is read in its purple strip
      // alone — was also „the bar's last box" (`[data-tile-selector] label` .last()).
      await expect(page.locator('[data-tile-group="fixed"] label')).toHaveText(["Interacțiuni"]);
      expect(await page.locator('[data-tile-group="fixed"]').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PURPLE);
      await expect(tile.locator("[data-interactions-empty]")).toHaveText(EMPTY, { timeout: 30_000 });
      await expect(tile.getByRole("button", { name: "Deschide în „Interacțiuni”", exact: true })).toBeVisible();
      await expect(tile.getByRole("button", { name: "Interacțiune nouă", exact: true })).toBeVisible();
      expect(await tile.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopColor])).toEqual([PURPLE, RIM]);
      // Slice 40.33: a person with no interaction — the tile at „Pagini"'s place and width; its „Înregistrează o
      // interacțiune" the kind of button „Asociază persoană" is: the same height and colour. Slice 40.43: nothing under
      // that button but the tile's padding, as under „Legături"'s buttons, within 2 px — it read „only as tall as an
      // empty „Legături" on the same screen, within 8 px" (40.33's 188-px floor, which left some 50 px there).
      await expect(tile).toHaveAttribute("data-interactions-state", "empty", { timeout: 30_000 });
      await showTile(page, "Legături");
      const links = page.locator('[data-tile="related"]');
      await expect(links).toBeVisible({ timeout: 30_000 });
      await expect.poll(async () => {
        const [s, under, linksUnder] = await Promise.all([size(tile), underLowestButton(tile), underLowestButton(links)]);
        return { x: s.x, y: s.y, w: s.w, under: Math.abs(under - linksUnder) <= 2 ? true : `${under} against ${linksUnder}` };
      }, { timeout: 15_000 }).toEqual({ x: pages1920.x, y: pages1920.y, w: pages1920.w, under: true });
      await expect(tile.locator('[data-person-log="collapsed"]')).toBeVisible();
      const log = tile.locator("[data-log-expand]");
      const associate = links.getByRole("button", { name: "Asociază persoană", exact: true });
      const look = (l: Locator) => l.evaluate((e) => ({ h: Math.round(e.getBoundingClientRect().height), bg: getComputedStyle(e).backgroundColor }));
      expect(await look(log)).toEqual(await look(associate));
      // As wide as its words, at the tile's left — not stretched across it.
      const [lb, tb] = await Promise.all([size(log), size(tile)]);
      expect(lb.w).toBeLessThan(tb.w / 2);

      // Step 3 — unticked, the tile and the column go; ticked, it is back.
      await tileBox(page, "Interacțiuni").click();
      await expect(tile).toHaveCount(0);
      await expect(page.locator('[data-tile-area="right"]')).toBeHidden();
      await tileBox(page, "Interacțiuni").click();
      await expect(tile).toBeVisible();

      // Step 4 — 1366: under the left tiles, the action bar under it (#38.46 — it read „under the left area", which
      // was the column wrapped as a line of its own, outside the packing), still „Pagini"'s size, purple.
      await page.setViewportSize({ width: 1366, height: 1080 });
      await expect.poll(async () => {
        const t = await size(tile);
        // 40.32: the right-hand tiles are boxes of the one area too — the left tiles are the others.
        const bottoms = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-tile-area="left"] [data-packed-col]')]
          .filter((e) => !e.classList.contains("order-last") && !e.closest('[data-tile-area="right"]')).map((e) => e.getBoundingClientRect().bottom));
        const bar = await size(page.locator("[data-tile-row] [data-packed-col].order-last"));
        return { underTiles: t.y >= Math.max(...bottoms), barUnder: bar.y >= t.y + t.h };
      }, { timeout: 15_000 }).toEqual({ underTiles: true, barUnder: true });
      const at1366 = await size(tile);
      expect(at1366.w).toBe(640);
      // #39.05 read the history at „Pagini"'s height; 40.33: empty, it is short — under 200 px with C.
      await expect(tile).toHaveAttribute("data-interactions-state", "empty");
      expect(at1366.h).toBeLessThan(200);
      expect(await tile.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(PURPLE);

      // Step 5 — the company: „Identitate" first, „Interacțiuni" at the right, the same size.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/judicial-persons/${jp}`);
      await expect(page.getByRole("region", { name: "Interacțiuni", exact: true })).toBeVisible({ timeout: 30_000 });
      // Slice #38.30: „Date de înregistrare" (was „Identitate"), „Reprezentanți și contact"; the Judicial Person keeps „Interacțiuni" ticked.
      // Slice 40.41: in any order — the two-row bar orders its groups to even its rows.
      const names = ["Date de înregistrare", "Reprezentanți și contact", "Adrese", "Legături", "Clasificare", "Etichete și grupuri", "Interacțiuni"];
      await expect.poll(async () => (await page.locator("[data-tile-selector] label").allTextContents()).map((t) => t.trim()).sort()).toEqual([...names].sort());
      await expect(page.locator('[data-panel="identity"] h2').first()).toContainText("Date de înregistrare");
      // FU-312: read once, the tile was now and then 9 px higher than „Pagini" — measured before the company's
      // screen had settled (green alone each time; again in full 20261010T234115Z-18004). Polled, as step 4 is.
      // #39.05 read the history at „Pagini"'s height; 40.33: no interaction, so as tall as the company's empty „Legături"
      // (within 8 px); 40.43: nothing under its button but the padding, as under „Legături"'s, within 2 px.
      await showTile(page, "Legături");
      await expect.poll(async () => {
        const jpTileLoc = page.getByRole("region", { name: "Interacțiuni", exact: true });
        const [jpTile, under, linksUnder] = await Promise.all([size(jpTileLoc), underLowestButton(jpTileLoc), underLowestButton(page.locator('[data-tile="related"]'))]);
        return { x: jpTile.x, y: jpTile.y, w: jpTile.w, under: Math.abs(under - linksUnder) <= 2 };
      }, { timeout: 15_000 }).toEqual({ x: pages1920.x, y: pages1920.y, w: pages1920.w, under: true });

      // Step 6 (40.43) — one interaction against ten: the history as tall as its rows, so the tile with one is visibly
      // shorter; with ten never taller than „Pagini"; the button right under the history; under it only the padding.
      const one = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Unu" });
      const ten = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Zece" });
      made.push(one, ten);
      await logMany(page, one, 1);
      await logMany(page, ten, 10);
      const tileOf = async (id: string, rows: number) => {
        await page.goto(`/natural-persons/${id}`);
        const t = page.getByRole("region", { name: "Interacțiuni", exact: true });
        await expect(t.locator("[data-person-interaction]")).toHaveCount(rows, { timeout: 30_000 });
        await page.waitForTimeout(500);
        const at = await t.evaluate((e) => {
          const R = (x: Element) => x.getBoundingClientRect();
          const history = e.querySelector("[data-interactions-history]")!;
          const button = e.querySelector("[data-log-expand]")!;
          return { h: Math.round(R(e).height), history: Math.round(R(history).height), buttonUnderHistory: Math.round(R(button).top - R(history).bottom) };
        });
        return { ...at, under: await underLowestButton(t) };
      };
      const withOne = await tileOf(one, 1);
      const withTen = await tileOf(ten, 10);
      expect(withOne.h).toBeLessThan(withTen.h - 100);
      // The history's ceiling: „Pagini"'s height less the tile's padding and border (410 px); the button panel under it.
      expect(withTen.history).toBeLessThanOrEqual(pages1920.h - 26 + 2);
      for (const t of [withOne, withTen]) {
        expect(t.buttonUnderHistory).toBeLessThanOrEqual(13); // C's own 12-px top margin
        expect(Math.abs(t.under - withOne.under)).toBeLessThanOrEqual(2);
      }
    } finally {
      await clearChoices(page).catch(() => undefined);
      await removeRecord(page.request, "person", np);
      await removeRecord(page.request, "company", jp);
      await removeRecord(page.request, "document", doc);
      for (const id of made) await removeRecord(page.request, "person", id);
    }
  });
});
