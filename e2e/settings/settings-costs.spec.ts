/**
 * Case:   TC-SET-04 — „Setări”: părțile alese din căsuțe; „Costuri”, un furnizor pe parte, strâns la un rând
 * Source: docs/testing/cases/TC-SET-04.md, „Last green" 2026-10-13
 *
 * A translation of the case file, step for step (Slice #39.17; „Street View",
 * „Adrese căutate" and „Testare"'s three counts, Slice #39.19). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The figures are read by their shape, not their value: they change every
 *     day, and the known Google bill leaves the month's figures in November.
 *   - „Testare"'s counts are read by their shape too, and either form is taken:
 *     counted on the runner's laptop, „Numărul hărților … doar pe laptopul …"
 *     anywhere without the runner's ledger.
 */

import { test, expect, type Page } from "../helpers/test";
import { hideTile, showTile, tileBox } from "../helpers/tiles";

/** The note that marks this case's amount, so `finally` removes it and nothing else. */
const MARK = "TC-E2E-SET-04";

/** Removes every entered amount this case left, through the DELETE the tile's „Șterge suma" calls. */
async function removeMarked(page: Page): Promise<void> {
  const res = await page.request.get("/api/admin/costs");
  expect(res.ok()).toBe(true);
  const body = (await res.json()) as { providers: { entered: { id: string; note: string | null }[] }[] };
  for (const e of body.providers.flatMap((p) => p.entered).filter((x) => x.note === MARK)) {
    expect((await page.request.delete(`/api/admin/costs?id=${e.id}`)).status()).toBe(204);
  }
}

const PROVIDERS = [
  "AI",
  "Abonament Claude",
  "Google Maps",
  "Street View",
  "Adrese căutate",
  "Supabase",
  "Vercel",
  "Resend (e-mail)",
  "GitHub",
  "Domeniu web",
  "Testare",
];
const COUNT = String.raw`[\d.]+`;
const MONEY = String.raw`CA\$[\d,]+\.\d{2}`;

test.describe("TC-SET-04 — „Setări”: căsuțele și „Costuri”", () => {
  test("unsprezece furnizori strânși la un rând; „Detalii” arată condițiile, partea gratuită și prețul verificat", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/admin/settings");
    const main = page.locator("main");

    // Step 1 — the boxes: the screen's own tiles and the eleven providers, all ticked.
    for (const name of ["Contul meu", "Praguri de timp", "Copii de siguranță", "Despre", ...PROVIDERS]) {
      await expect(tileBox(page, name)).toBeChecked({ timeout: 30_000 });
    }

    // Step 2 — every cost tile collapsed to one line.
    for (const name of PROVIDERS) {
      const tile = main.getByRole("region", { name, exact: true });
      await expect(tile).toHaveAttribute("data-cost-state", "collapsed");
      await expect(tile.locator("[data-cost-line]")).toBeVisible({ timeout: 30_000 });
    }
    const maps = main.getByRole("region", { name: "Google Maps", exact: true });
    await expect(maps.locator("[data-cost-line]")).toHaveText(new RegExp(`^Luna aceasta: ${MONEY} · prognoză: ${MONEY}$`));
    const ai = main.getByRole("region", { name: "AI", exact: true });
    await expect(ai.locator("[data-cost-line]")).toHaveText(new RegExp(`^Estimat luna aceasta: ${MONEY} · prognoză: ${MONEY}$`));

    // Step 3 — „Detalii" on Google Maps.
    await maps.getByRole("button", { name: "Detalii", exact: true }).click();
    await expect(maps).toHaveAttribute("data-cost-state", "expanded");
    for (const heading of ["Ce se plătește", "Gratuit", "Cum se plătește", "Costul în timp"]) {
      await expect(maps.getByRole("heading", { name: heading, exact: true })).toBeVisible();
    }
    await expect(maps.getByText("Pe lună: 10.000 de hărți, 5.000 de Street View și 10.000 de adrese căutate.", { exact: true })).toBeVisible();
    await expect(maps.getByText(/^Prețuri verificate la \d{2}\.\d{2}\.\d{4} pe/)).toBeVisible();
    await expect(maps.getByRole("link", { name: "pagina de prețuri a furnizorului" })).toHaveAttribute(
      "href",
      "https://developers.google.com/maps/billing-and-pricing/pricing",
    );
    await expect(maps.getByText(/^Luna aceasta, până azi$/)).toBeVisible();
    await expect(maps.getByText(/^Prognoză la sfârșitul lunii$/)).toBeVisible();

    // Step 4 — „Restrânge": one line again.
    await maps.getByRole("button", { name: "Restrânge", exact: true }).click();
    await expect(maps).toHaveAttribute("data-cost-state", "collapsed");

    // Steps 5–6 (#39.19) — „Street View" and „Adrese căutate": the same sections as „Google Maps", the prices read on
    // 13.10.2026, and the month's use — the tests' count and people's estimate, said as one — against the free part.
    for (const [name, free, estimate] of [
      ["Street View", "Pe lună: 5.000 de panorame, separat de cele 10.000 de hărți. Testele își permit cel mult 1.500 din ele.", /^De la oameni: cam 10 pe zi, \d+ pe lună — o estimare, nu o numărătoare\./],
      ["Adrese căutate", "Pe lună: 10.000 de căutări, separat de hărți și de Street View. Testele își permit cel mult 3.000 din ele.", /^De la oameni: cam 5 pe zi, \d+ pe lună — o estimare, nu o numărătoare\./],
    ] as const) {
      const tile = main.getByRole("region", { name, exact: true });
      await expect(tile.locator("[data-cost-line]")).toHaveText(new RegExp(`^Luna aceasta: ${MONEY} · prognoză: ${MONEY}$`));
      await tile.getByRole("button", { name: "Detalii", exact: true }).click();
      await expect(tile).toHaveAttribute("data-cost-state", "expanded");
      for (const heading of ["Ce se plătește", "Gratuit", "Cum se plătește", "Costul în timp", "Sume introduse"]) {
        await expect(tile.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      }
      await expect(tile.getByText(free, { exact: true })).toBeVisible();
      await expect(tile.getByText(/^Prețuri verificate la 13\.10\.2026 pe/)).toBeVisible();
      await expect(tile.getByRole("link", { name: "pagina de prețuri a furnizorului" })).toHaveAttribute(
        "href",
        "https://developers.google.com/maps/billing-and-pricing/pricing",
      );
      await expect(tile.getByText(/^Google nu a facturat nimic încă pentru asta/)).toBeVisible();
      await expect(tile.getByText(new RegExp(`^Din teste: (${COUNT} până azi, numărate|nenumărate pe acest calculator)`))).toBeVisible();
      await expect(tile.getByText(estimate)).toBeVisible();
      await expect(tile.getByText(new RegExp(`^Toată luna: cam ${COUNT} din ${COUNT} gratuite — `))).toBeVisible();
      await tile.getByRole("button", { name: "Restrânge", exact: true }).click();
      await expect(tile).toHaveAttribute("data-cost-state", "collapsed");
    }

    // Step 7 (#39.19) — „Testare": the tests' maps, panoramas and look-ups this month, each against its ceiling.
    const testing = main.getByRole("region", { name: "Testare", exact: true });
    await testing.getByRole("button", { name: "Detalii", exact: true }).click();
    const counted = testing.locator("[data-cost-tests]");
    const away = testing.getByText("Numărul hărților din teste se vede doar pe laptopul cu programul de testare.", { exact: true });
    await expect(counted.or(away)).toBeVisible({ timeout: 30_000 });
    if (await counted.isVisible()) {
      await expect(counted.locator("li")).toHaveText([
        new RegExp(`^Hărți reale în teste luna aceasta: ${COUNT} din plafonul de 3\\.000\\.$`),
        new RegExp(`^Panorame Street View în teste (luna aceasta: ${COUNT} din plafonul de|: nenumărate încă \\(plafonul:) 1\\.500`),
        new RegExp(`^Adrese căutate în teste (luna aceasta: ${COUNT} din plafonul de|: nenumărate încă \\(plafonul:) 3\\.000`),
      ]);
    }
    await testing.getByRole("button", { name: "Restrânge", exact: true }).click();

    // Step 8 — „AI" expanded: what it showed before, and the price of one read.
    await ai.getByRole("button", { name: "Detalii", exact: true }).click();
    await expect(ai.getByText("Extragerea datelor din acte", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(ai.locator("dd").first()).toHaveText(/^claude-/);
    await expect(ai.getByText(/^O citire e socotită la 0\.15 US\$/)).toBeVisible();

    // Step 9 — „Testare" unticked leaves the page; „Implicit" brings it back.
    await hideTile(page, "Testare");
    await page.getByRole("button", { name: "Implicit", exact: true }).click();
    await expect(main.getByRole("region", { name: "Testare", exact: true })).toBeVisible();
    await showTile(page, "Testare");
  });

  test("o sumă introdusă pe „Domeniu web” apare în lună și se șterge", async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto("/admin/settings");
    await removeMarked(page);
    try {
      // Step 10 — „Domeniu web": „Detalii", then a year's fee for this month's first day.
      const tile = page.locator("main").getByRole("region", { name: "Domeniu web", exact: true });
      await tile.getByRole("button", { name: "Detalii", exact: true }).click();
      await expect(tile.getByRole("heading", { name: "Sume introduse", exact: true })).toBeVisible({ timeout: 30_000 });
      const first = new Date().toISOString().slice(0, 8) + "01";
      await tile.getByLabel("De la", { exact: true }).fill(first);
      await tile.getByLabel("Până la", { exact: true }).fill(first);
      await tile.getByLabel("Suma", { exact: true }).fill("10");
      await tile.getByLabel("Moneda", { exact: true }).selectOption("EUR");
      await tile.getByLabel("Curs în CA$", { exact: true }).fill("1.5");
      await tile.getByLabel("Notă", { exact: true }).fill(MARK);
      await tile.getByRole("button", { name: "Adaugă o sumă", exact: true }).click();
      const row = tile.locator("[data-cost-entered-row]").filter({ hasText: MARK });
      await expect(row).toBeVisible({ timeout: 30_000 });
      await expect(row).toContainText("10.00 EUR");
      await expect(row).toContainText("≈ CA$15.00");
      await expect(tile.locator("[data-cost-so-far]")).not.toHaveAttribute("data-cost-so-far", "0");

      // Step 11 — „Șterge suma": the row leaves.
      await row.getByRole("button", { name: "Șterge suma", exact: true }).click();
      await expect(tile.locator("[data-cost-entered-row]").filter({ hasText: MARK })).toHaveCount(0, { timeout: 30_000 });
    } finally {
      await removeMarked(page);
    }
  });
});
