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
 * second test, steps 8–11: a proposal accepted, read behind „?”, and the text put back.
 *
 * Slice #39.52: every proposal is accepted on Adrian's database, so none is offered any more and the second test
 * SEEDS its own: it empties „Ajutor și învățare — Harta competențelor”, whose proposal was written against no
 * text, so the proposal is offered again; and it gives the text back at the end, byte for byte. A third test,
 * steps 12–14, does the same for two screens and accepts them with „Acceptă toate”. It never accepts a proposal
 * it did not seed: when any other proposal waits on the database, it skips and says so. And every screen must
 * read „Complet” now — the list of screens allowed to read „Lipsă” is empty.
 */

import { test, expect } from "../helpers/test";
import { readHelp, writeHelp } from "../helpers/records";
import { sidebar } from "../helpers/sidebar";
import { HELP_PROPOSALS } from "../../src/lib/help/proposals-data";

const SCREEN = "admin-tags";
/** The manual section „Administrare — Etichete” points at (HELP_SCREENS in src/lib/help/registry.ts). */
const MANUAL_SECTION = "admin-groups-tags";
const TC_TEXT = "TC-E2E-HELP-01 — text de ajutor scris de cazul de test.";
/**
 * Screens registered before their help is written — Adrian writes it, on this very screen (#37.23's rule: the text
 * is his, the handover proposes it). Each may read „Lipsă"; every other screen must read „Complet". The list may
 * outlive the gap: once the text is written the screen reads „Complet" and still passes. (Slice #38.84)
 */
const HELP_TO_WRITE: readonly string[] = [
  // Slice #39.52: none left — every proposal was accepted, the four screens that had no text among them.
  // Slice #39.67 registered the tarla's two screens with no text; #39.73's run found them „Lipsă". The batch's 39.80
  // writes the help after 39.73–39.79, and the text is Adrian's on this screen.
  "Tarlale — Listă",
  "Tarlale — Detaliu",
];

/** Slice #39.52: the screens whose proposals were written against no text, emptied to offer them again. */
const SEEDED = [
  { key: "skills-map", label: "Ajutor și învățare — Harta competențelor", path: "/skills-map" },
  { key: "skill-quiz", label: "Ajutor și învățare — Chestionarul unei competențe", path: null },
] as const;
const EMPTY = { backgroundEn: "", backgroundRo: "", howToEn: "", howToRo: "" };

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
  test("o propunere acceptată, citită în „?”; apoi textul pus înapoi", async ({ page }) => {
    test.slow();
    const seeded = SEEDED[0];
    const proposalText = HELP_PROPOSALS[seeded.key]!;
    const before = await readHelp(page.request, seeded.key);

    try {
      // Seeding — the screen emptied, so its proposal, written against no text, is offered again.
      await writeHelp(page.request, seeded.key, EMPTY);

      // Step 8 — „Informații de ajutor”: the screen is marked „Propunere”, and a line above the list counts them.
      await page.goto("/admin/help-content");
      const screenButton = page.getByRole("button", { name: new RegExp(`^${seeded.label}`) });
      await expect(screenButton).toContainText("Propunere", { timeout: 30_000 });
      await expect(page.locator("[data-help-proposals-count]")).toContainText(/(are|au) un text propus din manual/);

      // Step 9 — the screen: its text and the proposal side by side, field by field.
      await screenButton.click();
      const proposal = page.locator(`[data-help-proposal="${seeded.key}"]`);
      await expect(proposal).toBeVisible();
      await expect(proposal.getByText("Textul de acum", { exact: true })).toBeVisible();
      await expect(proposal.getByText("Propunerea", { exact: true })).toBeVisible();
      await expect(proposal.locator('[data-proposal-field="howToRo"] p').nth(1)).toHaveText("—");
      expect(((await proposal.locator('[data-proposal-field="howToRo"] p').nth(3).textContent()) ?? "").trim()).not.toBe("");

      // Step 10 — „Acceptă”: saved, the mark gone, the boxes holding the proposal.
      await proposal.getByRole("button", { name: "Acceptă", exact: true }).click();
      await expect(page.getByText("Propunerea a fost salvată ca text al ecranului.", { exact: true })).toBeVisible({ timeout: 15_000 });
      await expect(proposal).toBeHidden();
      await expect(screenButton).not.toContainText("Propunere");
      const after = await readHelp(page.request, seeded.key);
      expect(after).toEqual({
        backgroundEn: proposalText.backgroundEn,
        backgroundRo: proposalText.backgroundRo,
        howToEn: proposalText.howToEn,
        howToRo: proposalText.howToRo,
      });
      await expect(page.locator("main textarea").nth(3)).toHaveValue(proposalText.howToRo);

      // Step 11 — „Harta competențelor”, „?”: the proposal is the screen's help now.
      await page.goto(seeded.path);
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
      await expect(panel.getByText(proposalText.backgroundRo, { exact: true })).toBeVisible();
    } finally {
      // At the end — the text back, byte for byte.
      await writeHelp(page.request, seeded.key, before);
      expect(await readHelp(page.request, seeded.key)).toEqual(before);
    }
  });

  test("„Acceptă toate”: două propuneri, o confirmare, amândouă salvate; apoi textele puse înapoi", async ({ page }) => {
    test.slow();
    // Never accept what the spec did not seed: with any proposal already waiting, the case is not run.
    await page.goto("/admin/help-content");
    await expect(page.getByRole("button", { name: /^Administrare — Etichete/ })).toContainText("Complet", { timeout: 30_000 });
    test.skip(
      (await page.locator("[data-help-proposals-count]").count()) > 0,
      "Proposals already wait on this database; „Acceptă toate” would accept them too, and the spec accepts only what it seeded.",
    );
    const before = await Promise.all(SEEDED.map((s) => readHelp(page.request, s.key)));

    try {
      // Seeding — both screens emptied, so both proposals are offered.
      for (const s of SEEDED) await writeHelp(page.request, s.key, EMPTY);

      // Step 12 — „Acceptă toate (2)” above the list; pressed, a confirmation naming the two screens.
      await page.reload();
      const acceptAll = page.getByRole("button", { name: "Acceptă toate (2)", exact: true });
      await expect(acceptAll).toBeVisible({ timeout: 30_000 });
      await acceptAll.click();
      const dialog = page.getByRole("alertdialog", { name: "Acceptați toate propunerile?" });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText("Propunerile se salvează ca texte ale celor 2 ecrane de mai jos.");
      await expect(dialog.locator("[data-help-accept-all-screen]")).toHaveCount(2);
      for (const s of SEEDED) await expect(dialog.getByText(s.label, { exact: true })).toBeVisible();

      // Step 13 — „Anulează”: nothing saved; both screens still „Propunere”.
      await dialog.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(dialog).toBeHidden();
      for (const s of SEEDED) await expect(page.getByRole("button", { name: new RegExp(`^${s.label}`) })).toContainText("Propunere");
      for (const s of SEEDED) expect(await readHelp(page.request, s.key)).toEqual(EMPTY);

      // Step 14 — „Acceptă toate” again, then „Acceptă toate” in the dialog: both saved, the marks and the button gone.
      await acceptAll.click();
      await dialog.getByRole("button", { name: "Acceptă toate", exact: true }).click();
      await expect(page.getByText("2 texte propuse au fost salvate.", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[data-help-accept-all] button")).toHaveCount(0);
      await expect(page.locator("[data-help-proposals-count]")).toHaveCount(0);
      for (const s of SEEDED) {
        await expect(page.getByRole("button", { name: new RegExp(`^${s.label}`) })).not.toContainText("Propunere");
        const p = HELP_PROPOSALS[s.key]!;
        expect(await readHelp(page.request, s.key)).toEqual({ backgroundEn: p.backgroundEn, backgroundRo: p.backgroundRo, howToEn: p.howToEn, howToRo: p.howToRo });
      }
    } finally {
      // At the end — both texts back, byte for byte.
      for (const [i, s] of SEEDED.entries()) {
        await writeHelp(page.request, s.key, before[i]);
        expect(await readHelp(page.request, s.key)).toEqual(before[i]);
      }
    }
  });
});
