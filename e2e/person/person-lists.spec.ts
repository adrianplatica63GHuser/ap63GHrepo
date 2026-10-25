/**
 * Case:   TC-PERS-04 — Listele de persoane: fără filtre de importanță și relevanță, câmpurile identității în „Câmpuri afișate", previzualizarea pe patru rânduri
 * Source: docs/testing/cases/TC-PERS-04.md, „Last green" 2026-10-18
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-PERS-04` (records.ts), and the person's CNP is
 *     `1800101420071` — synthetic like the case's, and not TC-PERS-03's
 *     `1800101420045`, so the two specs can never meet on the unique CNP.
 *   - A Playwright browser has never changed „Câmpuri afișate", so „Before
 *     you start" holds without setting anything aside.
 *   - The preview tiles are measured: as wide as their widest line needs
 *     (narrower than a 3-unit panel) and no taller than three lines and the
 *     buttons need.
 *   - Slice #37.60's pictures, not steps of the case: both lists with
 *     „Câmpuri afișate" open (filtered to this case's record), and a preview
 *     of each kind, at 1366 and 1920 px, into `playwright-report/person-lists/`.
 */

import { test, expect, type Locator, type Page } from "../helpers/test";
import { E2E_MARKER, createCompany, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { listsOnTheirEarlierColumns } from "../helpers/list-columns";

const MARK = `${E2E_MARKER}PERS-04`;
/** #39.28: notes too long for the preview's line, so it is cut. Invented. */
const NOTE = "Notă de test lungă despre o persoană inventată, scrisă ca să nu încapă pe rândul ei din previzualizare, oricât de lată ar fi fereastra";
const CNP = "1800101420071";
const SHOTS = "playwright-report/person-lists";

async function photograph(page: Page, name: string, target: Locator): Promise<void> {
  for (const width of [1366, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(300);
    await target.screenshot({ path: `${SHOTS}/${name}-${width}.png` });
  }
  await page.setViewportSize({ width: 1366, height: 900 });
}

/** The preview's heading and its lines, as text. */
async function previewOf(page: Page): Promise<{ title: string; lines: string[]; width: number; height: number }> {
  const tile = page.locator("[data-preview]");
  await expect(tile.locator("[data-preview-line]").first()).toBeVisible({ timeout: 30_000 });
  return tile.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      title: el.querySelector("h2")?.textContent ?? "",
      // The values only: each value's own text, without its read-aloud label.
      lines: [...el.querySelectorAll("[data-preview-line]")].map((l) =>
        [...l.querySelectorAll("[data-preview-value]")]
          .map((v) => [...v.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""))
          .join(""),
      ),
      width: r.width,
      height: r.height,
    };
  });
}

test.describe("TC-PERS-04 — listele de persoane", () => {
  test("fără filtre; „Câmpuri afișate” cu câmpurile identității; previzualizarea pe patru rânduri", async ({ page }) => {
    // 40.66: the lists open on four default columns; these steps were written against the earlier ones.
    await listsOnTheirEarlierColumns(page);
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1366, height: 900 });
    const personId = await createNaturalPerson(page.request, {
      lastName: MARK, firstName: "Ion", nickname: "Ionel TC", cnp: CNP, dateOfBirth: "1980-01-01", placeOfBirth: "Localitatea Exemplu",
      // #39.28: the second phone and the work e-mail — the first FILLED of each is the one shown; the notes cut.
      personalPhone2: "+40 700 000 001", workEmail: "ion.tc@example.ro", notes: NOTE,
    });
    const typesRes = await page.request.get("/api/admin/value-lists/judicial-person-types");
    const srl = ((await typesRes.json()) as { items: { id: string; name: string }[] }).items.find((t) => t.name === "SRL");
    expect(srl, "„SRL\" among the judicial-person types").toBeTruthy();
    const companyId = await createCompany(page.request, {
      name: `${MARK} Firmă de test SRL`, nickname: "Firma TC", cuiNumber: "RO99999990", tradeRegisterNumber: "J99/9999/2026", judicialPersonTypeId: srl!.id,
      phone: "+40 700 000 002", email: "firma.tc@example.ro", notes: NOTE,
    });
    try {
      // Step 1 — „Persoane Fizice": the search box, no filters, „Câmpuri afișate 0/4".
      await page.goto("/natural-persons");
      const main = page.locator("main");
      await expect(main.getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu")).toBeVisible({ timeout: 30_000 });
      // #39.82: no select on the list again — „+ Filtru" is gone, a filter opens from its column's funnel. #39.62 had
      // „one select, „+ Filtru"", and before it `toHaveCount(0)`.
      await expect(main.locator("select")).toHaveCount(0);
      await expect(main.getByText("Importanță")).toHaveCount(0);
      await expect(main.getByText("Relevanță")).toHaveCount(0);
      const npChooser = main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true });
      await expect(npChooser).toBeVisible();

      // Step 2 — the six fields, in the panel's order.
      await npChooser.click();
      const npPicker = main.locator("[data-field-chooser]");
      // #39.30: + „Data decesului", after „Gen" — the panel's order. #39.70: + „Relația cu firma", last.
      await expect(npPicker.locator("label")).toHaveText([
        // Slice 40.20: Adrian's short names.
        "CNP", "Născut pe", "Vârstă", "Gen", "Decedat pe", "Născut la", "Tip prof.", "Rel.cu VM",
        // 40.55: „Modificat la", last.
        "Modificat la",
      ]);

      // Step 3 — CNP and Data nașterii; the search; the row.
      await npPicker.getByRole("checkbox", { name: "CNP" }).check();
      await npPicker.getByRole("checkbox", { name: "Născut pe" }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await expect(main.getByRole("button", { name: "Câmpuri afișate 2/4", exact: true })).toBeVisible();
      await main.getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu").fill(MARK);
      const npRow = main.locator("tbody tr").filter({ hasText: MARK });
      await expect(npRow).toHaveCount(1, { timeout: 30_000 });
      for (const col of ["NUME", "PORECLĂ", "CNP", "NĂSCUT PE"] /* 40.20: short names */) await expect(main.getByRole("columnheader", { name: col }).first()).toBeVisible();
      await expect(npRow).toContainText(`Ion ${MARK}`);
      await expect(npRow).toContainText("Ionel TC");
      await expect(npRow).toContainText(CNP);
      await expect(npRow).toContainText("01.01.1980");
      // Adrian, 2026-10-18: found by CNP with the search box — and never a filter on CNP: its column has no funnel.
      const npSearch = main.getByPlaceholder("caută după ID, Nume, Poreclă, CNP, Email Personal 1, Email Personal 2, Email serviciu, Telefon Personal 1, Telefon Personal 2 sau Telefon serviciu");
      await npSearch.fill(CNP.slice(0, 10));
      await expect(main.locator("tbody tr").filter({ hasText: CNP })).toHaveCount(1, { timeout: 30_000 });
      await expect(main.locator('[data-width-column="listCnp"] [data-filter-funnel]')).toHaveCount(0);
      await expect(main.getByRole("button", { name: "Filtrează după „CNP”", exact: true })).toHaveCount(0);
      await npSearch.fill(MARK);
      await expect(npRow).toHaveCount(1, { timeout: 30_000 });
      await main.getByRole("button", { name: "Câmpuri afișate 2/4", exact: true }).click();
      await photograph(page, "natural-persons-chooser", main);
      await page.getByRole("heading", { level: 1 }).first().click();

      // Step 4 — the preview: Nume Prenume, then three lines (#39.28); no system ID.
      await npRow.getByRole("button", { name: "Previzualizare", exact: true }).click();
      const np = await previewOf(page);
      expect(np.title).toBe(`${MARK} Ion`);
      // #39.28: it read [`Ionel TC, ${CNP}`, "născut: 01.01.1980, Localitatea Exemplu"] — #37.70's two lines.
      expect(np.lines).toEqual([
        `Ionel TC · CNP: ${CNP} · născut: 01.01.1980, Localitatea Exemplu`,
        "+40 700 000 001 · ion.tc@example.ro",
        NOTE,
      ]);
      // The notes are cut on one line, whole on hover, and do not widen the tile.
      const cut = page.locator("[data-preview] [data-preview-cut]");
      await expect(cut).toHaveAttribute("title", NOTE);
      expect(await cut.evaluate((el) => el.scrollWidth > el.clientWidth && getComputedStyle(el).textOverflow === "ellipsis")).toBe(true);
      await expect(page.locator("[data-preview]")).not.toContainText(/PPERS\d+/);
      await expect(page.locator("[data-preview]")).not.toContainText("Prenume");
      const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
      // Slice #39.04: on a list the preview is the row tiles' column's width, 40 rem. It read
      // `expect(np.width).toBeLessThan((3 * 9.25 + 2) * rem)` — three units and a little.
      expect(Math.abs(np.width - 40 * rem)).toBeLessThanOrEqual(2);
      expect(np.height).toBeLessThan(10 * rem);
      await photograph(page, "natural-person-preview", page.locator("[data-preview]"));

      // Step 5 — „Persoane Juridice": „Câmpuri afișate 0/4", its four fields (#37.71: „Persoană de contact").
      await page.goto("/judicial-persons");
      await expect(main.getByPlaceholder("caută după ID, Denumire, Poreclă, Nr. înregistrare (CUI), Telefon firmă sau E-mail firmă")).toBeVisible({ timeout: 30_000 });
      await main.getByRole("button", { name: "Câmpuri afișate 0/4", exact: true }).click();
      const jpPicker = main.locator("[data-field-chooser]");
      // #39.82: „Localitate" after them — the head office's, so its filter has a column.
      await expect(jpPicker.locator("label")).toHaveText(["Tip", "CUI", "#Reg. Com.", "Contact", "Localitate", "Modificat la"]); // 40.20: short names; 40.55: „Modificat la", last

      // Step 6 — Nr. înregistrare (CUI); the search; the row.
      await jpPicker.getByRole("checkbox", { name: "CUI", exact: true }).check();
      await page.getByRole("heading", { level: 1 }).first().click();
      await main.getByPlaceholder("caută după ID, Denumire, Poreclă, Nr. înregistrare (CUI), Telefon firmă sau E-mail firmă").fill(MARK);
      const jpRow = main.locator("tbody tr").filter({ hasText: MARK });
      await expect(jpRow).toHaveCount(1, { timeout: 30_000 });
      await expect(main.getByRole("columnheader", { name: "CUI", exact: true })).toBeVisible();
      await expect(jpRow).toContainText("RO99999990");
      await main.getByRole("button", { name: "Câmpuri afișate 1/4", exact: true }).click();
      await photograph(page, "judicial-persons-chooser", main);
      await page.getByRole("heading", { level: 1 }).first().click();

      // Step 7 — the preview: Denumire, then two lines; no system ID.
      await jpRow.getByRole("button", { name: "Previzualizare", exact: true }).click();
      const jp = await previewOf(page);
      expect(jp.title).toBe(`${MARK} Firmă de test SRL`);
      // #39.28: no count of its contact persons after the heading (#37.70 read „(niciun contact)”), no „Tip”, no
      // „Nr. Reg. Com.” — it read ["Firma TC, SRL", "RO99999990, J99/9999/2026"].
      await expect(page.locator("[data-preview] [data-preview-title-note]")).toHaveCount(0);
      expect(jp.lines).toEqual(["Firma TC · CUI: RO99999990", "+40 700 000 002 · firma.tc@example.ro", NOTE]);
      await expect(page.locator("[data-preview]")).not.toContainText(/JPERS\d+/);
      await photograph(page, "judicial-person-preview", page.locator("[data-preview]"));
    } finally {
      await removeRecord(page.request, "person", personId);
      await removeRecord(page.request, "company", companyId);
    }
  });
});
