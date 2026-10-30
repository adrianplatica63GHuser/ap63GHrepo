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
 *   - Slice #39.06: the log form left the module's screen for the person's (C, #39.05), so the spec drives it on
 *     Irina's screen, its assertions unchanged where they still apply. The person box is gone there — the person
 *     is the screen's — so step 3's „Alege o persoană din registru." and the focus on the person box, step 4's
 *     search for Irina and step 7's „the person stays" have nothing left to read; the history is B, the person's
 *     own tile, which does not flash a saved row; step 10's sticky button belonged to the module's stacked tiles.
 */

import fs from "node:fs";
import { test, expect, type Page } from "../helpers/test";
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
      page.locator("[data-account-entry]"), // 40.59: the signed-in name is the account entry's
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
      // #39.06: B, Irina's history on her screen (it read the module's grid, `[data-history-grid] … [data-subject]`).
      const subjects = page.locator('[data-tile="interactions"] [data-person-interaction] [data-subject]');
      const save = log.getByRole("button", { name: "Salvează", exact: true });
      const saveAndNew = log.getByRole("button", { name: "Salvează și adaugă", exact: true });
      const subject = log.getByLabel("Subiect", { exact: true });
      const person = log.getByRole("combobox", { name: "Persoană" });

      // Step 1 — Irina's screen, C expanded (#39.06: it read the module scoped to her): the log tile, no person box —
      // the person is the screen's — and nothing in her history.
      await page.goto(`/natural-persons/${irina}?log=new`);
      await expect(log.getByRole("heading", { name: "Înregistrează o interacțiune" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('[data-tile="interactions"] [data-interactions-empty]')).toBeVisible({ timeout: 30_000 });
      await expect(person).toHaveCount(0);

      // Step 2 — „Conturi conectate": both „Neconectat", „Conectează" inert, „Nimic nu se trimite fără confirmare."
      // #39.33: a section that opens and closes, closed when the tile opens — opened here first.
      await log.getByRole("button", { name: "Conturi conectate", exact: true }).click();
      const connections = log.locator("[data-connections]");
      await expect(connections.locator("[data-connection]")).toHaveCount(2);
      await expect(connections.getByText("Neconectat", { exact: true })).toHaveCount(2);
      for (const b of await connections.getByRole("button", { name: "Conectează" }).all()) await expect(b).toBeDisabled();
      await expect(connections).toContainText("Nimic nu se trimite fără confirmare.");
      await picture(page, "log-empty-1366");

      // Step 3 — no subject: „Salvează" is inert. Ctrl+S: the subject's hint, the focus on the subject. (#39.06: the
      // person cleared, „Alege o persoană din registru." and the focus on the person box were read here.)
      await expect(save).toBeDisabled();
      await subject.click();
      await page.keyboard.press("Control+s");
      await expect(log).toContainText("Adaugă un subiect scurt. Acesta apare în istoric.");
      await expect(subject).toBeFocused();

      // Step 4 — „Telefon": the description asks „Ce s-a convenit?"; „Primită"; a subject. (#39.06: no person to find.)
      await log.locator('[data-channel-option="PHONE"]').click();
      await expect(log.getByLabel("Descriere", { exact: true })).toHaveAttribute("placeholder", "Ce s-a convenit?");
      await log.locator('[data-direction-option="INBOUND"]').click(); // 41.11: an icon toggle, „Primită" its name
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

      // Step 6 — „Salvează": the toast, the row first in her history; the form clean again. (#39.06: B does not flash.)
      await save.click();
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune înregistrată");
      await expect(subjects).toHaveText(["Programare vizionare"], { timeout: 30_000 });
      await expect(subject).toHaveValue("");

      // Step 7 — „Salvează și adaugă": channel, direction and person stay; the subject is empty.
      await log.locator('[data-channel-option="PHONE"]').click();
      await log.locator('[data-direction-option="INBOUND"]').click(); // 41.11: an icon toggle, „Primită" its name
      await subject.fill("Al doilea apel");
      await saveAndNew.click();
      await expect(subjects).toHaveText(["Al doilea apel", "Programare vizionare"], { timeout: 30_000 });
      await expect(subject).toHaveValue("");
      await expect(log.locator('[data-channel-option="PHONE"]')).toHaveAttribute("aria-pressed", "true");
      await expect(log.locator("[data-log-direction]").getByRole("button", { name: "Primită" })).toHaveAttribute("aria-pressed", "true");

      // Step 8 — „Renunță" on a form with something typed asks first; „Renunță la ea" clears it.
      await subject.fill("Ciornă");
      await log.getByRole("button", { name: "Renunță", exact: true }).click();
      await expect(log.getByRole("alertdialog")).toContainText("Renunți la interacțiunea nesalvată?");
      await log.getByRole("button", { name: "Renunță la ea", exact: true }).click();
      await expect(subject).toHaveValue("");
      await expect(log.locator('[data-channel-option="EMAIL"]')).toHaveAttribute("aria-pressed", "true");

      // Step 9 — Ctrl+S saves.
      await subject.fill("Salvat cu tastatura");
      await page.keyboard.press("Control+s");
      await expect(page.locator("[data-toast]")).toHaveText("Interacțiune înregistrată");
      await expect(subjects.first()).toHaveText("Salvat cu tastatura", { timeout: 30_000 });

      // (#39.06: step 10, the module's sticky „Înregistrează interacțiunea" under 1100 px, went with the module's form.)
    } finally {
      await removeRecord(page.request, "person", irina);
    }
  });
});
