/**
 * Case:   TC-INT-02 — „Interacțiuni": un apel telefonic înregistrat de mână, fără niciun cont conectat
 * Source: docs/testing/cases/TC-INT-02.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person carries `TC-E2E-INT-02` (records.ts); the screen is opened scoped to her, so the archive's other
 *     interactions never enter the grid.
 *   - Dates are typed relative to the run's own clock.
 *   - The pictures for Slice #38.85's handover go to playwright-report/interactions-log, invented records only;
 *     the signed-in name and „Recente" are painted over.
 */

import fs from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INT-02`;
const SHOTS = "playwright-report/interactions-log";

const minute = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

async function picture(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(1, 1);
  await page.locator("[data-interactions-log]").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    mask: [
      page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
      page.locator("aside").getByText(/^Autentificat ca/),
    ],
  });
}

test.describe("TC-INT-02 — o interacțiune înregistrată de mână", () => {
  test("fără cont conectat; validarea; „Salvează”, „Salvează și adaugă”, „Renunță”, Ctrl+S", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const irina = await createNaturalPerson(page.request, { lastName: `${MARK} Dobre`, firstName: "Irina" });
    try {
      await page.setViewportSize({ width: 1366, height: 1000 });
      const log = page.locator("[data-interactions-log]");
      const subjects = page.locator("[data-history-grid] tbody tr[data-interaction-row] [data-subject]");
      const save = log.getByRole("button", { name: "Salvează", exact: true });
      const saveAndNew = log.getByRole("button", { name: "Salvează și adaugă", exact: true });
      const subject = log.getByLabel("Subiect", { exact: true });
      const person = log.getByRole("combobox", { name: "Persoană" });

      // Step 1 — the screen scoped to Irina: the log tile, the person filled in, nothing in the grid.
      await page.goto(`/interactions?person=${irina}`);
      await expect(log.getByRole("heading", { name: "Înregistrează o interacțiune" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[data-history-empty]")).toBeVisible({ timeout: 30_000 });
      await expect(person).toHaveValue(new RegExp(`${MARK} Dobre`));

      // Step 2 — „Conturi conectate": both „Neconectat", „Conectează" inert, „Nimic nu se trimite fără confirmare."
      const connections = log.locator("[data-connections]");
      await expect(connections.locator("[data-connection]")).toHaveCount(2);
      await expect(connections.getByText("Neconectat", { exact: true })).toHaveCount(2);
      for (const b of await connections.getByRole("button", { name: "Conectează" }).all()) await expect(b).toBeDisabled();
      await expect(connections).toContainText("Nimic nu se trimite fără confirmare.");
      await picture(page, "log-empty-1366");

      // Step 3 — no subject: „Salvează" is inert. The person cleared and Ctrl+S: both hints, the focus on the person.
      await expect(save).toBeDisabled();
      await log.getByRole("button", { name: "Golește persoana", exact: true }).click();
      await subject.click();
      await page.keyboard.press("Control+s");
      await expect(log).toContainText("Alege o persoană din registru.");
      await expect(log).toContainText("Adaugă un subiect scurt. Acesta apare în istoric.");
      await expect(person).toBeFocused();

      // Step 4 — Irina found again; „Telefon": the description asks „Ce s-a convenit?"; „Primită"; a subject.
      await person.fill(`${MARK} Dobre`);
      await page.getByRole("listbox").getByRole("button", { name: new RegExp(`${MARK} Dobre`) }).click();
      await log.locator('[data-channel-option="PHONE"]').click();
      await expect(log.getByLabel("Descriere", { exact: true })).toHaveAttribute("placeholder", "Ce s-a convenit?");
      await log.locator("[data-log-direction]").getByText("Primită", { exact: true }).click();
      await subject.fill("Programare vizionare");

      // Step 5 — tomorrow, still „Înregistrată": the date's hint; Save inert. Yesterday: Save is live.
      const when = log.getByLabel("Data și ora", { exact: true });
      await when.fill(minute(new Date(Date.now() + 26 * 3600_000)));
      await when.blur();
      await expect(log).toContainText("Datele viitoare sunt pentru ce e programat.");
      await expect(save).toBeDisabled();
      await when.fill(minute(new Date(Date.now() - 24 * 3600_000)));
      await log.getByLabel("Descriere", { exact: true }).fill("S-a convenit vizionarea de joi.");
      await expect(save).toBeEnabled();
      await picture(page, "log-filled-1366");

      // Step 6 — „Salvează": the toast, the row first in the grid and flashing; the form clean again.
      await save.click();
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune înregistrată");
      await expect(subjects).toHaveText(["Programare vizionare"], { timeout: 30_000 });
      await expect(page.locator("[data-interaction-row][data-flash]")).toHaveCount(1);
      await expect(subject).toHaveValue("");

      // Step 7 — „Salvează și adaugă": channel, direction and person stay; the subject is empty.
      await log.locator('[data-channel-option="PHONE"]').click();
      await log.locator("[data-log-direction]").getByText("Primită", { exact: true }).click();
      await subject.fill("Al doilea apel");
      await saveAndNew.click();
      await expect(subjects).toHaveText(["Al doilea apel", "Programare vizionare"], { timeout: 30_000 });
      await expect(subject).toHaveValue("");
      await expect(log.locator('[data-channel-option="PHONE"] input')).toBeChecked();
      await expect(log.locator("[data-log-direction]").getByRole("radio", { name: "Primită" })).toBeChecked();
      await expect(person).toHaveValue(new RegExp(`${MARK} Dobre`));

      // Step 8 — „Renunță" on a form with something typed asks first; „Renunță la ea" clears it.
      await subject.fill("Ciornă");
      await log.getByRole("button", { name: "Renunță", exact: true }).click();
      await expect(log.getByRole("alertdialog")).toContainText("Renunți la interacțiunea nesalvată?");
      await log.getByRole("button", { name: "Renunță la ea", exact: true }).click();
      await expect(subject).toHaveValue("");
      await expect(log.locator('[data-channel-option="EMAIL"] input')).toBeChecked();

      // Step 9 — Ctrl+S saves.
      await subject.fill("Salvat cu tastatura");
      await page.keyboard.press("Control+s");
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune înregistrată");
      await expect(subjects.first()).toHaveText("Salvat cu tastatura", { timeout: 30_000 });

      // Step 10 — under 1100 px of module the tiles are stacked; „Înregistrează interacțiunea" takes you to the form.
      await page.locator("[data-history-grid]").scrollIntoViewIfNeeded();
      await page.locator("[data-log-sticky]").getByRole("button", { name: "Înregistrează interacțiunea", exact: true }).click();
      await expect(log.locator("#interaction-channel-first")).toBeFocused();
    } finally {
      await removeRecord(page.request, "person", irina);
    }
  });
});
