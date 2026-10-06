/**
 * Case:   TC-TAG-02 — „Etichete": o etichetă aleasă în nor redenumită pe loc, două fuzionate
 * Source: docs/testing/cases/TC-TAG-02.md, „Last green" 2026-10-06
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The records carry `TC-E2E-TAG-02` (records.ts): the property
 *     `TC-E2E-TAG-02 Teren` and the tags `tc-e2e-tag-02-a` … `-d`, posted to
 *     the property's metadata here, as TC-ICON-05's spec does.
 *   - Playwright's mouse double-clicks and its keyboard types; the hand run
 *     dispatched the events (FU-290). Opens „Etichete" by its address, not the
 *     sidebar (TC-TAG-01 covers the sidebar's way there).
 */

import { test, expect } from "@playwright/test";
import { E2E_MARKER, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}TAG-02`;
const TAG = (s: string) => `${MARK.toLowerCase()}-${s}`;

test.describe("TC-TAG-02 — o etichetă aleasă în nor redenumită pe loc, două fuzionate", () => {
  test("selecție cu dublu clic, redenumire pe loc, Escape, fuziune", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    let propertyId = "";
    let po = "";
    try {
      const res = await page.request.post("/api/properties", { data: { nickname: `${MARK} Teren`, provenance: "MANUAL" } });
      expect(res.ok()).toBeTruthy();
      const p = ((await res.json()) as { property: { id: string; principalObjectId: string } }).property;
      propertyId = p.id;
      po = p.principalObjectId;
      for (const s of ["a", "b", "c"]) expect((await page.request.post(`/api/metadata/${po}/tags`, { data: { tag: TAG(s) } })).ok()).toBeTruthy();

      const chip = (s: string) => page.locator(`[data-tag-chip="${TAG(s)}"]`);
      const rename = page.getByRole("button", { name: "Redenumește etichetă", exact: true });
      const merge = page.getByRole("button", { name: "Fuzionează etichete", exact: true });
      const pressed = page.locator('[data-tag-chip][aria-pressed="true"]');

      // Step 1 — the cloud alone; the three tags „×1"; both buttons inactive; the explanation's end.
      await page.goto("/admin/tags");
      await expect(page.getByText("Nor de etichete", { exact: true })).toBeVisible({ timeout: 30_000 });
      await expect(page.locator("table")).toHaveCount(0);
      for (const s of ["a", "b", "c"]) await expect(chip(s)).toHaveText(`${TAG(s)}×1`);
      await expect(rename).toBeDisabled();
      await expect(merge).toBeDisabled();
      await expect(page.getByText("fără nicio etichetă selectată, ambele sunt inactive.", { exact: false })).toBeVisible();

      // Step 2 — `-a`: pressed; rename active, merge inactive.
      await chip("a").dblclick();
      await expect(chip("a")).toHaveAttribute("aria-pressed", "true");
      await expect(rename).toBeEnabled();
      await expect(merge).toBeDisabled();

      // Step 3 — and `-b`: merge active, rename inactive.
      await chip("b").dblclick();
      await expect(pressed).toHaveCount(2);
      await expect(merge).toBeEnabled();
      await expect(rename).toBeDisabled();

      // Step 4 — `-b` again: only `-a`; rename active again.
      await chip("b").dblclick();
      await expect(pressed).toHaveCount(1);
      await expect(chip("a")).toHaveAttribute("aria-pressed", "true");
      await expect(rename).toBeEnabled();

      // Step 5 — „Redenumește etichetă": the box, holding the name, focused; rename inactive.
      await rename.click();
      const box = page.getByRole("textbox", { name: `Noul nume pentru „${TAG("a")}”`, exact: true });
      await expect(box).toHaveValue(TAG("a"));
      await expect(box).toBeFocused();
      await expect(rename).toBeDisabled();

      // Step 6 — Enter unchanged: refused under the cloud.
      await box.press("Enter");
      await expect(page.getByText("Noul nume este identic cu cel curent.", { exact: true })).toBeVisible();

      // Step 7 — `TC-E2E-TAG-02-D`, Enter: lower-case as typed; renamed; none pressed; the message gone.
      await box.fill(TAG("d").toUpperCase());
      await expect(box).toHaveValue(TAG("d"));
      await box.press("Enter");
      await expect(chip("d")).toHaveText(`${TAG("d")}×1`, { timeout: 15_000 });
      await expect(chip("a")).toHaveCount(0);
      await expect(pressed).toHaveCount(0);
      await expect(page.getByText("Noul nume este identic cu cel curent.", { exact: true })).toHaveCount(0);

      // Step 8 — `-c`, „Redenumește etichetă", `-x`, Escape: `-c` again, unchanged, still pressed.
      await chip("c").dblclick();
      await rename.click();
      const boxC = page.getByRole("textbox", { name: `Noul nume pentru „${TAG("c")}”`, exact: true });
      await boxC.fill(TAG("x"));
      await boxC.press("Escape");
      await expect(chip("c")).toHaveText(`${TAG("c")}×1`);
      await expect(chip("c")).toHaveAttribute("aria-pressed", "true");
      await expect(chip("x")).toHaveCount(0);

      // Step 9 — `-c` off, `-b` and `-d` on, „Fuzionează etichete": both ticked.
      await chip("c").dblclick();
      await chip("b").dblclick();
      await chip("d").dblclick();
      await merge.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Fuzionare etichete" })).toBeVisible();
      for (const s of ["b", "d"]) await expect(dialog.locator("label").filter({ hasText: TAG(s) }).getByRole("checkbox").first()).toBeChecked();

      // Step 10 — `-d` kept, „Fuzionează": the sentence; then `-c` and `-d ×1`, none pressed.
      await dialog.locator(`input[type="radio"][value="${TAG("d")}"]`).check();
      await expect(dialog.getByText(`Etichetele „${TAG("b")}” vor deveni „${TAG("d")}”.`)).toBeVisible();
      await dialog.getByRole("button", { name: "Fuzionează", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 15_000 });
      await expect(chip("b")).toHaveCount(0, { timeout: 15_000 });
      await expect(chip("c")).toHaveCount(1);
      await expect(chip("d")).toHaveText(`${TAG("d")}×1`);
      await expect(pressed).toHaveCount(0);
    } finally {
      for (const s of ["a", "b", "c", "d", "x"]) if (po) await page.request.delete(`/api/metadata/${po}/tags`, { data: { tag: TAG(s) } }).catch(() => undefined);
      if (propertyId) await removeRecord(page.request, "property", propertyId);
    }
  });
});
