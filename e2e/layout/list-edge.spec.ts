/**
 * Case:   TC-LAYOUT-02 — Listele: „Adaugă …" se termină la marginea tabelului, nu a ferestrei
 * Source: docs/testing/cases/TC-LAYOUT-02.md, „Last green" 2026-10-04
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-LAYOUT-02` (records.ts), and the list is
 *     searched for it, so the rows are the case's own.
 *   - Step 2 ticks the first column „Câmpuri afișate" leaves unticked, then
 *     unticks it — whichever list's defaults the browser starts with.
 *   - Step 8 opens `/documents?documentTypeIds=` — the address the „Tip
 *     document" list writes when „Toate tipurile" is unticked — instead of
 *     unticking it in the open list.
 *   - Step 2's „the table widens" is read on the table, not its frame: the
 *     frame stops at the window and scrolls (step 2's „unless").
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  E2E_MARKER,
  createCompany,
  createDocumentOfType,
  createNaturalPerson,
  createProperty,
  removeLeftovers,
  removeRecord,
  type RecordKind,
} from "../helpers/records";

const MARK = `${E2E_MARKER}LAYOUT-02`;

const LISTS = [
  { url: "/natural-persons", add: "Adaugă persoană" },
  { url: "/judicial-persons", add: "Adaugă persoană juridică" },
  { url: "/properties", add: "Adaugă proprietate" },
  { url: "/documents", add: "Adaugă act" },
] as const;

/** A box's right edge, in px. */
async function rightOf(box: Locator): Promise<number> {
  const b = await box.boundingBox();
  if (!b) throw new Error("not on screen");
  return b.x + b.width;
}

/** A box's width, in px. */
async function widthOf(box: Locator): Promise<number> {
  const b = await box.boundingBox();
  if (!b) throw new Error("not on screen");
  return b.width;
}

function addOf(page: Page, name: string): Locator {
  const main = page.locator("main");
  return main.getByRole("link", { name, exact: true }).or(main.getByRole("button", { name, exact: true })).first();
}

/** „Adaugă …" and the row under the table end at the table frame's right edge (±1 px). */
async function expectAtEdge(page: Page, add: string): Promise<number> {
  const main = page.locator("main");
  const frame = main.locator("[data-list-previews] > [data-list-edge]");
  const under = main.locator("[data-list-edge]").last();
  const edge = await rightOf(frame);
  expect(Math.abs((await rightOf(addOf(page, add))) - edge)).toBeLessThanOrEqual(1);
  expect(Math.abs((await rightOf(under)) - edge)).toBeLessThanOrEqual(1);
  return edge;
}

/** Ticks or unticks `label` in „Câmpuri afișate", then presses outside. */
async function setColumn(page: Page, label: string, on: boolean): Promise<void> {
  const main = page.locator("main");
  await main.getByRole("button", { name: /^Câmpuri afișate/ }).click();
  const box = main.locator("[data-field-chooser]").getByRole("checkbox", { name: label, exact: true });
  await (on ? box.check() : box.uncheck());
  await page.getByRole("heading", { level: 1 }).first().click();
}

/** The first column „Câmpuri afișate" leaves unticked, by its label. */
async function firstUnticked(page: Page): Promise<string> {
  const main = page.locator("main");
  await main.getByRole("button", { name: /^Câmpuri afișate/ }).click();
  const label = await main.locator("[data-field-chooser]").evaluate((el) => {
    const box = [...el.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')].find((b) => !b.checked);
    return box ? (box.closest("label")?.textContent ?? "").trim() : "";
  });
  await page.getByRole("heading", { level: 1 }).first().click();
  expect(label).not.toBe("");
  return label;
}

async function oneList(page: Page, url: string, add: string, width: number): Promise<number> {
  await page.setViewportSize({ width, height: 900 });
  // Step 1 — the group and the row under the table end at the edge.
  await page.goto(url);
  const main = page.locator("main");
  const search = main.locator('input[placeholder^="caută"]').first();
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill(MARK);
  await expect(main.locator("tbody tr").filter({ hasText: MARK })).toHaveCount(1, { timeout: 30_000 });
  await page.waitForTimeout(300);
  await expectAtEdge(page, add);
  const table = main.locator("[data-list-previews] table").first();
  const tableWidth = await widthOf(table);

  // Step 2 — one more column, then back.
  const label = await firstUnticked(page);
  await setColumn(page, label, true);
  // The table itself widens; its frame only as far as the window allows (then it scrolls).
  await expect.poll(async () => widthOf(table)).toBeGreaterThan(tableWidth + 10);
  await page.waitForTimeout(300);
  await expectAtEdge(page, add);
  await setColumn(page, label, false);
  await expect.poll(async () => Math.round(await widthOf(table))).toBe(Math.round(tableWidth));
  await page.waitForTimeout(300);
  await expectAtEdge(page, add);

  // Step 3 — a preview opens beside the table; the group does not move.
  const before = await rightOf(addOf(page, add));
  await main.locator("tbody tr").filter({ hasText: MARK }).getByRole("button", { name: "Previzualizare", exact: true }).click();
  await expect(page.locator("[data-preview]").getByRole("link", { name: "Deschide", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(300);
  expect(Math.abs((await rightOf(addOf(page, add))) - before)).toBeLessThanOrEqual(0.5);
  return before;
}

test.describe("TC-LAYOUT-02 — „Adaugă …” la marginea tabelului", () => {
  test("pe cele patru liste, la 1366 și 1920 px", async ({ page }) => {
    test.slow();
    test.setTimeout(360_000);
    await removeLeftovers(page.request, MARK);
    const made: [RecordKind, string][] = [];
    try {
      made.push(["person", await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ion" })]);
      made.push(["company", await createCompany(page.request, { name: `${MARK} Firmă SRL` })]);
      made.push(["property", await createProperty(page.request, { nickname: `${MARK} Proprietate` })]);
      made.push(["document", await createDocumentOfType(page.request, "ADEVERINTA", `${MARK} Act`)]);

      // Steps 1–7 — each list, at 1366 and at 1920 px.
      for (const { url, add } of LISTS) {
        for (const width of [1366, 1920]) {
          await test.step(`${url} at ${width}`, async () => {
            const at = await oneList(page, url, add, width);
            // Step 8 — „Acte" with no type: the group stands where it stood.
            if (url === "/documents") {
              await page.goto("/documents?documentTypeIds=");
              await expect(page.locator("main").getByText("Selectați cel puțin un tip de document")).toBeVisible({ timeout: 30_000 });
              await page.waitForTimeout(300);
              expect(Math.abs((await rightOf(addOf(page, add))) - at)).toBeLessThanOrEqual(1);
            }
          });
        }
      }
    } finally {
      for (const [kind, id] of made) await removeRecord(page.request, kind, id);
    }
  });
});
