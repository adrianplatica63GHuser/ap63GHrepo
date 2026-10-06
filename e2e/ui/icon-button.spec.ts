/**
 * Case:   TC-ICON-01 — Butoanele cu pictogramă își arată numele: la mouse, la tastatură, și când sunt inactive
 * Source: docs/testing/cases/TC-ICON-01.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim. A tooltip is read as the case reads it: the
 * element with role `tooltip`, which IconButton draws at the end of <body>
 * only while it is shown.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The persons are `Persoana NN TC-E2E-ICON-01` (records.ts), created
 *     through the API and removed through it at the end.
 *   - The hand run's pane was hidden, so its hovers were dispatched pointer
 *     events; here they are Playwright's real mouse. „Anterior" is inactive,
 *     and an inactive button lets the pointer through to the wrapper that
 *     listens (icon-button.tsx), so the mouse is moved over that wrapper.
 *   - Slice #37.42's pictures, not a step of the case: the sidebar open and
 *     collapsed, the list toolbar with a tooltip showing, and a form's
 *     „Înapoi la listă", at 1366 and 1920 px, into
 *     `playwright-report/icon-button/`. The sidebar's „Recente" list is
 *     painted over, as it may name the archive's own records.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}ICON-01`;
const SHOTS = "playwright-report/icon-button";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before?: () => Promise<void>): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    if (before) await before();
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

/** Somewhere that is no control: the window's bottom-right corner, empty on these screens. */
async function moveAway(page: Page): Promise<void> {
  const v = page.viewportSize() ?? { width: 1920, height: 1080 };
  await page.mouse.move(v.width - 10, v.height - 10);
}

function tooltip(page: Page): Locator {
  return page.getByRole("tooltip");
}

test.describe("TC-ICON-01 — Butoanele cu pictogramă își arată numele", () => {
  test("la mouse, la tastatură, și când sunt inactive", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const ids: string[] = [];
    try {
      for (let i = 1; i <= 16; i++) {
        ids.push(await createNaturalPerson(page.request, { lastName: MARK, firstName: `Persoana ${String(i).padStart(2, "0")}` }));
      }

      // Step 1 — „Persoane Fizice", the marker in the search box.
      await page.goto("/natural-persons");
      await page.getByPlaceholder("caută după cod, nume, email sau telefon").fill(MARK);
      const main = page.locator("main");
      await expect(main.getByText("Se afișează 15 din 16")).toBeVisible({ timeout: 15_000 });
      await expect(main.getByText("Pagina 1 din 2")).toBeVisible();
      await expect(main.locator("tbody tr")).toHaveCount(15);
      await expect(main.getByRole("link", { name: "Deschide", exact: true })).toHaveCount(15);
      await expect(main.getByRole("button", { name: "Previzualizare", exact: true })).toHaveCount(15);
      const chooseFields = main.getByRole("button", { name: "Câmpuri afișate 0/4" });
      await expect(chooseFields).toBeVisible();
      const add = main.getByRole("link", { name: "Adaugă persoană" });
      await expect(add).toHaveText("Adaugă persoană");
      const previous = main.getByRole("button", { name: "Anterior" });
      const next = main.getByRole("button", { name: "Următor" });
      await expect(previous).toBeDisabled();
      await expect(next).toBeEnabled();

      // Step 2 — the mouse over the columns icon: „Câmpuri afișate 0/4", under it; gone when it leaves.
      await chooseFields.hover();
      await expect(tooltip(page)).toHaveText("Câmpuri afișate 0/4");
      const tip = await tooltip(page).boundingBox();
      const btn = await chooseFields.boundingBox();
      expect(tip!.y).toBeGreaterThan(btn!.y + btn!.height - 1);
      expect(Math.abs(tip!.x + tip!.width / 2 - (btn!.x + btn!.width / 2))).toBeLessThan(2);
      await photograph(page, "list-toolbar-tooltip", async () => {
        await moveAway(page);
        await chooseFields.hover();
        await expect(tooltip(page)).toHaveText("Câmpuri afișate 0/4");
      });
      await moveAway(page);
      await expect(tooltip(page)).toHaveCount(0);

      // Step 3 — „Adaugă persoană": its words are on it, so no tooltip.
      await add.hover();
      await expect(tooltip(page)).toHaveCount(0);

      // Step 4 — „Anterior", inactive: its tooltip all the same.
      await previous.locator("..").hover();
      await expect(tooltip(page)).toHaveText("Anterior");
      await moveAway(page);

      // Step 5 — Tab from the last row's „Previzualizare" to „Următor": its tooltip; Escape closes it.
      await main.getByRole("button", { name: "Previzualizare", exact: true }).last().focus();
      await page.keyboard.press("Tab");
      await expect(next).toBeFocused();
      await expect(tooltip(page)).toHaveText("Următor");
      await page.keyboard.press("Escape");
      await expect(tooltip(page)).toHaveCount(0);

      // Step 6 — „Următor": page two, one row, no tooltip left.
      await page.keyboard.press("Enter");
      await expect(main.getByText("Pagina 2 din 2")).toBeVisible();
      await expect(main.getByText("Se afișează 16 din 16")).toBeVisible();
      await expect(main.locator("tbody tr")).toHaveCount(1);
      await expect(main.getByText(`Persoana 01 ${MARK}`)).toBeVisible();
      await expect(tooltip(page)).toHaveCount(0);

      // Pictures (#37.42), not steps: the sidebar open, collapsed with a row's tooltip, and a form's „Înapoi".
      await photograph(page, "sidebar-open", () => moveAway(page));
      await page.getByRole("button", { name: "Restrânge bara laterală" }).click();
      await photograph(page, "sidebar-collapsed", async () => {
        await moveAway(page);
        // Slice #38.20: collapsed, the sidebar shows its nine sections' icons; „Persoane Fizice"
        // is inside „Domeniu", whose icon carries the tooltip.
        await page.locator("nav[data-sidebar-nav]").getByRole("button", { name: "Domeniu" }).hover();
        await expect(tooltip(page)).toHaveText("Domeniu");
      });
      await page.getByRole("button", { name: "Extinde bara laterală" }).click();
      await page.goto(`/natural-persons/${ids[0]}?readonly=true`);
      const back = page.getByRole("button", { name: "Înapoi la listă" });
      await expect(back).toBeVisible({ timeout: 15_000 });
      await photograph(page, "form-back", async () => {
        await back.scrollIntoViewIfNeeded();
        await back.hover();
        await expect(tooltip(page)).toHaveText("Înapoi la listă");
      });
    } finally {
      for (const id of ids) await removeRecord(page.request, "person", id);
    }
  });
});
