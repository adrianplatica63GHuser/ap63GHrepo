/**
 * Case:   TC-ICON-05 — O etichetă redenumită cu creionul, două fuzionate, o ștampilă aplicată, cu pictograme
 * Source: docs/testing/cases/TC-ICON-05.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the button's <svg>.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-ICON-05` (records.ts): the property
 *     `TC-E2E-ICON-05 Teren`, the tags `tc-e2e-icon-05-a` / `-b` / `-c`, the
 *     stamp `TC-E2E-ICON-05 Ștampilă`. The tags are posted to the property's
 *     metadata here — records.ts has no helper for them, and they are only
 *     this case's.
 *   - The hand run's pane was hidden (dispatched hover, `click()`); here it is
 *     Playwright's real mouse.
 *   - Slice #37.46's pictures, not steps of the case: „Etichete" with `-a`
 *     chosen (#38.14; every other tag's chip painted over), the stamp's screen after „Aplică ștampila (1)", „Tipuri de
 *     Document"'s modal, „Calcul" and „Distilare Tipizate", at 1366 and 1920
 *     px, into `playwright-report/icon-admin/`. The sidebar's „Recente" list is
 *     painted over.
 */

import { test, expect, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord, removeStampLeftovers } from "../helpers/records";

const MARK = `${E2E_MARKER}ICON-05`;
const PROPERTY = `${MARK} Teren`;
const STAMP = `${MARK} Ștampilă`;
const TAG = (s: string) => `${MARK.toLowerCase()}-${s}`;
const SHOTS = "playwright-report/icon-admin";

const recent = (page: Page) =>
  page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) });

async function photograph(page: Page, name: string, before?: () => Promise<void>, extraMask: Locator[] = []): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 1080 });
    if (before) await before();
    // `transition-colors`: a button the pointer crossed on its way out is
    // still fading back for 150 ms.
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SHOTS}/${name}-${width}.png`, fullPage: true, mask: [recent(page), ...extraMask] });
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
}

async function moveAway(page: Page): Promise<void> {
  const v = page.viewportSize() ?? { width: 1920, height: 1080 };
  await page.mouse.move(v.width - 10, v.height - 10);
}

async function iconOf(control: Locator): Promise<string> {
  const cls = (await control.locator("svg").first().getAttribute("class")) ?? "";
  return cls.split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "";
}

async function postOk(request: APIRequestContext, url: string, data: unknown): Promise<Record<string, unknown>> {
  const res = await request.post(url, { data });
  expect(res.ok(), `POST ${url} failed (${res.status()})`).toBeTruthy();
  return (await res.json()) as Record<string, unknown>;
}

test.describe("TC-ICON-05 — redenumită, fuzionată, ștampilată, cu pictograme", () => {
  test("o etichetă redenumită, două fuzionate, o ștampilă aplicată", async ({ page }) => {
    test.slow();
    await removeStampLeftovers(page.request, MARK);
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    let propertyId: string | undefined;
    let principalObjectId: string | undefined;
    try {
      const created = (await postOk(page.request, "/api/properties", { nickname: PROPERTY, provenance: "MANUAL" })).property as {
        id: string;
        principalObjectId: string;
      };
      propertyId = created.id;
      principalObjectId = created.principalObjectId;
      for (const s of ["a", "b"]) await postOk(page.request, `/api/metadata/${principalObjectId}/tags`, { tag: TAG(s) });
      await postOk(page.request, "/api/stamps", { shortDescription: STAMP });

      // #38.14: the cloud alone — a chip is chosen by a double click.
      const chip = (tag: string) => page.locator(`[data-tag-chip="${tag}"]`);
      const rename = page.getByRole("button", { name: "Redenumește etichetă", exact: true });
      const openMerge = page.getByRole("button", { name: "Fuzionează etichete", exact: true });

      // Step 1 — „Etichete": the two chips, each used once; „Redenumește etichetă" the pencil-line
      // and the words, „Fuzionează etichete" the merge icon and the words, both inactive.
      await page.goto("/admin/tags");
      await expect(page.getByRole("heading", { name: "Etichete", exact: true })).toBeVisible({ timeout: 30_000 });
      for (const s of ["a", "b"]) await expect(chip(TAG(s))).toHaveText(`${TAG(s)}×1`, { timeout: 30_000 });
      await expect(rename).toHaveText("Redenumește etichetă");
      expect(await iconOf(rename)).toBe("lucide-pencil-line");
      await expect(openMerge).toHaveText("Fuzionează etichete");
      expect(await iconOf(openMerge)).toBe("lucide-merge");
      await expect(rename).toBeDisabled();
      await expect(openMerge).toBeDisabled();

      // Step 2 — `-a` double-clicked: pressed; „Redenumește etichetă" active.
      await chip(TAG("a")).dblclick();
      await expect(chip(TAG("a"))).toHaveAttribute("aria-pressed", "true");
      await expect(rename).toBeEnabled();
      await expect(openMerge).toBeDisabled();
      // Every other tag is somebody's data: the cloud's other chips are painted over.
      await photograph(page, "tag-manager", () => moveAway(page), [page.locator("[data-tag-chip]").filter({ hasNotText: MARK.toLowerCase() })]);

      // Step 3 — renamed in the chip to `-c`, Enter: chips `-b` and `-c`.
      await rename.click();
      const box = page.getByRole("textbox", { name: `Noul nume pentru „${TAG("a")}”`, exact: true });
      await box.fill(TAG("c"));
      await box.press("Enter");
      await expect(chip(TAG("c"))).toHaveText(`${TAG("c")}×1`, { timeout: 15_000 });
      await expect(chip(TAG("a"))).toHaveCount(0);
      await expect(chip(TAG("b"))).toHaveCount(1);
      await expect(page.locator('[data-tag-chip][aria-pressed="true"]')).toHaveCount(0);

      // Step 4 — `-b` and `-c` double-clicked, „Fuzionează etichete": both ticked, `-c` kept: the sentence, „Fuzionează" active.
      await chip(TAG("b")).dblclick();
      await chip(TAG("c")).dblclick();
      await expect(openMerge).toBeEnabled();
      await expect(rename).toBeDisabled();
      await openMerge.click();
      const merge = page.getByRole("dialog");
      for (const s of ["b", "c"]) {
        await expect(merge.locator("label").filter({ hasText: TAG(s) }).getByRole("checkbox").first()).toBeChecked();
      }
      await merge.locator(`input[type="radio"][value="${TAG("c")}"]`).check();
      await expect(merge.getByText(`Etichetele „${TAG("b")}” vor deveni „${TAG("c")}”.`)).toBeVisible();
      const doMerge = merge.getByRole("button", { name: "Fuzionează", exact: true });
      await expect(doMerge).toHaveText("Fuzionează");
      expect(await iconOf(doMerge)).toBe("lucide-merge");
      await expect(doMerge).toBeEnabled();

      // Step 5 — „Fuzionează": one chip, `-c`, used once.
      await doMerge.click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
      await expect(chip(TAG("b"))).toHaveCount(0, { timeout: 15_000 });
      await expect(chip(TAG("c"))).toHaveText(`${TAG("c")}×1`);

      // Step 6 — „Ștampile": the plus, the stamp's row at 0, „Aplică" the stamp icon and the word.
      await page.goto("/admin/stamps");
      await expect(page.getByRole("heading", { name: "Ștampile", exact: true })).toBeVisible({ timeout: 30_000 });
      const create = page.getByRole("button", { name: "+ Creare ștampilă", exact: true });
      expect(await iconOf(create)).toBe("lucide-plus");
      await expect(create).toHaveText("");
      const stampRow = page.locator("tbody tr").filter({ hasText: STAMP });
      await expect(stampRow).toHaveCount(1, { timeout: 30_000 });
      await expect(stampRow.locator("td").nth(1)).toHaveText("0");
      const apply = stampRow.getByRole("link", { name: "Aplică", exact: true });
      await expect(apply).toHaveText("Aplică");
      expect(await iconOf(apply)).toBe("lucide-stamp");

      // Step 7 — „Aplică", „Proprietate", the search: one element; (0) buttons inactive.
      await expect(async () => {
        await apply.click({ timeout: 5_000 });
        await expect(page).toHaveURL(/\/admin\/stamps\/[0-9a-f-]+$/, { timeout: 15_000 });
      }).toPass({ timeout: 90_000 });
      await page.locator("main select").selectOption({ label: "Proprietate" });
      await page.getByRole("searchbox", { name: "Caută în elementele disponibile" }).fill(MARK);
      const item = page.getByRole("checkbox", { name: PROPERTY });
      await expect(item).toHaveCount(1, { timeout: 15_000 });
      const apply0 = page.getByRole("button", { name: "Aplică ștampila (0)", exact: true });
      const remove0 = page.getByRole("button", { name: "Elimină ștampila (0)", exact: true });
      expect(await iconOf(apply0)).toBe("lucide-stamp");
      expect(await iconOf(remove0)).toBe("lucide-eraser");
      await expect(apply0).toBeDisabled();
      await expect(remove0).toBeDisabled();

      // Step 8 — ticked, „Aplică ștampila (1)": it moves across, „Modificări nesalvate".
      await item.check();
      await page.getByRole("button", { name: "Aplică ștampila (1)", exact: true }).click();
      await expect(page.getByText("Modificări nesalvate")).toBeVisible();
      await expect(page.getByText("Niciun element ștampilat încă")).toHaveCount(0);
      await photograph(page, "stamp-applicator", () => moveAway(page));

      // Step 9 — the floppy disk: the banner goes; „Elemente" 1.
      await page.getByRole("button", { name: "Salvează ștampilele", exact: true }).click();
      await expect(page.getByText("Modificări nesalvate")).toHaveCount(0, { timeout: 15_000 });
      await page.goto("/admin/stamps");
      await expect(page.locator("tbody tr").filter({ hasText: STAMP }).locator("td").nth(1)).toHaveText("1", { timeout: 30_000 });

      // Pictures (#37.46), not steps: „Tipuri de Document"'s modal, „Calcul", „Distilare Tipizate".
      await page.goto("/admin/value-lists");
      await page.getByRole("button", { name: "Tipuri de Document", exact: true }).click();
      // Slice #38.36: „Roluri pe Document" is gone from this toolbar — a role's types are in its own panel.
      const form = page.getByRole("button", { name: /^Formular \(\d+\)$/ }).first();
      await expect(form).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(form)).toBe("lucide-clipboard-list");
      await photograph(page, "value-list-modal", () => moveAway(page));

      await page.goto("/admin/calculation");
      const history = page.getByRole("link", { name: "Istoricul calculelor", exact: true });
      await expect(history).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(history)).toBe("lucide-history");
      await photograph(page, "calculation", () => moveAway(page));

      await page.goto("/admin/doc-type-engine");
      const pick = page.getByRole("button", { name: "Alege folderul cu mostre…", exact: true });
      await expect(pick).toBeVisible({ timeout: 30_000 });
      expect(await iconOf(pick)).toBe("lucide-folder-open");
      expect(await iconOf(page.getByRole("button", { name: "Începe citirea", exact: true }))).toBe("lucide-play");
      await photograph(page, "doc-type-engine", () => moveAway(page));
    } finally {
      await removeStampLeftovers(page.request, MARK);
      if (principalObjectId) {
        for (const s of ["a", "b", "c"]) {
          await page.request.delete(`/api/metadata/${principalObjectId}/tags`, { data: { tag: TAG(s) } });
        }
      }
      if (propertyId) await removeRecord(page.request, "property", propertyId);
    }
  });
});
