/**
 * Case:   TC-SET-02 — „Setări” în patru secțiuni; exemplul unui prag se schimbă odată cu valoarea
 * Source: docs/testing/cases/TC-SET-02.md, „Last green" 2026-10-08
 *
 * A translation of the case file, step for step (Slice #38.40). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - Step 4 saves nothing: the threshold is typed and then „Anulează”. Step 8
 *     (Slice 39.92) saves the make-room delay, and the value it found is put
 *     back through the API in `finally`, whatever happened.
 *   - Slice #38.40's pictures, not steps of the case: „Setări” at 1366 and
 *     1920 px, into `playwright-report/settings-sections/`.
 */

import { test, expect, type Page } from "../helpers/test";
import { accountEntry } from "../helpers/sidebar";

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

    // Step 2 — the thresholds in five groups (39.92: „Fișe").
    for (const group of ["Tablou de bord", "Acte", "Persoane", "Insigna „Nou!”", "Fișe"]) {
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
    // Since #39.17 „AI" is a cost part that opens collapsed: „Detalii" first.
    const ai = main.getByRole("region", { name: "AI", exact: true });
    await ai.getByRole("button", { name: "Detalii", exact: true }).click();
    for (const use of ["Extragerea datelor din acte", "Citirea cărților de identitate", "Clasificarea fișierelor la import", "Gruparea mostrelor (Instrumente)"]) {
      await expect(ai.getByText(use, { exact: true })).toBeVisible();
    }
    await expect(ai.locator("dd").first()).toHaveText(/^claude-/);
    const about = main.getByRole("region", { name: "Despre", exact: true });
    for (const label of ["Versiune", "Commit", "Mediu", "Bază de date"]) {
      await expect(about.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(about).not.toContainText("password");

    // Step 7 (#38.41) — „Contul meu": the password's two fields and the language; the
    // sidebar's footer is the account entry (40.59; it read „Ieșire" alone).
    const account = main.getByRole("region", { name: "Contul meu", exact: true });
    await expect(account.getByLabel("Parola nouă", { exact: false })).toBeVisible();
    await expect(account.getByRole("radio", { name: "Română", exact: true })).toBeChecked();
    await expect(account.getByRole("radio", { name: "English", exact: true })).not.toBeChecked();
    await expect(page.locator("aside").getByRole("link", { name: "Schimbă parola" })).toHaveCount(0);
    // 40.59: „Ieșire" is in the account menu; the sidebar's footer is the account entry.
    await expect(accountEntry(page)).toBeVisible();
    await photograph(page, "settings");

    // Step 8 (39.92) — „Timp de ținere peste altă fișă", in seconds with decimals: 0,1 refused; 1,25 saved and kept.
    const delayOf = async (): Promise<number> => {
      const items = ((await (await page.request.get("/api/time-frames")).json()) as { items: { key: string; value: number }[] }).items;
      return items.find((i) => i.key === "tile_make_room_delay")?.value ?? 1000;
    };
    const before = await delayOf();
    try {
      const panel = main.locator('[data-panel="time-frames"]');
      const delay = panel.getByLabel("Timp de ținere peste altă fișă", { exact: true });
      const delayExample = panel.locator('[data-time-frame-example="tile_make_room_delay"]');
      const save = panel.getByRole("button", { name: "Salvează", exact: true });
      await delay.fill("0,1");
      await save.click();
      await expect(panel.getByText("Timpul de ținere peste altă fișă se scrie în secunde, cu cel mult două zecimale, între 0,2 și 10 — de exemplu 1,5.", { exact: true })).toBeVisible();
      const value = before === 1250 ? "1,5" : "1,25";
      await delay.fill(value);
      await expect(delayExample).toHaveText(`Exemplu: O fișă trasă peste alta și ținută acolo ${value} secunde o face pe aceea să alunece în jos, ca să-i facă loc.`);
      await save.click();
      await expect(panel.getByText("Salvat cu succes.", { exact: true })).toBeVisible({ timeout: 15_000 });
      expect(await delayOf()).toBe(value === "1,25" ? 1250 : 1500);
      await page.reload();
      await expect(main.locator('[data-panel="time-frames"]').getByLabel("Timp de ținere peste altă fișă", { exact: true })).toHaveValue(value, { timeout: 30_000 });
    } finally {
      await page.request.patch("/api/time-frames", { data: { settings: [{ key: "tile_make_room_delay", value: before }] } }).catch(() => undefined);
    }
  });
});
