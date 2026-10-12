/**
 * src/lib/costs/load.ts                                            (Slice #39.17)
 *
 * The reading behind „Setări → Costuri", server-side only: the paid AI reads
 * per day (`ai_paid_read`) and the tests' Google maps this month — the test
 * runner's ledger on this machine, `.test-runner/google-maps-month.json`
 * (Slice #39.16), absent anywhere else. No provider is called and no
 * credential is read: nothing here leaves the machine.
 */
import fs from "node:fs";
import path from "node:path";
import { eq, min, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiPaidRead } from "@/db/schema";

/** Successful paid reads per Toronto day, oldest first, and the first read ever — or empty on any fault. */
export async function aiReadsByDay(): Promise<{ days: { day: string; reads: number }[]; since: string | null }> {
  try {
    const day = sql<string>`to_char(${aiPaidRead.at} AT TIME ZONE 'America/Toronto', 'YYYY-MM-DD')`;
    const rows = await db
      .select({ day, reads: sql<number>`count(*)::int` })
      .from(aiPaidRead)
      .where(eq(aiPaidRead.success, true))
      .groupBy(day)
      .orderBy(day);
    const [first] = await db.select({ at: min(aiPaidRead.at) }).from(aiPaidRead);
    return {
      days: rows.map((r) => ({ day: String(r.day), reads: Number(r.reads) })),
      since: first?.at ? new Date(first.at as unknown as string).toISOString() : null,
    };
  } catch (err) {
    console.error("[costs] could not count the paid reads:", err);
    return { days: [], since: null };
  }
}

/** The runner's month of tests' maps, or null where there is no runner (any machine but Adrian's laptop). */
export function testsMapsThisMonth(root: string = process.cwd()): { month: string; maps: number } | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(root, ".test-runner", "google-maps-month.json"), "utf8")) as {
      month?: unknown;
      maps?: unknown;
    };
    return typeof raw.month === "string" && typeof raw.maps === "number" ? { month: raw.month, maps: raw.maps } : null;
  } catch {
    return null;
  }
}
