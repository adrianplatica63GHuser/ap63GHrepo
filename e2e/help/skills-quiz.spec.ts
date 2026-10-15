/**
 * Case:   TC-SKILL-02 — Chestionarul unei competențe deschise: întrebările, „Trimite”, plecarea întreabă întâi
 * Source: docs/testing/cases/TC-SKILL-02.md, „Last green" 2026-10-15
 *
 * A translation of the case file, step for step, on an account with no attempts. Nothing in the case is sent:
 * it reads a quiz and leaves it, and proves that leaving records nothing.
 *
 * AND A SECOND TEST THAT IS NOT A STEP OF THE CASE: a quiz passed and one failed, through the page, as a user
 * would. It passes 1.1 with the right answers (read from the quiz file — the browser is never told them) after
 * 1.2 and 1.3 are seeded as passed, and sees 1.1 Mastered and 2.13 open on the map; it fails 1.4 and is told
 * when it reopens. Those attempts are real ones, so the test runs only on an account that had none, and
 * deletes every attempt of the account in a `finally` (scripts/skills/reset-progress.ts).
 *
 * AND A THIRD, ALSO NOT A STEP OF THE CASE (#39.44): an Expert quiz passed through the page masters its Path. The
 * import Path's Advanced skills and everything they and its Expert skill rest on are seeded as passed; 4.5 is
 * passed by the page; the Path's chip then carries the badge. Same account rule, same `finally`.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "../helpers/test";
import { SKILLS } from "../../src/lib/skills/catalogue";

type QuizJson = { variants: { id: string; questions: { id: string; options: { id: string; correct: boolean }[] }[] }[] };
const quizFile = (key: string): QuizJson =>
  JSON.parse(fs.readFileSync(path.join("src", "lib", "skills", "quizzes", `${key}.json`), "utf8")) as QuizJson;
const key = (number: string) => SKILLS.find((s) => s.number === number)!.key;
/** A skill's number as numbers, so 1.10 sorts after 1.9. */
const order = (n: string) => n.split(".").map(Number);
const byNumber = (x: string, y: string) => {
  const [a, b] = [order(SKILLS.find((s) => s.key === x)!.number), order(SKILLS.find((s) => s.key === y)!.number)];
  return a[0] - b[0] || a[1] - b[1];
};
/** Every skill the given ones rest on, however far back. */
function before(keys: string[]): Set<string> {
  const out = new Set<string>();
  const stack = [...keys];
  while (stack.length) {
    const k = stack.pop()!;
    for (const p of SKILLS.find((s) => s.key === k)!.predecessors) {
      if (out.has(p)) continue;
      out.add(p);
      stack.push(p);
    }
  }
  return out;
}

function script(file: string, ...args: string[]): number {
  const email = process.env.E2E_EMAIL;
  if (!email) throw new Error("E2E_EMAIL is not set.");
  try {
    execFileSync(process.execPath, ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", `scripts/skills/${file}`, "--email", email, ...args], {
      stdio: "pipe",
      timeout: 60_000,
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
    if (e.status === 3) return 3;
    throw new Error(`${file} ${args.join(" ")} failed (${e.status}): ${e.stderr?.toString() ?? ""}${e.stdout?.toString() ?? ""}`);
  }
}
/** True when the account has attempts of its own, which the spec must not touch. */
const hasOwnAttempts = () => script("set-progress.ts", "--require-empty") === 3;

function main(page: Page) {
  return page.locator("main[data-skill-quiz]").filter({ visible: true });
}

async function openQuiz(page: Page, skillKey: string) {
  await page.goto("/skills-map");
  const box = page.locator(`[data-skill="${skillKey}"]`).filter({ visible: true });
  await expect(box).toHaveAttribute("data-state", "open", { timeout: 30_000 });
  await box.click();
  await expect(page).toHaveURL(new RegExp(`/skills-map/${skillKey}$`), { timeout: 30_000 });
  await expect(main(page).locator("[data-quiz-form]")).toBeVisible({ timeout: 30_000 });
}

/** Answer every question of the form shown: right ones from the file, or wrong ones. */
async function answerAll(page: Page, skillKey: string, right: boolean) {
  const form = main(page).locator("[data-quiz-form]");
  const vid = await form.getAttribute("data-quiz-form");
  const v = quizFile(skillKey).variants.find((x) => x.id === vid);
  if (!v) throw new Error(`The page drew variant „${vid}”, which ${skillKey}.json does not have.`);
  for (const q of v.questions) {
    const option = q.options.find((o) => o.correct === right)!;
    await form.locator(`[data-quiz-question="${q.id}"] input[value="${option.id}"]`).check();
  }
}

test.describe("TC-SKILL-02 — Chestionarul unei competențe", () => {
  test.describe.configure({ mode: "serial" });

  test("o competență deschisă: întrebările, „Trimite” după toate răspunsurile, plecarea întreabă întâi și nu înregistrează nimic", async ({ page }) => {
    test.skip(hasOwnAttempts(), "The e2e account has quiz attempts of its own; the case is for an account with none.");
    script("set-progress.ts", "--clear", "--apply");
    const k = key("1.1");
    const skill = SKILLS.find((s) => s.key === k)!;

    // Step 1 — the Open box 1.1 opens its quiz: the title, the rule, six questions of three or four answers.
    await openQuiz(page, k);
    await expect(main(page).getByRole("heading", { name: `Chestionar — ${skill.number} ${skill.name.ro}` })).toBeVisible();
    await expect(main(page)).toContainText("6 întrebări. Alegeți câte un răspuns la fiecare, apoi apăsați „Trimite”. Treceți cu cel puțin 5 răspunsuri bune.");
    const questions = main(page).locator("[data-quiz-question]");
    await expect(questions).toHaveCount(6);
    for (let i = 0; i < 6; i++) {
      const n = await questions.nth(i).locator('input[type="radio"]').count();
      expect(n >= 3 && n <= 4).toBe(true);
    }
    // The page carries no answer: nothing in it says which option is right.
    expect(await page.content()).not.toMatch(/"correct"\s*:/);

    // Step 2 — „Trimite” waits for every answer.
    const send = main(page).getByRole("button", { name: "Trimite" });
    await expect(send).toBeDisabled();
    await expect(main(page).locator("[data-quiz-answered]")).toHaveText("0 din 6 răspunsuri");
    await questions.nth(0).locator('input[type="radio"]').first().check();
    await expect(main(page).locator("[data-quiz-answered]")).toHaveText("1 din 6 răspunsuri");
    await expect(send).toBeDisabled();

    // Step 3 — leaving with an answer chosen asks first; „Anulează” stays, „Renunță” leaves.
    await main(page).getByRole("link", { name: "Înapoi la hartă" }).click();
    const dialog = page.getByRole("dialog").filter({ hasText: "Modificări nesalvate" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Anulează" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(new RegExp(`/skills-map/${k}$`));
    await expect(main(page).locator("[data-quiz-answered]")).toHaveText("1 din 6 răspunsuri");
    await main(page).getByRole("link", { name: "Înapoi la hartă" }).click();
    await page.getByRole("dialog").filter({ hasText: "Modificări nesalvate" }).getByRole("button", { name: "Renunță" }).click();
    await expect(page).toHaveURL(/\/skills-map$/, { timeout: 30_000 });

    // Step 4 — nothing was recorded: 1.1 is still Open, its quiz still available.
    await expect(page.locator(`[data-skill="${k}"]`).filter({ visible: true })).toHaveAttribute("data-state", "open", { timeout: 30_000 });
    expect(hasOwnAttempts()).toBe(false);
  });

  test("a quiz passed and one failed through the page — not a step of the case", async ({ page }) => {
    test.slow();
    test.skip(hasOwnAttempts(), "The e2e account has quiz attempts of its own; nothing is recorded over them.");
    script("set-progress.ts", "--clear", "--apply");
    try {
      // 1.2 and 1.3 passed by the seeding script; 1.1 by the page.
      script("set-progress.ts", "--pass", `${key("1.2")},${key("1.3")}`, "--apply");
      await openQuiz(page, key("1.1"));
      await answerAll(page, key("1.1"), true);
      await main(page).getByRole("button", { name: "Trimite" }).click();
      const passed = main(page).locator('[data-quiz-result="passed"]');
      await expect(passed).toBeVisible({ timeout: 30_000 });
      await expect(passed).toContainText("Ați trecut chestionarul");
      await expect(passed).toContainText("6 răspunsuri bune din 6");
      await expect(passed.locator("[data-quiz-explanation]")).toHaveCount(6);
      await expect(passed.locator("[data-quiz-section]").first()).toBeVisible();

      // The map: 1.1 Mastered with its badge; 2.13 (1.1, 1.2, 1.3) Open now.
      await page.goto("/skills-map");
      const b11 = page.locator(`[data-skill="${key("1.1")}"]`).filter({ visible: true });
      await expect(b11).toHaveAttribute("data-state", "mastered", { timeout: 30_000 });
      await expect(b11.locator("[data-mastery-badge]")).toHaveCount(1);
      await expect(page.locator(`[data-skill="${key("2.13")}"]`).filter({ visible: true })).toHaveAttribute("data-state", "open");
      // A Mastered box's panel names its manual sections.
      await b11.click();
      await expect(page.locator(`[data-skill-panel="${key("1.1")}"] [data-quiz-section]`).first()).toBeVisible();

      // 1.4 failed through the page: the score, what to read again, when it reopens — and no right answer.
      await openQuiz(page, key("1.4"));
      await answerAll(page, key("1.4"), false);
      await main(page).getByRole("button", { name: "Trimite" }).click();
      const failed = main(page).locator('[data-quiz-result="failed"]');
      await expect(failed).toBeVisible({ timeout: 30_000 });
      await expect(failed).toContainText("Nu ați trecut de data aceasta");
      await expect(failed).toContainText("0 răspunsuri bune din 6; trebuiau cel puțin 5.");
      await expect(failed.locator("[data-quiz-retry]")).toContainText("Chestionarul se poate relua din");
      await expect(failed.locator("[data-quiz-section]").first()).toBeVisible();
      await expect(failed).not.toContainText("Răspunsul bun");

      // Its page now says when it reopens instead of drawing a quiz.
      await page.goto(`/skills-map/${key("1.4")}`);
      await expect(main(page).locator("[data-quiz-cooling]")).toContainText("Chestionarul se poate relua din", { timeout: 30_000 });
      await expect(main(page).locator("[data-quiz-form]")).toHaveCount(0);
    } finally {
      script("reset-progress.ts", "--apply");
    }
  });
  test("an Expert quiz passed through the page masters its Path — not a step of the case (#39.44)", async ({ page }) => {
    test.slow();
    test.skip(hasOwnAttempts(), "The e2e account has quiz attempts of its own; nothing is recorded over them.");
    script("set-progress.ts", "--clear", "--apply");
    try {
      const expert = SKILLS.find((s) => s.path === "import" && s.level === 4)!;
      const high = SKILLS.filter((s) => s.path === "import" && s.level >= 3).map((s) => s.key);
      // Predecessors first: a skill's number sorts after every one it rests on.
      const seed = [...new Set([...high, ...before(high)])].filter((k) => k !== expert.key).sort(byNumber);
      script("set-progress.ts", "--pass", seed.join(","), "--apply");

      await page.goto("/skills-map");
      const chip = page.locator('[data-path-chip="import"]').filter({ visible: true });
      await expect(page.locator(`[data-skill="${expert.key}"]`).filter({ visible: true })).toHaveAttribute("data-state", "open", { timeout: 30_000 });
      await expect(chip).not.toContainText("traseu stăpânit");

      await openQuiz(page, expert.key);
      const n = await main(page).locator("[data-quiz-question]").count();
      expect(n).toBe(12);
      await answerAll(page, expert.key, true);
      await main(page).getByRole("button", { name: "Trimite" }).click();
      const passed = main(page).locator('[data-quiz-result="passed"]');
      await expect(passed).toBeVisible({ timeout: 30_000 });
      await expect(passed).toContainText("12 răspunsuri bune din 12");

      await page.goto("/skills-map");
      await expect(page.locator(`[data-skill="${expert.key}"]`).filter({ visible: true })).toHaveAttribute("data-state", "mastered", { timeout: 30_000 });
      await expect(chip).toContainText("traseu stăpânit");
    } finally {
      script("reset-progress.ts", "--apply");
    }
  });
});
