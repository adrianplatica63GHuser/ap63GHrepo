/**
 * Case:   TC-SKILL-01 — „Harta competențelor”: casetele, stările, traseele, lista și chestionarul unei competențe deschise
 * Source: docs/testing/cases/TC-SKILL-01.md, „Last green" 2026-10-15
 * Case:   TC-SKILL-03 — Un traseu pe „Harta competențelor”, în „Progresul meu” și în „Prezentare”
 * Source: docs/testing/cases/TC-SKILL-03.md, „Last green" 2026-10-15
 *
 * A translation of the case file, step for step, on an account with no attempts — what a person sees the
 * first time: every Basic skill Open, every other skill Closed.
 *
 * AND A SECOND TEST THAT IS NOT A STEP OF THE CASE: the four states where 39.41's rules put them. Until the
 * quizzes exist (#39.43) nothing a person does writes an attempt, so it seeds them with
 * scripts/skills/set-progress.ts — through recordAttempt, the rules' own gate — every row marked `tc-e2e` and
 * deleted in a `finally`. It skips, and says why, when the account holds attempts of its own: real progress is
 * never drawn over. With GA40_MANUAL_FIGURES set (e2e/help/manual.spec.ts named in the same run) it also shoots
 * the manual's figure of the map, once per language (#39.46).
 *
 * TC-SKILL-03 (#39.50) runs on ANY account: a Path and the two views depend on no attempt, and it writes nothing.
 * The Path's skills come from src/lib/skills/paths.ts, as the screen's do. With GA40_MANUAL_FIGURES set it shoots
 * the manual's figure of the Path „Proprietăți” in „Prezentare”, once per language.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { test, expect, type Page } from "../helpers/test";
import { openSection, sidebar } from "../helpers/sidebar";
import { SKILLS } from "../../src/lib/skills/catalogue";
import { PATH_SKILLS } from "../../src/lib/skills/paths";

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

    // Step 6 — an Open box opens its quiz page, with its quiz (#39.43; the quiz itself is TC-SKILL-02).
    const open = BASIC[0];
    await box(page, open.key).click();
    await expect(page).toHaveURL(new RegExp(`/skills-map/${open.key}$`), { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: `Chestionar — ${open.number} ${open.name.ro}` }).filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("main[data-skill-quiz] [data-quiz-form]").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "Înapoi la hartă" }).click();
    await expect(page).toHaveURL(/\/skills-map$/, { timeout: 30_000 });
  });

  test("the four states where the rules put them — seeded through recordAttempt, not a step of the case", async ({ page }) => {
    test.skip(setProgress("--require-empty") === 3, "The e2e account has quiz attempts of its own; nothing is seeded over them.");
    setProgress("--clear", "--apply");
    try {
      // #39.55, Adrian's rule: mastering a skill removes the arrows into it, and only a skill left with no arrow out
      // is Obsolete. 1.1, 1.2, 1.3 passed, then 2.13 (which needs all three), then 3.12 (1.1 and 2.13):
      //   - 1.1 leads only to 2.13 and 3.12, both mastered: no arrow out left — Obsolete;
      //   - 1.2 still leads to 2.14, not mastered — Mastered, not Obsolete (39.41's rule made it Obsolete);
      //   - 2.13 still leads to 3.8 and 3.13 — Mastered; 3.12 Mastered;
      //   - 3.13 (1.4 and 2.13) Closed, 1.4 not mastered; 1.4 failed once — still Open.
      setProgress("--pass", [key("1.1"), key("1.2"), key("1.3"), key("2.13"), key("3.12")].join(","), "--fail", key("1.4"), "--apply");
      await openMap(page);
      const expected: [string, string, boolean, RegExp][] = [
        [key("1.1"), "obsolete", true, /^solid-4$/],
        [key("1.2"), "mastered", true, /^solid-/],
        [key("2.13"), "mastered", true, /^solid-/],
        [key("3.12"), "mastered", true, /^solid-/],
        [key("3.13"), "closed", false, /^dotted-/],
        [key("1.4"), "open", false, /^solid-/],
      ];
      for (const [k, state, badge, frame] of expected) {
        await expect(box(page, k)).toHaveAttribute("data-state", state);
        await expect(box(page, k).locator("[data-mastery-badge]")).toHaveCount(badge ? 1 : 0);
        await expect(box(page, k).locator("[data-frame]")).toHaveAttribute("data-frame", frame);
      }
      await expect(box(page, key("1.2")).locator("[data-frame]")).not.toHaveAttribute("data-frame", /^solid-4$/);
      // The arrows: into a Mastered or Obsolete box, gone in „Progresul meu”; the rest drawn.
      const arrow = (from: string, to: string) => page.locator(`[data-arrow="${key(from)}>${key(to)}"]`);
      for (const [from, to] of [["1.1", "2.13"], ["1.1", "3.12"], ["1.2", "2.13"], ["2.13", "3.12"]]) await expect(arrow(from, to)).toHaveCount(0);
      for (const [from, to] of [["1.2", "2.14"], ["2.13", "3.13"], ["1.4", "3.13"]]) await expect(arrow(from, to)).toHaveCount(1);
      // „Prezentare” draws every arrow, as before.
      await page.locator('[data-map-view="overview"]').filter({ visible: true }).click();
      for (const [from, to] of [["1.1", "2.13"], ["1.1", "3.12"], ["1.2", "2.13"], ["2.13", "3.12"]]) await expect(arrow(from, to)).toHaveCount(1);
      await page.locator('[data-map-view="progress"]').filter({ visible: true }).click();
      await expect(arrow("1.1", "2.13")).toHaveCount(0);
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
        // screen is a record of the archive; „Recente” is blurred as on every figure. #39.46: once per language,
        // each in its own interface, into playwright-report/manual-figures/<locale>/.
        await page.setViewportSize({ width: 1366, height: 900 });
        for (const [locale, recentTitle] of [["ro-RO", "Recente"], ["en-GB", "Recently viewed"]] as const) {
          const dir = `${FIGURES}/${locale}`;
          fs.mkdirSync(dir, { recursive: true });
          if (locale !== "ro-RO") {
            await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, domain: "localhost", path: "/" }]);
            await page.goto("/skills-map");
            await expect(page.locator("[data-skills-frame]").filter({ visible: true })).toBeVisible({ timeout: 30_000 });
            await expect(box(page, key("2.13"))).toHaveAttribute("data-state", "mastered");
          }
          await page.waitForTimeout(800);
          await page.evaluate((t) => {
            const recent = [...document.querySelectorAll<HTMLElement>("aside div.border-t")].find((d) => (d.textContent ?? "").includes(t));
            if (recent) recent.style.filter = "blur(7px)";
          }, recentTitle);
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          // The app shell scrolls its content column, not the window: every scrolling box above the map back to its top.
          await page.locator("[data-skills-frame]").filter({ visible: true }).evaluate((el) => {
            for (let n: Element | null = el; n; n = n.parentElement) n.scrollTop = 0;
            window.scrollTo(0, 0);
          });
          await page.mouse.move(5, 5);
          await page.waitForTimeout(400);
          await page.screenshot({ path: `${dir}/skills-map.png` });
          expect(fs.existsSync(`${dir}/skills-map.png`)).toBe(true);
        }
        await page.context().addCookies([{ name: "NEXT_LOCALE", value: "ro-RO", domain: "localhost", path: "/" }]);
      }
    } finally {
      setProgress("--clear", "--apply");
    }
  });
  test("TC-SKILL-03 — un traseu, în „Progresul meu” și în „Prezentare”", async ({ page }) => {
    const arrow = (from: string, to: string) => page.locator(`[data-arrow="${key(from)}>${key(to)}"]`);
    const frame = page.locator("[data-skills-frame]").filter({ visible: true });
    const inProperties = PATH_SKILLS.properties;

    // Step 1 — the map opens in „Progresul meu”, with the four states' legend.
    await openMap(page);
    await expect(page.locator('[data-map-view="progress"]').filter({ visible: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-map-view="overview"]').filter({ visible: true })).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("[data-legend]").filter({ visible: true })).toHaveCount(4);

    // Step 2 — the Path „Proprietăți”: its note, and every box in it — other Paths' skills included — at full strength.
    await page.locator('[data-path-chip="properties"]').filter({ visible: true }).click();
    await expect(page.locator('[data-path-note="properties"]')).toHaveText(
      `Traseul Proprietăți: ${inProperties.size} competențe — competențele lui de expert, tot ce le trebuie înainte, din orice traseu, și celelalte competențe ale lui.`,
    );
    for (const n of ["4.2", "1.2", "1.6", "1.12"]) expect(inProperties.has(key(n))).toBe(true);
    expect(SKILLS.filter((s) => inProperties.has(s.key) && s.path !== "properties").length).toBeGreaterThan(0);
    for (const s of SKILLS) await expect(box(page, s.key)).toHaveCSS("opacity", inProperties.has(s.key) ? "1" : "0.25");

    // Step 3 — an arrow inside the Path is navy, head and all; one leaving it is grey, its head grey too.
    await expect(arrow("3.3", "4.2")).toHaveAttribute("data-arrow-head", "navy");
    await expect(arrow("3.3", "4.2")).toHaveAttribute("stroke", "#1e3a6e");
    await expect(arrow("3.7", "4.3")).toHaveAttribute("data-arrow-head", "grey");
    await expect(arrow("3.7", "4.3")).toHaveAttribute("stroke", "#b8bec7");
    // Every arrow's head is its line's colour.
    for (const l of await page.locator("[data-arrow]").all()) {
      const head = await l.getAttribute("data-arrow-head");
      expect(await l.getAttribute("stroke")).toBe(head === "navy" ? "#1e3a6e" : "#b8bec7");
      expect(await l.getAttribute("marker-end")).toBe(`url(#skills-arrow-${head})`);
    }

    // Step 4 — hovering 4.3, outside the Path, brings its own arrows forward in navy; leaving greys them again.
    await box(page, key("4.3")).hover();
    await expect(arrow("3.7", "4.3")).toHaveAttribute("data-arrow-head", "navy");
    await expect(arrow("3.7", "4.3")).toHaveAttribute("opacity", "1");
    await page.mouse.move(5, 5);
    await expect(arrow("3.7", "4.3")).toHaveAttribute("data-arrow-head", "grey");

    // Step 5 — „Prezentare”: every box Open-faced, no grey, no dotted frame, no badge; the levels' legend; the Path kept.
    await page.locator('[data-map-view="overview"]').filter({ visible: true }).click();
    await expect(page.locator('[data-map-view="overview"]').filter({ visible: true })).toHaveAttribute("aria-pressed", "true");
    await expect(frame.locator('[data-shown]:not([data-shown="open"])')).toHaveCount(0);
    await expect(frame.locator("[data-skill]")).toHaveCount(SKILLS.length);
    await expect(frame.locator('[data-frame^="dotted"]')).toHaveCount(0);
    await expect(frame.locator("[data-mastery-badge]")).toHaveCount(0);
    await expect(page.locator("[data-path-chip] [data-mastery-badge]")).toHaveCount(0);
    for (const l of ["De bază", "Intermediar", "Avansat", "Expert"]) await expect(page.locator("[data-legend-level]").getByText(l, { exact: true })).toBeVisible();
    await expect(page.locator("[data-overview-note]")).toHaveText(
      "„Prezentare” arată fiecare casetă în culoarea nivelului ei, deschisă, fără stări și fără bife. „Progresul meu” arată unde sunteți.",
    );
    await expect(box(page, key("1.1"))).toHaveCSS("opacity", "0.25");
    await expect(box(page, key("4.2"))).toHaveCSS("opacity", "1");

    // Step 6 — a box opens its panel — no quiz, no state; the skill and its manual sections.
    const s18 = SKILLS.find((s) => s.number === "1.8")!;
    await box(page, s18.key).click();
    const panel = page.locator(`[data-skill-panel="${s18.key}"]`);
    await expect(panel).toBeVisible();
    await expect(page).toHaveURL(/\/skills-map$/);
    await expect(panel).toContainText(s18.description.ro);
    await expect(panel).toContainText("În manual:");
    for (const st of ["Deschisă", "Stăpânită", "Închisă", "Depășită"]) await expect(panel).not.toContainText(st);
    await panel.getByRole("button", { name: "Închide" }).click();
    await expect(panel).toBeHidden();

    // Step 7 — „Listă” follows the Path and the view: the Path's skills, no „Starea”, no links.
    await page.getByRole("button", { name: "Listă", exact: true }).click();
    await expect(page.locator("[data-skill-row]")).toHaveCount(inProperties.size);
    await expect(page.locator("[data-skills-list] th").filter({ hasText: "Starea" })).toHaveCount(0);
    await expect(page.locator("[data-skill-row] a")).toHaveCount(0);
    await page.getByRole("button", { name: "Diagramă", exact: true }).click();
    await expect(page.locator('[data-map-view="overview"]').filter({ visible: true })).toHaveAttribute("aria-pressed", "true");

    if (process.env.GA40_MANUAL_FIGURES) {
      // The manual's figure 13.2: the Path „Proprietăți” in „Prezentare”, once per language. Nothing here is a
      // record of the archive, and the view shows no progress of anyone's; „Recente” is blurred as on every figure.
      await page.setViewportSize({ width: 1366, height: 900 });
      for (const [locale, recentTitle] of [["ro-RO", "Recente"], ["en-GB", "Recently viewed"]] as const) {
        const dir = `${FIGURES}/${locale}`;
        fs.mkdirSync(dir, { recursive: true });
        if (locale !== "ro-RO") {
          await page.context().addCookies([{ name: "NEXT_LOCALE", value: locale, domain: "localhost", path: "/" }]);
          await page.goto("/skills-map");
          await expect(frame).toBeVisible({ timeout: 30_000 });
          await page.locator('[data-path-chip="properties"]').filter({ visible: true }).click();
          await page.locator('[data-map-view="overview"]').filter({ visible: true }).click();
          await expect(page.locator('[data-path-note="properties"]')).toBeVisible();
        }
        await page.waitForTimeout(800);
        await page.evaluate((t) => {
          const recent = [...document.querySelectorAll<HTMLElement>("aside div.border-t")].find((d) => (d.textContent ?? "").includes(t));
          if (recent) recent.style.filter = "blur(7px)";
        }, recentTitle);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await frame.evaluate((el) => {
          for (let n: Element | null = el; n; n = n.parentElement) n.scrollTop = 0;
          window.scrollTo(0, 0);
        });
        await page.mouse.move(5, 5);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${dir}/skills-map-path.png` });
        expect(fs.existsSync(`${dir}/skills-map-path.png`)).toBe(true);
      }
      await page.context().addCookies([{ name: "NEXT_LOCALE", value: "ro-RO", domain: "localhost", path: "/" }]);
      await page.goto("/skills-map");
      await expect(frame).toBeVisible({ timeout: 30_000 });
    }

    // Step 8 — „Progresul meu” draws the account's own states again; „Toate traseele” brings every box back.
    await page.locator('[data-map-view="progress"]').filter({ visible: true }).click();
    for (const s of SKILLS) {
      const b = box(page, s.key);
      await expect(b).toHaveAttribute("data-shown", (await b.getAttribute("data-state"))!);
    }
    await expect(page.locator("[data-legend]").filter({ visible: true })).toHaveCount(4);
    await page.getByRole("button", { name: "Toate traseele", exact: true }).click();
    await expect(box(page, key("1.1"))).toHaveCSS("opacity", "1");
    await expect(box(page, key("4.1"))).toHaveCSS("opacity", "1");
  });
});
