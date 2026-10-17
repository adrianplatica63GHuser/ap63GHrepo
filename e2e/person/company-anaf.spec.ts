/**
 * Case:   TC-PERS-14 — „Completează din ANAF” pe o persoană juridică
 * Source: docs/testing/cases/TC-PERS-14.md, „Last green" 2026-10-17 (Slice #39.64)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - ANAF is not asked: the app's route `/api/judicial-persons/anaf` is answered in the browser with what it
 *     answered on 2026-10-17 for CUI 2816464 (src/lib/anaf/recorded-answers.ts, read into the route's shape), and
 *     with its „notFound" for 12 — a test must not depend on ANAF's firewall or change when ANAF's data does. The
 *     proposed „Tip" is this database's „SRL".
 *   - The name carries `TC-E2E-PERS-14` (records.ts). Step 5 opens the record by its address, found through the
 *     list's API, rather than by a click in the list.
 */

import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PERS-14`;
const NAME = `${MARK} Dedeman`;

const DEDEMAN = {
  cui: "2816464",
  name: "DEDEMAN SRL",
  tradeRegisterNumber: "",
  phone: "0234513330",
  address: { streetLine: "Str. Alexei Tolstoi nr. 8", postalCode: "600093", locality: "Mun. Bacău", county: "Bacău", country: "România" },
  legalForm: "SOCIETATE COMERCIALĂ CU RĂSPUNDERE LIMITATĂ",
  inactiveSince: null,
  deregisteredOn: null,
};

async function answerAnaf(page: Page, srl: { id: string; name: string }): Promise<string[]> {
  const asked: string[] = [];
  await page.route("**/api/judicial-persons/anaf?*", async (route) => {
    const cui = new URL(route.request().url()).searchParams.get("cui") ?? "";
    asked.push(cui);
    if (cui.replace(/\s|RO/gi, "") === "2816464") {
      await route.fulfill({ json: { kind: "found", version: "v9", company: DEDEMAN, proposedType: srl } });
    } else {
      await route.fulfill({ json: { kind: "notFound", version: "v9" } });
    }
  });
  return asked;
}

test.describe("TC-PERS-14 — „Completează din ANAF”", () => {
  test("un CUI necunoscut, ce s-ar schimba, „Preia bifele”, „Salvează”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const types = (await (await page.request.get("/api/admin/value-lists/judicial-person-types")).json()) as { items: { id: string; name: string }[] };
    const srl = types.items.find((t) => t.name === "SRL");
    expect(srl, "the database has no „SRL” juridical person type").toBeTruthy();
    const asked = await answerAnaf(page, { id: srl!.id, name: srl!.name });
    let id: string | null = null;
    try {
      const main = page.locator("main");
      const button = main.getByRole("button", { name: "Completează din ANAF" });
      const dialog = page.locator("[data-anaf-dialog]");
      const rows = dialog.locator("[data-anaf-row]");
      const box = (name: string) => main.locator(`[name="${name}"]`);

      // Step 1 — „Adaugă persoană juridică": the button greyed out, „Scrieți întâi CUI-ul.".
      await page.goto("/judicial-persons");
      await main.getByRole("link", { name: "Adaugă persoană juridică" }).click();
      await expect(button).toBeDisabled({ timeout: 30_000 });
      await expect(page.getByText("Scrieți întâi CUI-ul.")).toBeAttached();

      // Step 2 — CUI 12: „ANAF nu cunoaște CUI-ul 12."; ✕ closes it.
      await box("cuiNumber").fill("12");
      await button.click();
      await expect(dialog.getByRole("heading")).toHaveText("Date din ANAF pentru CUI 12");
      await expect(dialog.locator("[data-anaf-status]")).toHaveText("ANAF nu cunoaște CUI-ul 12.");
      await dialog.getByRole("button", { name: "Renunță" }).click();
      await expect(dialog).toHaveCount(0);

      // Step 3 — the name, CUI RO 2816464: the rows; Denumire not ticked, the seven others ticked; no ORC row.
      await box("name").fill(NAME);
      await box("cuiNumber").fill("RO 2816464");
      await button.click();
      await expect(dialog.getByRole("heading")).toHaveText("Date din ANAF pentru CUI RO 2816464");
      const want: [string, string, string, boolean][] = [
        ["Denumire", NAME, "DEDEMAN SRL", false],
        ["Telefon firmă", "(gol)", "0234513330", true],
        ["Tip", "(gol)", "SRL", true],
        ["Sediu: Stradă, Nr., etaj, ap", "(gol)", "Str. Alexei Tolstoi nr. 8", true],
        ["Sediu: Cod poștal", "(gol)", "600093", true],
        ["Sediu: Localitate", "(gol)", "Mun. Bacău", true],
        ["Sediu: Județ / Sector", "(gol)", "Bacău", true],
        ["Sediu: Țară", "(gol)", "România", true],
      ];
      await expect(rows).toHaveCount(want.length);
      for (const [i, [field, now, anaf, ticked]] of want.entries()) {
        const cells = rows.nth(i).locator("td");
        await expect(cells.nth(0)).toHaveText(field);
        await expect(cells.nth(1)).toHaveText(now);
        await expect(cells.nth(2)).toHaveText(anaf);
        await expect(cells.nth(3).locator("input")).toBeChecked({ checked: ticked });
      }

      // Step 4 — „Preia bifele": closed, the line, the name kept, the seven filled.
      await dialog.getByRole("button", { name: "Preia bifele" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(main.getByText("Câmpurile s-au completat din ANAF. Verificați-le și apăsați „Salvează”.")).toBeVisible();
      await expect(box("name")).toHaveValue(NAME);
      await expect(box("phone")).toHaveValue("0234513330");
      await expect(box("judicialPersonTypeId")).toHaveValue(srl!.id);
      for (const [k, v] of Object.entries(DEDEMAN.address)) await expect(box(`addresses.HEADQUARTERS.${k}`)).toHaveValue(v);

      // Step 5 — „Salvează", then the record: it holds them.
      await main.getByRole("button", { name: "Salvează" }).click();
      await expect(page).toHaveURL(/\/judicial-persons(\?.*)?$/, { timeout: 30_000 });
      const found = (await (await page.request.get(`/api/judicial-persons?q=${encodeURIComponent(MARK)}`)).json()) as { items: { id: string }[] };
      expect(found.items).toHaveLength(1);
      id = found.items[0].id;
      await page.goto(`/judicial-persons/${id}`);
      await expect(box("name")).toHaveValue(NAME, { timeout: 30_000 });
      await expect(box("cuiNumber")).toHaveValue("RO 2816464");
      await expect(box("phone")).toHaveValue("0234513330");
      await expect(box("judicialPersonTypeId")).toHaveValue(srl!.id);
      for (const [k, v] of Object.entries(DEDEMAN.address)) await expect(box(`addresses.HEADQUARTERS.${k}`)).toHaveValue(v);

      // Step 6 — again: only Denumire, not ticked; „Preia bifele" disabled; ✕ closes it.
      await button.click();
      await expect(rows).toHaveCount(1);
      await expect(rows.first().locator("td").first()).toHaveText("Denumire");
      await expect(rows.first().locator("input")).not.toBeChecked();
      await expect(dialog.getByRole("button", { name: "Preia bifele" })).toBeDisabled();
      await dialog.getByRole("button", { name: "Renunță" }).click();
      await expect(dialog).toHaveCount(0);
      expect(asked.map((c) => c.replace(/\s/g, ""))).toEqual(["12", "RO2816464", "RO2816464"]);
    } finally {
      if (id) await removeRecord(page.request, "company", id);
      await removeLeftovers(page.request, MARK);
    }
  });
});
