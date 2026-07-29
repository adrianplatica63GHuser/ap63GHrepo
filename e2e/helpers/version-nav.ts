/**
 * Page-Object helpers for the VersionNavControls strip  (Slice #19.28)
 *
 * All interactions use Playwright's built-in auto-retry via `expect()` so
 * callers do not need explicit sleeps.  Romanian locale (NEXT_LOCALE=ro-RO)
 * is assumed — aria-labels and button texts are Romanian.
 *
 * Version label format (from messages/ro-RO.json corners.versionLabel):
 *   "v {n}"  e.g. "v 3" for version 3
 */

import { expect, type Page } from "@playwright/test";

// ── Internal locators ────────────────────────────────────────────────────────

/** The version label — text content is exactly "v N" (e.g. "v 3"). */
const versionLabelLoc = (page: Page) =>
  page.getByText(/^v \d+$/).first();

/** ◀ button — aria-label from property.corners.prevVersion in ro-RO.json. */
const prevBtnLoc = (page: Page) =>
  page.getByRole("button", { name: "Versiunea anterioară" });

/** ▶ button — aria-label from property.corners.nextVersion in ro-RO.json. */
const nextBtnLoc = (page: Page) =>
  page.getByRole("button", { name: "Versiunea următoare" });

/**
 * "Setează ca actuală" button — text from property.corners.makeCurrent.
 * (Person/Document forms use "Fă curentă" from their own namespace — this
 * helper is property-specific.)
 */
const makeCurrentBtnLoc = (page: Page) =>
  page.getByRole("button", { name: "Setează ca actuală" });

// ── Public helpers ────────────────────────────────────────────────────────────

/**
 * Wait until the version nav strip has loaded on the page.
 * The strip appears after the async /api/properties/{id}/versions query
 * resolves and sets versionNav != null in the form component.
 */
export async function waitForNav(page: Page): Promise<void> {
  await expect(versionLabelLoc(page)).toBeVisible({ timeout: 15_000 });
}

/**
 * Return the version number currently shown in the nav label.
 * Assumes waitForNav() has already been called (nav is visible).
 */
export async function getVersionNumber(page: Page): Promise<number> {
  const text = await versionLabelLoc(page).textContent();
  return parseInt((text ?? "").replace("v ", "").trim(), 10);
}

/**
 * Click ◀ (previous version) and wait for the label to decrement by 1.
 */
export async function clickPrev(page: Page): Promise<void> {
  const before = await getVersionNumber(page);
  await prevBtnLoc(page).click();
  await expect(page.getByText(`v ${before - 1}`, { exact: true })).toBeVisible(
    { timeout: 8_000 },
  );
}

/**
 * Click ▶ (next version) and wait for the label to increment by 1.
 */
export async function clickNext(page: Page): Promise<void> {
  const before = await getVersionNumber(page);
  await nextBtnLoc(page).click();
  await expect(page.getByText(`v ${before + 1}`, { exact: true })).toBeVisible(
    { timeout: 8_000 },
  );
}

/**
 * Click "Fă curentă", confirm the dialog with "OK", and wait for the nav to
 * show the new latest version (previousLatest + 1).
 *
 * @param page           — Playwright page
 * @param previousLatest — the version number that WAS the latest before Make Current
 * @returns              the new latest version number (previousLatest + 1)
 */
export async function clickMakeCurrentAndConfirm(
  page: Page,
  previousLatest: number,
): Promise<number> {
  await makeCurrentBtnLoc(page).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible({ timeout: 8_000 });

  // Confirm with the OK button inside the dialog
  await dialog.getByRole("button", { name: "OK" }).click();

  // The dialog must close (save in progress)
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });

  // The nav must jump to the newly-created version
  const newLatest = previousLatest + 1;
  await expect(
    page.getByText(`v ${newLatest}`, { exact: true }),
  ).toBeVisible({ timeout: 15_000 });

  return newLatest;
}

/**
 * Return true when the property form is in read-only mode (viewing a
 * historical version).  The form wraps editable inputs in a
 * `<fieldset disabled>` — disabled is the reliable DOM signal.
 */
export async function isFormReadOnly(page: Page): Promise<boolean> {
  return (await page.locator("fieldset[disabled]").count()) > 0;
}
