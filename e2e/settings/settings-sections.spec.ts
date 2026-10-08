/**
 * Case:   TC-SET-02 — „Setări” în patru secțiuni; exemplul unui prag se schimbă odată cu valoarea
 * Source: docs/testing/cases/TC-SET-02.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.40). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Nothing is saved: the threshold is typed and then „Anulează” — the case
 *     changes no setting, so it has nothing to put back.
 *   - Slice #38.40's pictures, not steps of the case: „Setări” at 1366 and
 *     1920 px, into `playwright-report/settings-sections/`.
 */

import { test, expect, type Page } from "@playwright/test";

const SHOTS = "playwright-report/settings-sections";

async function photograph(page: Page, name: string): Promise<void> {
  for (const width of [1366, 1920]) {
    // A window tall enough for the whole of „Setări”: `main` scrolls inside the page, so a
    // shorter one photographed its upper part blank (20261008T093730Z-1005) and a full-page
    // shot only the window's worth (20261008T095645Z-17464).
    await page.setViewportSize({ width, height: 2400 });
    await page.waitForTimeout(300);
    await page.locator("main").screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

/** The Romanian words for n days, as the example prints them. */
function days(n: number): string {
  if (n === 1) return "o zi";
  const rest = n % 100;
  return n === 0 || (rest >= 1 && rest <= 19) ? `${n} zile` : `${n} de zile`;
}

test.describe("TC-SET-02 — „Setări” în patru secțiuni", () => {
  test("patru secțiuni, patru grupuri de praguri; exemplul urmează valoarea tastată", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });

    // Step 1 — four sections.
    await page.goto("/admin/settings");
    const main = page.locator("main");
    for (const title of ["Contul meu", "Praguri de timp", "Copii de siguranță", "AI", "Despre"]) {
      await expect(main.getByRole("heading", { name: title, exact: true, level: 2 })).toBeVisible({ timeout: 30_000 });
    }

    // Step 2 — the thresholds in four groups.
    for (const group of ["Tablou de bord", "Acte", "Persoane", "Insigna „Nou!”"]) {
      await expect(main.getByRole("heading", { name: group, exact: true, level: 3 })).toBeVisible();
    }

    // Step 3 — „Fereastră filtru expiră curând": its example names its value.
    const box = page.getByLabel("Fereastră filtru expiră curând", { exact: true });
    const example = main.locator('[data-time-frame-example="documents_expiring_soon"]');
    const saved = Number(await box.inputValue());
    await expect(example).toHaveText(`Exemplu: Un act apare «expiră curând» cu ${days(saved)} înainte.`);

    // Step 4 — typed 45: the example says 45 before anything is saved; „Anulează” puts it back.
    const typed = saved === 45 ? 46 : 45;
    await box.fill(String(typed));
    await expect(example).toHaveText(`Exemplu: Un act apare «expiră curând» cu ${days(typed)} înainte.`);
    await page.getByRole("button", { name: "Anulează", exact: true }).click();
    await expect(box).toHaveValue(String(saved));
    await expect(example).toHaveText(`Exemplu: Un act apare «expiră curând» cu ${days(saved)} înainte.`);

    // Step 5 — „Copii de siguranță" reads the last backup and drill, or says it cannot.
    const backups = main.getByRole("region", { name: "Copii de siguranță", exact: true });
    await expect(backups.locator("[data-backups]").first()).toBeVisible({ timeout: 30_000 });
    const reachable = (await backups.locator('[data-backups="unreachable"]').count()) === 0;
    if (reachable) {
      await expect(backups.getByText("Ultima copie", { exact: true })).toBeVisible();
      await expect(backups.getByText("Ultima probă de restaurare", { exact: true })).toBeVisible();
    } else {
      await expect(backups.getByText("Copiile de siguranță nu pot fi citite de aici", { exact: false })).toBeVisible();
    }
    await expect(backups.getByRole("button")).toHaveCount(0); // read-only: nothing to start

    // Step 6 — „AI": the four uses and a model each; „Despre": version, commit, environment, database.
    const ai = main.getByRole("region", { name: "AI", exact: true });
    for (const use of ["Extragerea datelor din acte", "Citirea cărților de identitate", "Clasificarea fișierelor la import", "Gruparea mostrelor (Funcții)"]) {
      await expect(ai.getByText(use, { exact: true })).toBeVisible();
    }
    await expect(ai.locator("dd").first()).toHaveText(/^claude-/);
    const about = main.getByRole("region", { name: "Despre", exact: true });
    for (const label of ["Versiune", "Commit", "Mediu", "Bază de date"]) {
      await expect(about.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(about).not.toContainText("password");

    // Step 7 (#38.41) — „Contul meu": the password's two fields and the language; the
    // sidebar's footer keeps „Ieșire" alone.
    const account = main.getByRole("region", { name: "Contul meu", exact: true });
    await expect(account.getByLabel("Parola nouă", { exact: false })).toBeVisible();
    await expect(account.getByRole("radio", { name: "Română", exact: true })).toBeChecked();
    await expect(account.getByRole("radio", { name: "English", exact: true })).not.toBeChecked();
    await expect(page.locator("aside").getByRole("link", { name: "Schimbă parola" })).toHaveCount(0);
    await expect(page.locator("aside").getByRole("button", { name: "Ieșire", exact: true })).toBeVisible();
    await photograph(page, "settings");
  });
});
