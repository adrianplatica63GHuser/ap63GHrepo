/**
 * Case:   TC-PERS-16 — „Acte de identitate” pe o persoană: actele ei, cel curent primul; unul deschis; „Adaugă act de identitate”
 * Source: docs/testing/cases/TC-PERS-16.md
 *
 * Slice 40.85. A person's identity documents on the person's screen: the list, the current one first with VALABIL /
 * EXPIRAT, one opened by its code, and „Adaugă act de identitate" — the kind asked, „Acte → Adaugă act" opened with
 * the person as holder and the person's names filled in, saved, and listed. Cetățenie on „Identitate".
 *
 * Divergences from the header's step, each for a reason:
 *   - „a seed person": the person and the two documents are invented here, through the API, with the TC-E2E- marker,
 *     and removed in `finally` — a seed person's documents depend on which seed the runner's database had
 *     (`C:\dev\.claude\rules\capture-and-personal-data.md`: identity screens with invented records only).
 * No map, no Street View, no address look-up.
 */
import { test, expect, type APIRequestContext } from "../helpers/test";
import { E2E_MARKER, createDocumentOfType, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { editTile } from "../helpers/tiles";

const MARK = `${E2E_MARKER}PERS-16`;
// An invented CNP: a man born 1985-04-21, control digit valid.
const CNP = "1850421400123";

async function linkHolder(request: APIRequestContext, documentId: string, personId: string): Promise<void> {
  const roles = await request.get(`/api/documents/${documentId}/valid-person-roles`);
  expect(roles.ok(), `GET valid-person-roles: ${roles.status()}`).toBeTruthy();
  const items = ((await roles.json()) as { items: { id: string; name: string }[] }).items;
  const holder = items.find((r) => r.name === "Titular act de identitate");
  const res = await request.post(`/api/documents/${documentId}/persons`, { data: { personIds: [personId], personRoleId: holder?.id ?? null } });
  expect(res.ok(), `POST persons: ${res.status()}`).toBeTruthy();
}

test.describe("TC-PERS-16 — actele de identitate ale unei persoane", () => {
  test("lista, cel curent primul, unul deschis, „Adaugă act de identitate”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await page.setViewportSize({ width: 1920, height: 1080 });
    const docs: string[] = [];
    let personId: string | undefined;
    try {
      personId = await createNaturalPerson(page.request, {
        lastName: MARK, firstName: "Ion", gender: "MALE", cnp: CNP, dateOfBirth: "1985-04-21", placeOfBirth: "Mun. București",
      });
      const card = await createDocumentOfType(page.request, "CARTE_IDENTITATE", `${MARK} CI expirată`, {
        nrDocument: "IF 123456", dateDocument: "2010-04-21", dateValidUntil: "2020-04-21",
        identity: { lastName: MARK, firstName: "Ion", cnp: CNP, sex: "MALE" },
      });
      docs.push(card);
      const passport = await createDocumentOfType(page.request, "PASAPORT", `${MARK} Pașaport`, {
        nrDocument: "051234876", dateDocument: "2022-09-01", dateValidUntil: "2099-09-01",
        identity: { lastName: MARK, firstName: "Ion", passportType: "P", countryCode: "ROU" },
      });
      docs.push(passport);
      await linkHolder(page.request, card, personId);
      await linkHolder(page.request, passport, personId);

      // Step 1 — „Acte de identitate": two rows, the passport first (valid today), VALABIL; the card EXPIRAT.
      await page.goto(`/natural-persons/${personId}`);
      const tile = page.locator("[data-identity-documents]");
      await expect(tile).toHaveAttribute("data-identity-documents-count", "2", { timeout: 30_000 });
      await expect(tile.getByRole("heading", { name: "Acte de identitate", exact: true })).toBeVisible();
      const rows = tile.locator("[data-identity-document]");
      await expect(rows.nth(0)).toHaveAttribute("data-identity-document", passport);
      await expect(rows.nth(0)).toHaveAttribute("data-identity-current", "");
      await expect(rows.nth(0).locator('[data-identity-validity="valid"]')).toHaveText("VALABIL");
      await expect(rows.nth(0)).toContainText("051234876");
      await expect(rows.nth(0)).toContainText("01.09.2099");
      await expect(rows.nth(1)).toHaveAttribute("data-identity-document", card);
      await expect(rows.nth(1).locator('[data-identity-validity="expired"]')).toHaveText("EXPIRAT");
      await expect(rows.nth(1)).toContainText("IF 123456");

      // Step 2 — „Identitate" has „Cetățenie" (Ask first 1), after „Locul nașterii".
      await editTile(page, "identity");
      const identity = page.locator('[data-panel="identity"]');
      await expect(identity.getByText("Cetățenie", { exact: true }).first()).toBeVisible();
      await page.locator('[data-tile-cancel="identity"]').click();

      // Step 3 — the card's code opens it.
      await rows.nth(1).locator("[data-identity-open]").click();
      await expect(page).toHaveURL(new RegExp(`/documents/${card}$`), { timeout: 30_000 });

      // Step 4 — „Adaugă act de identitate": the kind asked; „Carte de identitate (tip vechi)", „Continuă".
      await page.goto(`/natural-persons/${personId}`);
      await tile.getByRole("button", { name: "Adaugă act de identitate" }).click();
      const chooser = page.locator("[data-identity-kind-chooser]");
      await expect(chooser.getByText("Ce act de identitate adăugați?", { exact: true })).toBeVisible();
      await chooser.getByRole("radio", { name: "Carte de identitate (tip vechi)" }).check();
      await chooser.getByRole("button", { name: "Continuă" }).click();

      // Step 5 — „Adaugă act": the type chosen, the holder named, the person's names filled in; nothing saved yet.
      await expect(page).toHaveURL(/\/documents\/new\?identityKind=CI_VECHE&holder=/, { timeout: 30_000 });
      await expect(page.locator(`[data-identity-holder-new="${personId}"]`)).toContainText(`Ion ${MARK}`);
      const docTile = page.locator('[data-panel="identity"]');
      await expect(docTile.locator('[data-width-field="identity.lastName"]')).toHaveValue(MARK);
      await expect(docTile.locator('[data-width-field="identity.firstName"]')).toHaveValue("Ion");

      // Step 6 — „Salvează": the new document opens, its holder the person; back on the person, three documents.
      await page.locator("#document-form").evaluate((f: HTMLFormElement) => f.requestSubmit());
      await expect(page).toHaveURL(/\/documents\/[0-9a-f-]{36}$/, { timeout: 60_000 });
      docs.push(page.url().split("/").pop()!);
      await expect(page.locator("[data-identity-holder]")).toContainText(`Ion ${MARK}`, { timeout: 30_000 });
      await page.goto(`/natural-persons/${personId}`);
      await expect(tile).toHaveAttribute("data-identity-documents-count", "3", { timeout: 30_000 });
    } finally {
      for (const id of docs) await removeRecord(page.request, "document", id);
      if (personId) await removeRecord(page.request, "person", personId);
    }
  });
});
