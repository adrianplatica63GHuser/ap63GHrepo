/**
 * Case:   TC-INT-04 — „Interacțiuni": o înregistrare schimbată, apărată de o salvare învechită, apoi ștearsă
 * Source: docs/testing/cases/TC-INT-04.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person and her two interactions carry `TC-E2E-INT-04` (records.ts) and are made through the API; the
 *     screen is opened scoped to her.
 *   - „Someone else" in step 5 is a PUT through the API, the route the other person's „Salvează modificările" sends.
 *   - The picture for Slice #38.87's handover goes to playwright-report/interactions-edit, invented records only.
 *   - Slice #39.06: the log form is on the person's screen (C, #39.05), so the case runs on Ana's screen
 *     (`?log=new`) and chooses the rows of her history there (B); every assertion is unchanged.
 */

import fs from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { openSection, sidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}INT-04`;
const SHOTS = "playwright-report/interactions-edit";
const DAY = 24 * 3600_000;

type Rec = { id: string; updatedAt: string; subject: string; channel: string; direction: string; occurredAt: string; personId: string; status: string };

async function log(request: APIRequestContext, personId: string, subject: string, channel: string, daysAgo: number): Promise<Rec> {
  const res = await request.post("/api/interactions", {
    data: { personId, subject, channel, direction: "OUTBOUND", status: "LOGGED", occurredAt: new Date(Date.now() - daysAgo * DAY).toISOString() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as Rec;
}

/** „Someone else" changes the record behind the form: the PUT their „Salvează modificările" sends. */
async function changeBehind(request: APIRequestContext, id: string, subject: string): Promise<void> {
  const now = (await (await request.get(`/api/interactions/${id}`)).json()) as Rec;
  const res = await request.put(`/api/interactions/${id}`, {
    data: {
      channel: now.channel,
      direction: now.direction,
      occurredAt: now.occurredAt,
      personId: now.personId,
      status: now.status,
      subject,
      expectedUpdatedAt: now.updatedAt,
    },
  });
  expect(res.status(), await res.text()).toBe(200);
}

async function picture(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(1, 1);
  await page.locator("[data-audit-line]").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    mask: [
      page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
      page.locator("aside").getByText(/^Autentificat ca/),
      // The audit line names the signed-in user: painted over like „Autentificat ca".
      page.locator("[data-audit-name]"),
    ],
  });
}

test.describe("TC-INT-04 — schimbat, apărat, șters", () => {
  test("alegere, schimbare, salvare; întrebările înainte de a pierde ce s-a scris; 409 cu „Reîncarcă” și „Suprascrie”; ștergerea", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const ana = await createNaturalPerson(page.request, { lastName: `${MARK} Popa`, firstName: "Ana" });
    try {
      const offer = await log(page.request, ana, "Ofertă trimisă", "EMAIL", 1);
      const call = await log(page.request, ana, "Apel de clarificare", "PHONE", 2);
      await page.setViewportSize({ width: 1920, height: 1080 });
      const tile = page.locator("[data-interactions-log]");
      const subject = tile.getByLabel("Subiect", { exact: true });
      // #39.06: the rows of Ana's history on her screen (it read the module's grid, `[data-interaction-row]`).
      const rowOf = (id: string) => page.locator(`[data-person-interaction="${id}"]`);
      const mode = tile.getByRole("radiogroup", { name: "Mod" });
      const saveChanges = tile.getByRole("button", { name: "Salvează modificările", exact: true });

      // Step 1 — a row chosen: „Editează selecția", the record in the form, the audit line.
      await page.goto(`/natural-persons/${ana}?log=new`); // #39.06: was `/interactions?person=${ana}`
      await expect(rowOf(offer.id)).toBeVisible({ timeout: 30_000 });
      await expect(mode.getByRole("radio", { name: "Editează selecția" })).toBeDisabled();
      await rowOf(offer.id).click();
      await expect(rowOf(offer.id)).toHaveAttribute("aria-selected", "true");
      await expect(mode.getByRole("radio", { name: "Editează selecția" })).toBeChecked();
      await expect(subject).toHaveValue("Ofertă trimisă", { timeout: 15_000 });
      await expect(tile.locator("[data-audit-line]")).toContainText("Creată de");
      await expect(tile.locator("[data-audit-line]")).toContainText("modificată ultima dată de");
      await picture(page, "edit-1920");

      // Step 2 — changed and saved: „Modificări salvate", the grid shows the change.
      await subject.fill("Ofertă revizuită");
      await saveChanges.click();
      await expect(page.locator("[data-toast]")).toHaveText("Modificări salvate");
      await expect(rowOf(offer.id).locator("[data-subject]")).toHaveText("Ofertă revizuită", { timeout: 15_000 });

      // Step 3 — something typed, another row chosen: the tile asks. „Continuă" keeps it; again, „Renunță la ea" goes.
      await subject.fill("Ciornă");
      await rowOf(call.id).click();
      const discard = tile.locator("[data-log-discard]");
      await expect(discard).toContainText("Renunți la modificările nesalvate?");
      await discard.getByRole("button", { name: "Continuă", exact: true }).click();
      await expect(subject).toHaveValue("Ciornă");
      await expect(rowOf(offer.id)).toHaveAttribute("aria-selected", "true");
      await rowOf(call.id).click();
      await discard.getByRole("button", { name: "Renunță la ea", exact: true }).click();
      await expect(subject).toHaveValue("Apel de clarificare", { timeout: 15_000 });
      await expect(rowOf(call.id)).toHaveAttribute("aria-selected", "true");

      // Step 4 — something typed, „Acte" in the sidebar: the app's „Modificări nesalvate"; „Anulează" stays.
      await subject.fill("Ciornă");
      await openSection(page, "Domeniu");
      await sidebar(page).getByRole("link", { name: "Acte", exact: true }).click();
      const leave = page.getByRole("dialog").filter({ hasText: "Modificări nesalvate" });
      await expect(leave).toBeVisible();
      await leave.getByRole("button", { name: "Anulează", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`/natural-persons/${ana}`)); // #39.06: was /\/interactions/
      await expect(subject).toHaveValue("Ciornă");

      // Step 5 — someone else saved first: „Reîncarcă" brings theirs; a second time, „Suprascrie" keeps ours.
      await changeBehind(page.request, call.id, "Schimbat de altcineva");
      await subject.fill("Schimbat de mine");
      await saveChanges.click();
      const conflict = tile.locator("[data-log-conflict]");
      await expect(conflict).toContainText("Această înregistrare a fost modificată de altcineva.");
      await conflict.getByRole("button", { name: "Reîncarcă", exact: true }).click();
      await expect(subject).toHaveValue("Schimbat de altcineva");
      await changeBehind(page.request, call.id, "Iar altcineva");
      await subject.fill("Tot eu");
      await saveChanges.click();
      await conflict.getByRole("button", { name: "Suprascrie", exact: true }).click();
      await expect(page.locator("[data-toast]")).toHaveText("Modificări salvate");
      await expect(rowOf(call.id).locator("[data-subject]")).toHaveText("Tot eu", { timeout: 15_000 });

      // Step 6 — „Șterge înregistrarea": the person and the date named, the documents kept; „Șterge".
      await tile.getByRole("button", { name: "Șterge înregistrarea", exact: true }).click();
      const confirm = page.locator("[data-log-delete]");
      await expect(confirm).toContainText(`${MARK} Popa`);
      await expect(confirm).toContainText("Actele legate rămân în arhivă");
      await confirm.getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune ștearsă");
      await expect(rowOf(call.id)).toHaveCount(0, { timeout: 15_000 });
      await expect(mode.getByRole("radio", { name: "Înregistrare nouă" })).toBeChecked();
      expect((await page.request.get(`/api/interactions/${call.id}`)).status()).toBe(404);
    } finally {
      await removeRecord(page.request, "person", ana);
    }
  });
});
