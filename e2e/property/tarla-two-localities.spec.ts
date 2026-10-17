/**
 * Case:   TC-PROP-16 — Aceeași tarla în două localități: două tarlale, două parcele 1, iar a treia parcelă 1 este refuzată
 * Source: docs/testing/cases/TC-PROP-16.md, „Last green" 2026-10-17
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The properties carry `TC-E2E-PROP-16` (records.ts); the two tarlale keep the case's code `TC16`, and any left
 *     by an interrupted run are deleted first.
 *   - Steps 3–5 open „Proprietate nouă" at `/properties/new`, the page „Introducere manuală" opens, rather than
 *     through the list's dialog (TC-PROP-01 and TC-PROP-15 walk that).
 */

import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}PROP-16`;
const CODE = "TC16";
const TARLA = "/api/admin/value-lists/tarla";

type TarlaRow = { id: string; indicativ: string; locality: string | null };

async function tarlale(request: APIRequestContext): Promise<TarlaRow[]> {
  const res = await request.get(TARLA);
  expect(res.ok()).toBeTruthy();
  return ((await res.json()) as { items: TarlaRow[] }).items.filter((t) => t.indicativ.toLowerCase() === CODE.toLowerCase());
}

async function removeTarlale(request: APIRequestContext): Promise<void> {
  for (const t of await tarlale(request)) await request.delete(`${TARLA}/${t.id}`);
}

async function addTarla(request: APIRequestContext, locality: string): Promise<string> {
  const res = await request.post(TARLA, { data: { indicativ: CODE, locality, county: "Ilfov" } });
  expect(res.ok(), `POST ${TARLA} ${locality}: ${res.status()}`).toBeTruthy();
  return ((await res.json()) as { id: string }).id;
}

/** „Proprietate nouă": nickname, tarla, parcel, „Salvează". */
async function newProperty(page: Page, nickname: string, tarlaLabel: string, parcela: string): Promise<void> {
  await page.goto("/properties/new");
  const tarla = page.locator('select[name="tarlaId"]');
  await expect(tarla.locator("option", { hasText: tarlaLabel })).toHaveCount(1, { timeout: 30_000 });
  await page.locator('[name="nickname"]').fill(nickname);
  await tarla.selectOption({ label: tarlaLabel });
  await page.locator('input[name="parcela"]').fill(parcela);
  await page.getByRole("button", { name: "Salvează", exact: true }).click();
}

async function propertyIdsOn(request: APIRequestContext, tarlaId: string): Promise<string[]> {
  const res = await request.get(`/api/tarlale/${tarlaId}/properties`);
  if (!res.ok()) return [];
  return ((await res.json()) as { items: { id: string }[] }).items.map((p) => p.id);
}

test.describe("TC-PROP-16 — aceeași tarla în două localități", () => {
  test("două tarlale TC16, două parcele 1, a treia refuzată", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    await removeTarlale(page.request);
    await page.setViewportSize({ width: 1366, height: 900 });
    const bragadiru = await addTarla(page.request, "Bragadiru");
    const cornetu = await addTarla(page.request, "Cornetu");
    try {
      // Step 1 — two rows TC16, „Bragadiru, Ilfov" and „Cornetu, Ilfov", each with „Deschide pagina tarlalei".
      await page.goto("/admin/value-lists?list=tarla");
      const list = page.getByRole("region", { name: "Indicative Tarla", exact: true });
      const rows = list.locator("tbody tr").filter({ hasText: CODE });
      await expect(rows).toHaveCount(2, { timeout: 30_000 });
      await expect(rows.filter({ hasText: "Bragadiru, Ilfov" })).toHaveCount(1);
      await expect(rows.filter({ hasText: "Cornetu, Ilfov" })).toHaveCount(1);
      for (const r of await rows.all()) await expect(r.getByRole("link", { name: "Deschide pagina tarlalei" })).toBeVisible();

      // Step 2 — „Adaugă", tc16 in Cornetu: refused, the form still open, still two rows.
      await list.getByRole("button", { name: /Adaugă/ }).click();
      const box = (label: RegExp) => list.locator("div.flex.flex-col.gap-1", { has: page.locator("label", { hasText: label }) }).locator("input");
      await box(/^Indicativ/).fill("tc16");
      await box(/^Localitate/).fill("Cornetu");
      await list.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(
        page.getByRole("alert").filter({ hasText: "Există deja, în aceeași localitate, un indicativ de tarla care se citește la fel ca acesta: „TC16”." }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(box(/^Indicativ/)).toBeVisible();
      await expect(rows).toHaveCount(2);

      // Step 3 — TC16 (Bragadiru), parcel 1: saved, back in the list at the top with „Nou!".
      await newProperty(page, `${MARK} Bragadiru`, `${CODE} (Bragadiru)`, "1");
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
      await expect(page.locator("tbody tr").first()).toContainText(`${MARK} Bragadiru`, { timeout: 30_000 });
      await expect(page.locator("tbody tr").first()).toContainText("Nou!");

      // Step 4 — TC16 (Cornetu), parcel 1: saved as well, not refused.
      await newProperty(page, `${MARK} Cornetu`, `${CODE} (Cornetu)`, "1");
      await expect(page).toHaveURL(/\/properties$/, { timeout: 30_000 });
      await expect(page.locator("tbody tr").first()).toContainText(`${MARK} Cornetu`, { timeout: 30_000 });

      // Step 5 — TC16 (Bragadiru), parcel 1 again: refused, naming the first.
      await newProperty(page, `${MARK} Al doilea`, `${CODE} (Bragadiru)`, "1");
      const refused = page.getByRole("alert").filter({ hasText: "Această parcelă are deja o proprietate" });
      await expect(refused).toBeVisible({ timeout: 30_000 });
      await expect(refused).toContainText("Tarla TC16, parcela 1 aparține deja proprietății de mai jos. Nu s-a creat o proprietate nouă.");
      await expect(refused).toContainText(`Deschide ${MARK} Bragadiru`);
      await expect(page).toHaveURL(/\/properties\/new$/);

      // Step 6 — /tarlale: the box with six facts; two rows TC16, one property each.
      await page.goto("/tarlale");
      const info = page.locator("[data-tarla-boundaries-info]");
      await expect(info.getByRole("heading", { name: "Despre limitele tarlalelor" })).toBeVisible({ timeout: 30_000 });
      await expect(info.locator("li")).toHaveCount(6);
      const tarlaRows = page.locator(`[data-tarla-row="${CODE}"]`);
      await expect(tarlaRows).toHaveCount(2, { timeout: 30_000 });
      for (const locality of ["Bragadiru", "Cornetu"]) {
        const r = tarlaRows.filter({ hasText: locality });
        await expect(r).toHaveCount(1);
        await expect(r.locator("td").nth(4)).toHaveText("1");
      }

      // Step 7 — Cornetu's TC16: its heading, the box, its locality, only its own property.
      await tarlaRows.filter({ hasText: "Cornetu" }).getByRole("link", { name: CODE }).click();
      await expect(page).toHaveURL(new RegExp(`/tarlale/${cornetu}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Tarla ${CODE} — Cornetu`, { timeout: 30_000 });
      await expect(page.locator("[data-tarla-boundaries-info] li")).toHaveCount(6);
      await expect(page.locator("[data-tarla-identity] input").nth(1)).toHaveValue("Cornetu");
      await expect(page.locator("[data-tarla-properties] h2")).toHaveText("O proprietate", { timeout: 30_000 });
      await expect(page.locator("[data-tarla-property]")).toHaveCount(1);
      await expect(page.locator("[data-tarla-property]")).toContainText(`${MARK} Cornetu`);
    } finally {
      // At the end — the two properties, then the two tarlale.
      await page.waitForLoadState("networkidle").catch(() => {});
      for (const t of [bragadiru, cornetu]) for (const p of await propertyIdsOn(page.request, t)) await removeRecord(page.request, "property", p);
      await removeLeftovers(page.request, MARK);
      await removeTarlale(page.request);
    }
  });
});
