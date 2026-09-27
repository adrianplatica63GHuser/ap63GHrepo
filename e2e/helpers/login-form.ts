/**
 * Fill the real /login form, and make sure both fields kept what was typed.
 *                                                              (Slice #37.02)
 *
 * ⚠️ **A FIELD FILLED BEFORE THE FORM IS INTERACTIVE CAN BE EMPTIED AGAIN.**
 * Measured in the test runner's `full` run 20260927T012711Z-6756: on a server
 * still warming up, „Utilizator sau Email" was empty and focused at the moment
 * of the click while „Parolă" still held its value, so the required field
 * stopped the submit and the setup waited out its 20 s for „/" — every spec
 * then „did not run". The same race the case files note for a new record's
 * first „Salvează". So the two fills are repeated until both values hold.
 *
 * ⚠️ **NO VALUE REACHES AN ERROR MESSAGE.** The check compares in code and
 * reports only WHICH field lost its value: a `toHaveValue(password)` that
 * failed would print the password into the runner's log.
 */

import { expect, type Page } from "@playwright/test";

export async function fillLoginForm(page: Page, identity: string, password: string): Promise<void> {
  await expect(async () => {
    await page.fill("#identity", identity);
    await page.fill("#password", password);
    await page.waitForTimeout(300);
    const keptIdentity = (await page.inputValue("#identity")) === identity;
    const keptPassword = (await page.inputValue("#password")) === password;
    expect(keptIdentity, "„Utilizator sau Email” lost what was typed into it").toBe(true);
    expect(keptPassword, "„Parolă” lost what was typed into it").toBe(true);
  }).toPass({ timeout: 30_000 });
}
