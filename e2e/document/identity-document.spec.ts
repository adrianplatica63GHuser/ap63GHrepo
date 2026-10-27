/**
 * Case:   TC-DOC-28 — Actul de identitate pe ecranul lui: un tile pe tip, VALABIL / EXPIRAT, CNP-ul verificat, tipul schimbat
 * Source: docs/testing/cases/TC-DOC-28.md
 *
 * Slice 40.83. The four identity kinds on the document's own screen, each made through POST /api/documents with
 * invented values (no real card, the capture rule) and the TC-E2E- marker, and removed in `finally`:
 *   - model nou: its fields in the card's order, the common ones once (not in „Identificarea actului"), EXPIRAT on a
 *     validity end in the past, the warning when the CNP's sex disagrees with Sex, a CNP refused, an edit kept;
 *   - model vechi: the booklet's own fields, no CNP, no validity, so no status;
 *   - Pașaport: VALABIL, its domicile county; Pașaport CRDS: its domicile country;
 *   - a change of type: to Pașaport names the values removed and removes them; to an ordinary type is refused while
 *     a value is held;
 *   - Documente → Adaugă act with an identity type: the tile, empty, and the value saved.
 * No map, no Street View, no address look-up.
 */
import { test, expect, type Page } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile, saveTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}DOC-28`;
const tile = (page: Page) => page.locator('[data-panel="identity"]');
const box = (page: Page, field: string) => tile(page).locator(`[data-width-field="${field}"]`);
const general = (page: Page) => page.locator('[data-panel="general"]');

// An invented CNP: a man born 1985-04-21, control digit valid.
const CNP = "1850421400123";

test.describe("TC-DOC-28 — actul de identitate pe ecranul lui", () => {
  test("cele patru tipuri, starea, CNP-ul, schimbarea tipului, un act nou", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const made: string[] = [];
    try {
      const nou = await createDocumentOfType(page.request, "CARTE_IDENTITATE", `${MARK} CI nou`, {
        nrDocument: "IF 123456",
        dateDocument: "2012-04-21",
        dateValidUntil: "2022-04-21",
        identity: {
          lastName: "Testescu", firstName: "Ion", cnp: CNP, sex: "FEMALE", nationality: "Română / ROU",
          placeOfBirth: "Mun. București", domicileAddress: "Str. Probei nr. 1, Bragadiru", cardNumber: "000111",
        },
      });
      made.push(nou);
      const vechi = await createDocumentOfType(page.request, "CARTE_IDENTITATE_VECHE", `${MARK} CI vechi`, {
        nrDocument: "BX 100200",
        dateDocument: "1995-06-02",
        identity: { lastName: "Testescu", firstName: "Ion", fatherFirstName: "Ilie", motherFirstName: "Ana", civilStatus: "necăsătorit" },
      });
      made.push(vechi);
      const pas = await createDocumentOfType(page.request, "PASAPORT", `${MARK} Pașaport`, {
        nrDocument: "051234876",
        dateDocument: "2022-09-01",
        dateValidUntil: "2099-09-01",
        identity: { passportType: "P", countryCode: "ROU", lastName: "Testescu", firstName: "Ion", domicileCounty: "Ilfov" },
      });
      made.push(pas);
      const crds = await createDocumentOfType(page.request, "PASAPORT_CRDS", `${MARK} Pașaport CRDS`, {
        identity: { lastName: "Testescu", firstName: "Ion", domicileCountry: "Spania" },
      });
      made.push(crds);

      // Step 1 — model nou: the tile, its fields once, EXPIRAT, the CNP warning.
      await page.goto(`/documents/${nou}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      for (const label of ["Seria și numărul", "CNP", "Sex", "Nume", "Prenume", "Cetățenia", "Domiciliu", "Emisă de", "Data eliberării", "Valabil până la", "MRZ", "Nr. card"]) {
        await expect(tile(page).getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(tile(page).getByText("Data nașterii", { exact: true })).toHaveCount(0);
      await expect(general(page).locator('[data-width-field="nrDocument"]')).toHaveCount(0);
      await expect(box(page, "nrDocument")).toHaveText("IF 123456");
      await expect(box(page, "identity.lastName")).toHaveText("Testescu");
      await expect(tile(page).locator('[data-identity-validity="expired"]')).toHaveText("EXPIRAT");
      await expect(tile(page).locator('[data-identity-warning="cnp_sex_mismatch"]')).toBeVisible();

      // Step 2 — a CNP without its control digit is refused; Sex corrected, the warning goes; kept after a reload.
      await editTile(page, "identity");
      await box(page, "identity.cnp").fill("1850421400124");
      await expect(tile(page).getByText("CNP-ul trebuie să aibă 13 cifre și o cifră de control corectă.").first()).toBeVisible();
      await box(page, "identity.cnp").fill(CNP);
      await tile(page).getByRole("combobox", { name: "Sex", exact: true }).selectOption("MALE");
      await expect(tile(page).locator('[data-identity-warning="cnp_sex_mismatch"]')).toHaveCount(0);
      await box(page, "identity.firstName").fill("Ionel");
      await saveTile(page, "identity");
      await page.reload();
      await expect(box(page, "identity.firstName")).toHaveText("Ionel", { timeout: 30_000 });
      await expect(box(page, "identity.sex")).toHaveText("M");

      // Step 3 — model vechi: the booklet's fields; no CNP, no validity end, so no status.
      await page.goto(`/documents/${vechi}`);
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      for (const label of ["Prenumele tatălui", "Prenumele mamei", "Starea civilă", "Lucrătorul care a eliberat-o"]) {
        await expect(tile(page).getByText(label, { exact: true }).first()).toBeVisible();
      }
      await expect(tile(page).getByText("CNP", { exact: true })).toHaveCount(0);
      await expect(tile(page).locator("[data-identity-validity]")).toHaveCount(0);

      // Step 4 — the passports: VALABIL and the county; CRDS the country.
      await page.goto(`/documents/${pas}`);
      await expect(tile(page).locator('[data-identity-validity="valid"]')).toHaveText("VALABIL", { timeout: 30_000 });
      await expect(box(page, "identity.domicileCounty")).toHaveText("Ilfov");
      await page.goto(`/documents/${crds}`);
      await expect(box(page, "identity.domicileCountry")).toHaveText("Spania", { timeout: 30_000 });

      // Step 5 — model nou to Pașaport: the values it has no field for are named, and removed on save.
      await page.goto(`/documents/${nou}`);
      await editTile(page, "general");
      await general(page).getByLabel(/^Tip document/).selectOption({ label: "Pașaport" });
      const notice = general(page).locator('[data-identity-change="removes"]');
      await expect(notice).toContainText("Domiciliu");
      await expect(notice).toContainText("Nr. card");
      await saveTile(page, "general");
      await page.reload();
      await expect(tile(page).getByText("Codul țării", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
      await expect(box(page, "identity.lastName")).toHaveText("Testescu");
      await expect(box(page, "identity.domicileAddress")).toHaveCount(0);

      // Step 6 — to an ordinary type while a value is held: said, and refused.
      await editTile(page, "general");
      await general(page).getByLabel(/^Tip document/).selectOption({ label: "Adeverință" });
      await expect(general(page).locator('[data-identity-change="held"]')).toBeVisible();
      await page.locator('[data-tile-save="general"]').click();
      await expect(page.getByText("goliți-le înainte de a-l trece la un tip de document obișnuit").first()).toBeVisible();
      // Back to Pașaport — nothing left to save — and the tile closed.
      await general(page).getByLabel(/^Tip document/).selectOption({ label: "Pașaport" });
      await page.locator('[data-tile-cancel="general"]').click();
      await expect(page.locator('[data-tile-edit-bar="general"]')).toHaveCount(0);

      // Step 7 — Documente → Adaugă act with an identity type: the tile, empty; saved.
      await page.goto("/documents/new");
      await page.getByLabel(/^Tip document/).selectOption({ label: "Carte de Identitate (model vechi)" });
      await expect(tile(page)).toBeVisible({ timeout: 30_000 });
      await expect(box(page, "identity.lastName")).toHaveValue("");
      await page.getByLabel(/^Etichetă scurtă/).fill(`${MARK} nou din Acte`);
      await box(page, "identity.lastName").fill("Testescu");
      await page.locator("#document-form").evaluate((f: HTMLFormElement) => f.requestSubmit());
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 60_000 });
      made.push(page.url().split("/").pop()!);
      await expect(box(page, "identity.lastName")).toHaveText("Testescu", { timeout: 30_000 });
    } finally {
      for (const id of made) await removeRecord(page.request, "document", id);
    }
  });
});
