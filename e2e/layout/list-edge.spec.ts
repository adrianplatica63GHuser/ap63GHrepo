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
 *   - Step 10 is its own test, on the archive's rows unsearched (only boxes are read), so that at 1280 × 600 they
 *     overflow the frame and the vertical bar is there.
 *   - Step 9 reads the add button's last icon by its Lucide class (`lucide-user` …) rather than looking in the
 *     sidebar, whose „Domeniu" may be folded; it runs after step 3, the preview open, which moves none of it.
 *   - Step 2's „the table widens" is read on the table, not its frame: the
 *     frame stops at the window and scrolls (step 2's „unless"). Since #40.01
 *     it is the width the table's columns ask for: on Acte the toolbar can be
 *     wider than the columns, and the table then fills the frame it widened.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
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
  { url: "/natural-persons", add: "Adaugă persoană", caption: "Nouă", icon: "lucide-user", search: 160 },
  { url: "/judicial-persons", add: "Adaugă persoană juridică", caption: "Nouă", icon: "lucide-building-2", search: 208 },
  { url: "/properties", add: "Adaugă proprietate", caption: "Nouă", icon: "lucide-map", search: 168 },
  { url: "/documents", add: "Adaugă act", caption: "Nou", icon: "lucide-file-text", search: 120 },
] as const;

/**
 * Step 9 (40.37) — „+ Nouă" / „+ Nou": a +, the word, then the sidebar's „Domeniu" icon for the list (its Lucide
 * class — that it IS the sidebar's is list-add-new.test.ts's domainIcon check); found by the whole „Adaugă …" name;
 * the search box as wide as beside the old button (LIST_SEARCH_REM), ± 1 px.
 */
async function expectNewCaption(page: Page, add: string, caption: string, icon: string, search: number): Promise<void> {
  const main = page.locator("main");
  const button = addOf(page, add);
  await expect(button).toHaveText(caption);
  const icons = await button.evaluate((el) => [...el.querySelectorAll("svg")].map((s) => s.getAttribute("class") ?? ""));
  expect(icons.length).toBe(2);
  expect(icons[0].split(" ")).toContain("lucide-plus");
  expect(icons[1].split(" ")).toContain(icon);
  const box = await main.locator("[data-list-search]").first().boundingBox();
  expect(Math.abs(box!.width - search)).toBeLessThanOrEqual(1);
}

/** A box's right edge, in px. */
async function rightOf(box: Locator): Promise<number> {
  const b = await box.boundingBox();
  if (!b) throw new Error("not on screen");
  return b.x + b.width;
}

/**
 * The width the table's columns ask for, in px — its own `style.width` (`fixedTable`), in rem. Slice #40.01: on Acte the
 * toolbar can be wider than the columns, the frame follows it (#37.84) and the `min-w-full` table fills the frame, so one
 * more column can leave the drawn table as wide as before; what grows is what the columns ask for.
 */
async function columnsWidthOf(table: Locator): Promise<number> {
  return table.evaluate((el) => {
    const w = (el as HTMLElement).style.width;
    const px = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return w.endsWith("rem") ? parseFloat(w) * px : parseFloat(w);
  });
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
  const tableWidth = await columnsWidthOf(table);

  // Step 2 — one more column, then back.
  const label = await firstUnticked(page);
  await setColumn(page, label, true);
  // The table itself widens; its frame only as far as the window allows (then it scrolls). #40.01: read as the width its
  // columns ask for — on Acte the drawn table can already be as wide as the toolbar.
  await expect.poll(async () => columnsWidthOf(table)).toBeGreaterThan(tableWidth + 10);
  await page.waitForTimeout(300);
  await expectAtEdge(page, add);
  await setColumn(page, label, false);
  await expect.poll(async () => Math.round(await columnsWidthOf(table))).toBe(Math.round(tableWidth));
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

/**
 * Step 10 (40.39) — the list's right edge, on the archive's own rows, unsearched: the band ends past „Deschide" by the
 * gap the magnifier keeps from its divider (± 1 px — not on Acte, whose toolbar is wider than its columns and widens
 * the band with the frame); past the band only the scroll bar's kept room (40.14), with the band's grey drawn across it
 * to the frame's border; „+ Nou…" and the row under the table end on that border.
 */
async function rightEdge(page: Page, url: string, add: string, size: { width: number; height: number }): Promise<void> {
  await page.setViewportSize(size);
  await page.goto(url);
  const main = page.locator("main");
  await expect.poll(async () => main.locator("[data-list-frame] tbody tr").count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
  await page.waitForTimeout(500);
  const m = await main.locator("[data-list-frame]").evaluate((el) => {
    const fr = el as HTMLElement;
    const R = (e: Element) => e.getBoundingClientRect();
    const band = fr.querySelector("thead")!;
    const buttons = [...fr.querySelector("tbody tr [data-row-actions]")!.querySelectorAll("a, button")];
    const cs = getComputedStyle(fr);
    const borders = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
    return {
      past: R(band).right - R(buttons[buttons.length - 1]).right,
      lead: R(buttons[0]).left - R(buttons[0].closest("td")!).left,
      beyond: R(fr).right - R(band).right,
      bar: fr.offsetWidth - fr.clientWidth - borders,
      border: parseFloat(cs.borderRightWidth) || 0,
      frame: R(fr).right,
      painted: cs.backgroundImage.startsWith("linear-gradient(") ? parseFloat(fr.style.getPropertyValue("--list-band")) : 0,
      bandHeight: R(band).height,
    };
  });
  if (url !== "/documents") expect(Math.abs(m.past - m.lead)).toBeLessThanOrEqual(1);
  expect(Math.abs(m.beyond - m.bar - m.border)).toBeLessThanOrEqual(1);
  // The bar's room is kept (40.14), and the band's grey is drawn across it, down to the band's height.
  expect(Math.abs(m.painted - m.bandHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs((await rightOf(addOf(page, add))) - m.frame)).toBeLessThanOrEqual(1);
  expect(Math.abs((await rightOf(main.locator("[data-list-edge]").last())) - m.frame)).toBeLessThanOrEqual(1);
}

test.describe("TC-LAYOUT-02 — „Adaugă …” la marginea tabelului", () => {
  test("pasul 10 — banda, rama și „+ Nou” se termină împreună (40.39)", async ({ page }) => {
    test.slow();
    for (const { url, add } of LISTS) {
      for (const size of [{ width: 1920, height: 1080 }, { width: 1280, height: 600 }]) {
        await test.step(`${url} at ${size.width} × ${size.height}`, async () => rightEdge(page, url, add, size));
      }
    }
  });

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
      for (const { url, add, caption, icon, search } of LISTS) {
        for (const width of [1366, 1920]) {
          await test.step(`${url} at ${width}`, async () => {
            const at = await oneList(page, url, add, width);
            if (width === 1920) await expectNewCaption(page, add, caption, icon, search);
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
