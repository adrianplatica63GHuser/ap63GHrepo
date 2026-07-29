/**
 * E2E: Property versioning happy path  (Slice #19.28)
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
