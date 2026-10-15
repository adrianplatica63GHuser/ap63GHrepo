/**
 * Case:   TC-HELP-01 — Text de ajutor scris pentru un ecran și citit în spatele „?”
 * Source: docs/testing/cases/TC-HELP-01.md, „Last green" 2026-09-26
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * ⚠️ **HELP IS SHARED STATE — EVERY USER READS IT — AND IT IS GIVEN BACK BYTE
 * FOR BYTE.** The spec reads all four stored fields of „Administrare —
 * Etichete" before it touches anything, puts the text back through the screen
 * as the case does, and then — in a `finally`, so also when an assertion
 * failed first — writes all four back through the PUT the screen's „Salvează"
 * sends and asserts that what is stored equals what was read (`readHelp`,
 * `writeHelp`, e2e/helpers/records.ts). The row's `updated_at` moves; the text
 * does not, which is exactly what the case file says.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The four text areas' labels are not tied to them, so „Cum se folosește
 *     (Română)" is found as the fourth text area, in the order the labels are
 *     shown. Not changed here.
 *   - The sentence written is `TC-E2E-HELP-01 — text de ajutor scris de cazul
 *     de test.` — the case's, with the TC-E2E- marker every spec write carries.
 *   - Step 3's „notes the text" reads the stored field before anything is written; since Slice #39.40 the spec
 *     no longer pins it to the case file's sentence, because the text is Adrian's and the screen now offers him
 *     a proposal to replace it. What the spec proves is unchanged: the text read is the text put back.
 *
 * Slice #39.40 adds step 7 — the panel's „Vezi în manual” opens the manual at the screen's section — and a
 * second test, steps 8–11: a proposal accepted on „Administrare — Etichete”, read behind „?”, and the text
 * put back, after which the proposal is offered again. Both tests change the same row, so they run serially.
 */

import { test, expect } from "../helpers/test";
import { readHelp, writeHelp } from "../helpers/records";
import { sidebar } from "../helpers/sidebar";

const SCREEN = "admin-tags";
/** The manual section „Administrare — Etichete” points at (HELP_SCREENS in src/lib/help/registry.ts). */
const MANUAL_SECTION = "admin-groups-tags";
const TC_TEXT = "TC-E2E-HELP-01 — text de ajutor scris de cazul de test.";
/**
 * Screens registered before their help is written — Adrian writes it, on this very screen (#37.23's rule: the text
 * is his, the handover proposes it). Each may read „Lipsă"; every other screen must read „Complet". The list may
 * outlive the gap: once the text is written the screen reads „Complet" and still passes. (Slice #38.84)
 */
const HELP_TO_WRITE = [
  "Interacțiuni — Istoric",
  // Slice #39.42: two new screens, each with a proposal written against no text (#39.40).
  "Ajutor și învățare — Harta competențelor",
  "Ajutor și învățare — Chestionarul unei competențe",
] as const;

test.describe("TC-HELP-01 — Text de ajutor scris pentru un ecran și citit în spatele „?”", () => {
  test.describe.configure({ mode: "serial" });

  test("textul scris pe „Informații de ajutor” e cel din „?”; apoi pus înapoi identic", async ({ page }) => {
    test.slow();
    const before = await readHelp(page.request, SCREEN);
    const originalHowToRo = before.howToRo ?? "";

    try {
      // Step 1 — „Ajutor și învățare" → „Informații de ajutor" (#39.37: was „Administrare"): the heading, „Ecrane", „Sfaturi rapide",
      // every screen „Complet" once the list has loaded (FU-227).
      await page.goto("/");
      const nav = sidebar(page);
      const helpLink = nav.getByRole("link", { name: "Informații de ajutor", exact: true });
      if (!(await helpLink.isVisible())) {
        await nav.getByRole("button", { name: "Ajutor și învățare", exact: true }).click();
      }
      await helpLink.click();
      await expect(page).toHaveURL(/\/admin\/help-content$/, { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: "Informații de ajutor" })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByText("Ecrane", { exact: true })).toBeVisible();
      await expect(page.getByText("Sfaturi rapide", { exact: true })).toBeVisible();
      const screenButton = page.getByRole("button", { name: /^Administrare — Etichete/ });
      await expect(screenButton).toContainText("Complet", { timeout: 30_000 });
      const missing = await page.getByRole("button").filter({ has: page.getByText("Lipsă", { exact: true }) }).allInnerTexts();
      expect(missing.filter((name) => !HELP_TO_WRITE.some((s) => name.trim().startsWith(s)))).toEqual([]);

      // Step 2 — the four fields, „Salvează", „Previzualizare".
      await screenButton.click();
      for (const label of ["Context (Engleză)", "Context (Română)", "Cum se folosește (Engleză)", "Cum se folosește (Română)"]) {
        await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(page.getByText("Previzualizare", { exact: true })).toBeVisible();
      const save = page.getByRole("button", { name: "Salvează", exact: true });
      await expect(save).toBeVisible();
      const howToRo = page.locator("main textarea").nth(3);

      // Step 3 — the field holds the text above.
      await expect(howToRo).toHaveValue(originalHowToRo);

      // Step 4 — the new sentence; „Previzualizare" follows.
      await howToRo.fill(TC_TEXT);
      // The preview's paragraph — the text area holds the same words.
      await expect(page.locator("main p").filter({ hasText: TC_TEXT })).toBeVisible();

      // Step 5 — „Salvează": „Salvat".
      await save.click();
      await expect(page.getByText("Salvat", { exact: true })).toBeVisible({ timeout: 15_000 });

      // Step 6 — „Etichete", „?": „Ajutor" with „×", „Context" unchanged, „Cum se folosește" the new text.
      const tagsLink = nav.getByRole("link", { name: "Etichete", exact: true });
      if (!(await tagsLink.isVisible())) {
        await nav.getByRole("button", { name: "Administrare", exact: true }).click();
      }
      await tagsLink.click();
      await expect(page).toHaveURL(/\/admin\/tags$/, { timeout: 30_000 });
      // Slice #38.20: the sidebar has a section „Ajutor" too — the screen's „?" is the one outside it.
      await page
        .getByRole("button", { name: "Ajutor", exact: true })
        .and(page.locator(":not(nav[data-sidebar-nav] *)"))
        .first()
        .click({ timeout: 30_000 });
      // The innermost block holding both the „Ajutor" heading and „Cum se folosește" is the panel.
      const panel = page
        .locator("div")
        .filter({ has: page.getByRole("heading", { name: "Ajutor", exact: true }) })
        .filter({ hasText: "Cum se folosește" })
        .last();
      await expect(panel.getByRole("button", { name: "Închide" })).toBeVisible();
      await expect(panel.getByRole("heading", { name: "Context", exact: true })).toBeVisible();
      await expect(panel.getByText(before.backgroundRo ?? "", { exact: true })).toBeVisible();
      await expect(panel.getByRole("heading", { name: "Cum se folosește", exact: true })).toBeVisible();
      await expect(panel.getByText(TC_TEXT, { exact: true })).toBeVisible();

      // Step 7 (#39.40) — „Vezi în manual: §…” under the text opens the manual at the screen's section.
      const manualLink = panel.getByRole("link", { name: /^Vezi în manual: §\d+(\.\d+)* \S/ });
      await expect(manualLink).toBeVisible();
      await manualLink.click();
      await expect(page).toHaveURL(new RegExp(`/manual\\?s=${MANUAL_SECTION}$`), { timeout: 30_000 });
      await expect(page.locator(`[id="${MANUAL_SECTION}"]`).filter({ visible: true })).toBeVisible({ timeout: 30_000 });

      // ── At the end — the text above back into the field, empty line included, „Salvează" ──
      await page.goto("/admin/help-content");
      await page.getByRole("button", { name: /^Administrare — Etichete/ }).click({ timeout: 30_000 });
      await expect(howToRo).toHaveValue(TC_TEXT, { timeout: 15_000 });
      await howToRo.fill(originalHowToRo);
      await save.click();
      await expect(page.getByText("Salvat", { exact: true })).toBeVisible({ timeout: 15_000 });
    } finally {
      await writeHelp(page.request, SCREEN, before);
      expect(await readHelp(page.request, SCREEN)).toEqual(before);
    }
  });
  test("o propunere acceptată pe „Administrare — Etichete”, citită în „?”; apoi textul pus înapoi", async ({ page }) => {
    test.slow();
    const before = await readHelp(page.request, SCREEN);

    // Step 8 — „Informații de ajutor”: the screen is marked „Propunere”, and a line above the list counts them.
    await page.goto("/admin/help-content");
    const screenButton = page.getByRole("button", { name: /^Administrare — Etichete/ });
    await expect(screenButton).toContainText("Complet", { timeout: 30_000 });
    // The proposal is offered only while the text is the one it was written against: once Adrian has accepted
    // or rewritten it there is nothing to accept here, and the case says so rather than fail.
    test.skip(!(await screenButton.textContent())?.includes("Propunere"), "No proposal is offered for „Administrare — Etichete” on this database.");
    await expect(page.locator("[data-help-proposals-count]")).toContainText(/(are|au) un text propus din manual/);

    try {
      // Step 9 — the screen: its text and the proposal side by side, field by field.
      await screenButton.click();
      const proposal = page.locator(`[data-help-proposal="${SCREEN}"]`);
      await expect(proposal).toBeVisible();
      await expect(proposal.getByText("Textul de acum", { exact: true })).toBeVisible();
      await expect(proposal.getByText("Propunerea", { exact: true })).toBeVisible();
      await expect(proposal.locator('[data-proposal-field="howToRo"] p').nth(1)).toHaveText(before.howToRo ?? "—");
      const proposedHowToRo = (await proposal.locator('[data-proposal-field="howToRo"] p').nth(3).textContent()) ?? "";
      expect(proposedHowToRo).not.toBe("");

      // Step 10 — „Acceptă”: saved, the mark gone, the boxes holding the proposal.
      await proposal.getByRole("button", { name: "Acceptă", exact: true }).click();
      await expect(page.getByText("Propunerea a fost salvată ca text al ecranului.", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(proposal).toBeHidden();
      await expect(screenButton).not.toContainText("Propunere");
      const after = await readHelp(page.request, SCREEN);
      expect(after.howToRo).toBe(proposedHowToRo);
      await expect(page.locator("main textarea").nth(3)).toHaveValue(proposedHowToRo);

      // Step 11 — „Etichete”, „?”: the proposal is the screen's help now.
      await page.goto("/admin/tags");
      await page
        .getByRole("button", { name: "Ajutor", exact: true })
        .and(page.locator(":not(nav[data-sidebar-nav] *)"))
        .first()
        .click({ timeout: 30_000 });
      const panel = page
        .locator("div")
        .filter({ has: page.getByRole("heading", { name: "Ajutor", exact: true }) })
        .filter({ hasText: "Cum se folosește" })
        .last();
      await expect(panel.getByText(after.backgroundRo ?? "", { exact: true })).toBeVisible();
    } finally {
      // At the end — Adrian's text back, byte for byte; the proposal is offered again, because the text is the
      // one it was written against.
      await writeHelp(page.request, SCREEN, before);
      expect(await readHelp(page.request, SCREEN)).toEqual(before);
    }
    await page.goto("/admin/help-content");
    await expect(page.getByRole("button", { name: /^Administrare — Etichete/ })).toContainText("Propunere", { timeout: 30_000 });
  });
});
