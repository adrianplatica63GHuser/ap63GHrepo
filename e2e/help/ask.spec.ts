/**
 * Case:   TC-HELP-03 — „Întreabă”: o întrebare în cuvinte proprii primește răspunsul manualului, sau că manualul nu răspunde
 * Source: docs/testing/cases/TC-HELP-03.md, „Last green" 2026-10-15
 *
 * A translation of the case file, step for step. #39.49: the question is answered by Claude, by what it means —
 * and NEVER by a real AI call here (it costs money and its words change). POST /api/manual/ask is intercepted with
 * page.route and answers as the route answers; what the route itself does with Claude's replies is
 * src/__tests__/manual-ask.test.ts's, with Claude mocked. What this spec proves is the page: the question it sends,
 * the answer with its section links and the list of those sections under it, the one sentence and NO list when
 * the manual does not answer, and the same box at the top of the manual.
 */
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";

const ANSWERED = "vreau să trec în arhivă un om nou, cum fac?";
const NOT_ANSWERED = "ce vreme e mâine la Bragadiru?";

function box(page: Page) {
  return page.locator("[data-ask-box]").filter({ visible: true });
}

async function ask(page: Page, question: string, how: "enter" | "button") {
  const input = box(page).locator("[data-ask-input]");
  await input.fill(question);
  if (how === "enter") await input.press("Enter");
  else await box(page).getByRole("button", { name: "Întreabă", exact: true }).click();
}

test.describe("TC-HELP-03 — „Întreabă”", () => {
  test("o întrebare formulată altfel decât manualul primește răspunsul și secțiunile lui; una fără răspuns, o propoziție și nicio listă", async ({ page }) => {
    const asked: { question: string; lang: string }[] = [];
    await page.route("**/api/manual/ask", async (route) => {
      const body = route.request().postDataJSON() as { question: string; lang: string };
      asked.push(body);
      if (body.question === ANSWERED) {
        await route.fulfill({
          json: {
            kind: "answer",
            text: "Pe lista persoanelor fizice apăsați „Adaugă persoană” și completați formularul [§3.2].",
            cited: [{ id: "persons-add", number: "3.2", title: "O persoană adăugată de mână", href: "/manual?s=persons-add" }],
          },
        });
      } else {
        await route.fulfill({ json: { kind: "not-in-manual" } });
      }
    });

    // Step 1 — „Ajutor și învățare” → „Întreabă”: the heading, the box with „Întreabă”, the breadcrumb.
    await page.goto("/");
    await openSection(page, "Ajutor și învățare");
    await sidebar(page).getByRole("link", { name: "Întreabă", exact: true }).click();
    await expect(page).toHaveURL(/\/ask$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Întreabă", level: 1 }).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(box(page).getByRole("button", { name: "Întreabă", exact: true })).toBeVisible();
    await expect(box(page).getByRole("button", { name: "Caută" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true })).toContainText("Ajutor și învățare");

    // Step 2 — a question worded unlike the manual, Enter: the answer, its §3.2 a link, and the section under it.
    await ask(page, ANSWERED, "enter");
    const answer = box(page).locator("[data-ask-answer]");
    await expect(answer).toBeVisible({ timeout: 30_000 });
    expect(asked).toEqual([{ question: ANSWERED, lang: "ro" }]);
    await expect(answer.locator('[data-ask-cited="persons-add"]')).toHaveText("§3.2");
    await expect(answer.locator("[data-ask-link]")).toHaveText(["§3.2 O persoană adăugată de mână"]);
    await expect(answer).toContainText("Scris de AI doar din aceste secțiuni.");

    // Step 3 — the section's link opens the manual there, the same box at its top.
    await answer.locator('[data-ask-link="persons-add"]').click();
    await expect(page).toHaveURL(/\/manual\?s=persons-add$/, { timeout: 30_000 });
    await expect(page.locator('[id="persons-add"]').filter({ visible: true })).toContainText("O persoană adăugată de mână", { timeout: 30_000 });
    await expect(box(page)).toBeVisible();

    // Step 4 — a question the manual does not answer: one sentence, a link to the contents, and no list at all.
    await ask(page, NOT_ANSWERED, "button");
    const none = box(page).locator("[data-ask-not-in-manual]");
    await expect(none).toContainText("Manualul nu răspunde la această întrebare.", { timeout: 30_000 });
    await expect(none.getByRole("link", { name: "Deschide cuprinsul manualului" })).toHaveAttribute("href", "/manual");
    await expect(box(page).locator("[data-ask-link], [data-ask-answer]")).toHaveCount(0);
    expect(asked.map((a) => a.question)).toEqual([ANSWERED, NOT_ANSWERED]);
  });
});
