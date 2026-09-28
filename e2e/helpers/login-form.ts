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
 * ⚠️ **120 s, NOT 30** (Slice #37.17). The two `full` runs
 * 20260928T221128Z-8437 and 20260928T222705Z-21816 ran while Adrian's own dev
 * server on 3000 was up beside the runner's on 3100: „/login" took 32 s to
 * compile and the first API routes 50 s each, and the form was still not
 * interactive when the 30 s ran out — so every spec „did not run". The wait
 * ends the moment both values hold; a longer bound costs nothing on a warm
 * server. The runner's re-run does not cover the setup (FU-256).
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
  }).toPass({ timeout: 120_000 });
}
