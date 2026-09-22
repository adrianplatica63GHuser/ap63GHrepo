/**
 * Case:   TC-PROP-02 — Editare și salvare: contorul de versiuni avansează
 * Source: docs/testing/cases/TC-PROP-02.md, „Last green" 2026-09-22
 *
 * E2E: Property versioning happy path  (Slice #19.28)
 *
 * ⚠️ **THIS FILE IS TC-PROP-02'S AUTOMATION, AND THE CASE IS NOT WRITTEN TWICE.**
 *                                                              (Slice #36.06)
 * The four tests below predate the catalogue and already assert most of what
 * the case does, on the fixed property auth.setup.ts creates. What they could
 * not assert is the part of the case that holds only on a property with NO
 * history: „◀ v 0 ▶" before the first save, the strip replaced by the chip
 * „2 versiuni" after it, and the `sr-only` „v 1" beside the chip. The fixed
 * property has hundreds of versions and will never show „v 0" again. So the
 * case's own steps are the fifth test, at the bottom, on a property of its
 * own — marked `TC-E2E-PROP-02`, created through POST /api/properties and
 * removed through the DELETE route „Șterge" calls. The four tests are
 * unchanged.
 *
 * Covers the full save → version-append → nav ◀/▶ → make-current cycle on
 * the Property detail form — the most complex versioned entity (fields +
 * address + corners).
 *
 * Strategy: one fixed "E2E Proprietate Test" property is created once by
 * auth.setup.ts and reused across all runs.  beforeEach resets the nickname
 * via PATCH (which appends a new version) and reads the resulting version
 * number as `startVersion`.  All assertions are RELATIVE (+1 / -1 from
 * startVersion), so they stay correct no matter how many versions have
 * accumulated from prior runs.
 *
 * Pre-conditions:
 *   - Dev server running:  npm run dev
 *   - .env has E2E_EMAIL + E2E_PASSWORD
 *   - auth.setup.ts has written e2e/.auth/e2e-ids.json
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import * as nav from "../helpers/version-nav";
import { E2E_MARKER, createProperty, removeLeftovers, removeRecord } from "../helpers/records";

const IDS_FILE = path.join(__dirname, "../.auth/e2e-ids.json");

// ── Suite ─────────────────────────────────────────────────────────────────────

test.describe("Versionare Proprietate", () => {
  let propertyId: string;
  let startVersion: number;

  // Read the fixed property UUID once for the whole suite
  test.beforeAll(() => {
    const ids = JSON.parse(
      fs.readFileSync(IDS_FILE, "utf-8"),
    ) as { propertyId: string };
    propertyId = ids.propertyId;
  });

  // Reset to a known baseline before each test
  test.beforeEach(async ({ page }) => {
    // PATCH resets the nickname and creates a new baseline version
    const res = await page.request.patch(`/api/properties/${propertyId}`, {
      data: { nickname: "E2E Baseline" },
    });
    expect(
      res.ok(),
      `PATCH /api/properties/${propertyId} failed (${res.status()})`,
    ).toBeTruthy();

    // Navigate to the property detail page and wait for the version nav
    await page.goto(`/properties/${propertyId}`);
    await nav.waitForNav(page);

    // Snapshot the current version so each test can assert relative changes
    startVersion = await nav.getVersionNumber(page);
  });

  // ── Test 1: Save appends a new version ────────────────────────────────────

  test("salvarea adauga o versiune noua", async ({ page }) => {
    // Edit the nickname field
    await page.locator("input[name=\"nickname\"]").fill("E2E Edit 1");

    // Click Save
    await page.getByRole("button", { name: "Salvează", exact: true }).click();

    // Version label must increment by exactly 1
    await expect(
      page.getByText(`v ${startVersion + 1}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
  });

  // ── Test 2: ◀ navigates back; form becomes read-only ──────────────────────

  test("navigare inapoi — formularul devine read-only", async ({ page }) => {
    // Save once first to ensure a fresh "latest + 1" version exists to navigate back from
    await page.locator("input[name=\"nickname\"]").fill("E2E Navigare");
    await page.getByRole("button", { name: "Salvează", exact: true }).click();
    await expect(
      page.getByText(`v ${startVersion + 1}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate back one version via ◀
    await nav.clickPrev(page);
    // Nav label should now be startVersion (one step back from startVersion + 1)
    await expect(
      page.getByText(`v ${startVersion}`, { exact: true }),
    ).toBeVisible({ timeout: 5_000 });

    // Form must be read-only — fieldset[disabled] wraps editable inputs
    expect(await nav.isFormReadOnly(page)).toBe(true);
    await expect(page.locator("input[name=\"nickname\"]")).toBeDisabled();

    // "Setează ca actuală" must be enabled when viewing a past version
    await expect(
      page.getByRole("button", { name: "Setează ca actuală" }),
    ).toBeEnabled();
  });

  // ── Test 3: Make Current creates a new latest version ─────────────────────

  test("Seteaza ca actuala — creaza versiune noua din snapshot vechi", async ({ page }) => {
    // Save a modification to push the latest version forward
    await page.locator("input[name=\"nickname\"]").fill("E2E Modificare");
    await page.getByRole("button", { name: "Salvează", exact: true }).click();

    const afterSave = startVersion + 1;
    await expect(
      page.getByText(`v ${afterSave}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // Navigate back one version (now viewing startVersion)
    await nav.clickPrev(page);

    // Trigger Make Current — should create v(afterSave + 1)
    const newLatest = await nav.clickMakeCurrentAndConfirm(page, afterSave);
    expect(newLatest).toBe(afterSave + 1);

    // After Make Current the form must be editable (we follow the new latest)
    expect(await nav.isFormReadOnly(page)).toBe(false);
    await expect(page.locator("input[name=\"nickname\"]")).toBeEnabled();
  });

  // ── Test 4: Save button tracks dirty state ────────────────────────────────

  test("butonul Salveaza: dezactivat → activ → dezactivat dupa salvare", async ({ page }) => {
    const saveBtn = page.getByRole("button", { name: "Salvează", exact: true });

    // Initially: form matches saved baseline — Save must be disabled
    await expect(saveBtn).toBeDisabled();

    // Edit a field — Save must enable
    await page.locator("input[name=\"nickname\"]").fill("E2E Dirty");
    await expect(saveBtn).toBeEnabled();

    // Save — wait for the new version to appear, then Save must disable again
    await saveBtn.click();
    await expect(
      page.getByText(`v ${startVersion + 1}`, { exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(saveBtn).toBeDisabled();
  });
});

// ── TC-PROP-02, step for step ────────────────────────────────────────────────
//
// Outside the describe above on purpose: its beforeEach PATCHes the FIXED
// property and waits for its nav, which this test does not use.

test.describe("TC-PROP-02 — Editare și salvare: contorul de versiuni avansează", () => {
  test("de la v 0 la „2 versiuni”, cu bannerul de modificări nesalvate", async ({ page }) => {
    // The property screens compile slowly under `next dev`, and the first run
    // spent the whole default 30 s on one click, leaving the `finally` no time
    // to remove the property. `slow()` triples the budget.
    test.slow();
    const nickname = `${E2E_MARKER}PROP-02 Teren de test`;
    await removeLeftovers(page.request, `${E2E_MARKER}PROP-02`);
    // The case's precondition is TC-PROP-01's property: 1000 m², never edited.
    const propertyId = await createProperty(page.request, { nickname, surfaceAreaMp: 1000 });

    try {
      // Step 1 — „Deschide" on the row in „Proprietăți — Listă"; „DETALII".
      await page.goto("/properties");
      const row = page.getByRole("row").filter({ hasText: nickname });
      // `force`: on the first run this click resolved the link, the screenshot
      // showed it on screen, and Playwright waited 34 s for it to be „visible,
      // enabled and stable" until the test timed out. Only the Proprietăți list
      // did this — the same click on the persons and documents lists went
      // straight through. `force` skips only that wait; the URL assertion below
      // still proves the click landed.
      await row.getByRole("link", { name: "Deschide" }).click({ force: true });
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}$`), { timeout: 30_000 });
      await expect(page.getByRole("heading", { name: nickname })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("tab", { name: "DETALII" })).toBeVisible();

      // Step 2 — top right of the header: „◀ v 0 ▶" and „Setează ca actuală".
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.getByRole("button", { name: "Versiunea anterioară" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Versiunea următoare" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Setează ca actuală" })).toBeVisible();

      // Step 3 — „Salvează" is pale: nothing has changed yet.
      const save = page.getByRole("button", { name: "Salvează", exact: true });
      await expect(save).toBeDisabled();

      // Step 4 — 1000.00 → 1100, leave the field: the banner, and „Salvează" dark.
      const area = page.getByLabel(/^Suprafață oficială \(m²\)/);
      await expect(area).toHaveValue("1000.00");
      await area.fill("1100");
      await area.blur();
      const banner = page.getByRole("status").filter({ hasText: "Modificări nesalvate" });
      await expect(banner).toBeVisible();
      await expect(save).toBeEnabled();

      // Step 5 — „Salvează"; the form stays on this screen.
      await save.click();
      await expect(page).toHaveURL(new RegExp(`/properties/${propertyId}$`));

      // Step 6 — the strip is REPLACED by the chip „↺ 2 versiuni"; the banner
      // is gone; the field reads 1100. The chip carries a count, so the number
      // of the version on screen is the sr-only „v 1" beside it
      // (version-nav-controls.tsx) — asserted here because the case says a page
      // without it is a defect, not a step to work around.
      const chip = page.getByRole("button", { name: "2 versiuni" });
      await expect(chip).toBeVisible({ timeout: 15_000 });
      await expect(page.getByRole("button", { name: "Versiunea următoare" })).toHaveCount(0);
      await expect(page.getByText("v 1", { exact: true })).toBeAttached();
      await expect(banner).toHaveCount(0);
      await expect(area).toHaveValue("1100");

      // Step 7 — the chip leads to the previous version: „◀ v 0 ▶",
      // „Setează ca actuală" dark, the fields read-only, 1000.00 again.
      await chip.click();
      await expect(page.getByText("v 0", { exact: true })).toBeVisible({ timeout: 8_000 });
      await expect(page.getByRole("button", { name: "Setează ca actuală" })).toBeEnabled();
      await expect(area).toBeDisabled();
      await expect(area).toHaveValue("1000.00");

      // Step 8 — „Versiunea următoare": back to the latest, „v 1".
      await page.getByRole("button", { name: "Versiunea următoare" }).click();
      await expect(page.getByText("v 1", { exact: true })).toBeAttached({ timeout: 8_000 });
      await expect(page.getByRole("button", { name: "2 versiuni" })).toBeVisible();
    } finally {
      // The case leaves the property to TC-PROP-01's cleanup; a spec may not.
      await removeRecord(page.request, "property", propertyId);
    }
  });
});
