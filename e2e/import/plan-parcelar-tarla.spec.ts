/**
 * Case:   TC-IMP-06 — Un plan parcelar importat: tarla lui, cu parcelele, propusă, confirmată și legată de plan
 * Source: docs/testing/cases/TC-IMP-06.md, „Last green" 2026-10-17 (confirmed by two hand runs, Slice #39.69)
 *
 * A translation of the case file, step for step. Every Romanian string below is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The folder is the case's own, made the case's way: in the browser's private storage, with
 *     `window.showDirectoryPicker` answering it (TC-ICON-06). The plan is the drawn one, `e2e/fixtures/tc-e2e-imp-06-plan.png`.
 *   - THE THREE PAID CALLS ARE ANSWERED HERE, NOT BY THE MODEL: the classification (`scan-folder`), the general read
 *     (`ai-interpret`, which reads nothing here) and the tarla read (`tarla-plan`), the last with what both hand runs
 *     read off the same image. So no full run buys three calls, and the reading cannot drift. The real reads are the
 *     hand runs'.
 *   - Step 1's checks are kept to what this slice changed: the cost line at „Import”.
 *   - Everything named TC-E2E-IMP-06, and a tarla TCP9 in Testeni left by an interrupted run, is removed first and in
 *     `finally`, in the case's order (the plan, then the tarla).
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect, type APIRequestContext, type Page } from "../helpers/test";
import { E2E_MARKER, removeLeftovers } from "../helpers/records";

const MARK = `${E2E_MARKER}IMP-06`;
const FOLDER = "13.tc.plan.parcelar";
const FILE = `${MARK} Plan parcelar.png`;
const PLAN = path.join(__dirname, "..", "fixtures", "tc-e2e-imp-06-plan.png");

/** What both hand runs read off the drawn plan (src/lib/tarla/plan-read.ts's shape). */
const READING = {
  locality: "Testeni",
  county: "Exemplu",
  tarla: "TCP9",
  parcels: [
    { parcela: "1", areaSqm: 2500, use: "Arabil" },
    { parcela: "2", areaSqm: 3200, use: "Arabil" },
    { parcela: "3", areaSqm: 1850, use: "Pășune" },
    { parcela: "4", areaSqm: 4100, use: "Vie" },
  ],
  illegibleParcels: 0,
  unread: [],
  duplicatesDropped: 0,
};

async function tcp9(request: APIRequestContext): Promise<string | null> {
  const res = await request.get("/api/tarlale");
  expect(res.ok()).toBeTruthy();
  const { items } = (await res.json()) as { items: { id: string; indicativ: string; locality: string | null }[] };
  return items.find((t) => t.indicativ === "TCP9" && t.locality === "Testeni")?.id ?? null;
}

async function cleanUp(page: Page): Promise<void> {
  await removeLeftovers(page.request, MARK);
  const id = await tcp9(page.request);
  if (id) await page.request.delete(`/api/admin/value-lists/tarla/${id}`);
  await page
    .evaluate(async (folder) => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(folder, { recursive: true }).catch(() => undefined);
    }, FOLDER)
    .catch(() => undefined);
}

async function makeFolder(page: Page): Promise<void> {
  const bytes = [...fs.readFileSync(PLAN)];
  await page.evaluate(
    async ({ folder, file, bytes }) => {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(folder, { recursive: true }).catch(() => undefined);
      const top = await root.getDirectoryHandle(folder, { create: true });
      const flotante = await top.getDirectoryHandle("flotante", { create: true });
      const handle = await flotante.getFileHandle(file, { create: true });
      const w = await handle.createWritable();
      await w.write(new Blob([new Uint8Array(bytes)], { type: "image/png" }));
      await w.close();
      (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker = async () => top;
    },
    { folder: FOLDER, file: FILE, bytes },
  );
}

async function answerThePaidCalls(page: Page): Promise<void> {
  await page.route("**/api/admin/import/scan-folder", (route) =>
    route.fulfill({
      json: {
        classifiedLabel: "Plan Parcelar",
        suggestedTypeKey: "PLAN_PARCELAR",
        confidence: "high",
        extractable: true,
        identityPersonCount: 0,
        notes: null,
      },
    }),
  );
  await page.route("**/api/documents/*/ai-interpret", (route) =>
    route.fulfill({ json: { fields: {}, customFields: {}, notes: null, parties: [], partyRolesConfigured: false } }),
  );
  await page.route("**/api/documents/*/tarla-plan", (route) => route.fulfill({ json: { reading: READING, truncated: false } }));
}

const INNER = { useInnerText: true } as const;

test.describe("TC-IMP-06 — un plan parcelar importat", () => {
  test("tarla TCP9 creată cu patru parcele, planul legat de ea", async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 1366, height: 900 });
    const step = page.getByText(/^Pasul curent: /).first();
    await page.goto("/admin/import");
    await cleanUp(page);
    try {
      await answerThePaidCalls(page);
      await expect(step).toHaveText("Pasul curent: Informare", { timeout: 30_000 });
      await makeFolder(page);

      // Step 1 — TC-IMP-01's steps 1–10.
      await page.getByRole("button", { name: "Am înțeles", exact: true }).click();
      const toStructure = page.getByRole("button", { name: "Continuă la pasul „Structură”", exact: true });
      await expect(toStructure).toBeVisible({ timeout: 60_000 });
      await toStructure.click();
      await page.getByRole("checkbox", { name: "Respect regulile de structură", exact: true }).check();
      await page.getByRole("button", { name: "Alege folderul…", exact: true }).click();
      await expect(page.getByText(/niciuna nu a fost încălcată/).first()).toBeVisible({ timeout: 30_000 });
      for (const [name, tick, action, done] of [
        ["Restricții", "Am citit restricțiile privind fișierele", "Verifică fișierele", /niciunul nu a fost respins/],
        ["Duplicate", "Am citit ce se consideră duplicat", "Caută duplicate", /niciunul nu apare de mai multe ori/],
        [
          "Deja în sistem",
          "Am citit ce se întâmplă cu documentele care se află deja în sistem",
          "Vezi ce se află deja în sistem",
          /Niciun document din folderul ales nu se află deja în sistem/,
        ],
      ] as const) {
        await page.getByRole("button", { name: `Continuă la pasul „${name}”`, exact: true }).click();
        await expect(step).toHaveText(`Pasul curent: ${name}`, { timeout: 30_000 });
        await page.getByRole("checkbox", { name: tick, exact: true }).check();
        await page.getByRole("button", { name: action, exact: true }).click();
        await expect(page.getByText(done).first()).toBeVisible({ timeout: 30_000 });
      }
      await page.getByRole("button", { name: "Continuă la pasul „Scanare”", exact: true }).click();
      // Slice 41.03 (FU-374): Plan Parcelar has no form — Adrian recreated the type without one — so the scan stops at
      // „unele tipuri de documente nu au încă formular", and the import goes on with „Continuă fără formulare".
      const waive = page.getByRole("button", { name: "Continuă fără formulare", exact: true });
      await expect(waive).toBeVisible({ timeout: 60_000 });
      await waive.click();
      await expect(page.getByText("Scanat", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
      await page.getByRole("button", { name: "Continuă la pasul „Evaluare”", exact: true }).click();
      await page.getByRole("button", { name: "Continuă la pasul „Import”", exact: true }).click();
      await expect(page.getByText("Se creează un document, cu fișierele lui.")).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByText("Citirea AI se plătește: cel mult un document va fi citit. Planul parcelar se citește încă o dată, pentru tarla lui."),
      ).toBeVisible();

      // Step 2 — „Importă”, „Continuă”, „Da, pregătește etichetele”, „Importă Fișierele (1)”.
      await page.getByRole("button", { name: "Importă", exact: true }).click();
      const properties = page.getByRole("dialog").filter({ hasText: "Proprietățile acestui import" });
      await expect(properties.getByText(/un document, care va fi salvat fără legătură cu vreo proprietate/)).toBeVisible({ timeout: 60_000 });
      await properties.getByRole("button", { name: "Continuă", exact: true }).click();
      await page.getByRole("button", { name: "Da, pregătește etichetele", exact: true }).click();
      await page.getByRole("button", { name: "Importă Fișierele (1)", exact: true }).click();

      const tarlaStep = page.locator("[data-tarla-plan-step]");
      await expect(tarlaStep.getByRole("heading", { name: "Tarla din planul parcelar" })).toBeVisible({ timeout: 120_000 });
      await expect(tarlaStep.getByLabel("Tarla", { exact: true })).toHaveValue("TCP9");
      await expect(tarlaStep.getByLabel("Localitate", { exact: true })).toHaveValue("Testeni");
      await expect(tarlaStep.getByLabel("Județ", { exact: true })).toHaveValue("Exemplu");
      await expect(tarlaStep.getByText("4 parcele", { exact: true })).toBeVisible();
      await expect(tarlaStep.locator("[data-tarla-plan-parcels] tbody tr")).toHaveText(
        [/^1\s+2\.500\s+Arabil$/, /^2\s+3\.200\s+Arabil$/, /^3\s+1\.850\s+Pășune$/, /^4\s+4\.100\s+Vie$/],
        INNER,
      );
      await expect(tarlaStep).not.toContainText("PROPRIETAR");
      const proposal = tarlaStep.locator("[data-tarla-plan-proposal]");
      const createSentence = "Tarla TCP9 — Testeni nu există încă: va fi creată, cu parcelele de mai jos, iar planul va fi legat de ea.";
      await expect(proposal).toHaveText(createSentence, { timeout: 30_000 });
      const create = tarlaStep.getByRole("button", { name: "Creează tarla și leagă planul", exact: true });
      await expect(create).toBeEnabled();

      // Step 3 — 40 in Bragadiru, then empty, then back.
      await tarlaStep.getByLabel("Tarla", { exact: true }).fill("40");
      await tarlaStep.getByLabel("Localitate", { exact: true }).fill("Bragadiru");
      await expect(proposal).toHaveText(
        "Tarla 40 — Bragadiru există deja: planul va fi legat de ea și parcelele pe care nu le are vor fi adăugate. Deschide pagina tarlalei",
      );
      await expect(tarlaStep.getByRole("button", { name: "Leagă planul de tarla", exact: true })).toBeVisible();
      await tarlaStep.getByLabel("Tarla", { exact: true }).fill("");
      await expect(proposal).toHaveText("Fără codul tarlalei nu se poate crea sau lega nimic. Scrie-l, sau sari peste.");
      await expect(create).toBeDisabled();
      await tarlaStep.getByLabel("Tarla", { exact: true }).fill("TCP9");
      await tarlaStep.getByLabel("Localitate", { exact: true }).fill("Testeni");
      await expect(proposal).toHaveText(createSentence);

      // Step 4 — „Creează tarla și leagă planul”.
      await create.click();
      await expect(tarlaStep).toHaveCount(0, { timeout: 30_000 });
      await expect(page.getByText(/tarla TCP9 creată, cu 4 parcele/).first()).toBeVisible();
      await expect(page.getByText("Un document importat.")).toBeVisible();

      // Step 5 — the tarla's page.
      const id = await tcp9(page.request);
      expect(id).not.toBeNull();
      await page.goto(`/tarlale/${id}`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tarla TCP9 — Testeni", { timeout: 30_000 });
      const plans = page.locator("[data-tarla-plans]");
      await expect(plans.getByRole("heading", { name: "Un plan parcelar" })).toBeVisible({ timeout: 30_000 });
      await expect(plans.locator("[data-tarla-plan]")).toHaveCount(1);
      const docCode = (await plans.locator("[data-tarla-plan] a").innerText()).trim();
      await expect(plans.locator("[data-tarla-plan]")).toHaveText(`${docCode} — ${FILE}`);
      const parcels = page.locator("[data-tarla-parcels]");
      await expect(parcels.getByRole("heading", { name: "4 parcele" })).toBeVisible();
      await expect(parcels.locator("[data-tarla-parcel]")).toHaveText(
        [
          new RegExp(`^1\\s+2\\.500\\s+Arabil\\s+${docCode}$`),
          new RegExp(`^2\\s+3\\.200\\s+Arabil\\s+${docCode}$`),
          new RegExp(`^3\\s+1\\.850\\s+Pășune\\s+${docCode}$`),
          new RegExp(`^4\\s+4\\.100\\s+Vie\\s+${docCode}$`),
        ],
        INNER,
      );

      // At the end — the tarla's delete is refused while its plan is linked.
      const refused = await page.request.delete(`/api/admin/value-lists/tarla/${id}`);
      expect(refused.status()).toBe(409);
      expect(((await refused.json()) as { code: string }).code).toBe("IN_USE");
    } finally {
      await cleanUp(page);
    }
  });
});
