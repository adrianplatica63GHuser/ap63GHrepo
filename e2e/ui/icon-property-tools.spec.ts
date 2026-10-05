/**
 * Case:   TC-ICON-04 — Unghiurile pornite și oprite, un punct adăugat și mutat mai sus, cu pictograme
 * Source: docs/testing/cases/TC-ICON-04.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the button's <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The property carries `TC-E2E-ICON-04` (records.ts): „Poreclă"
 *     `TC-E2E-ICON-04 Teren`, the case's three corners.
 *   - The hand run's pane was hidden (dispatched hover, `click()`); here it is
 *     Playwright's real mouse.
 *   - „Hartă" and „Puncte de contur" are ticked through `showTile`, which waits
 *     out the remembered choice (TC-MAP-01, #37.44) — the case's „the default".
 *   - Slice #37.45's pictures, not steps of the case: the corners manager with
 *     the angles on, the mini-map in drawing mode, the properties map's
 *     toolbar and a document's pages panel („Descoperire AI" left in #37.85), at 1366 and
 *     1920 px, into `playwright-report/icon-property-tools/`. The sidebar's
 *     „Recente" list is painted over.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, createProperty, createSaleContract, removeLeftovers, removeRecord, type RecordKind } from "../helpers/records";
import { showTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}ICON-04`;
const PROPERTY = `${MARK} Teren`;
const DOCUMENT = `${MARK} Act`;
const CORNERS = [
  { lat: 44.37, lon: 25.98 },
  { lat: 44.3702, lon: 25.9806 },
  { lat: 44.3697, lon: 25.9808 },
];
const SHOTS = "playwright-report/icon-property-tools";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before?: () => Promise<void>): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    if (before) await before();
    // `transition-colors`: a button the pointer crossed on its way out is
    // still fading back for 150 ms.
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true, mask: [recent(page)] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

async function moveAway(page: Page): Promise<void> {
  const v = page.viewportSize() ?? { width: 1920, height: 1080 };
  await page.mouse.move(v.width - 10, v.height - 10);
}

async function iconOf(button: Locator): Promise<string> {
  const cls = (await button.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

/** „Filled" is the cta fill of `primary`. */
async function filled(button: Locator): Promise<boolean> {
  return ((await button.getAttribute("class")) ?? "").split(" ").includes("bg-cta");
}

test.describe("TC-ICON-04 — Unghiurile, un punct adăugat și mutat mai sus, cu pictograme", () => {
  test("unghiuri pornite și oprite; un punct adăugat, mutat mai sus, păstrat", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: { kind: RecordKind; id: string }[] = [];
    try {
      const propertyId = await createProperty(page.request, { nickname: PROPERTY, corners: CORNERS });
      made.push({ kind: "property", id: propertyId });

      // Step 1 — three rows with their arrows, the ends inactive; MapPinPlus; „Arată Unghiuri"
      // not pressed, not filled; the mini-map's „HARTĂ" / „SATELIT" in words.
      await page.goto(`/properties/${propertyId}`);
      await expect(page.getByRole("heading", { name: PROPERTY })).toBeVisible({ timeout: 30_000 });
      const corners = await showTile(page, "Puncte de contur");
      const map = await showTile(page, "Hartă");
      const rows = corners.locator("tbody tr");
      await expect(rows).toHaveCount(3, { timeout: 30_000 });
      const ups = corners.getByRole("button", { name: "Mută mai sus", exact: true });
      const downs = corners.getByRole("button", { name: "Mută mai jos", exact: true });
      await expect(ups).toHaveCount(3);
      await expect(downs).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        expect(await iconOf(ups.nth(i))).toBe("lucide-arrow-up");
        expect(await iconOf(downs.nth(i))).toBe("lucide-arrow-down");
      }
      await expect(ups.first()).toBeDisabled();
      await expect(downs.last()).toBeDisabled();
      const add = corners.getByRole("button", { name: "+ Adaugă punct", exact: true });
      expect(await iconOf(add)).toBe("lucide-map-pin-plus");
      const showAngles = page.getByRole("button", { name: "Arată Unghiuri", exact: true });
      expect(await iconOf(showAngles)).toBe("lucide-drafting-compass");
      await expect(showAngles).toHaveAttribute("aria-pressed", "false");
      expect(await filled(showAngles)).toBe(false);
      await expect(map.getByRole("button", { name: "HARTĂ", exact: true })).toHaveText("HARTĂ", { timeout: 30_000 });
      await expect(map.getByRole("button", { name: "SATELIT", exact: true })).toHaveText("SATELIT");

      // Step 2 — „Arată Unghiuri": now „Ascunde Unghiuri", pressed, filled, its tooltip the new name.
      await showAngles.click();
      const hideAngles = page.getByRole("button", { name: "Ascunde Unghiuri", exact: true });
      await expect(hideAngles).toHaveAttribute("aria-pressed", "true");
      expect(await iconOf(hideAngles)).toBe("lucide-drafting-compass");
      expect(await filled(hideAngles)).toBe(true);
      // The press closed the tooltip and the pointer never left, so leave and come back.
      await moveAway(page);
      await hideAngles.hover();
      await expect(page.getByRole("tooltip")).toHaveText("Ascunde Unghiuri");
      await photograph(page, "corners-toggles", async () => {
        await hideAngles.scrollIntoViewIfNeeded();
        await moveAway(page);
      });

      // Step 3 — „Ascunde Unghiuri": „Arată Unghiuri" again, not pressed, not filled.
      await hideAngles.click();
      await expect(showAngles).toHaveAttribute("aria-pressed", "false");
      expect(await filled(showAngles)).toBe(false);

      // Step 4 — „+ Adaugă punct", Nord (m) 319340.00, Est (m) 578240.00, the row's „Salvează": a fourth row.
      await add.click();
      await corners.getByLabel("Nord (m)", { exact: true }).fill("319340.00");
      await corners.getByLabel("Est (m)", { exact: true }).fill("578240.00");
      await corners.locator("tbody").getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(rows).toHaveCount(4);
      await expect(rows.nth(3)).toContainText("319340.00");
      await expect(rows.nth(3)).toContainText("578240.00");
      await expect(ups.nth(3)).toBeEnabled();

      // Step 5 — the fourth row's „Mută mai sus": the new point is row 3.
      await ups.nth(3).click();
      await expect(rows.nth(2)).toContainText("319340.00");
      await expect(rows.nth(3)).toContainText("319355.12");

      // Step 6 — the floppy disk: „v 1", „2 versiuni", the order kept.
      await page.locator('[data-tile-area="left"]').getByRole("button", { name: "Salvează", exact: true }).last().click(); // #37.56: the form's, not a corner row's
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("v 1", { exact: true }).first()).toBeAttached();
      await expect(rows.nth(2)).toContainText("319340.00");
      await expect(rows.nth(3)).toContainText("319355.12");

      // Picture (#37.45), not a step: the mini-map in drawing mode (PenTool → Check).
      const draw = map.getByRole("button", { name: "Desenează", exact: true });
      await expect(draw).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(draw)).toBe("lucide-pen-tool");
      await draw.click();
      const done = map.getByRole("button", { name: "Gata", exact: true });
      expect(await iconOf(done)).toBe("lucide-check");
      await photograph(page, "mini-map-drawing", async () => {
        await done.scrollIntoViewIfNeeded();
        await moveAway(page);
      });
      await done.click();

      // Picture (#37.45), not a step: the properties map's toolbar.
      await page.goto("/properties/map");
      await expect(page.locator("[data-property-map]")).toHaveAttribute("data-map-zoom", /\d/, { timeout: 30_000 });
      const toolbar = page.locator("[data-map-ui]");
      for (const [name, icon] of [["Unghiuri", "lucide-drafting-compass"], ["Riglă", "lucide-ruler"], ["Grupuri", "lucide-group"], ["Selectează", "lucide-square-dashed-mouse-pointer"]] as const) {
        expect(await iconOf(toolbar.getByRole("button", { name, exact: true }))).toBe(icon);
      }
      await photograph(page, "properties-map-toolbar", () => moveAway(page));

      // Picture (#37.45), not a step: a document's pages panel. („Descoperire AI"
      // and its picture left with the button, Slice #37.85.)
      const documentId = await createSaleContract(page.request, DOCUMENT);
      made.push({ kind: "document", id: documentId });
      await page.goto(`/documents/${documentId}`);
      const addPage = page.getByRole("button", { name: "+ Adaugă pagină", exact: true });
      await expect(addPage).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(addPage)).toBe("lucide-file-plus");
      // The pages panel and the sidebar's menus load after the form.
      await expect(page.getByText("Se încarcă…")).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText("Autentificat ca", { exact: false })).toBeVisible({ timeout: 30_000 });
      await photograph(page, "document-pages", async () => {
        await addPage.scrollIntoViewIfNeeded();
        await moveAway(page);
      });
    } finally {
      for (const { kind, id } of made) await removeRecord(page.request, kind, id);
    }
  });
});
