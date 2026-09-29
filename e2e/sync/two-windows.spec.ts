/**
 * Case:   TC-TABS-01 — Același act în două ferestre: cealaltă urmează, salvarea învechită e refuzată
 * Source: docs/testing/cases/TC-TABS-01.md, „Last green" 2026-09-28
 *
 * Two pages of one browser context are two windows of one browser: they share
 * a BroadcastChannel (Slice #37.21, `src/lib/sync/record-sync.ts`) and a
 * session. The case's steps, verbatim where it quotes the screen.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The contract is this spec's own, „TC-E2E-TABS-01 Contract de test",
 *     created through POST /api/documents and removed in `finally` through the
 *     DELETE route „Șterge" calls.
 *   - The version history is read from GET /api/documents/[id]/versions, the
 *     route the header's „◀ v n ▶" reads.
 */
import { test, expect } from "@playwright/test";
import { E2E_MARKER, createSaleContract, removeLeftovers, removeRecord } from "../helpers/records";
import { photograph } from "../helpers/field-widths";

const MARK = `${E2E_MARKER}TABS-01`;
const TITLE = `${MARK} Contract de test`;

test.describe("TC-TABS-01 — Același act în două ferestre", () => {
  test("cealaltă fereastră urmează salvarea; o salvare dintr-o versiune învechită e refuzată", async ({ page }) => {
    test.setTimeout(240_000);
    await removeLeftovers(page.request, MARK);
    const documentId = await createSaleContract(page.request, TITLE);
    const second = await page.context().newPage();

    try {
      // Step 1 — the contract in the first window, editable; in the second, read-only.
      await page.goto(`/documents/${documentId}`);
      await expect(page.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 30_000 });
      await second.goto(`/documents/${documentId}?readonly=true`);
      await expect(second.getByRole("heading", { name: TITLE })).toBeVisible({ timeout: 30_000 });
      const subjectA = page.locator('[name="subject"]');
      const subjectB = second.locator('[name="subject"]');
      await expect(subjectB).toHaveValue("");
      // The version list must be in before the first save carries its base version.
      await expect(page.getByText("v 0", { exact: true }).first()).toBeAttached({ timeout: 30_000 });

      // Step 2 — the first window: „Subiect" `TC-A1`, „Salvează": v 1.
      await subjectA.fill("TC-A1");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.getByText("2 versiuni")).toBeVisible({ timeout: 30_000 });

      // Step 3 — the second window, which had nothing unsaved, shows it by itself.
      await expect(subjectB).toHaveValue("TC-A1", { timeout: 30_000 });

      // Step 4 — the second window: „Modifică", „Subiect" `TC-B` (not saved).
      await second.getByRole("button", { name: "Modifică", exact: true }).click();
      await subjectB.fill("TC-B");
      await expect(second.getByText("Modificări nesalvate")).toBeVisible();

      // Step 5 — the first window: „Subiect" `TC-A2`, „Salvează": v 2.
      await subjectA.fill("TC-A2");
      await page.getByRole("button", { name: "Salvează", exact: true }).click();
      await expect(page.getByText("3 versiuni")).toBeVisible({ timeout: 30_000 });

      // Step 6 — the second window is NOT reloaded under the user's hands: it says so.
      const saved = second.locator('[data-record-sync="saved"]');
      await expect(saved).toBeVisible({ timeout: 30_000 });
      await expect(saved).toContainText("Această înregistrare a fost salvată în altă fereastră.");
      await expect(saved.getByRole("button", { name: "Reîncarcă" })).toBeVisible();
      await expect(subjectB).toHaveValue("TC-B");
      // Slice #37.23 — the User Guide's picture of this notice.
      await photograph(second, "sync-saved-elsewhere", [1920]);

      // Step 7 — the second window saves anyway: refused, nothing written, `TC-B` still on screen.
      await second.getByRole("button", { name: "Salvează", exact: true }).click();
      const stale = second.locator('[data-record-sync="stale"]');
      await expect(stale).toBeVisible({ timeout: 30_000 });
      await expect(stale).toContainText("Nu s-a salvat nimic");
      await expect(subjectB).toHaveValue("TC-B");
      await photograph(second, "sync-save-refused", [1920]);

      // Step 8 — the history holds exactly the two accepted saves: v 0, v 1, v 2, the last `TC-A2`.
      const res = await page.request.get(`/api/documents/${documentId}/versions`);
      expect(res.ok()).toBeTruthy();
      const { items } = (await res.json()) as { items: { versionNumber: number; snapshot: { subject?: string | null } }[] };
      expect(items.map((v) => v.versionNumber).sort((a, b) => a - b)).toEqual([0, 1, 2]);
      const latest = items.reduce((a, b) => (b.versionNumber > a.versionNumber ? b : a));
      expect(latest.snapshot.subject).toBe("TC-A2");

      // Step 9 — „Reîncarcă" in the second window: asked first (something is unsaved), then the current version.
      await stale.getByRole("button", { name: "Reîncarcă" }).click();
      const confirm = second.getByRole("dialog", { name: "Reîncărcați înregistrarea?" });
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "Reîncarcă" }).click();
      await expect(subjectB).toHaveValue("TC-A2", { timeout: 30_000 });
    } finally {
      await second.close();
      await removeRecord(page.request, "document", documentId);
    }
  });
});
