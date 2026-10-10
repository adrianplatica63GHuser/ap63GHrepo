/**
 * Case:   TC-VL-10 — „Roluri și legături”: triunghiul legăturilor deasupra listelor
 * Source: docs/testing/cases/TC-VL-10.md, „Last green" 2026-10-09
 *
 * A translation of the case file, step for step. Nothing is created: the tile describes the code.
 */

import { test, expect, type Locator } from "@playwright/test";

// Slice #38.77: the third cell was the status in words („configurat în aplicație" / „neconfigurat, intenționat");
// it is the where-sentence now, which stands after „Vezi:" on the name line.
const SIX = [
  ["personPerson", "Persoană → Persoană", "Coloana „Persoană → Persoană” și coloana „Rol invers” din lista „Roluri Persoane”."],
  ["propertyProperty", "Proprietate → Proprietate", "Lista „Legături Proprietate → Proprietate”."],
  ["documentDocument", "Document → Document", "Lista „Legături Document → Document”."],
  ["personProperty", "Persoană – Proprietate", "Coloana „Persoană → Proprietate” din lista „Roluri Persoane”."],
  ["personDocument", "Persoană – Document", "Nu are o coloană în lista „Roluri Persoane”: se configurează pe fiecare rol, la „Act”, sau pe pagina tipului de document."],
  ["documentProperty", "Document – Proprietate", "Nicio listă: tipul documentului spune ce înseamnă legătura."],
] as const;

/**
 * Slice #38.77 — measured on 2026-10-10 before the slice, Roluri Persoane: at 1920 px the tile 1132 × 698.6 px and the
 * six's column 756.4 px wide; at 1366 px the tile 968 × 741 px (the side's six units, the unit grid giving it no
 * more) and the column 592.4. After: 1920 — the tile 1283.6 × 535.5, the column 908 (×1.20); 1366 — 968 × 694.7,
 * the column unchanged (the cap, Ask first #1).
 */
const BEFORE = { 1366: { tileH: 741, column: 592.4 }, 1920: { tileH: 698.6, column: 756.4 } } as const;

test.describe("TC-VL-10 — triunghiul legăturilor", () => {
  for (const width of [1366, 1920]) {
    test(`la ${width} px: deasupra listei, șase legături, o latură deschide lista ei`, async ({ page }) => {
      test.slow();
      await page.setViewportSize({ width, height: 1000 });

      // Step 1 — „Roluri Persoane": the tile above the list, its drawing and its six entries.
      await page.goto("/admin/value-lists?list=person-roles");
      const tile = page.locator("[data-relationship-triangle]");
      const list = page.getByRole("region", { name: "Roluri Persoane", exact: true });
      await expect(tile).toBeVisible({ timeout: 30_000 });
      await expect(list).toBeVisible({ timeout: 30_000 });
      const tileBox = (await tile.boundingBox())!;
      const listBox = (await list.boundingBox())!;
      expect(tileBox.y + tileBox.height).toBeLessThanOrEqual(listBox.y + 1);
      await expect(tile.getByRole("img")).toBeVisible();
      for (const k of ["Persoană", "Proprietate", "Document"]) await expect(tile.locator("svg text", { hasText: new RegExp(`^${k}$`) })).toHaveCount(1);

      // Step 2 — the six, in order. #38.77: no status words; on each name line, a few spaces after the name,
      // „Vezi:" and the sentence that stood in small type at the bottom (#38.62–#38.76: `[data-status]`).
      const entries = tile.locator("[data-relationship-entry]");
      await expect(entries).toHaveCount(6);
      await expect(tile.locator("[data-status]")).toHaveCount(0);
      await expect(tile).not.toContainText("configurat în aplicație");
      await expect(tile).not.toContainText("neconfigurat, intenționat");
      for (const [i, [id, name, where]] of SIX.entries()) {
        const e = entries.nth(i);
        await expect(e).toHaveAttribute("data-relationship-entry", id);
        await expect(e).toContainText(name);
        // Word for word after „Vezi:" (5 and 6 also hold their ⓘ, so not `toHaveText` on the whole).
        await expect(e.locator(`[data-note="${id}"]`)).toHaveText(/^Vezi: /);
        await expect(e.locator(`[data-note="${id}"]`)).toContainText(`Vezi: ${where}`);
        const line = await e.evaluate((el, nid) => {
          const nameEl = el.querySelector<HTMLElement>("p > a, p > span.whitespace-nowrap")!.getBoundingClientRect(); // the name, not the number
          const first = el.querySelector<HTMLElement>(`[data-note="${nid}"]`)!.getClientRects()[0];
          return { sameLine: Math.abs(first.top - nameEl.top) <= 6, gap: first.left - nameEl.right };
        }, id);
        expect([id, line.sameLine], `${id}: „Vezi:" on the name's line`).toEqual([id, true]);
        expect(line.gap, `${id}: the gap after the name, px`).toBeGreaterThanOrEqual(10);
        expect(line.gap, `${id}: the gap after the name, px`).toBeLessThanOrEqual(24);
      }
      await expect(entries.nth(5)).toContainText("Nu există o listă „Document → Proprietate”");
      await expect(entries.nth(4)).toContainText("Nu are o coloană în lista „Roluri Persoane”");
      // The side that is not configured is dashed, and opens nothing.
      await expect(tile.locator('[data-side="documentProperty"]')).toHaveAttribute("stroke-dasharray", "6 5");
      await expect(tile.locator('a[data-relationship="documentProperty"]')).toHaveCount(0);
      // #34.05's note is not printed above the list any more: it is entry 6.
      await expect(page.getByText("Nu există o listă „Document → Proprietate”")).toHaveCount(1);

      // Step 7 (#38.67, read here, before step 3 moves away) — the title over the drawing, no wider than it; the drawing
      // about 20 % smaller than #38.62's 416 px, its words not under 12 px; the six from the tile's top edge, beside the
      // column, a divider between them that runs the tile's full height; no divider across the tile under the title.
      const layout = await tile.evaluate((t) => {
        const box = (sel: string) => t.querySelector<HTMLElement | SVGElement>(sel)!.getBoundingClientRect();
        const tileBox = t.getBoundingClientRect();
        const heading = box("[data-triangle-heading]");
        const svg = t.querySelector<SVGSVGElement>("[data-triangle-drawing]")!;
        const drawing = svg.getBoundingClientRect();
        const scale = drawing.width / svg.viewBox.baseVal.width;
        const fonts = [...svg.querySelectorAll("text")].map((x) => Number(x.getAttribute("font-size")) * scale);
        const ol = t.querySelector<HTMLElement>("[data-triangle-list]")!;
        const olBox = ol.getBoundingClientRect();
        const first = box("[data-relationship-entry]");
        const cs = getComputedStyle(ol);
        return {
          headingOver: heading.width - drawing.width,
          drawingW: drawing.width,
          smallestFont: Math.min(...fonts),
          firstFromTop: first.top - tileBox.top,
          beside: olBox.left >= drawing.right,
          divider: cs.borderLeftWidth,
          dividerTop: cs.borderTopWidth,
          dividerHeight: olBox.height - (tileBox.height - 2),
          ruledUnderTitle: [...t.querySelectorAll<HTMLElement>("div")].some((d) => getComputedStyle(d).borderBottomWidth !== "0px" && d.getBoundingClientRect().width > tileBox.width - 4),
        };
      });
      expect(layout.headingOver, "the title's box against the drawing's width").toBeLessThanOrEqual(8);
      expect(layout.drawingW).toBeGreaterThan(416 * 0.75);
      expect(layout.drawingW).toBeLessThan(416 * 0.85);
      expect(layout.smallestFont, "the smallest word in the drawing, px").toBeGreaterThanOrEqual(12);
      expect(layout.firstFromTop, "the first of the six against the tile's top").toBeLessThanOrEqual(8);
      expect(layout.beside).toBe(true);
      expect([layout.divider, layout.dividerTop]).toEqual(["1px", "0px"]);
      expect(Math.abs(layout.dividerHeight), "the divider runs the tile's full height").toBeLessThanOrEqual(2);
      expect(layout.ruledUnderTitle).toBe(false);

      // Step 10 (#38.77) — the six's column 20 % wider where the tile is held by its own width, the drawing kept; where
      // the side already holds it (1366 px), as wide as the side; and the tile less tall than before, at both.
      const wide = await tile.evaluate((t) => ({
        tileW: t.getBoundingClientRect().width,
        tileH: t.getBoundingClientRect().height,
        column: t.querySelector<HTMLElement>("[data-triangle-list]")!.getBoundingClientRect().width,
        side: t.closest<HTMLElement>("[data-value-list-side]")!.getBoundingClientRect().width,
        sideScrolls: t.closest<HTMLElement>("[data-value-list-side]")!.scrollWidth > t.closest<HTMLElement>("[data-value-list-side]")!.clientWidth + 1,
      }));
      const before = BEFORE[width as 1366 | 1920];
      expect(wide.tileH, `the tile's height against ${before.tileH} px before`).toBeLessThan(before.tileH - 20);
      expect(wide.sideScrolls, "the side scrolls sideways").toBe(false);
      if (width === 1920) {
        expect(wide.column / before.column, "the six's column against its width before").toBeGreaterThanOrEqual(1.2 - 0.005);
      } else {
        expect(Math.abs(wide.tileW - wide.side), "the tile as wide as the side holding it").toBeLessThanOrEqual(1);
        expect(wide.column, "the six's column no narrower than before").toBeGreaterThanOrEqual(before.column - 1);
      }
      // The slice's pictures, light and dark — not a step of the case.
      for (const scheme of ["light", "dark"] as const) {
        await page.emulateMedia({ colorScheme: scheme });
        await page.waitForTimeout(300);
        await tile.screenshot({ path: `playwright-report/value-list-page/triangle-${width}-${scheme}.png` });
      }
      await page.emulateMedia({ colorScheme: "light" });

      // Step 3 — the Proprietate → Proprietate corner opens its list; the tile stays above it.
      await tile.locator('a[data-relationship="propertyProperty"]').click();
      await expect(page).toHaveURL(/\?list=property-property-roles$/, { timeout: 15_000 });
      await expect(page.getByRole("region", { name: "Legături Proprietate → Proprietate", exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("[data-relationship-triangle]")).toBeVisible();

      // Step 4 — a side: Persoană – Proprietate opens „Roluri Persoane".
      await page.locator('[data-relationship-triangle] a[data-relationship="personProperty"]').click();
      await expect(page).toHaveURL(/\?list=person-roles$/, { timeout: 15_000 });
      await expect(page.getByRole("region", { name: "Roluri Persoane", exact: true })).toBeVisible({ timeout: 15_000 });

      // Step 5 — the list under the tile keeps #38.56's frame: scrolled to the list, it takes most of a screen, and
      // scrolled to its last row its header row stays at the frame's top.
      const table = page.locator("table[data-width-table]");
      await table.evaluate((t) => t.closest("[data-value-list-card]")!.scrollIntoView({ block: "start" }));
      const frameOf = () => table.evaluate((t) => {
        const f = t.parentElement!;
        return { height: f.getBoundingClientRect().height, top: f.getBoundingClientRect().top, head: t.querySelector("thead")!.getBoundingClientRect().top, scrollTop: f.scrollTop };
      });
      expect((await frameOf()).height).toBeGreaterThan(500);
      await table.evaluate((t) => { t.parentElement!.scrollTop = t.parentElement!.scrollHeight; });
      await expect.poll(async () => (await frameOf()).scrollTop).toBeGreaterThan(0);
      const after = await frameOf();
      expect(Math.abs(after.head - after.top)).toBeLessThanOrEqual(2);

      // Step 8 — (#38.68) one link, the heavy yellow in four places. Pressing 4 marks 4 on the drawing and among the six,
      // „Roluri Persoane" in the column and the card's title, and leaves 1 and 5 unmarked. Colour read with getComputedStyle.
      const YELLOW = "rgb(250, 204, 21)";
      const nav = page.getByRole("navigation", { name: "Liste de referință" });
      const bg = (l: Locator) => l.evaluate((el) => getComputedStyle(el).backgroundColor);
      const fill = (id: string) => page.locator(`[data-relationship-triangle] [data-bubble="${id}"]`).evaluate((el) => getComputedStyle(el).fill);
      const entryNo = (id: string) => bg(page.locator(`[data-relationship-triangle] [data-entry-number="${id}"]`));
      const cardTitle = page.locator("[data-value-list-card] h2 span");
      const ALL = SIX.map(([id]) => id);
      const unmarkedBut = async (id: string) => {
        for (const other of ALL.filter((x) => x !== id)) {
          expect([other, await fill(other)]).not.toEqual([other, YELLOW]);
          expect([other, await entryNo(other)]).not.toEqual([other, YELLOW]);
        }
      };
      await page.locator('[data-relationship-triangle] a[data-relationship="personProperty"]').click();
      await expect.poll(() => fill("personProperty")).toBe(YELLOW);
      expect(await entryNo("personProperty")).toBe(YELLOW);
      await unmarkedBut("personProperty");
      expect(await bg(nav.getByRole("button", { name: "Roluri Persoane", exact: true }))).toBe(YELLOW);
      expect(await bg(cardTitle)).toBe(YELLOW);
      await expect(page.locator('[data-relationship-triangle] a[data-relationship="personProperty"]')).toHaveAttribute("aria-current", "true");
      await expect(page.locator('[data-relationship-entry="personProperty"]')).toHaveAttribute("aria-current", "true");
      await expect(page.locator('[data-relationship-triangle] a[data-relationship="personPerson"]')).not.toHaveAttribute("aria-current", "true");
      if (width === 1366) {
        // The page scrolls in its own area (`data-page-scroll`), not the window: to its top, so the column shows.
        await page.evaluate(() => document.querySelector("[data-page-scroll]")?.scrollTo(0, 0));
        for (const scheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.waitForTimeout(300);
          await page.screenshot({ path: `playwright-report/value-list-page/yellow-4-1366-${scheme}.png` });
        }
        await page.emulateMedia({ colorScheme: "light" });
      }

      // The column: „Legături Document → Document" marks 3, and itself.
      await nav.getByRole("button", { name: "Legături Document → Document", exact: true }).click();
      await expect(page).toHaveURL(/\?list=document-document-roles$/, { timeout: 15_000 });
      await expect.poll(() => fill("documentDocument")).toBe(YELLOW);
      expect(await entryNo("documentDocument")).toBe(YELLOW);
      await unmarkedBut("documentDocument");
      expect(await bg(nav.getByRole("button", { name: "Legături Document → Document", exact: true }))).toBe(YELLOW);
      await expect.poll(() => bg(cardTitle)).toBe(YELLOW);

      // 6: marks only 6 — the list stays open, its name and its title unmarked.
      await page.locator('[data-relationship-triangle] [data-relationship="documentProperty"]').click();
      await expect.poll(() => fill("documentProperty")).toBe(YELLOW);
      await expect(page).toHaveURL(/\?list=document-document-roles$/);
      await unmarkedBut("documentProperty");
      expect(await bg(nav.getByRole("button", { name: "Legături Document → Document", exact: true }))).not.toBe(YELLOW);
      expect(await bg(cardTitle)).not.toBe(YELLOW);
      await expect(page.locator('[data-relationship-triangle] [data-relationship="documentProperty"]')).toHaveAttribute("aria-pressed", "true");

      // Step 9 — (#38.69) notes 5 and 6 italic and magenta, 1–4 not; each ⓘ opens its steps, Esc or a press outside closes
      // them, and a list a step names opens.
      const MAGENTA = "rgb(162, 28, 175)";
      const note = (id: string) => page.locator(`[data-relationship-triangle] [data-note="${id}"]`);
      const look = (id: string) => note(id).evaluate((el) => ({ italic: getComputedStyle(el).fontStyle, color: getComputedStyle(el).color }));
      for (const id of ["personDocument", "documentProperty"]) expect([id, await look(id)]).toEqual([id, { italic: "italic", color: MAGENTA }]);
      for (const id of ["personPerson", "propertyProperty", "documentDocument", "personProperty"]) {
        const l = await look(id);
        expect([id, l.italic === "italic" || l.color === MAGENTA]).toEqual([id, false]);
      }
      const info5 = note("personDocument").getByRole("button", { name: "Cum se configurează legătura Persoană – Document", exact: true });
      await info5.click();
      const panel5 = page.getByRole("dialog", { name: "Cum se configurează legătura Persoană – Document", exact: true });
      await expect(panel5).toBeVisible();
      await expect(panel5).toContainText("fila „Roluri”");
      await expect(info5).toHaveAttribute("aria-expanded", "true");
      if (width === 1366) {
        await panel5.scrollIntoViewIfNeeded();
        for (const scheme of ["light", "dark"] as const) {
          await page.emulateMedia({ colorScheme: scheme });
          await page.waitForTimeout(300);
          // The window, not the tile: the explanation hangs over the tile's bottom edge.
          await page.screenshot({ path: `playwright-report/value-list-page/magenta-info-1366-${scheme}.png` });
        }
        await page.emulateMedia({ colorScheme: "light" });
      }
      await page.keyboard.press("Escape");
      await expect(panel5).toHaveCount(0);
      await expect(info5).toBeFocused();
      const info6 = note("documentProperty").getByRole("button", { name: "Cum se face legătura Document – Proprietate", exact: true });
      await info6.click();
      const panel6 = page.getByRole("dialog", { name: "Cum se face legătura Document – Proprietate", exact: true });
      await expect(panel6).toBeVisible();
      await page.locator("[data-relationship-triangle] h2").click();
      await expect(panel6).toHaveCount(0);
      await info6.click();
      await page.keyboard.press("Escape");
      await expect(panel6).toHaveCount(0);
      // A list a step names opens, as the triangle's names do (Ask first #2).
      await info5.click();
      await panel5.getByRole("link", { name: "Roluri Persoane", exact: true }).click();
      await expect(page).toHaveURL(/\?list=person-roles$/, { timeout: 15_000 });

      // Step 6 — a list outside „Roluri și legături" has no tile.
      await page.goto("/admin/value-lists?list=citizenships");
      await expect(page.getByRole("region", { name: "Cetățenie", exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[data-relationship-triangle]")).toHaveCount(0);
    });
  }
});
