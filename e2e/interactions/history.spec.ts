/**
 * Case:   TC-INT-01 — „Interacțiuni": istoricul, cele mai noi întâi, filtrat din bara de unelte și din coloane
 * Source: docs/testing/cases/TC-INT-01.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The two persons carry `TC-E2E-INT-01` (records.ts) and their four interactions are logged through
 *     POST /api/interactions — the screen that logs one by hand is 38.85's.
 *   - Every view is narrowed to the case's own records by typing the marker into the module bar's search, so the
 *     archive's other interactions never enter a count.
 *   - The pictures for Slice #38.84's handover go to playwright-report/interactions-history, invented records only;
 *     the signed-in name and „Recente" are painted over.
 */

import fs from "node:fs";
import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";
import { openSection, sidebar } from "../helpers/sidebar";

const MARK = `${E2E_MARKER}INT-01`;
const SHOTS = "playwright-report/interactions-history";
const DAY = 24 * 60 * 60 * 1000;

async function logInteraction(
  request: APIRequestContext,
  body: { personId: string; channel: string; direction: string; daysAgo: number; subject: string; status: string; description?: string },
): Promise<string> {
  const { daysAgo, ...rest } = body;
  const res = await request.post("/api/interactions", {
    data: { ...rest, occurredAt: new Date(Date.now() - daysAgo * DAY).toISOString() },
  });
  expect(res.status(), await res.text()).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

const rows = (page: Page) => page.locator("[data-history-grid] tbody tr[data-interaction-row]");
const subjects = (page: Page) => rows(page).locator("[data-subject]");
const search = (page: Page) => page.getByPlaceholder("Caută persoană sau subiect…");

async function picture(page: Page, name: string): Promise<void> {
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: `${SHOTS}/${name}.png`,
    mask: [
      page.locator("aside div.border-t").filter({ has: page.getByRole("button", { name: /Recente/i }) }),
      page.locator("[data-account-entry]"), // 40.59: the signed-in name is the account entry's
    ],
  });
}

test.describe("TC-INT-01 — istoricul interacțiunilor", () => {
  test("cele mai noi întâi; canal, sens, persoană și perioadă; ordinea ținută la reîncărcare; „Șterge filtrele”; „Așteaptă răspuns”", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const ana = await createNaturalPerson(page.request, { lastName: `${MARK} Popa`, firstName: "Ana" });
    const mihai = await createNaturalPerson(page.request, { lastName: `${MARK} Ionescu`, firstName: "Mihai" });
    try {
      await logInteraction(page.request, { personId: ana, channel: "EMAIL", direction: "OUTBOUND", daysAgo: 1, subject: "Proiect de contract", status: "LOGGED", description: "Proiectul trimis spre lectură." });
      await logInteraction(page.request, { personId: mihai, channel: "WHATSAPP", direction: "INBOUND", daysAgo: 2, subject: "Confirmare vizionare", status: "NEEDS_REPLY" });
      await logInteraction(page.request, { personId: ana, channel: "PHONE", direction: "OUTBOUND", daysAgo: 3, subject: "Verificare titlu", status: "COMPLETED" });
      await logInteraction(page.request, { personId: mihai, channel: "MEETING", direction: "INBOUND", daysAgo: 120, subject: "Vizită pe teren", status: "LOGGED" });
      const newest = ["Proiect de contract", "Confirmare vizionare", "Verificare titlu"];

      // Step 1 — the sidebar's „Interacțiuni" opens the screen: „Toți clienții", the last 90 days, newest first.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto("/");
      await openSection(page, "Rapoarte"); // #39.02: was „Domeniu"
      await sidebar(page).getByRole("link", { name: "Interacțiuni", exact: true }).click();
      await expect(page).toHaveURL(/\/interactions$/);
      await expect(page.getByRole("heading", { level: 1, name: "Interacțiuni" })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("[data-interactions-scope]")).toHaveText("Toți clienții");
      await expect(page.locator("[data-range-trigger]")).toContainText("Ultimele 90 de zile");
      await expect(page.locator("[data-sort-control]")).toHaveText("Cele mai noi întâi");
      await expect(page.locator("[data-clear-filters]")).toHaveCount(0);

      // Step 2 — the marker in the search: three rows, newest first; the fourth is older than 90 days.
      await search(page).fill(MARK);
      await expect(subjects(page)).toHaveText(newest, { timeout: 30_000 });
      await expect(page.locator("[data-interactions-count]")).toHaveText("3 interacțiuni");
      await expect(page.getByRole("button", { name: "Așteaptă răspuns: 1", exact: true })).toBeEnabled();
      await picture(page, "history-1920");

      // Step 3 — the chip „Telefon": one row; pressed again, three. „Șterge filtrele" shows while it is on.
      const phone = page.locator('[data-channel-chips] label[data-channel-chip="PHONE"]');
      await phone.click();
      await expect(subjects(page)).toHaveText(["Verificare titlu"]);
      await expect(page.locator("[data-clear-filters]")).toHaveText("Șterge filtrele");
      await phone.click();
      await expect(subjects(page)).toHaveText(newest);

      // Step 4 — the column „Canal"'s filter ticks „Telefon": the chip lights up — one filter state.
      await page.getByRole("button", { name: "Filtrează după „Canal”", exact: true }).click();
      await page.getByRole("dialog", { name: "Filtrează după „Canal”" }).getByLabel("Telefon").check();
      await expect(subjects(page)).toHaveText(["Verificare titlu"]);
      await expect(phone).toHaveAttribute("data-on", "");
      await page.keyboard.press("Escape");
      await phone.click();
      await expect(subjects(page)).toHaveText(newest);

      // Step 5 — direction „Primite": the one inbound row in range; „Toate" again, three.
      const direction = page.getByRole("radiogroup", { name: "Sens" });
      await direction.getByText("Primite", { exact: true }).click();
      await expect(subjects(page)).toHaveText(["Confirmare vizionare"]);
      await direction.getByText("Toate", { exact: true }).click();
      await expect(subjects(page)).toHaveText(newest);

      // Step 6 — the person „Ionescu": the address names him, the bar shows him; × shows every client again.
      // The toolbar's box, by its placeholder: since 38.85 the log form has a „Persoană" box of its own.
      await page.getByPlaceholder("Caută persoană…", { exact: true }).fill(`${MARK} Ionescu`);
      await page.getByRole("listbox").getByRole("button", { name: new RegExp(`${MARK} Ionescu`) }).click();
      await expect(page).toHaveURL(new RegExp(`person=${mihai}`));
      await expect(page.locator("[data-interactions-scope]")).toContainText(`${MARK} Ionescu`);
      await expect(subjects(page)).toHaveText(["Confirmare vizionare"]);
      await page.getByRole("button", { name: "Arată toți clienții", exact: true }).click();
      await expect(page).toHaveURL(/\/interactions$/);
      await expect(subjects(page)).toHaveText(newest);

      // Step 7 — the period „Anul acesta": the meeting of 120 days ago joins; „Ultimele 7 zile": three again.
      await page.locator("[data-range-trigger]").click();
      await page.getByRole("dialog", { name: "Perioada" }).getByLabel("Anul acesta").check();
      // 120 days before a date early in the year falls in the year before — then the case expects three.
      const inYear = new Date(Date.now() - 120 * DAY).getFullYear() === new Date().getFullYear();
      await expect(subjects(page)).toHaveText(inYear ? [...newest, "Vizită pe teren"] : newest);
      await page.getByRole("dialog", { name: "Perioada" }).getByLabel("Ultimele 7 zile").check();
      await page.keyboard.press("Escape");
      await expect(subjects(page)).toHaveText(newest);

      // Step 8 — the sort: „Cele mai vechi întâi" reverses the rows, and a reload keeps it.
      await page.locator("[data-sort-control]").click();
      await expect(page.locator("[data-sort-control]")).toHaveText("Cele mai vechi întâi");
      await expect(subjects(page)).toHaveText([...newest].reverse());
      await page.reload();
      await search(page).fill(MARK);
      await expect(page.locator("[data-sort-control]")).toHaveText("Cele mai vechi întâi");
      await expect(subjects(page)).toHaveText([...newest].reverse(), { timeout: 30_000 });

      // Step 9 — „Șterge filtrele": the 90 days, every channel and direction, newest first, the search empty.
      await phone.click();
      await page.locator("[data-clear-filters]").click();
      await expect(page.locator("[data-clear-filters]")).toHaveCount(0);
      await expect(page.locator("[data-sort-control]")).toHaveText("Cele mai noi întâi");
      await expect(page.locator("[data-range-trigger]")).toContainText("Ultimele 90 de zile");
      await expect(search(page)).toHaveValue("");
      await expect(phone).not.toHaveAttribute("data-on", "");
      await expect(direction.getByRole("radio", { name: "Toate" })).toBeChecked();

      // Step 10 — „Așteaptă răspuns: 1" jumps to the inbound row awaiting a reply.
      await search(page).fill(MARK);
      await expect(subjects(page)).toHaveText(newest, { timeout: 30_000 });
      await page.getByRole("button", { name: "Așteaptă răspuns: 1", exact: true }).click();
      await expect(subjects(page)).toHaveText(["Confirmare vizionare"]);
      await expect(direction.getByRole("radio", { name: "Primite" })).toBeChecked();
      await page.locator("[data-clear-filters]").click();

      // Step 11 — a row clicked is selected, and its description shows under its subject; no box to type in.
      await search(page).fill(MARK);
      const first = rows(page).filter({ hasText: "Proiect de contract" });
      await first.click();
      await expect(first).toHaveAttribute("aria-selected", "true");
      await expect(first.locator("[data-description-preview]")).toHaveText("Proiectul trimis spre lectură.");
      await expect(rows(page).locator("input, textarea, select")).toHaveCount(0);

      // The pictures at 1366 and 1920 (#39.06: A alone, across the width), the spec's invented records only.
      await page.setViewportSize({ width: 1366, height: 900 });
      await expect(subjects(page)).toHaveText(newest);
      await picture(page, "history-1366");
      await page.setViewportSize({ width: 1920, height: 1080 });
      await picture(page, "history-1920");

      // Step 12 — (#39.06) A alone: no log tile here. A person's name is a link to their screen, C expanded on a new
      // record; it does not select its row.
      await expect(page.locator("[data-interactions-log]")).toHaveCount(0);
      const second = rows(page).filter({ hasText: "Verificare titlu" });
      const link = second.locator(`[data-person-link="${ana}"]`);
      await expect(link).toHaveAttribute("href", `/natural-persons/${ana}?log=new`);
      await link.click();
      await expect(page).toHaveURL((u) => u.pathname === `/natural-persons/${ana}` && u.searchParams.get("log") === "new", { timeout: 30_000 });
      const log = page.locator("[data-interactions-log]");
      await expect(log.getByRole("group", { name: "Mod" }).getByRole("button", { name: "Interacțiune nouă" })).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 }); // 41.11
    } finally {
      await removeRecord(page.request, "person", ana);
      await removeRecord(page.request, "person", mihai);
    }
  });
});
