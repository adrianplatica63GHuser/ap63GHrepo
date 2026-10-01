/**
 * Case:   TC-ICON-06 — Importul, până la „Restricții": „Verifică din nou" și „Continuă" cu pictogramele lângă cuvinte
 * Source: docs/testing/cases/TC-ICON-06.md, „Last green" 2026-10-01
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim; an icon is read as the case reads it, the Lucide
 * class on the button's <svg>, and its place — before or after the words — as
 * the button's first or last child.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The folder is the case's own, made the case's way: in the browser's
 *     private storage, with `window.showDirectoryPicker` answering it. The
 *     catalogue's „A file into a page, without the dialog" names a scripted
 *     stand-in for the handle; this is not one — the browser's own storage
 *     hands out a real `FileSystemDirectoryHandle`, so nothing is faked but
 *     the dialog.
 *   - The hand run's pane was hidden (`click()`); here it is Playwright's
 *     real mouse.
 *   - Slice #37.47's pictures, not steps of the case: „Precondiții" with both
 *     buttons, „Structură" with its result, and — in a second test, signed out
 *     — the sign-in and request-access pages, at 1366 and 1920 px, into
 *     `playwright-report/icon-import/`. The sidebar's „Recente" list is painted
 *     over.
 */

import { test, expect, type Locator, type Page } from "@playwright/test";

const FOLDER = "TC-ICON-06";
const PROPERTY_FOLDER = "40-212per40IE99906-TC-ICON-06 Teren";
const COORD_FILE = "coord TC-ICON-06.txt";
const CORNERS = "16\t318693.706\t573578.558\n17\t318675.770\t573554.698\n18\t318659.521\t573567.196\n19\t318677.456\t573591.056\n";
const SHOTS = "playwright-report/icon-import";

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

/** The Lucide icons in a control, and whether the first sits before the words or after them. */
async function iconsOf(control: Locator): Promise<{ icons: string[]; place: "before" | "after" | "none" }> {
  return control.evaluate((el) => {
    const icons = [...el.querySelectorAll("svg")].map(
      (s) => (s.getAttribute("class") ?? "").split(" ").find((c) => c.startsWith("lucide-") && c !== "lucide") ?? "",
    );
    const first = el.firstElementChild?.tagName.toLowerCase();
    const last = el.lastElementChild?.tagName.toLowerCase();
    const place = icons.length === 0 ? "none" : first === "svg" ? "before" : last === "svg" ? "after" : "none";
    return { icons, place } as { icons: string[]; place: "before" | "after" | "none" };
  });
}

async function makeFolder(page: Page): Promise<void> {
  await page.evaluate(
    async ({ folder, propertyFolder, coordFile, corners }) => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(folder, { recursive: true }).catch(() => undefined);
      const top = await root.getDirectoryHandle(folder, { create: true });
      const property = await top.getDirectoryHandle(propertyFolder, { create: true });
      const file = await property.getFileHandle(coordFile, { create: true });
      const w = await file.createWritable();
      await w.write(corners);
      await w.close();
      (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => top;
    },
    { folder: FOLDER, propertyFolder: PROPERTY_FOLDER, coordFile: COORD_FILE, corners: CORNERS },
  );
}

async function removeFolder(page: Page): Promise<void> {
  await page
    .evaluate(async (folder) => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(folder, { recursive: true }).catch(() => undefined);
    }, FOLDER)
    .catch(() => undefined);
}

test.describe("TC-ICON-06 — „Verifică din nou” și „Continuă” cu pictogramele lângă cuvinte", () => {
  test("până la „Restricții”, apoi „Renunță la import”", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1920, height: 1080 });
    const step = page.getByText(/^Pasul curent: /).first();
    try {
      // Step 1 — „Informare": „Renunță la import" stop circle before; „Am înțeles" words only.
      await page.goto("/admin/import");
      await expect(step).toHaveText("Pasul curent: Informare", { timeout: 30_000 });
      await makeFolder(page);
      const cancel = page.getByRole("button", { name: "Renunță la import", exact: true });
      expect(await iconsOf(cancel)).toEqual({ icons: ["lucide-circle-stop"], place: "before" });
      const understood = page.getByRole("button", { name: "Am înțeles", exact: true });
      expect(await iconsOf(understood)).toEqual({ icons: [], place: "none" });

      // Step 2 — „Precondiții": „Verifică din nou" refresh before, „Continuă la pasul „Structură”" arrow after.
      await understood.click();
      await expect(step).toHaveText("Pasul curent: Precondiții", { timeout: 30_000 });
      const toStructure = page.getByRole("button", { name: "Continuă la pasul „Structură”", exact: true });
      await expect(toStructure).toBeVisible({ timeout: 30_000 });
      const recheck = page.getByRole("button", { name: "Verifică din nou", exact: true });
      expect(await iconsOf(recheck)).toEqual({ icons: ["lucide-refresh-cw"], place: "before" });
      expect(await iconsOf(toStructure)).toEqual({ icons: ["lucide-arrow-right"], place: "after" });
      await photograph(page, "preconditions", async () => {
        await toStructure.scrollIntoViewIfNeeded();
        await moveAway(page);
      });

      // Step 3 — „Structură": chevron up, file down, „Alege folderul…" open folder, inactive.
      await toStructure.click();
      await expect(step).toHaveText("Pasul curent: Structură", { timeout: 30_000 });
      expect(await iconsOf(page.getByRole("button", { name: "Ascunde regulile", exact: true }))).toEqual({
        icons: ["lucide-chevron-up"],
        place: "before",
      });
      expect(await iconsOf(page.getByRole("button", { name: "Salvează regulile ca pagină", exact: true }))).toEqual({
        icons: ["lucide-file-down"],
        place: "before",
      });
      const pick = page.getByRole("button", { name: "Alege folderul…", exact: true });
      expect(await iconsOf(pick)).toEqual({ icons: ["lucide-folder-open"], place: "before" });
      await expect(pick).toBeDisabled();

      // Step 4 — the tick, „Alege folderul…" (the script answers): in regulă, „Continuă la pasul „Restricții”" arrow after.
      await page.getByRole("checkbox", { name: "Respect regulile de structură", exact: true }).check();
      await pick.click();
      await expect(page.getByText("Structura folderului este în regulă.").first()).toBeVisible({ timeout: 30_000 });
      const toConstraints = page.getByRole("button", { name: "Continuă la pasul „Restricții”", exact: true });
      expect(await iconsOf(toConstraints)).toEqual({ icons: ["lucide-arrow-right"], place: "after" });
      await photograph(page, "structure", async () => {
        await toConstraints.scrollIntoViewIfNeeded();
        await moveAway(page);
      });

      // Step 5 — „Restricții": „Verifică fișierele" refresh before, inactive.
      await toConstraints.click();
      await expect(step).toHaveText("Pasul curent: Restricții", { timeout: 30_000 });
      const checkFiles = page.getByRole("button", { name: "Verifică fișierele", exact: true });
      expect(await iconsOf(checkFiles)).toEqual({ icons: ["lucide-refresh-cw"], place: "before" });
      await expect(checkFiles).toBeDisabled();

      // Step 6 — „Renunță la import", „Da, renunț la import": the question in words; „Informare" again.
      await cancel.click();
      const question = page.getByRole("dialog").or(page.getByRole("alertdialog")).filter({ hasText: "Renunțați la import?" });
      await expect(question).toBeVisible();
      for (const answer of ["Nu, continui importul", "Da, renunț la import"]) {
        expect(await iconsOf(question.getByRole("button", { name: answer, exact: true }))).toEqual({ icons: [], place: "none" });
      }
      await question.getByRole("button", { name: "Da, renunț la import", exact: true }).click();
      await expect(step).toHaveText("Pasul curent: Informare", { timeout: 30_000 });
    } finally {
      await removeFolder(page);
    }
  });
});

test.describe("Slice #37.47's pictures — the sign-in pages, signed out", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("„Solicită acces” and „Conectare” with their icons before the words", async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/login");
    const request = page.getByRole("link", { name: "Solicită acces", exact: true });
    await expect(request).toBeVisible({ timeout: 30_000 });
    expect(await iconsOf(request)).toEqual({ icons: ["lucide-user-plus"], place: "before" });
    await photograph(page, "login", () => moveAway(page));

    await request.click();
    await expect(page).toHaveURL(/\/signup$/, { timeout: 30_000 });
    const signIn = page.getByRole("link", { name: "Conectare", exact: true });
    await expect(signIn).toBeVisible({ timeout: 30_000 });
    expect(await iconsOf(signIn)).toEqual({ icons: ["lucide-log-in"], place: "before" });
    await photograph(page, "signup", () => moveAway(page));
  });
});
