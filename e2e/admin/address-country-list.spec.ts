/**
 * Case:   TC-VL-12 — „Țara adresei” după „Cetățenie”, cu cele opt țări; o schimbare în una cere verificarea celeilalte
 * Source: docs/testing/cases/TC-VL-12.md, „Last green" 2026-11-02
 *
 * Slice 41.51. An invented country (`TC-E2E-VL-12 Țară`) is added through the screen and deleted through it; nothing
 * else in either list changes. Maps are not on these screens.
 */
import { test, expect, type APIRequestContext } from "../helpers/test";
import { E2E_MARKER } from "../helpers/records";

const MARK = `${E2E_MARKER}VL-12`;
const NEW = `${MARK} Țară`;
const LIST = "/api/admin/value-lists/address-countries";
const EIGHT = ["România", "Moldova", "Statele Unite ale Americii", "Germania", "Franța", "Italia", "Spania", "Regatul Unit"];
const SISTER_NOTICE = "Ați salvat o schimbare în „Cetățenie”. Verificați dacă „Țara adresei” are nevoie de aceeași schimbare, ca listele să rămână în acord.";
const NOTICE = "Ați salvat o schimbare în „Țara adresei”. Verificați dacă „Cetățenie” are nevoie de aceeași schimbare, ca listele să rămână în acord.";

async function removeMine(request: APIRequestContext): Promise<void> {
  const res = await request.get(LIST);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { items?: { id: string; name: string }[] };
  for (const v of body.items ?? []) if (v.name.startsWith(MARK)) await request.delete(`${LIST}/${v.id}`);
}

test.describe("TC-VL-12 — „Țara adresei”", () => {
  test("după „Cetățenie”, cele opt țări; adăugată și ștearsă, de fiecare dată nota despre „Cetățenie”", async ({ page }) => {
    test.slow();
    await removeMine(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    try {
      // Step 1 — the list, right after „Cetățenie" in „Liste de valori"; its eight countries in their order.
      await page.goto("/admin/value-lists?list=address-countries");
      const nav = page.getByRole("navigation", { name: "Liste de referință" });
      const group = nav.locator("[data-category]").filter({ has: page.getByRole("button", { name: "Cetățenie", exact: true }) });
      await expect(group.locator("button[data-list-key]")).toHaveText(["Indicative Tarla", "Cetățenie", "Țara adresei", "Relația cu firma"], { timeout: 30_000 });
      const panel = page.getByRole("region", { name: "Țara adresei", exact: true });
      // The rows once loaded (a „Se încarcă…" row stands first while the list is fetched).
      await expect(panel.locator("tbody tr td:first-child").first()).toHaveText("România", { timeout: 30_000 });
      const names = await panel.locator("tbody tr td:first-child").allInnerTexts();
      expect(names.map((n) => n.trim()).slice(0, 8)).toEqual(EIGHT);

      // Step 2 — „Adaugă" a country: saved, and the notice names „Cetățenie"; it stays until „Închide".
      await panel.locator("[data-value-list-head]").getByRole("button", { name: "+ Adaugă", exact: true }).click();
      await panel.getByRole("textbox").first().fill(NEW);
      await panel.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(panel.getByText(NEW, { exact: true })).toBeVisible({ timeout: 30_000 });
      const notice = page.locator("[data-notice-text]");
      await expect(notice).toHaveText(NOTICE);
      await page.waitForTimeout(4500); // longer than a toast's 4 s: a notice stays
      await expect(notice).toBeVisible();
      await page.locator("[data-notice-close]").click();
      await expect(notice).toHaveCount(0);

      // Step 3 — „Șterge" it: the same notice.
      const row = panel.locator("tbody tr").filter({ hasText: NEW });
      await row.getByRole("button", { name: "Șterge", exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(panel.getByText(NEW, { exact: true })).toHaveCount(0, { timeout: 30_000 });
      await expect(notice).toHaveText(NOTICE);
      await page.locator("[data-notice-close]").click();

      // Step 4 — 41.52: „Cetățenie" has „Forme tipărite"; saved on „Română", the notice names „Țara adresei". Put back.
      await page.goto("/admin/value-lists?list=citizenships");
      const citizenships = page.getByRole("region", { name: "Cetățenie", exact: true });
      const romana = citizenships.locator("tbody tr").filter({ has: page.getByText("Română", { exact: true }) });
      await expect(romana).toHaveCount(1, { timeout: 30_000 });
      await romana.getByRole("button", { name: "Editează", exact: true }).click();
      // The form's second box (its labels are not tied to the boxes): „Denumire", then „Forme tipărite".
      await expect(citizenships.getByText("Forme tipărite", { exact: true }).first()).toBeVisible();
      const forms = citizenships.getByRole("textbox").nth(1);
      const before = await forms.inputValue();
      await forms.fill(`ROU, ${MARK}`);
      await citizenships.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(romana).toContainText(`ROU, ${MARK}`, { timeout: 30_000 });
      await expect(notice).toHaveText(SISTER_NOTICE);
      await romana.getByRole("button", { name: "Editează", exact: true }).click();
      await forms.fill(before);
      await citizenships.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(romana).not.toContainText(MARK, { timeout: 30_000 });
    } finally {
      await removeMine(page.request);
    }
  });
});

/** 42.03 — „Folosit de” counts the addresses that write a country's name; „Forme tipărite” says what it is. */
test.describe("TC-VL-12 — „Țara adresei” numărată, „Forme tipărite” explicată (42.03)", () => {
  test("„România” e folosită de adresele seed-ului; bula de pe „Forme tipărite”", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto("/admin/value-lists?list=address-countries");
    const panel = page.getByRole("region", { name: "Țara adresei", exact: true });
    const romania = panel.locator("tbody tr").filter({ has: page.locator("td:first-child", { hasText: /^România$/ }) });
    await expect(romania.locator("[data-usage]")).not.toHaveText("…", { timeout: 30_000 });
    // Every seeded person's and property's address writes „România": it is used, so it is not greyed or last.
    const n = Number(await romania.locator("[data-usage]").getAttribute("data-usage"));
    expect(n, "„România”'s addresses").toBeGreaterThan(0);
    await expect(romania).not.toHaveAttribute("data-unused", "");

    await page.goto("/admin/value-lists?list=citizenships");
    const cit = page.getByRole("region", { name: "Cetățenie", exact: true });
    await expect(cit.locator("[data-printed-forms-head]")).toBeVisible({ timeout: 30_000 });
    await cit.getByRole("button", { name: "Ce sunt formele tipărite?", exact: true }).click();
    await expect(page.getByText("Cum scrie actul de identitate această cetățenie (ex. ROU, ROUMAINE), despărțite prin virgulă — importul cărții de identitate le folosește ca să găsească cetățenia.", { exact: true })).toBeVisible();
  });
});
