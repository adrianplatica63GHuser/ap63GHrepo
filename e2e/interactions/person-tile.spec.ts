/**
 * Case:   TC-INT-06 — „Interacțiuni” pe persoană: istoricul (B) și panoul de acțiune (C) sub el; în Incursiune doar istoricul
 * Source: docs/testing/cases/TC-INT-06.md
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Slice #39.05 rewrote it. It read (#38.89): a company's history on its screen and in its Incursiune, and B's three
 * ways out — „Deschide în „Interacțiuni”", „Interacțiune nouă" and a row — each opening the module. Now „Interacțiune
 * nouă" and a row reach C, the module's own log form under the history, fixed to the person.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person and her first interaction carry `TC-E2E-INT-06` (records.ts) and are made through the API.
 *   - The pictures for the handover go to playwright-report/interactions-person, invented records only; the
 *     signed-in name and „Recente" are painted over.
 */

import fs from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INT-06`;
const SHOTS = "playwright-report/interactions-person";
const DAY = 24 * 3600_000;

async function log(request: APIRequestContext, personId: string, subject: string, channel: string, daysAgo: number): Promise<string> {
  const res = await request.post("/api/interactions", {
    data: { personId, subject, channel, direction: "OUTBOUND", status: "LOGGED", occurredAt: new Date(Date.now() - daysAgo * DAY).toISOString() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function picture(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(1, 1);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    mask: [
      page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
      page.locator("aside").getByText(/^Autentificat ca/),
    ],
  });
}

test.describe("TC-INT-06 — istoricul și panoul de acțiune pe fișa persoanei", () => {
  test("C restrâns; desfăcut: o interacțiune înregistrată, aleasă, schimbată, ștearsă; adresa îl deschide; Incursiunea arată doar istoricul", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const ana = await createNaturalPerson(page.request, { lastName: MARK, firstName: "Ana" });
    try {
      const offer = await log(page.request, ana, "Ofertă de preț", "EMAIL", 3);
      await page.setViewportSize({ width: 1366, height: 1000 });

      // Step 1 — the person's screen: B lists „Ofertă de preț"; C is one large button, „Înregistrează o interacțiune".
      await page.goto(`/natural-persons/${ana}`);
      const tile = page.getByRole("region", { name: "Interacțiuni", exact: true });
      const subjects = tile.locator("[data-person-interaction] [data-subject]");
      await expect(subjects).toHaveText(["Ofertă de preț"], { timeout: 30_000 });
      await expect(tile.locator('[data-person-log="collapsed"]')).toBeVisible();
      await expect(tile.locator("[data-interactions-log]")).toHaveCount(0);
      const expand = tile.getByRole("button", { name: "Înregistrează o interacțiune", exact: true });
      await expect(expand).toBeVisible();
      const [e, t] = [(await expand.boundingBox())!, (await tile.boundingBox())!];
      expect(t.width - e.width, "the button spans the tile, inside its padding").toBeLessThanOrEqual(30);
      await tile.scrollIntoViewIfNeeded();
      await picture(page, "person-collapsed-1366");

      // Step 2 — expanded: the log form, no person box (the person is the screen's); one interaction logged → in B.
      await expand.click();
      const logTile = tile.locator("[data-interactions-log]");
      await expect(logTile.getByRole("heading", { name: "Înregistrează o interacțiune" })).toBeVisible({ timeout: 15_000 });
      await expect(logTile.getByRole("combobox", { name: "Persoană" })).toHaveCount(0);
      await logTile.locator('[data-channel-option="PHONE"]').click();
      const subject = logTile.getByLabel("Subiect", { exact: true });
      await subject.fill("Telefon de clarificare");
      await logTile.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune înregistrată");
      await expect(subjects).toHaveText(["Telefon de clarificare", "Ofertă de preț"], { timeout: 30_000 });
      await tile.scrollIntoViewIfNeeded();
      await picture(page, "person-expanded-1366");

      // Step 3 — the new row chosen: it reads selected and loads into C; changed and saved.
      const mine = tile.locator("[data-person-interaction]").first();
      const id = (await mine.getAttribute("data-person-interaction"))!;
      await mine.click();
      await expect(mine).toHaveAttribute("aria-selected", "true");
      const mode = logTile.getByRole("radiogroup", { name: "Mod" });
      await expect(mode.getByRole("radio", { name: "Editează selecția" })).toBeChecked({ timeout: 15_000 });
      await expect(subject).toHaveValue("Telefon de clarificare", { timeout: 15_000 });
      await subject.fill("Telefon de clarificare, cu răspuns");
      await logTile.getByRole("button", { name: "Salvează modificările", exact: true }).click();
      await expect(subjects.first()).toHaveText("Telefon de clarificare, cu răspuns", { timeout: 30_000 });

      // Step 4 — deleted: „Șterge înregistrarea", „Șterge"; gone from B, C on a new record.
      await logTile.getByRole("button", { name: "Șterge înregistrarea", exact: true }).click();
      await page.locator("[data-log-delete]").getByRole("button", { name: "Șterge", exact: true }).click();
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune ștearsă");
      await expect(subjects).toHaveText(["Ofertă de preț"], { timeout: 30_000 });
      await expect(mode.getByRole("radio", { name: "Înregistrare nouă" })).toBeChecked();
      expect((await page.request.get(`/api/interactions/${id}`)).status()).toBe(404);

      // Step 5 — „Restrânge": the large button again.
      await tile.getByRole("button", { name: "Restrânge", exact: true }).click();
      await expect(tile.locator('[data-person-log="collapsed"]')).toBeVisible();

      // Step 6 — the address: `?log=new` opens C expanded on a new record; `?log=<id>` on that row.
      await page.goto(`/natural-persons/${ana}?log=new`);
      await expect(logTile).toBeVisible({ timeout: 30_000 });
      await expect(mode.getByRole("radio", { name: "Înregistrare nouă" })).toBeChecked();
      await page.goto(`/natural-persons/${ana}?log=${offer}`);
      await expect(subject).toHaveValue("Ofertă de preț", { timeout: 30_000 });
      await expect(tile.locator(`[data-person-interaction="${offer}"]`)).toHaveAttribute("aria-selected", "true");

      // Step 7 — „Persoane Fizice", her „Incursiune": the history alone — no C, no „Interacțiune nouă".
      await page.goto("/natural-persons");
      const search = page.locator("main").locator('input[placeholder^="caută"]').first();
      await expect(search).toBeVisible({ timeout: 30_000 });
      await search.fill(MARK);
      const row = page.locator("main [data-list-edge] tbody tr").filter({ hasText: MARK });
      await expect(row).toHaveCount(1, { timeout: 30_000 });
      await row.getByRole("button", { name: "Incursiune", exact: true }).click();
      const peek = page.locator('[data-incursion="person"] [data-tile="interactions"]');
      await expect(peek.locator("[data-person-interaction] [data-subject]")).toHaveText(["Ofertă de preț"], { timeout: 30_000 });
      await expect(peek.locator("[data-interactions-new]")).toHaveCount(0);
      await expect(page.locator('[data-incursion="person"] [data-person-log], [data-incursion="person"] [data-interactions-log]')).toHaveCount(0);
      await picture(page, "incursion-1366");

      // Step 8 — a row there opens her screen with C expanded on it (#39.05's Ask first 4).
      await peek.locator(`[data-person-interaction="${offer}"]`).click();
      await expect(page).toHaveURL((u) => u.pathname === `/natural-persons/${ana}` && u.searchParams.get("log") === offer, { timeout: 30_000 });
      await expect(page.locator("[data-interactions-log]").getByLabel("Subiect", { exact: true })).toHaveValue("Ofertă de preț", { timeout: 30_000 });
    } finally {
      await removeRecord(page.request, "person", ana);
    }
  });
});
