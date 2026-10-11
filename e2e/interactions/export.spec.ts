/**
 * Case:   TC-INT-05 — „Interacțiuni": „Exportă” descarcă rândurile filtrate, în ordinea grilei, pentru Excel
 * Source: docs/testing/cases/TC-INT-05.md, „Last green" 2026-10-10
 *
 * A translation of the case file, step for step. Every Romanian string below
 * is quoted from it verbatim.
 *
 * Divergences from the hand run, each for a reason the case cannot have:
 *   - The person and her three interactions carry `TC-E2E-INT-05` (records.ts) and are made through the API; the
 *     screen is opened scoped to her.
 *   - The file is read by the spec, cell for cell, where the hand run opens it in Excel.
 */

import fs from "node:fs";
import { test, expect, type APIRequestContext } from "../helpers/test";
import { E2E_MARKER, createNaturalPerson, removeLeftovers, removeRecord } from "../helpers/records";

const MARK = `${E2E_MARKER}INT-05`;
const DAY = 24 * 3600_000;
const TRICKY = 'A spus "da"; trimite actele\nmâine.';

async function log(request: APIRequestContext, body: Record<string, unknown>, daysAgo: number): Promise<void> {
  const res = await request.post("/api/interactions", {
    data: { direction: "INBOUND", status: "LOGGED", occurredAt: new Date(Date.now() - daysAgo * DAY).toISOString(), ...body },
  });
  expect(res.status(), await res.text()).toBe(201);
}

/** RFC 4180, as Excel reads it. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ";") {
      row.push(cur);
      cur = "";
    } else if (c === "\r" && csv[i + 1] === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
      i++;
    } else cur += c;
  }
  return rows;
}

test.describe("TC-INT-05 — exportul", () => {
  test("filtrat la „Telefon”: fișierul ține doar acele rânduri, în ordinea grilei, cu descrierea, fără nota internă", async ({ page }) => {
    test.slow();
    await removeLeftovers(page.request, MARK);
    const ana = await createNaturalPerson(page.request, { lastName: `${MARK} Ionescu`, firstName: "Ioana" });
    try {
      await log(page.request, { personId: ana, channel: "PHONE", subject: "Primul apel", description: TRICKY, internalNote: "Doar pentru echipă" }, 3);
      await log(page.request, { personId: ana, channel: "EMAIL", subject: "Un e-mail" }, 2);
      await log(page.request, { personId: ana, channel: "PHONE", subject: "Al doilea apel" }, 1);

      // Step 1 — scoped to Ioana, the chip „Telefon": two rows, newest first.
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/interactions?person=${ana}`);
      await page.locator('[data-channel-chips] label[data-channel-chip="PHONE"]').click();
      const subjects = page.locator("[data-history-grid] tbody tr[data-interaction-row] [data-subject]");
      await expect(subjects).toHaveText(["Al doilea apel", "Primul apel"], { timeout: 30_000 });

      // Step 2 — „Exportă": a file interactiuni-<date>.csv.
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Exportă", exact: true }).click();
      const file = await download;
      expect(file.suggestedFilename()).toMatch(/^interactiuni-\d{4}-\d{2}-\d{2}\.csv$/);
      const bytes = fs.readFileSync(await file.path());

      // Step 3 — what the file holds: UTF-8 with its mark, „;" between cells, the two rows in the grid's order,
      // the description whole in one cell, no internal note.
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const rows = parse(bytes.toString("utf8").slice(1));
      expect(rows[0]).toEqual(["Data și ora", "Canal", "Sens", "Persoană", "Subiect", "Descriere", "Acte legate", "Stare", "Memento", "Etichete"]);
      expect(rows.slice(1).map((r) => r[4])).toEqual(["Al doilea apel", "Primul apel"]);
      expect(rows.slice(1).map((r) => r[1])).toEqual(["Telefon", "Telefon"]);
      expect(rows[2][5]).toBe(TRICKY);
      expect(rows[1][0]).toMatch(/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/);
      expect(bytes.toString("utf8")).not.toContain("Doar pentru echipă");
    } finally {
      await removeRecord(page.request, "person", ana);
    }
  });
});
