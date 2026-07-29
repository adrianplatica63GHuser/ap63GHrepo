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

/**
 * ◀ / "step back" button — matched by `title`, NOT by accessible role name.
 *
 * VersionNavControls (Slice #20.12) has two states for "on the latest version
 * with prior history": the full strip's bare ◀ arrow (aria-label AND title
 * both = "Versiunea anterioară", so its accessible NAME is that string), and
 * the compact discovery chip (title = "Versiunea anterioară" too, but its
 * visible text — and therefore its accessible NAME — is the version COUNT,
 * e.g. "2 versiuni"). Both call the same nav.onPrev handler, so from a test's
 * point of view they are the same button in two skins. Matching by role+name
 * only finds the full-strip arrow and hangs forever while the chip is
 * showing; matching by `title` finds either one, since that attribute is the
 * one thing both states were already given identically.
 */
const prevBtnLoc = (page: Page) => page.getByTitle("Versiunea anterioară");

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
 *
 * Timeout is generous (30s, not the usual 5-8s used elsewhere in this file)
 * because the Property detail page is unusually heavy for Next dev-mode's
 * on-demand compilation: it pulls in two next/dynamic client-only imports
 * (the mini-map and Street View panel, both Google Maps) plus the corners
 * table and four other tabs. A cold first hit to this route — especially
 * right after other files in the repo were edited while `npm run dev` was
 * running — can genuinely take longer than a normal page's compile time.
 * This is a dev-server characteristic, not something a test should be
 * flaky about.
 */
export async function waitForNav(page: Page): Promise<void> {
  await expect(versionLabelLoc(page)).toBeVisible({ timeout: 30_000 });
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
