/**
 * Case:   TC-INT-07 — „Înregistrează o interacțiune": cinci secțiuni care se deschid și se închid
 * Source: docs/testing/cases/TC-INT-07.md, „Last green" 2026-10-14
 *
 * A translation of the case file, step for step (Slice #39.33). Every Romanian
 * string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person carries `TC-E2E-INT-07` (records.ts), and nothing is saved.
 */

import { test, expect, type Locator } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INT-07`;
const SECTIONS = ["Conturi conectate", "Înregistrare manuală", "Asocieri", "Memento", "Notă internă"] as const;

const title = (log: Locator, name: string | RegExp) =>
  log.getByRole("button", { name: typeof name === "string" ? new RegExp(`^${name}( · .*)?$`) : name });

test.describe("TC-INT-07 — cinci secțiuni care se deschid și se închid", () => {
  test("„Înregistrare manuală” deschisă, celelalte închise; un clic deschide, al doilea închide; o eroare își deschide secțiunea", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const person = await createNaturalPerson(page.request, { lastName: `${MARK} Pop`, firstName: "Ana" });
    try {
      await page.setViewportSize({ width: 1366, height: 900 });
      const log = page.locator("[data-interactions-log]");
      await page.goto(`/natural-persons/${person}?log=new`);
      await expect(log.getByRole("heading", { name: "Înregistrează o interacțiune" })).toBeVisible({ timeout: 30_000 });

      // Step 1 — the five titles, in order; only „Înregistrare manuală" open.
      for (const name of SECTIONS) {
        await expect(title(log, name)).toHaveAttribute("aria-expanded", name === "Înregistrare manuală" ? "true" : "false");
      }
      const order = await Promise.all(SECTIONS.map(async (name) => (await title(log, name).boundingBox())!.y));
      expect([...order].sort((a, b) => a - b)).toEqual(order);
      await expect(log.getByLabel("Subiect", { exact: true })).toBeVisible();
      await expect(log.getByText("Setează un memento", { exact: true })).toBeHidden();

      // Step 2 — each closed one: a click opens it, its content shows; a second click closes it.
      const content: Record<string, Locator> = {
        "Conturi conectate": log.locator("[data-connections]"),
        Asocieri: log.getByRole("button", { name: "Adaugă legătură", exact: true }),
        Memento: log.getByText("Setează un memento", { exact: true }),
        "Notă internă": log.getByText("Vizibilă doar echipei", { exact: true }),
      };
      for (const [name, inside] of Object.entries(content)) {
        await title(log, name).click();
        await expect(title(log, name)).toHaveAttribute("aria-expanded", "true");
        await expect(inside).toBeVisible();
        await title(log, name).click();
        await expect(title(log, name)).toHaveAttribute("aria-expanded", "false");
        await expect(inside).toBeHidden();
      }
      // And „Înregistrare manuală" closes too.
      await title(log, "Înregistrare manuală").click();
      await expect(log.getByLabel("Subiect", { exact: true })).toBeHidden();
      await title(log, "Înregistrare manuală").click();

      // Step 3 — from the keyboard: Enter opens „Memento", Space closes it.
      await title(log, "Memento").focus();
      await page.keyboard.press("Enter");
      await expect(title(log, "Memento")).toHaveAttribute("aria-expanded", "true");
      await page.keyboard.press("Space");
      await expect(title(log, "Memento")).toHaveAttribute("aria-expanded", "false");

      // Step 4 — „Asocieri" with a tag, closed: its title says so.
      await title(log, "Asocieri").click();
      await log.getByRole("button", { name: "Adaugă etichetă", exact: true }).click();
      await log.getByRole("combobox", { name: "Etichetă nouă" }).fill(`${MARK} vizită`);
      await page.keyboard.press("Enter");
      await title(log, "Asocieri").click();
      await expect(title(log, "Asocieri")).toHaveAccessibleName("Asocieri · 1 etichetă");

      // Step 5 — a memento with no date, closed: its title says what is missing; Ctrl+S opens it on the date.
      await title(log, "Memento").click();
      await log.getByText("Setează un memento", { exact: true }).click();
      await title(log, "Memento").click();
      await expect(title(log, "Memento")).toHaveAccessibleName("Memento · Alege data mementoului.");
      await log.getByLabel("Subiect", { exact: true }).fill("Telefon de verificare");
      await page.keyboard.press("Control+s");
      await expect(title(log, "Memento")).toHaveAttribute("aria-expanded", "true");
      await expect(log.getByLabel("Data mementoului", { exact: true })).toBeFocused();
    } finally {
      await removeRecord(page.request, "person", person);
    }
  });
});
