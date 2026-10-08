/**
 * Case:   TC-VL-08 — Roluri: numele inverse ale unui rol pe o singură linie, despărțite prin virgulă
 * Source: docs/testing/cases/TC-VL-08.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step. The roles carry `TC-E2E-VL-08` (records.ts).
 */

import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_MARKER } from "../helpers/records";

const MARK = `${E2E_MARKER}VL-08`;
const ROLES = "/api/admin/value-lists/person-roles";
const SELLER = `${MARK} Vânzător`;
const SELLER_F = `${MARK} Vânzătoare`;

async function removeRoles(request: APIRequestContext): Promise<void> {
  const res = await request.get(ROLES);
  const items = ((await res.json()) as { items: { id: string; name: string }[] }).items;
  for (const r of items) if (r.name.startsWith(MARK)) await request.delete(`${ROLES}/${r.id}`);
}

/** The converse cell of the row named `name`: its text, its `title`, its height against the name cell's line. */
async function converseOf(page: Page, name: string) {
  return page.evaluate((roleName) => {
    const table = document.querySelector<HTMLElement>("table[data-width-table]")!;
    const heads = [...table.querySelectorAll<HTMLElement>("thead th")];
    const at = heads.findIndex((th) => /^rol invers/i.test(th.innerText.trim()));
    const row = [...table.querySelectorAll<HTMLTableRowElement>("tbody tr")].find((r) => r.cells[0]?.innerText.trim() === roleName)!;
    const td = row.cells[at];
    const cs = getComputedStyle(td);
    return {
      head: heads[at].innerText.split("\n").map((s) => s.trim()),
      text: td.innerText.trim(),
      title: td.title,
      oneLine: cs.whiteSpace === "nowrap" && td.querySelectorAll(".block").length === 0,
      rowHeight: Math.round(row.getBoundingClientRect().height),
    };
  }, name);
}

test.describe("TC-VL-08 — numele inverse pe o singură linie", () => {
  test("trei nume, două nume, antetul pe două rânduri", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 1000 });
    await removeRoles(page.request);
    try {
      for (const data of [
        { name: `${MARK} Trei`, converseName: SELLER, converseNameMale: SELLER, converseNameFemale: SELLER_F },
        { name: `${MARK} Două`, converseName: SELLER, converseNameMale: "", converseNameFemale: SELLER_F },
      ]) {
        const created = await page.request.post(ROLES, { data });
        expect(created.ok(), `POST ${ROLES} failed (${created.status()})`).toBeTruthy();
      }

      // Step 1 — the header's two lines.
      await page.goto("/admin/value-lists?list=person-roles");
      await expect(page.locator("[data-usage]").first()).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("tbody tr").filter({ hasText: `${MARK} Trei` })).toHaveCount(1, { timeout: 30_000 });
      const three = await converseOf(page, `${MARK} Trei`);
      expect(three.head.map((s) => s.toLowerCase())).toEqual(["rol invers", "(bărbat, femeie)"]);

      // Step 2 — three names, one line, the whole text on hover; the row one line tall.
      const whole = `${SELLER}, ${SELLER}, ${SELLER_F}`;
      expect(three.title).toBe(whole);
      expect(whole.startsWith(three.text.replace(/…$/, ""))).toBe(true);
      expect(three.oneLine).toBe(true);
      expect(three.rowHeight).toBeLessThan(56);

      // Step 3 — two names, no empty place between commas.
      const two = await converseOf(page, `${MARK} Două`);
      expect(two.title).toBe(`${SELLER}, ${SELLER_F}`);
      expect(two.oneLine).toBe(true);
    } finally {
      await removeRoles(page.request);
    }
  });
});
