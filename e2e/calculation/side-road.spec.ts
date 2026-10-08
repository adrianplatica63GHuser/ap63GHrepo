/**
 * Case:   TC-CALC-01 — Calculul cu drum lateral pe un teren cunoscut, și istoricul lui
 * Source: docs/testing/cases/TC-CALC-01.md, „Last green" 2026-10-07
 *
 * A translation of the case file, step for step (Slice #38.43). Every Romanian
 * string and figure below is quoted from it verbatim; step 8's figures are
 * Adrian's, checked by hand (2026-10-07).
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The four data files are copies of the case's, in `e2e/fixtures/`, so the
 *     spec does not read a folder outside the repository.
 *   - Step 4 puts the owners in order with ↑ in the table, never by dragging:
 *     the order the file's slices come in is random, and ↑ is deterministic.
 *   - Step 5 compares the table's swatches (`data-owner-color`) before and
 *     after the swap, not the map's slices: the map paints the same colour from
 *     the same `ownerColor(owner)`, and a canvas pixel is not a locator.
 *   - Step 14 (#38.43) deletes the run from „Istoricul calculelor”, which is
 *     what lets the spec exist: before it, every run of it left a run behind.
 *   - Everything it created is removed in `afterAll`, which runs after a red
 *     step too: the four properties, the group, and the run if step 14 never
 *     got to it — through the API, as every TC-E2E- record is.
 */

import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";
import { SUPERUSER_STATE } from "../helpers/auth-state";

const FIXTURES = path.join(__dirname, "..", "fixtures");
const file = (name: string) => path.join(FIXTURES, `TC-CALC-01 ${name}.txt`);
const OWNERS = ["TC-CALC-01 A", "TC-CALC-01 B", "TC-CALC-01 C"] as const;
const GROUP = "TC-CALC-01 Grup de test";
const ROAD = "TC-CALC-01 Drum comun";

/** What this run created, for afterAll. */
const made: { propertyIds: string[]; runId: string | null } = { propertyIds: [], runId: null };

const map = (page: Page) => page.locator('[data-panel="preview-map"]');
const roadStatus = (page: Page) => page.locator('[data-panel="road-step"] p[role="status"]');
const fileInput = (page: Page) => page.locator('input[type="file"]');
// `data-width-table`, not any table: Google's map draws a keyboard-shortcuts table of its own
// inside the panel once it takes focus (measured in 20261008T115334Z-12191).
const ownerTable = (page: Page) => page.locator('[data-panel="calculation"] table[data-width-table]');

/** The owners' names in the table, top to bottom. */
async function order(page: Page): Promise<string[]> {
  return (await ownerTable(page).locator("tbody tr td:nth-child(2)").allInnerTexts()).map((t) => t.trim());
}

/** A table row's cells, the reorder column left out, whitespace collapsed. */
async function rowText(row: Locator): Promise<string> {
  const cells = (await row.locator("td").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
  return cells.slice(0, 8).join(" · ");
}

/** A figure tile („Suprafața parcelei" …) by its label: its value. */
function figure(page: Page, label: string): Locator {
  return page
    .locator('[data-panel="calculation"] div.rounded-md')
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();
}

/** Each owner's swatch colour, by name. */
async function swatches(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const row of await ownerTable(page).locator("tbody tr").all()) {
    const name = (await row.locator("td").nth(1).innerText()).trim();
    out[name] = (await row.locator("[data-owner-color]").getAttribute("data-owner-color")) ?? "";
  }
  return out;
}

/**
 * ↑ on `name` until it stands at `pos` (0-based), one swap at a time.
 *
 * Each ↑ starts a recompute, and while it runs the arrows are disabled and the
 * table still shows the old order. A click sent then waits for the arrows and
 * lands on the NEW order — measured in full 20261008T133345Z-19785, where a
 * second ↑ meant for A's old row arrived after A was already first. So every
 * swap is followed by waiting for the order to change, before the next read.
 */
async function moveTo(page: Page, name: string, pos: number): Promise<void> {
  for (let guard = 0; guard < OWNERS.length; guard++) {
    const now = (await order(page)).indexOf(name);
    if (now <= pos) break;
    const up = page.getByRole("button", { name: `Mută felia lui ${name} mai sus`, exact: true });
    await expect(up).toBeEnabled({ timeout: 30_000 });
    await up.click();
    await expect.poll(async () => (await order(page)).indexOf(name), { timeout: 30_000 }).toBe(now - 1);
  }
  expect((await order(page)).indexOf(name)).toBe(pos);
}

test.afterAll(async ({ playwright }) => {
  const api = await playwright.request.newContext({
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    storageState: SUPERUSER_STATE,
  });
  try {
    for (const id of made.propertyIds) await api.delete(`/api/properties/${id}`);
    const groups = ((await (await api.get("/api/groups")).json()).items ?? []) as { id: string; description: string | null }[];
    for (const g of groups.filter((g) => (g.description ?? "").startsWith(GROUP))) await api.delete(`/api/groups/${g.id}`);
    if (made.runId) {
      const r = await api.delete(`/api/calculation/runs/${made.runId}`);
      expect([200, 404]).toContain(r.status());
    }
  } finally {
    await api.dispose();
  }
});

test.describe("TC-CALC-01 — calculul cu drum lateral, și istoricul lui", () => {
  test("fișierele respinse, ordinea și culorile, drumul, cifrele lui Adrian, istoricul, re-rularea și ștergerea", async ({ page }) => {
    test.setTimeout(300_000);
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Step 1 — „Calcul", its three sections and their rules.
    await page.goto("/admin/calculation");
    await expect(page.getByRole("heading", { name: "Calcul", exact: true, level: 1 })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Alegeți fișierul de date al parcelei. Are trei secțiuni", { exact: false }).first()).toBeVisible();

    // Step 2 — the three rejected files, each with its one reason, and no map.
    for (const [name, reason] of [
      ["Respins 5 colturi", "Fișierul are 5 colțuri; trebuie să aibă exact 4."],
      ["Respins 98 la suta", "Cotele-părți însumează 98,00%; trebuie să fie 100% sau 99,99%."],
      ["Respins drum 15 m", "Lățimea drumului este 15 m; trebuie să fie peste 0 și sub 15 m."],
    ] as const) {
      await fileInput(page).setInputFiles(file(name));
      const problems = page.locator('[data-panel="file-problems"]');
      await expect(problems).toContainText("Fișierul nu poate fi folosit:", { timeout: 30_000 });
      await expect(problems).toContainText(reason);
      await expect(map(page)).toHaveCount(0);
    }

    // Step 3 — the good file: the road step, the map, the parcel's figures, the 0,01% note.
    await fileInput(page).setInputFiles(file("Impartire cu drum"));
    await expect(page.getByText("Pasul 3 — drumul", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(map(page).getByText("18", { exact: true })).toBeVisible({ timeout: 30_000 });
    expect([...(await order(page))].sort()).toEqual([...OWNERS]);
    await expect(figure(page, "Suprafața parcelei")).toContainText("611,87 m²");
    await expect(figure(page, "Lățime drum")).toContainText("3,0 m");
    await expect(figure(page, "Latura 16–17")).toContainText("29,8 m");
    await expect(figure(page, "Latura 17–18")).toContainText("20,5 m");
    await expect(figure(page, "Latura 18–19")).toContainText("29,8 m");
    await expect(figure(page, "Latura 19–16")).toContainText("20,5 m");
    await expect(page.getByText(/^Cotele însumează 99,99%: ultima felie din ordine/)).toBeVisible();

    // Step 4 — A, B, C with ↑.
    for (let i = 0; i < OWNERS.length; i++) await moveTo(page, OWNERS[i], i);
    expect(await order(page)).toEqual([...OWNERS]);

    // Step 5 — each owner keeps its colour through a swap and back.
    const colours = await swatches(page);
    expect(new Set(Object.values(colours)).size).toBe(3);
    await moveTo(page, "TC-CALC-01 B", 0);
    expect(await order(page)).toEqual(["TC-CALC-01 B", "TC-CALC-01 A", "TC-CALC-01 C"]);
    expect(await swatches(page)).toEqual(colours);
    await moveTo(page, "TC-CALC-01 A", 0);
    expect(await order(page)).toEqual([...OWNERS]);
    expect(await swatches(page)).toEqual(colours);

    // Step 6 — corner 18.
    await map(page).scrollIntoViewIfNeeded();
    await map(page).getByText("18", { exact: true }).click();
    await expect(roadStatus(page)).toHaveText(
      "Colțul 18 este ales. Faceți clic pe latura pe care merge drumul: 18–19 sau 17–18.",
      { timeout: 15_000 },
    );

    // Step 7 — side 16–17 is refused; corner 18 stays chosen.
    await map(page).getByText("16–17", { exact: true }).click();
    await expect(page.locator('[data-panel="road-refusal"]')).toHaveText("Latura 16–17 nu pornește din colțul 18. Alegeți 18–19 sau 17–18.");
    await expect(roadStatus(page)).toContainText("Colțul 18 este ales");

    // Step 8 — side 18–19: Adrian's figures.
    await map(page).getByText("18–19", { exact: true }).click();
    await expect(roadStatus(page)).toContainText("Drumul pornește din colțul 18, pe latura 18–19.", { timeout: 30_000 });
    await expect(figure(page, "Colțul drumului")).toContainText("18");
    await expect(figure(page, "Latura drumului")).toContainText("18–19");
    await expect(figure(page, "Lungime drum")).toContainText("20,8 m", { timeout: 30_000 });
    await expect(figure(page, "Suprafață drum")).toContainText("62,45 m²");
    const rows = ownerTable(page).locator("tbody tr");
    await expect(rows).toHaveCount(3);
    await expect.poll(() => rowText(rows.nth(0)), { timeout: 30_000 }).toBe("1 · TC-CALC-01 A · 33,33% · 203,94 · 20,81 · 183,12 · 203,94 · 0,00");
    expect(await rowText(rows.nth(1))).toBe("2 · TC-CALC-01 B · 33,33% · 203,94 · 20,81 · 183,12 · 203,94 · 0,00");
    expect(await rowText(rows.nth(2))).toBe("3 · TC-CALC-01 C · 33,33% · 204,00 · 20,82 · 183,18 · 204,00 · 0,00");
    expect(await rowText(ownerTable(page).locator("tfoot tr"))).toBe(" · Total · 99,99% · 611,87 · 62,45 · 549,42 · 611,87 · 0,00");

    // Step 9 — the group's description and the road's nickname; „Creează proprietățile".
    const commit = page.locator('[data-panel="commit"]');
    await expect(commit.getByText("Creează 4 proprietăți — proprietarii și drumul — și un grup", { exact: true })).toBeVisible();
    await page.getByRole("textbox", { name: "Descrierea grupului" }).fill(GROUP);
    await page.getByRole("textbox", { name: "Poreclă drum" }).fill(ROAD);
    await page.getByRole("button", { name: "Creează proprietățile", exact: true }).click();
    const done = page.locator('[data-panel="committed"]');
    await expect(done).toBeVisible({ timeout: 60_000 });
    const links = done.locator("ul a");
    made.propertyIds = (await links.evaluateAll((as) => as.map((a) => a.getAttribute("href") ?? ""))).map((h) => h.split("/").pop()!);
    const runLink = done.locator('a[href^="/admin/calculation/history/"]');
    made.runId = (await runLink.getAttribute("href"))!.split("/").pop()!;
    await expect(done).toContainText(/S-a creat grupul GRP-\d+ cu următoarele proprietăți:/);
    const runCode = /Calculul înregistrat: (CALC\d+)/.exec(await done.innerText())?.[1];
    expect(runCode).toMatch(/^CALC\d{5}$/);
    await expect(links).toHaveText([...OWNERS, ROAD]);

    // Step 10 — „Vezi istoricul calculului": the run's own page.
    await runLink.click();
    await expect(page).toHaveURL(new RegExp(`/admin/calculation/history/${made.runId}$`), { timeout: 30_000 });
    const run = page.locator('[data-panel="calculation-run"]');
    await expect(run).toContainText(runCode!, { timeout: 30_000 });
    await expect(run).toContainText("Activ");
    await expect(run.getByRole("button", { name: "Re-rulează cu acești parametri" })).toBeVisible();
    for (const text of ["Parametrii calculului", "Descriere grup", GROUP, "Pașii calculului", "Previzualizare hartă", "Parcele create"]) {
      await expect(run.getByText(text, { exact: false }).first()).toBeVisible();
    }
    await expect(run.getByText("Parcelă proprietar", { exact: true })).toHaveCount(3);
    await expect(run.getByText("Drum comun", { exact: true })).toHaveCount(1);

    // Step 11 — property A: its computed area, and „Nr. orig." 17 on one corner.
    const a = await (await page.request.get(`/api/properties/${made.propertyIds[0]}`)).json();
    const flat = JSON.stringify(a);
    expect(Number(/"surfaceAreaMp":"?([\d.]+)/.exec(flat)?.[1])).toBeCloseTo(183.12, 2);
    expect([...flat.matchAll(/"originalIndex":(\d+)/g)].map((m) => m[1])).toEqual(["17"]);

    // Step 12 — „Istoricul calculelor": the run's row.
    await page.goto("/admin/calculation/history");
    const row = page.locator("tbody tr").filter({ hasText: runCode! });
    await expect(row).toHaveCount(1, { timeout: 30_000 });
    await expect(row).toContainText("Drum lateral");
    await expect(row).toContainText("4");
    await expect(row).toContainText(/GRP-\d+/);
    await expect(row).toContainText("Activ");

    // Step 13 — re-run: the same file, A, B, C, the road from 18 along 18–19, step 8's figures.
    await page.goto(`/admin/calculation/history/${made.runId}`);
    await page.getByRole("button", { name: "Re-rulează cu acești parametri" }).click({ timeout: 30_000 });
    await expect(roadStatus(page)).toContainText("Drumul pornește din colțul 18, pe latura 18–19.", { timeout: 30_000 });
    expect(await order(page)).toEqual([...OWNERS]);
    await expect(figure(page, "Suprafață drum")).toContainText("62,45 m²");

    // Step 14 (#38.43) — „Șterge calculul" on its row: the confirmation counts what stays; the row goes.
    await page.goto("/admin/calculation/history");
    const again = page.locator("tbody tr").filter({ hasText: runCode! });
    await again.getByRole("button", { name: "Șterge calculul", exact: true }).click({ timeout: 30_000 });
    const dialog = page.getByRole("alertdialog", { name: "Ștergeți calculul?" });
    await expect(dialog.locator("[data-delete-run-body]")).toHaveText(
      `Calculul ${runCode} se șterge; cele 4 proprietăți și grupul create rămân.`,
    );
    const gone = page.waitForResponse((r) => r.url().includes(`/api/calculation/runs/${made.runId}`) && r.request().method() === "DELETE");
    await dialog.getByRole("button", { name: "Șterge", exact: true }).click();
    expect((await gone).status()).toBe(200);
    await expect(again).toHaveCount(0, { timeout: 30_000 });
    expect((await page.request.get(`/api/calculation/runs/${made.runId}`)).status()).toBe(404);
    // What it created stayed: property A still opens.
    expect((await page.request.get(`/api/properties/${made.propertyIds[0]}`)).status()).toBe(200);
  });
});
