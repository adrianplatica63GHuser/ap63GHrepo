/**
 * Case:   TC-TILES-23 — Bara de butoane e ultimul lucru de pe ecran, la orice lățime, pe persoană, act și proprietate
 * Source: docs/testing/cases/TC-TILES-23.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step.
 *
 * Divergences from a hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TILES-23` (records.ts).
 *   - Each reading is polled until it holds: a width change lays the row out again.
 */

import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, createProperty, createSaleContract, removeLeftovers, removeRecord, type RecordKind } from "../helpers/records";

const MARK = `${E2E_MARKER}TILES-23`;
const GAP = 16;

/** The bar's top against the lowest tile on the screen — the left area's and the right column's — and the bar's width against the row's. */
async function reading(page: Page): Promise<{ under: boolean; acrossRow: boolean; tiles: number }> {
  return page.evaluate((gap) => {
    const shown = (e: HTMLElement) => !e.hidden && e.getClientRects().length > 0 && e.getBoundingClientRect().height > 0;
    const row = document.querySelector<HTMLElement>("[data-tile-row]")!.getBoundingClientRect();
    const bar = document.querySelector<HTMLElement>("[data-tile-row] [data-packed-col].order-last")!.getBoundingClientRect();
    const tiles = [
      ...document.querySelectorAll<HTMLElement>("[data-tile-area=left] [data-packed-col]:not(.order-last)"),
      ...document.querySelectorAll<HTMLElement>("[data-tile-area=right] [data-tile-slot] > *"),
    ].filter(shown);
    const lowest = Math.max(...tiles.map((t) => t.getBoundingClientRect().bottom));
    return { under: bar.top >= lowest + gap - 1, acrossRow: Math.abs(bar.width - row.width) <= 1, tiles: tiles.length };
  }, GAP);
}

const screens: { name: string; kind: RecordKind; base: string; entity: string }[] = [
  { name: "persoană fizică", kind: "person", base: "natural-persons", entity: "natural-person" },
  { name: "act", kind: "document", base: "documents", entity: "document" },
  { name: "proprietate", kind: "property", base: "properties", entity: "property" },
];

test.describe("TC-TILES-23 — bara de butoane e ultimul lucru de pe ecran", () => {
  for (const s of screens) {
    test(`${s.name}: la 1920, 1366 și 960 px bara e sub fiecare fișă`, async ({ page }) => {
      test.slow();
      await removeLeftovers(page.request, MARK);
      await page.setViewportSize({ width: 1920, height: 1080 });
      const id =
        s.kind === "person" ? await createNaturalPerson(page.request, { lastName: `${MARK} Unu`, firstName: "Ion" })
        : s.kind === "document" ? await createSaleContract(page.request, `${MARK} Act`)
        : await createProperty(page.request, {
            nickname: `${MARK} Teren`,
            corners: [{ lat: 44.43512, lon: 26.10234 }, { lat: 44.43561, lon: 26.10301 }, { lat: 44.43527, lon: 26.10372 }, { lat: 44.4347, lon: 26.10335 }],
          });
      const forget = () => page.evaluate((e) => {
        for (const k of Object.keys(localStorage)) if (k.startsWith(`ga40-tile-positions-${e}`) || k.startsWith(`ga40-tiles-${e}`)) localStorage.removeItem(k);
      }, s.entity);
      try {
        await page.goto(`/${s.base}/${id}`);
        await forget();
        await page.reload();
        await page.getByRole("button", { name: "Toate", exact: true }).click({ timeout: 30_000 });
        await expect(page.locator("[data-tile-row] [data-packed-col].order-last")).toBeVisible({ timeout: 30_000 });
        for (const width of [1920, 1366, 960]) {
          await page.setViewportSize({ width, height: 1080 });
          await expect.poll(async () => {
            const r = await reading(page);
            return { width, under: r.under, acrossRow: r.acrossRow, some: r.tiles > 2 };
          }, { timeout: 20_000 }).toEqual({ width, under: true, acrossRow: true, some: true });
        }
      } finally {
        await forget().catch(() => undefined);
        await removeRecord(page.request, s.kind, id).catch(() => undefined);
      }
    });
  }
});
