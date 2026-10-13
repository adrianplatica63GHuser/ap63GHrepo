/**
 * src/lib/costs/tests-ledger.ts                                    (Slice #39.19)
 *
 * The test runner's ledger on this machine, `.test-runner/google-maps-month.json`
 * (Slices #39.16, #39.18), as „Setări → Costuri" reads it — absent anywhere but
 * Adrian's laptop. Server-side only, and apart from `./load.ts` because it needs
 * no database.
 */
import fs from "node:fs";
import path from "node:path";
import type { TestsGoogle } from "./summary";

/**
 * The runner's month of tests' Google use — maps, and since Slice #39.18 Street View panoramas and address look-ups —
 * or null where there is no runner (any machine but Adrian's laptop). A count the ledger does not carry is null:
 * „not counted", never zero.
 */
export function testsGoogleThisMonth(root: string = process.cwd()): TestsGoogle | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, ".test-runner", "google-maps-month.json"), "utf8").replace(/^\uFEFF/, "")) as {
      month?: unknown;
      maps?: unknown;
      streetView?: unknown;
      addressLookups?: unknown;
    };
    if (typeof raw.month !== "string" || typeof raw.maps !== "number") return null;
    const count = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
    return { month: raw.month, maps: raw.maps, streetView: count(raw.streetView), addressLookups: count(raw.addressLookups) };
  } catch {
    return null;
  }
}
