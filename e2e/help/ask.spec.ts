/**
 * Case:   TC-HELP-03 — „Întreabă”: o întrebare în cuvinte proprii găsește secțiunile manualului, și în capul manualului
 * Source: docs/testing/cases/TC-HELP-03.md, „Last green" 2026-10-15
 *
 * A translation of the case file, step for step. The search only: „Răspuns AI” is never pressed here — a real AI
 * call costs money and its words change (Slice #39.45: no real AI call in e2e). Its route is
 * src/__tests__/manual-ask.test.ts's, with Claude mocked.
 */
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";

function box(page: Page) {
  return page.locator("[data-ask-box]").filter({ visible: true });
}

async function ask(page: Page, question: string, how: "enter" | "button") {
  const input = box(page).locator("[data-ask-input]");
  await input.fill(question);
  if (how === "enter") await input.press("Enter");
  else await box(page).getByRole("button", { name: "Caută" }).click();
}

test.describe("TC-HELP-03 — „Întreabă”", () => {
  test("o întrebare fără diacritice găsește secțiunea, duce la ea, iar o întrebare fără răspuns spune așa", async ({ page }) => {
    // Step 1 — „Ajutor și învățare” → „Întreabă”: the heading, the box, the breadcrumb.
    await page.goto("/");
    await openSection(page, "Ajutor și învățare");
    await sidebar(page).getByRole("link", { name: "Întreabă", exact: true }).click();
    await expect(page).toHaveURL(/\/ask$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Întreabă", level: 1 }).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(box(page).getByRole("button", { name: "Caută" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true })).toContainText("Ajutor și învățare");

    // Step 2 — without diacritics, Enter: at most five sections, §3.2 first, sentences with the words marked.
    await ask(page, "cum adaug o persoana", "enter");
    const results = box(page).locator("[data-ask-results]");
    await expect(results).toBeVisible({ timeout: 30_000 });
    const items = results.locator("[data-ask-result]");
    const n = await items.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(5);
    await expect(results.locator("[role=status]")).toContainText(`${n}`);
    await expect(items.first()).toHaveAttribute("data-ask-result", "persons-add");
    await expect(items.first().locator("[data-ask-link]")).toHaveText("§3.2 O persoană adăugată de mână");
    for (let i = 0; i < n; i++) await expect(items.nth(i).locator("[data-ask-hit]").first()).toBeVisible();
    await expect(box(page).getByRole("button", { name: "Răspuns AI" })).toBeVisible();
    await expect(box(page).locator("[data-ask-answer]")).toHaveCount(0);

    // Step 3 — the section's link opens the manual there, the same box at its top.
    await items.first().locator("[data-ask-link]").click();
    await expect(page).toHaveURL(/\/manual\?s=persons-add$/, { timeout: 30_000 });
    await expect(page.locator('[id="persons-add"]').filter({ visible: true })).toContainText("O persoană adăugată de mână", { timeout: 30_000 });
    await expect(box(page)).toBeVisible();

    // Step 4 — a question nothing matches: the box says so, and shows no section.
    await ask(page, "xqzvw plmkj", "button");
    await expect(box(page).locator("[data-ask-empty]")).toHaveText(
      "Manualul nu pare să răspundă la întrebarea aceasta. Încercați alte cuvinte sau căutați în cuprins.",
      { timeout: 30_000 },
    );
    await expect(box(page).locator("[data-ask-result]")).toHaveCount(0);
  });
});
