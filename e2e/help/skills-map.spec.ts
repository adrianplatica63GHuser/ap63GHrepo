/**
 * Case:   TC-SKILL-01 — „Harta competențelor”: casetele, stările, traseele, lista și chestionarul unei competențe deschise
 * Source: docs/testing/cases/TC-SKILL-01.md
 *
 * A translation of the case file, step for step, on an account with no attempts — what a person sees the
 * first time: every Basic skill Open, every other skill Closed.
 *
 * AND A SECOND TEST THAT IS NOT A STEP OF THE CASE: the four states where 39.41's rules put them. Until the
 * quizzes exist (#39.43) nothing a person does writes an attempt, so it seeds them with
 * scripts/skills/set-progress.ts — through recordAttempt, the rules' own gate — every row marked `tc-e2e` and
 * deleted in a `finally`. It skips, and says why, when the account holds attempts of its own: real progress is
 * never drawn over. With GA40_MANUAL_FIGURES set (e2e/help/manual.spec.ts named in the same run) it also shoots
 * the manual's figure of the map.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";
import { SKILLS } from "../../src/lib/skills/catalogue";

const FIGURES = "playwright-report/manual-figures";

/** Run scripts/skills/set-progress.ts for the e2e account; its exit code. */
function setProgress(...args: string[]): number {
  const email = process.env.E2E_EMAIL;
  if (!email) throw new Error("E2E_EMAIL is not set.");
  try {
    execFileSync(process.execPath, ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", "scripts/skills/set-progress.ts", "--email", email, ...args], {
      stdio: "pipe",
      timeout: 60_000,
    });
    return 0;
  } catch (err) {
    const e = err as { status?: number; stdout?: Buffer; stderr?: Buffer };
    if (e.status === 3) return 3;
    throw new Error(`set-progress ${args.join(" ")} failed (${e.status}): ${e.stderr?.toString() ?? ""}${e.stdout?.toString() ?? ""}`);
  }
}

function box(page: Page, key: string) {
  return page.locator(`[data-skill="${key}"]`).filter({ visible: true });
}

async function openMap(page: Page) {
  await page.goto("/");
  await openSection(page, "Ajutor și învățare");
  await sidebar(page).getByRole("link", { name: "Harta competențelor", exact: true }).click();
  await expect(page).toHaveURL(/\/skills-map$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Harta competențelor", level: 1 }).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-skills-frame]")).toBeVisible({ timeout: 30_000 });
}

const BASIC = SKILLS.filter((s) => s.level === 1);
const key = (number: string) => SKILLS.find((s) => s.number === number)!.key;

test.describe("TC-SKILL-01 — „Harta competențelor”", () => {
  test.describe.configure({ mode: "serial" });

  test("pe un cont fără încercări: casetele, o casetă închisă, traseele, lista, chestionarul unei casete deschise", async ({ page }) => {
    test.skip(setProgress("--require-empty") === 3, "The e2e account has quiz attempts of its own; the case is for an account with none.");
    setProgress("--clear", "--apply");

    // Step 1 — „Ajutor și învățare” → „Harta competențelor”: the title, the four columns, the breadcrumb.
    await openMap(page);
    for (const l of ["De bază", "Intermediar", "Avansat", "Expert"]) await expect(page.getByText(l, { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Fir de navigare" }).filter({ visible: true })).toContainText("Ajutor și învățare");

    // Step 2 — one box per skill; every Basic one Open, every other Closed; the legend's four states.
    await expect(page.locator("[data-skill]").filter({ visible: true })).toHaveCount(SKILLS.length);
    for (const s of SKILLS) await expect(box(page, s.key)).toHaveAttribute("data-state", s.level === 1 ? "open" : "closed");
    for (const st of ["Deschisă", "Stăpânită", "Închisă", "Depășită"]) await expect(page.locator("[data-legend]").getByText(st, { exact: true })).toBeVisible();
    // A Closed box's frame is dotted; an Open one's is not; no box carries the badge yet.
    await expect(box(page, key("2.1")).locator("[data-frame]")).toHaveAttribute("data-frame", /^dotted-/);
    await expect(box(page, key("1.1")).locator("[data-frame]")).toHaveAttribute("data-frame", /^solid-/);
    await expect(page.locator("[data-skill] [data-mastery-badge]")).toHaveCount(0);

    // Step 3 — a Closed box: the panel names what it still needs.
    const closed = SKILLS.find((s) => s.number === "2.13")!;
    await box(page, closed.key).click();
    const panel = page.locator(`[data-skill-panel="${closed.key}"]`);
    await expect(panel).toBeVisible();
    await expect(panel).toContainText("Ca să se deschidă, îi lipsesc:");
    for (const p of closed.predecessors) await expect(panel.locator(`[data-missing="${p}"]`)).toBeVisible();
    await panel.getByRole("button", { name: "Închide" }).click();
    await expect(panel).toBeHidden();

    // Step 4 — a Path: the skills outside it fade.
    await page.locator('[data-path-chip="persons"]').click();
    await expect(box(page, key("1.5"))).toHaveCSS("opacity", "1"); // a „Persoane” skill
    await expect(box(page, key("1.1"))).toHaveCSS("opacity", "0.25"); // a „Spațiul de lucru” one
    await page.getByRole("button", { name: "Toate traseele" }).click();
    await expect(box(page, key("1.1"))).toHaveCSS("opacity", "1");

    // Step 5 — „Listă”: the same skills, by level; „Diagramă” goes back.
    await page.getByRole("button", { name: "Listă" }).click();
    await expect(page.locator("[data-skill-row]")).toHaveCount(SKILLS.length);
    await expect(page.locator(`[data-skill-row="${key("1.1")}"]`)).toHaveAttribute("data-state", "open");
    await page.getByRole("button", { name: "Diagramă" }).click();
    await expect(page.locator("[data-skills-frame]")).toBeVisible();

    // Step 6 — an Open box opens its quiz page; until #39.43 it says the quiz is being prepared.
    const open = BASIC[0];
    await box(page, open.key).click();
    await expect(page).toHaveURL(new RegExp(`/skills-map/${open.key}$`), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: `Chestionar — ${open.number} ${open.name.ro}` }).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Chestionarul acestei competențe se pregătește.", { exact: false }).filter({ visible: true })).toBeVisible();
    await page.getByRole("link", { name: "Înapoi la hartă" }).click();
    await expect(page).toHaveURL(/\/skills-map$/, { timeout: 30_000 });
  });

  test("the four states where the rules put them — seeded through recordAttempt, not a step of the case", async ({ page }) => {
    test.skip(setProgress("--require-empty") === 3, "The e2e account has quiz attempts of its own; nothing is seeded over them.");
    setProgress("--clear", "--apply");
    try {
      // 1.1, 1.2, 1.3 passed, then 2.13 (which needs all three): 2.13 Mastered, its three Obsolete; 3.12 (1.1 and
      // 2.13) Open; 3.13 (1.4 and 2.13) Closed, 1.4 not mastered; 1.4 failed once — still Open.
      setProgress("--pass", [key("1.1"), key("1.2"), key("1.3"), key("2.13")].join(","), "--fail", key("1.4"), "--apply");
      await openMap(page);
      const expected: [string, string, boolean, RegExp][] = [
        [key("1.1"), "obsolete", true, /^solid-4$/],
        [key("2.13"), "mastered", true, /^solid-/],
        [key("3.12"), "open", false, /^solid-/],
        [key("3.13"), "closed", false, /^dotted-/],
        [key("1.4"), "open", false, /^solid-/],
      ];
      for (const [k, state, badge, frame] of expected) {
        await expect(box(page, k)).toHaveAttribute("data-state", state);
        await expect(box(page, k).locator("[data-mastery-badge]")).toHaveCount(badge ? 1 : 0);
        await expect(box(page, k).locator("[data-frame]")).toHaveAttribute("data-frame", frame);
      }
      // A Mastered box says when; 3.13's panel names 1.4 only.
      await box(page, key("2.13")).click();
      await expect(page.locator(`[data-skill-panel="${key("2.13")}"]`)).toContainText("Stăpânită pe");
      await page.locator(`[data-skill-panel="${key("2.13")}"]`).getByRole("button", { name: "Închide" }).click();
      await box(page, key("3.13")).click();
      const missing = page.locator(`[data-skill-panel="${key("3.13")}"] [data-missing]`);
      await expect(missing).toHaveCount(1);
      await expect(missing.first()).toHaveAttribute("data-missing", key("1.4"));
      await page.locator(`[data-skill-panel="${key("3.13")}"]`).getByRole("button", { name: "Închide" }).click();

      if (process.env.GA40_MANUAL_FIGURES) {
        // The manual's figure: the map with the four states on it, fitted to a laptop's width. Nothing on this
        // screen is a record of the archive; „Recente” is blurred as on every figure.
        fs.mkdirSync(FIGURES, { recursive: true });
        await page.setViewportSize({ width: 1366, height: 900 });
        await page.waitForTimeout(800);
        await page.evaluate(() => {
          const recent = [...document.querySelectorAll<HTMLElement>("aside div.border-t")].find((d) => /Recente/i.test(d.textContent ?? ""));
          if (recent) recent.style.filter = "blur(7px)";
        });
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        // The app shell scrolls its content column, not the window: every scrolling box above the map back to its top.
        await page.locator("[data-skills-frame]").filter({ visible: true }).evaluate((el) => {
          for (let n: HTMLElement | null = el; n; n = n.parentElement) n.scrollTop = 0;
          window.scrollTo(0, 0);
        });
        await page.mouse.move(5, 5);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${FIGURES}/skills-map.png` });
        expect(fs.existsSync(`${FIGURES}/skills-map.png`)).toBe(true);
      }
    } finally {
      setProgress("--clear", "--apply");
    }
  });
});
