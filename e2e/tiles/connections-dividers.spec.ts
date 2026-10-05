/**
 * Case:   TC-TILES-17 — „Conexiuni": o linie între fiecare două grupuri, ca în „Clasificări"
 * Source: docs/testing/cases/TC-TILES-17.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-17` (records.ts).
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}TILES-17`;
const GROUPS = ["Etichete / Cuvinte cheie", "Grupuri", "Ștampile", "Vezi și"];

async function check(page: Page, url: string) {
  await page.goto(url);
  const conn = await showTile(page, "Conexiuni");
  const cls = await showTile(page, "Clasificări");
  await expect(conn.locator("[data-connections-groups] > [data-divider]")).toHaveCount(3, { timeout: 30_000 });
  await expect(cls.locator('[data-divider="horizontal"]').first()).toBeVisible();
  const ref = await cls.locator('[data-divider="horizontal"]').first().evaluate((d) => {
    const cs = getComputedStyle(d);
    return `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`;
  });
  const read = await conn.evaluate((tile, refLook) => {
    const tb = tile.getBoundingClientRect();
    const kids = [...tile.querySelector("[data-connections-groups]")!.children] as HTMLElement[];
    return {
      seq: kids.map((k) => (k.dataset.divider ? "line" : (k.querySelector("h3")?.textContent ?? "?").trim())),
      lines: kids
        .map((k, i) => ({ k, i }))
        .filter(({ k }) => k.dataset.divider)
        .map(({ k, i }) => {
          const r = k.getBoundingClientRect();
          const cs = getComputedStyle(k);
          const above = r.top - kids[i - 1].getBoundingClientRect().bottom;
          const below = kids[i + 1].getBoundingClientRect().top - r.bottom;
          return {
            inside: r.left - tb.left >= 12 && tb.right - r.right >= 12,
            even: Math.abs(above - below) <= 1,
            same: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}` === refLook,
          };
        }),
    };
  }, ref);
  expect(read.seq).toEqual([GROUPS[0], "line", GROUPS[1], "line", GROUPS[2], "line", GROUPS[3]]);
  for (const l of read.lines) expect(l).toEqual({ inside: true, even: true, same: true });
}

test.describe("TC-TILES-17 — „Conexiuni”: linii între grupuri", () => {
  test("pe persoană și pe act: trei linii, ca în „Clasificări”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1200 });
    const person = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" });
    const doc = await createSaleContract(page.request, `${MARK} Act`);
    try {
      // Step 1 — the person.
      await check(page, `/natural-persons/${person}`);
      // Step 2 — the document.
      await check(page, `/documents/${doc}`);
    } finally {
      await removeRecord(page.request, "document", doc);
      await removeRecord(page.request, "person", person);
    }
  });
});
