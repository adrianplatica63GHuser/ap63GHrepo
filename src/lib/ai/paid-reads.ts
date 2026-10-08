/**
 * Every paid read, recorded; this month's, counted.               (Slice #38.40)
 *
 * „Setări → AI" shows how many reads the application paid for this month.
 * Nothing recorded them before, so `ai_paid_read` (migration_100) gets one row
 * per answer from the Anthropic Messages API, written here, after the call, by
 * every route that makes one. A network failure that never reached the API is
 * not a read and is not recorded; a refused call (an HTTP error) is recorded
 * with `success: false` and not counted.
 *
 * ⚠️ **A failed WRITE never fails the read it records.** The read has already
 * been paid for and its answer is what the user is waiting on; losing one row of
 * a monthly count is the cheaper loss. It is logged, never thrown.
 */

import { and, count, eq, gte, min } from "drizzle-orm";
import { db } from "@/db";
import { aiPaidRead } from "@/db/schema";
import { monthStart } from "./paid-read-month";

/** The routes that pay, by the name the count keeps. */
export type PaidReadRoute = "ai-interpret" | "read-sample" | "cluster" | "scan-folder" | "extract-id-card";

export async function recordPaidRead(read: { route: PaidReadRoute; model: string; success: boolean }): Promise<void> {
  try {
    await db.insert(aiPaidRead).values(read);
  } catch (err) {
    console.error(`[paid-reads] could not record a ${read.route} read:`, err);
  }
}


/** This month's successful reads, and when counting began (the first row ever), or null on any fault. */
export async function paidReadsThisMonth(now: Date = new Date()): Promise<{ count: number; since: string | null } | null> {
  try {
    const [month] = await db
      .select({ n: count() })
      .from(aiPaidRead)
      .where(and(eq(aiPaidRead.success, true), gte(aiPaidRead.at, monthStart(now))));
    const [first] = await db.select({ at: min(aiPaidRead.at) }).from(aiPaidRead);
    const since = first?.at ? new Date(first.at as unknown as string).toISOString() : null;
    return { count: Number(month?.n ?? 0), since };
  } catch (err) {
    console.error("[paid-reads] could not count:", err);
    return null;
  }
}
