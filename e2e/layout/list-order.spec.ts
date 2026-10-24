/**
 * Case:   TC-LAYOUT-09 — Butonul de ordine pe cele patru liste: „Recente întâi" la deschidere, „Vechi întâi" la apăsare, păstrat la Înapoi și la reîncărcare
 * Source: docs/testing/cases/TC-LAYOUT-09.md, „Last green" 2026-10-24 (step 9 is 40.49's)
 *
 * A translation of the case file, step for step (Slice 40.46). „The rows' order" is read from the list's own answer,
 * `GET /api/<list>`, by each row's last change — the later of `updatedAt` and `createdAt` — and the first row on
 * screen is matched to it by its link's id. No record's text is read.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The hand run read the answers by fetching the route itself; here the page's own request is awaited.
 *   - Playwright's mouse; the hand run pressed by script.
 */
import { test, expect, type Page, type Response } from "../helpers/test";
import { openFromSidebar } from "../helpers/sidebar";

type Row = { id: string; createdAt: string; updatedAt: string | null };

const lastChange = (r: Row): number => Math.max(Date.parse(r.updatedAt ?? "") || 0, Date.parse(r.createdAt));

function expectOrdered(items: Row[], dir: "desc" | "asc"): void {
  expect(items.length).toBeGreaterThan(1);
  for (let i = 1; i < items.length; i++) {
    const [a, b] = [lastChange(items[i - 1]), lastChange(items[i])];
    expect([i, dir === "desc" ? a >= b : a <= b]).toEqual([i, true]);
  }
}

/** The list's answer to the request `action` causes. */
async function answer(page: Page, api: string, action: () => Promise<unknown>): Promise<Row[]> {
  const isList = (r: Response) => new URL(r.url()).pathname === api && r.request().method() === "GET" && r.ok();
  const [res] = await Promise.all([page.waitForResponse(isList, { timeout: 30_000 }), action()]);
  return ((await res.json()) as { items: Row[] }).items;
}

const sortButton = (page: Page) => page.locator("main [data-sort-control]");
const firstRowLink = (page: Page, path: string) => page.locator("main tbody tr").first().locator(`a[href^="${path}/"]`);

async function expectFirstRow(page: Page, path: string, id: string): Promise<void> {
  await expect(firstRowLink(page, path)).toHaveAttribute("href", `${path}/${id}`, { timeout: 30_000 });
}

/** Where the button stands: the toolbar item before it — „Câmpuri afișate", or on Acte „Câmp specific"'s group. */
async function before(page: Page): Promise<string> {
  return sortButton(page).evaluate((b) => {
    let el: Element = b;
    while (el.parentElement && !el.parentElement.className.includes("flex-wrap") && !el.parentElement.hasAttribute("data-filter-fixed")) el = el.parentElement;
    const prev = el.previousElementSibling;
    if (!prev) return "none";
    if (prev.hasAttribute("data-field-chooser")) return "chooser";
    if (prev.hasAttribute("data-custom-field-group")) return "custom-field-group";
    return prev.tagName;
  });
}

const isDefaultAddress = (page: Page) => {
  const u = new URL(page.url());
  return !u.searchParams.has("sort") && !u.searchParams.has("order");
};

/** Steps 6–8: open, press, press again. */
async function flipTwice(page: Page, label: string, path: string, api: string, where: string): Promise<void> {
  const newest = await answer(page, api, () => openFromSidebar(page, label));
  expectOrdered(newest, "desc");
  await expect(sortButton(page)).toHaveText("Recente întâi", { timeout: 30_000 });
  expect(await before(page)).toBe(where);
  const oldest = await answer(page, api, () => sortButton(page).click());
  expectOrdered(oldest, "asc");
  await expect(sortButton(page)).toHaveText("Vechi întâi");
  await expectFirstRow(page, path, oldest[0].id);
  await sortButton(page).click();
  await expect(sortButton(page)).toHaveText("Recente întâi");
  await expectFirstRow(page, path, newest[0].id);
  expect(isDefaultAddress(page)).toBe(true);
}

test.describe("TC-LAYOUT-09 — butonul de ordine pe cele patru liste", () => {
  test("„Recente întâi” la deschidere, „Vechi întâi” la apăsare, păstrat la Înapoi și la reîncărcare", async ({ page }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto("/");

    // Step 1 — „Persoane Fizice": „Recente întâi" right after „Câmpuri afișate", newest change first, no order in the address.
    const newest = await answer(page, "/api/people", () => openFromSidebar(page, "Persoane Fizice"));
    expectOrdered(newest, "desc");
    await expect(sortButton(page)).toHaveText("Recente întâi", { timeout: 30_000 });
    await expect(sortButton(page).locator("svg")).toHaveClass(/lucide-arrow-down-wide-narrow/);
    expect(await before(page)).toBe("chooser");
    expect(isDefaultAddress(page)).toBe(true);

    // Step 2 — pressed: „Vechi întâi", oldest change first, sort=changed&order=asc.
    const oldest = await answer(page, "/api/people", () => sortButton(page).click());
    expectOrdered(oldest, "asc");
    await expect(sortButton(page)).toHaveText("Vechi întâi");
    await expect(sortButton(page).locator("svg")).toHaveClass(/lucide-arrow-up-narrow-wide/);
    await expect(page).toHaveURL(/[?&]sort=changed&order=asc\b/);
    await expectFirstRow(page, "/natural-persons", oldest[0].id);

    // Step 3 — the first row's record, then Back: the same list, the same order.
    await firstRowLink(page, "/natural-persons").click();
    await expect(page).toHaveURL(new RegExp(`/natural-persons/${oldest[0].id}$`), { timeout: 30_000 });
    await page.goBack();
    await expect(sortButton(page)).toHaveText("Vechi întâi", { timeout: 30_000 });
    await expectFirstRow(page, "/natural-persons", oldest[0].id);

    // Step 4 — a reload keeps it.
    await page.reload();
    await expect(sortButton(page)).toHaveText("Vechi întâi", { timeout: 30_000 });
    await expectFirstRow(page, "/natural-persons", oldest[0].id);

    // Step 5 — pressed again: „Recente întâi", newest first, no order in the address.
    await sortButton(page).click();
    await expect(sortButton(page)).toHaveText("Recente întâi");
    await expectFirstRow(page, "/natural-persons", newest[0].id);
    expect(isDefaultAddress(page)).toBe(true);

    // Steps 6–8 — the other three lists.
    await flipTwice(page, "Persoane Juridice", "/judicial-persons", "/api/judicial-persons", "chooser");
    await flipTwice(page, "Proprietăți", "/properties", "/api/properties", "chooser");
    await flipTwice(page, "Acte", "/documents", "/api/documents", "custom-field-group");

    // Step 9 (40.49) — „Șterge filtrele" right of the sort button: disabled with no filter, enabled with one; a press
    // clears the filters and keeps the search and the order.
    const LISTS = [
      ["Persoane Fizice", "/natural-persons", "gender", "MALE"],
      ["Persoane Juridice", "/judicial-persons", "locality", "_none"],
      ["Proprietăți", "/properties", "parcela", "1"],
      ["Acte", "/documents", "pageCount", "0..3"],
    ] as const;
    const clear = page.locator("main [data-clear-filters]");
    for (const [label, path, key, value] of LISTS) {
      await openFromSidebar(page, label);
      await expect(clear).toBeDisabled({ timeout: 30_000 });
      // Right after the sort button: the next item of the toolbar (or of Acte's group).
      expect(await sortButton(page).evaluate((b) => {
        let el: Element = b;
        while (el.parentElement && !el.parentElement.className.includes("flex-wrap") && !el.parentElement.hasAttribute("data-filter-fixed")) el = el.parentElement;
        return !!el.nextElementSibling?.querySelector("[data-clear-filters]") || el.nextElementSibling?.hasAttribute("data-clear-filters") === true;
      }), `${label}: „Șterge filtrele” right after the sort button`).toBe(true);
      await page.goto(`${path}?q=a&sort=changed&order=asc&${key}=${encodeURIComponent(value)}`);
      await expect(clear).toBeEnabled({ timeout: 30_000 });
      await expect(page.locator(`main [data-filter-chip="${key}"]`)).toHaveCount(1);
      await clear.click();
      await expect(page.locator(`main [data-filter-chip="${key}"]`)).toHaveCount(0, { timeout: 30_000 });
      await expect.poll(() => new URL(page.url()).searchParams.has(key), `${label}: the filter gone from the address`).toBe(false);
      const p = new URL(page.url()).searchParams;
      expect([label, p.get("q"), p.get("sort"), p.get("order")]).toEqual([label, "a", "changed", "asc"]);
      await expect(sortButton(page)).toHaveText("Vechi întâi");
      await expect(clear).toBeDisabled();
    }
  });
});
